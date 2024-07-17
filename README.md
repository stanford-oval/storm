<p align="center">
  <img src="assets/logo.svg" style="width: 25%; height: auto;">
</p>

# STORM: Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking

<p align="center">
| <a href="http://storm.genie.stanford.edu"><b>Research preview</b></a> | <a href="https://arxiv.org/abs/2402.14207"><b>Paper</b></a> | <a href="https://storm-project.stanford.edu/"><b>Website</b></a> |
</p>

**Latest News** 🔥

- [2024/07] You can now install our package with `pip install knowledge-storm`!
- [2024/07] We add `VectorRM` to support grounding on user-provided documents, complementing existing support of search engines (`YouRM`, `BingSearch`). (check out [#58](https://github.com/stanford-oval/storm/pull/58))
- [2024/07] We release demo light for developers a minimal user interface built with streamlit framework in Python, handy for local development and demo hosting (checkout [#54](https://github.com/stanford-oval/storm/pull/54))
- [2024/06] We will present STORM at NAACL 2024! Find us at Poster Session 2 on June 17 or check our [presentation material](assets/storm_naacl2024_slides.pdf). 
- [2024/05] We add Bing Search support in [rm.py](knowledge_storm/rm.py). Test STORM with `GPT-4o` - we now configure the article generation part in our demo using `GPT-4o` model.
- [2024/04] We release refactored version of STORM codebase! We define [interface](knowledge_storm/interface.py) for STORM pipeline and reimplement STORM-wiki (check out [`src/storm_wiki`](knowledge_storm/storm_wiki)) to demonstrate how to instantiate the pipeline. We provide API to support customization of different language models and retrieval/search integration.

## Overview [(Try STORM now!)](https://storm.genie.stanford.edu/)

<p align="center">
  <img src="assets/overview.svg" style="width: 90%; height: auto;">
</p>
STORM is a LLM system that writes Wikipedia-like articles from scratch based on Internet search.

While the system cannot produce publication-ready articles that often require a significant number of edits, experienced Wikipedia editors have found it helpful in their pre-writing stage.

**Try out our [live research preview](https://storm.genie.stanford.edu/) to see how STORM can help your knowledge exploration journey and please provide feedback to help us improve the system 🙏!**



## How STORM works

STORM breaks down generating long articles with citations into two steps:
1. **Pre-writing stage**: The system conducts Internet-based research to collect references and generates an outline.
2. **Writing stage**: The system uses the outline and references to generate the full-length article with citations.
<p align="center">
  <img src="assets/two_stages.jpg" style="width: 60%; height: auto;">
</p>

STORM identifies the core of automating the research process as automatically coming up with good questions to ask. Directly prompting the language model to ask questions does not work well. To improve the depth and breadth of the questions, STORM adopts two strategies:
1. **Perspective-Guided Question Asking**: Given the input topic, STORM discovers different perspectives by surveying existing articles from similar topics and uses them to control the question-asking process.
2. **Simulated Conversation**: STORM simulates a conversation between a Wikipedia writer and a topic expert grounded in Internet sources to enable the language model to update its understanding of the topic and ask follow-up questions.

Based on the separation of the two stages, STORM is implemented in a highly modular way using [dspy](https://github.com/stanfordnlp/dspy).



## Installation


To install the knowledge storm library, use `pip install knowledge-storm`. 

You could also install the source code which allows you to modify the behavior of STORM engine directly.
1. Clone the git repository.
    ```shell
    git clone https://github.com/stanford-oval/storm.git
    cd storm
    ```
   
2. Install the required packages.
   ```shell
   conda create -n storm python=3.11
   conda activate storm
   pip install -r requirements.txt
   ```
   

## API
The STORM knowledge curation engine is defined as a simple Python `STORMWikiRunner` class.

As STORM is working in the information curation layer, you need to set up the information retrieval module and language model module to create a `STORMWikiRunner` instance. Here is an example of using You.com search engine and OpenAI models.
```python
import os
from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.lm import OpenAIModel
from knowledge_storm.rm import YouRM

lm_configs = STORMWikiLMConfigs()
openai_kwargs = {
    'api_key': os.getenv("OPENAI_API_KEY"),
    'temperature': 1.0,
    'top_p': 0.9,
}
# STORM is a LM system so different components can be powered by different models to reach a good balance between cost and quality.
# For a good practice, choose a cheaper/faster model for `conv_simulator_lm` which is used to split queries, synthesize answers in the conversation. Choose a more powerful model for `article_gen_lm` to generate verifiable text with citations.
gpt_35 = OpenAIModel(model='gpt-3.5-turbo', max_tokens=500, **openai_kwargs)
gpt_4 = OpenAIModel(model='gpt-4-o', max_tokens=3000, **openai_kwargs)
lm_configs.set_conv_simulator_lm(gpt_35)
lm_configs.set_question_asker_lm(gpt_35)
lm_configs.set_outline_gen_lm(gpt_4)
lm_configs.set_article_gen_lm(gpt_4)
lm_configs.set_article_polish_lm(gpt_4)
# Check out the STORMWikiRunnerArguments class for more configurations.
engine_args = STORMWikiRunnerArguments(...)
rm = YouRM(ydc_api_key=os.getenv('YDC_API_KEY'), k=engine_args.search_top_k)
runner = STORMWikiRunner(engine_args, lm_configs, rm)
```

Currently, our package support:
- `OpenAIModel`, `AzureOpenAIModel`, `ClaudeModel`, `VLLMClient`, `TGIClient`, `TogetherClient`, `OllamaClient` as language model components
- `YouRM`, `BingSearch`, `VectorRM` as retrieval module components

:star2: **PRs for integrating more language models into [knowledge_storm/lm.py](knowledge_storm/lm.py) and search engines/retrievers into [knowledge_storm/rm.py](knowledge_storm/rm.py) are highly appreciated!**

The `STORMWikiRunner` instance can be evoked with the simple `run` method:
```python
topic = input('Topic: ')
runner.run(
    topic=topic,
    do_research=True,
    do_generate_outline=True,
    do_generate_article=True,
    do_polish_article=True,
)
runner.post_run()
runner.summary()
```
- `do_research`: if True, simulate conversations with difference perspectives to collect information about the topic; otherwise, load the results.
- `do_generate_outline`: if True, generate an outline for the topic; otherwise, load the results.
- `do_generate_article`: if True, generate an article for the topic based on the outline and the collected information; otherwise, load the results.
- `do_polish_article`: if True, polish the article by adding a summarization section and (optionally) removing duplicate content; otherwise, load the results.


## Quick Start with Example Scripts

We provide scripts in our [examples folder](examples) as a quick start to run STORM with different configurations.

**To run STORM with `gpt` family models with default configurations:**
1. We suggest using `secrets.toml` to set up the API keys. Create a file `secrets.toml` under the root directory and add the following content:
    ```shell
    # Set up OpenAI API key.
    OPENAI_API_KEY="your_openai_api_key"
    # If you are using the API service provided by OpenAI, include the following line:
    OPENAI_API_TYPE="openai"
    # If you are using the API service provided by Microsoft Azure, include the following lines:
    OPENAI_API_TYPE="azure"
    AZURE_API_BASE="your_azure_api_base_url"
    AZURE_API_VERSION="your_azure_api_version"
    # Set up You.com search API key.
    YDC_API_KEY="your_youcom_api_key"
    ```
2. Run the following command.
    ```
    python examples/run_storm_wiki_gpt.py \
        --output-dir $OUTPUT_DIR \
        --retriever you \
        --do-research \
        --do-generate-outline \
        --do-generate-article \
        --do-polish-article
    ```

**To run STORM using your favorite language models or grounding on your own corpus:** Check out [examples/README.md](examples/README.md).


## Customization of the Pipeline

If you have installed the source code, you can customize STORM based on your own use case. STORM engine consists of 4 modules:

1. Knowledge Curation Module: Collects a broad coverage of information about the given topic.
2. Outline Generation Module: Organizes the collected information by generating a hierarchical outline for the curated knowledge.
3. Article Generation Module: Populates the generated outline with the collected information.
4. Article Polishing Module: Refines and enhances the written article for better presentation.

The interface for each module is defined in `knowledge_storm/interface.py`, while their implementations are instantiated in `knowledge_storm/storm_wiki/modules/*`. These modules can be customized according to your specific requirements (e.g., generating sections in bullet point format instead of full paragraphs).


## Replicate NAACL2024 result

Please switch to the branch `NAACL-2024-code-backup` 

<details>
  <summary>Show me instructions</summary>

### Paper Experiments

The FreshWiki dataset used in our experiments can be found in [./FreshWiki](FreshWiki).
    
Run the following commands under [./src](knowledge_storm).

#### Pre-writing Stage
For batch experiment on FreshWiki dataset:
```shell
python -m scripts.run_prewriting --input-source file --input-path ../FreshWiki/topic_list.csv  --engine gpt-4 --do-research --max-conv-turn 5 --max-perspective 5
```
- `--engine` (choices=[`gpt-4`, `gpt-35-turbo`]): the LLM engine used for generating the outline
- `--do-research`: if True, simulate conversation to research the topic; otherwise, load the results.
- `--max-conv-turn`: the maximum number of questions for each information-seeking conversation
- `--max-perspective`: the maximum number of perspectives to be considered, each perspective corresponds to an information-seeking conversation. 
  - STORM also uses a general conversation to collect basic information about the topic. So, the maximum number of QA pairs is `max_turn * (max_perspective + 1)`. :bulb: Reducing `max_turn` or `max_perspective` can speed up the process and reduce the cost but may result in less comprehensive outline.
  - The parameter will not have any effect if `--disable-perspective` is set (the perspective-driven question asking is disabled).

To run the experiment on a single topic:
```shell
python -m scripts.run_prewriting --input-source console --engine gpt-4 --max-conv-turn 5 --max-perspective 5 --do-research
```
- The script will ask you to enter the `Topic` and the `Ground truth url` that will be excluded. If you do not have any url to exclude, leave that field empty.

The generated outline will be saved in `{output_dir}/{topic}/storm_gen_outline.txt` and the collected references will be saved in `{output_dir}/{topic}/raw_search_results.json`.


#### Writing Stage
For batch experiment on FreshWiki dataset:
```shell
python -m scripts.run_writing --input-source file --input-path ../FreshWiki/topic_list.csv --engine gpt-4 --do-polish-article --remove-duplicate
```
- `--do-polish-article`: if True, polish the article by adding a summarization section and removing duplicate content if `--remove-duplicate` is set True.

To run the experiment on a single topic:
```shell
python -m scripts.run_writing --input-source console --engine gpt-4 --do-polish-article --remove-duplicate
```
- The script will ask you to enter the `Topic`. Please enter the same topic as the one used in the pre-writing stage.

The generated article will be saved in `{output_dir}/{topic}/storm_gen_article.txt` and the references corresponding to citation index will be saved in `{output_dir}/{topic}/url_to_info.json`. If `--do-polish-article` is set, the polished article will be saved in `{output_dir}/{topic}/storm_gen_article_polished.txt`. 

### Customize the STORM Configurations
We set up the default LLM configuration in `LLMConfigs` in [src/modules/utils.py](knowledge_storm/modules/utils.py). You can use `set_conv_simulator_lm()`,`set_question_asker_lm()`, `set_outline_gen_lm()`, `set_article_gen_lm()`, `set_article_polish_lm()` to override the default configuration. These functions take in an instance from `dspy.dsp.LM` or `dspy.dsp.HFModel`.


### Automatic Evaluation

In our paper, we break down the evaluation into two parts: outline quality and full-length article quality.

#### Outline Quality
We introduce *heading soft recall* and *heading entity recall* to evaluate the outline quality. This makes it easier to prototype methods for pre-writing.

Run the following command under [./eval](eval) to compute the metrics on FreshWiki dataset:
```shell
python eval_outline_quality.py --input-path ../FreshWiki/topic_list.csv --gt-dir ../FreshWiki --pred-dir ../results --pred-file-name storm_gen_outline.txt --result-output-path ../results/storm_outline_quality.csv
```

#### Full-length Article Quality
[eval/eval_article_quality.py](eval/eval_article_quality.py) provides the entry point of evaluating full-length article quality using ROUGE, entity recall, and rubric grading. Run the following command under `eval` to compute the metrics:
```shell
python eval_article_quality.py --input-path ../FreshWiki/topic_list.csv --gt-dir ../FreshWiki --pred-dir ../results --gt-dir ../FreshWiki --output-dir ../results/storm_article_eval_results --pred-file-name storm_gen_article_polished.txt
```

#### Use the Metric Yourself
The similarity-based metrics (i.e., ROUGE, entity recall, and heading entity recall) are implemented in [eval/metrics.py](eval/metrics.py).

For rubric grading, we use the [prometheus-13b-v1.0](https://huggingface.co/prometheus-eval/prometheus-13b-v1.0) introduced in [this paper](https://arxiv.org/abs/2310.08491). [eval/evaluation_prometheus.py](eval/evaluation_prometheus.py) provides the entry point of using the metric.

</details>

## Roadmap & Contributions
Our team is actively working on:
1. Human-in-the-Loop Functionalities: Supporting user participation in the knowledge curation process.
2. Information Abstraction: Developing abstractions for curated information to support presentation formats beyond the Wikipedia-style report.

If you have any questions or suggestions, please feel free to open an issue or pull request. We welcome contributions to improve the system and the codebase!

Contact person: [Yijia Shao](mailto:shaoyj@stanford.edu) and [Yucheng Jiang](mailto:yuchengj@stanford.edu)

## Acknowledgement
We would like to thank Wikipedia for their excellent open-source content. The FreshWiki dataset is sourced from Wikipedia, licensed under the Creative Commons Attribution-ShareAlike (CC BY-SA) license.

We are very grateful to [Michelle Lam](https://michelle123lam.github.io/) for designing the logo for this project and [Dekun Ma](https://dekun.me) for leading the UI development.

## Citation
Please cite our paper if you use this code or part of it in your work:
```bibtex
@inproceedings{shao2024assisting,
      title={{Assisting in Writing Wikipedia-like Articles From Scratch with Large Language Models}}, 
      author={Yijia Shao and Yucheng Jiang and Theodore A. Kanell and Peter Xu and Omar Khattab and Monica S. Lam},
      year={2024},
      booktitle={Proceedings of the 2024 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies, Volume 1 (Long and Short Papers)}
}
```
