import argparse
import copy
import glob
import json
import logging
import os
import re

from fastchat.conversation import get_conv_template
from transformers import AutoTokenizer, LlamaForCausalLM

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def read_txt_file(file_path):
    """
    Read a text file to string
    """
    with open(file_path, 'r') as file:
        return file.read()


def read_json(file_path):
    """
    Read a json file to dict
    """
    with open(file_path, 'r') as file:
        return json.load(file)


def preprocess_text(text):
    """
    Clean up text: remove reference section, URLS, non-ascii chars
    """
    # clean up empty line
    paragraphs = text.split("\n")
    paragraphs = [i for i in paragraphs if len(i) > 0]
    # clean up section title and remove reference section
    cleaned_pargraphs = []
    for i in paragraphs:
        if i == "# References":
            break
        if i.startswith("#"):
            i = "section: " + i.replace("#", "").strip()
        cleaned_pargraphs.append(i)
    text = "\n".join(cleaned_pargraphs)
    # remove URLS
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    # remove non-ascii char
    text = re.sub(r'[^\x00-\x7F]+', '', text)
    # remove citation bracket (e.g. [10])
    text = re.sub(r'\[\d+\]', '', text)
    # remove non alphanumeric char
    text = re.sub(r'[^\w\s]', '', text)
    return text


def get_conversation_prompt(filled_prompt):
    """
    From filled prompt, convert it into llama-2 conversation prompt
    """
    conv = get_conv_template("llama-2")
    conv.set_system_message("You are a fair evaluator language model.")
    conv.append_message(conv.roles[0], filled_prompt)
    conv.append_message(conv.roles[1], None)
    prompt = conv.get_prompt()
    return prompt


def format_prompt(prompt_template, topic, rubric, response):
    """
    Fill prompt_template with rubric and response
    """
    prompt_template_copy = copy.deepcopy(prompt_template)
    data = copy.deepcopy(rubric)
    data.update({
        "instruction": f"You are a Wikipedia editor. Your task is write a wikipedia page for the topic: {topic}",
        "response": response
    })
    filled_prompt = prompt_template_copy.format(**data)
    return get_conversation_prompt(filled_prompt)


def get_grading_dict(responses,
                     topic,
                     tokenizer,
                     model,
                     prompt_template_path="./eval_prometheus_no_ref.prompt",
                     rubric_path="./eval_rubric_5.json",
                     disable_sample=False,
                     temperature=0.01,
                     top_p=0.95,
                     max_new_tokens=512,
                     repetition_penalty=1.03,
                     logger=None):
    grading = {}
    prompt_template = read_txt_file(prompt_template_path)
    rubrics = read_json(rubric_path)

    # Read all files in the given directory
    for rubric_idx, rubric in enumerate(rubrics):
        grading[rubric["criteria_description"]] = {}
        for response_idx, response in enumerate(responses):
            # generate evaluation prompt and tokenize
            if logger is not None:
                logger.info(
                    f"processing for rubric {rubric_idx + 1}/{len(rubrics)}, response {response_idx + 1}/{len(responses)}, response length: {len(response)}")
            prompt = format_prompt(prompt_template=prompt_template, topic=topic, rubric=rubric, response=response)
            input_ids = tokenizer(prompt, return_tensors="pt").input_ids.to('cuda')
            # geenrate output
            outputs = model.generate(input_ids,
                                     pad_token_id=tokenizer.eos_token_id,
                                     do_sample=not disable_sample,
                                     temperature=temperature,
                                     top_p=top_p,
                                     max_new_tokens=max_new_tokens,
                                     repetition_penalty=repetition_penalty)
            decoded_output = tokenizer.decode(outputs[0])
            # decode output and format into desired fields
            decoded_output = decoded_output[decoded_output.find("[/INST]") + len("[/INST]"):].strip()
            feedback = decoded_output[:decoded_output.find("[RESULT]")]
            score = decoded_output[decoded_output.find("[RESULT]") + len("[RESULT]"):].replace("</s>", "").strip()
            try:
                int(score)
            except Exception as e:
                pattern = r"the overall score is (\d+)"
                match = re.search(pattern, feedback)
                if match:
                    score = match.group(1)

            grading[rubric["criteria_description"]][response_idx] = {"feedback": feedback, "score": score}
    return grading


