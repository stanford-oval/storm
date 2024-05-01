"""Compute article quality metrics on a dataset.

The script expects
    - a CSV file (args.input_path) with a column 'topic' containing the topics for evaluation.
    - a directory (args.gt_dir) containing human-written articles. The articles should be named as txt/{topic_name}.txt
        and there should be a json file named json/{topic_name}.json containing the named entities in the article.
    - a directory (args.pred_dir) containing generated articles. The outlines should be named as {topic_name}/{args.pred_file_name}.
"""

import argparse
import json
import logging
import os

import pandas as pd
from tqdm import tqdm
from transformers import AutoTokenizer, LlamaForCausalLM

from evaluation_prometheus import get_grading_dict, preprocess_text
from evaluation_trim_length import process_document
from metrics import article_entity_recall, compute_rouge_scores

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


class ColoredFormatter(logging.Formatter):
    COLORS = {
        'WARNING': '\033[93m',  # Yellow
        'INFO': '\033[97m',  # White
        'DEBUG': '\033[92m',  # Green
        'CRITICAL': '\033[94m',  # Blue
        'ERROR': '\033[91m',  # Red
        'RESET': '\033[0m',  # Reset
    }

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        record.levelname = color + record.levelname + self.COLORS['RESET']
        record.msg = color + str(record.msg) + self.COLORS['RESET']
        return super().format(record)


def load_str(path):
    with open(path, 'r') as f:
        return '\n'.join(f.readlines())


def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)


def dump_json(data, path):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


def assert_int(x):
    try:
        int(x)
        return True
    except:
        return False


def main(args):
    logger.info(f"loading tokenizer {args.tokenizer} and model {args.model}")
    tokenizer = AutoTokenizer.from_pretrained(args.tokenizer)
    model = LlamaForCausalLM.from_pretrained(args.model, device_map="auto")

    df = pd.read_csv(args.input_path)

    aggregated_results = {}

    for i, row in tqdm(df.iterrows()):
        import pdb
        pdb.set_trace()
        topic = row['topic']
        topic_name = topic.replace(" ", "_").replace("/", "_")
        llm_output_path = os.path.join(args.pred_dir, topic_name, args.pred_file_name)
        assert os.path.exists(llm_output_path), f"llm output path not exists {llm_output_path}"

        golden_answer_json = load_json(os.path.join(args.gt_dir, 'json', topic_name + '.json'))
        golden_answer = load_str(os.path.join(args.gt_dir, 'txt', topic_name + '.txt'))
        golden_answer = preprocess_text(golden_answer)
        llm_output = load_str(llm_output_path)
        llm_output = preprocess_text(llm_output)
        output_file_path = os.path.join(args.result_output_dir, f"{topic_name}.json")

        # Prometheus model has a limited context window.
        trimmed_output_for_rubric_grading = process_document(llm_output_path, max_words=2000)

        evaluation_main_dict = {"topic": topic, "grading": {}}

        # Get rubric grading.
        logger.info(f"Processing rubric grading.")
        grading_dict = get_grading_dict(responses=[trimmed_output_for_rubric_grading],
                                        topic=topic,
                                        tokenizer=tokenizer,
                                        model=model,
                                        prompt_template_path=args.prompt_template_path,
                                        rubric_path=args.rubric_path,
                                        logger=logger)

        for criteria_description, response_grading_dict in grading_dict.items():
            for response_idx, feedback_dict in response_grading_dict.items():
                if 'rubric_grading' not in evaluation_main_dict["grading"]:
                    evaluation_main_dict["grading"] = {"rubric_grading": {criteria_description: feedback_dict}}
                else:
                    evaluation_main_dict["grading"]["rubric_grading"][criteria_description] = feedback_dict

        # get automatic evaluation score
        logger.info(f"Processing automatic evaluation.")
        automatic_evaluation_score = compute_rouge_scores(predicted_answer=llm_output, golden_answer=golden_answer)
        evaluation_main_dict["grading"]["auto_grading"] = automatic_evaluation_score

        # get named entity overlap with golden answer
        logger.info(f"Processing entity overlap with ground truth")
        evaluation_main_dict["grading"]["entity_recall"] = article_entity_recall(
            golden_entities=golden_answer_json['flair_entities'],
            predicted_article=llm_output
        )

        dump_json(evaluation_main_dict, output_file_path)

        if len(aggregated_results) == 0:
            for k in evaluation_main_dict['grading']['rubric_grading']:
                aggregated_results[k] = [evaluation_main_dict['grading']['rubric_grading'][k]]
            for k in evaluation_main_dict['grading']['auto_grading']:
                aggregated_results[k] = [evaluation_main_dict['grading']['auto_grading'][k]]
            aggregated_results['entity_recall'] = [evaluation_main_dict['grading']['entity_recall']]
        else:
            for k in evaluation_main_dict['grading']['rubric_grading']:
                aggregated_results[k].append(evaluation_main_dict['grading']['rubric_grading'][k])
            for k in evaluation_main_dict['grading']['auto_grading']:
                aggregated_results[k].append(evaluation_main_dict['grading']['auto_grading'][k])
            aggregated_results['entity_recall'].append(evaluation_main_dict['grading']['entity_recall'])

    # compute average score
    logger.info(f"Computing average score.")
    avg_results = {}
    for k in aggregated_results:
        if type(aggregated_results[k][0]) is dict:
            avg_results[k] = sum([float(x['score']) for x in aggregated_results[k]]) / len(aggregated_results[k])
        else:
            avg_results[k] = sum(aggregated_results[k]) / len(aggregated_results[k])
        print(f"{k}: {avg_results[k]}")
    dump_json(avg_results, os.path.join(args.result_output_dir, "avg_results.json"))


if __name__ == "__main__":
    # configure logger
    global logger
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)
    console_handler = logging.StreamHandler()
    formatter = ColoredFormatter('%(levelname)s: %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # command line argument
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-path', type=str,
                        help='Using csv file to store topic and ground truth url at present.')
    parser.add_argument('--pred-dir',
                        help='Directory to the file containing the LLM output.')
    parser.add_argument('--gt-dir',
                        help='Directory to the file containing the human-written articles.')
    parser.add_argument('--result-output-dir',
                        help='Directory to store the evaluation results. '
                             'Each article evaluation will be saved as separate file named after {topic_name}.json')
    parser.add_argument('--pred-file-name', help='Name of the article file.')
    parser.add_argument("--prompt-template-path", default="./eval_prometheus_no_ref.prompt",
                        help='path to evaluation prometheus prompt template')
    parser.add_argument("--rubric-path", default="./eval_rubric_5.json", help='path to rubric json file')

    parser.add_argument('--tokenizer', default="meta-llama/Llama-2-7b-chat-hf")
    parser.add_argument('--model',
                        choices=["prometheus-eval/prometheus-13b-v1.0", "prometheus-eval/prometheus-7b-v1.0"],
                        default="prometheus-eval/prometheus-13b-v1.0",
                        help="Model to use for rubric evaluation.")
    args = parser.parse_args()

    # check output directory
    if not os.path.exists(args.result_output_dir):
        os.makedirs(args.result_output_dir)
        logger.info(f"Directory {args.result_output_dir} created.")

    main(args)