def main(args):
    tokenizer = AutoTokenizer.from_pretrained(args.tokenizer)
    model = LlamaForCausalLM.from_pretrained(args.model, device_map="auto")

    doc_paths = glob.glob(os.path.join(args.batch_process_dir, "*.txt"))
    responses = [preprocess_text(read_txt_file(doc_path)) for doc_path in doc_paths]

    grading = get_grading_dict(responses=responses,
                               topic=args.topic,
                               tokenizer=tokenizer,
                               model=model,
                               prompt_template_path=args.prompt_template_path,
                               rubric_path=args.rubric_path,
                               disable_sample=args.disable_sample,
                               temperature=args.temperature,
                               top_p=args.top_p,
                               max_new_tokens=args.max_new_tokens,
                               repetition_penalty=args.repetition_penalty,
                               logger=logger)

    # Save grading dictionary to output path
    with open(args.output_path, 'w') as outfile:
        json.dump(grading, outfile, indent=2)
        logger.info("Grading complete. Output saved to: %s", args.output_path)


if __name__ == "__main__":
    global logger
    parser = argparse.ArgumentParser(description='Process some files.')
    parser.add_argument('-b', '--batch_process_dir', required=True, help='Directory of files to process')
    parser.add_argument('-o', '--output_path', required=True, help='Path to save the output JSON file')
    parser.add_argument('-t', "--topic", required=True, help="Topic of the script your going to analyze")

    parser.add_argument("--prompt_template_path", default="./eval_prometheus_no_ref.prompt",
                        help='path to evaluation prometheus prompt template')
    parser.add_argument("--rubric_path", default="./prompts/eval_rubric_5.json", help='path to rubric json file')

    parser.add_argument('--tokenizer', default="meta-llama/Llama-2-7b-chat-hf")
    parser.add_argument('--model',
                        choices=["prometheus-eval/prometheus-13b-v1.0", "prometheus-eval/prometheus-7b-v1.0"],
                        default="prometheus-eval/prometheus-13b-v1.0",
                        help="Model to use; options are 'prometheus-eval/prometheus-13b-v1.0' or 'prometheus-eval/prometheus-7b-v1.0'")
    parser.add_argument('--disable_sample', action='store_true', help='Whether to disable sampling; default is False')
    parser.add_argument('--temperature', type=float, default=0.01, help='Temperature for generation; default is 0.01')
    parser.add_argument('--top_p', type=float, default=0.95, help='Top P for generation; default is 0.95')
    parser.add_argument('--max_new_tokens', type=int, default=512,
                        help='Maximum new tokens to generate; default is 512')
    parser.add_argument('--repetition_penalty', type=float, default=1.03, help='Repetition penalty; default is 1.03')
    args = parser.parse_args()

    logger = logging.getLogger(__name__)

    assert os.path.exists(args.batch_process_dir), f"batch_process_dir: {args.batch_process_dir} not exists"
    assert not os.path.isdir(args.output_path), "The specified output path is a directory. Please provide a file path."
    output_directory = os.path.dirname(args.output_path)
    if not os.path.exists(output_directory):
        os.makedirs(output_directory, exist_ok=True)
        logger.info("Created directory: %s", output_directory)
    # Check if the file exists and ask for user confirmation to override
    if os.path.exists(args.output_path):
        overwrite = input(f"The file {args.output_path} already exists. Do you want to overwrite it? (y/n): ")
        if overwrite.lower() != 'y':
            logger.info("User chose not to overwrite the existing file. Exiting.")
            exit()

    main(args)
