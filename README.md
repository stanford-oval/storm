# Storm CW API Documentation

The Storm CW API provides endpoints for article generation and citation finding. The API requires authentication using a Bearer token.

## Getting Started

Start the API server:

```bash
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

Dev background worker

```bash
celery -A tasks worker --pool=solo --loglevel=info
```

Production background worker doesn't need to be run with solo pool.

## Authentication

All API endpoints require a Bearer token for authentication. Add the token to your requests using the `Authorization` header:

```http
Authorization: Bearer your-api-token
```

## Environment Variables

The API requires the following environment variables:

- `API_TOKENS`: Comma-separated list of valid authentication tokens
- `OPEN_AI_KEY`: API key for OpenAI
- `DEFAULT_WEBHOOK_URL`: Default URL for article generation webhooks (optional)
- `SERPER_API_KEY` or `YDC_API_KEY`: API key for search functionality

## Endpoints

### 1. Generate Article (v2)

Generate a new article using STORM.

```http
POST /v2/generate-article
```

> **Note:** The `do_research` parameter must be set to `true` for the API to function properly. The other flags (`do_generate_outline`, `do_generate_article`, `do_polish_article`) are optional and can be set based on your needs.

**Request Body Parameters:**

- `topic` (string, required): The topic you want to generate an article about
- `webhook_url` (string, optional): URL where the final result will be sent
- `do_research` (boolean, required): Must be set to `true`. This flag enables the system to collect information about the topic through internet search and simulated expert conversations.
- `do_generate_outline` (boolean, optional): When `true`, generates a structured outline organizing the collected information hierarchically.
- `do_generate_article` (boolean, optional): When `true`, generates a full article based on the outline and collected information.
- `do_polish_article` (boolean, optional): When `true`, refines the generated article by adding a summary section and optionally removing duplicate content.
- `remove_duplicate` (boolean, optional): When `true`, removes any duplicate content during the polishing phase.
- `metadata` (object, optional): Additional metadata to be included with the request.
- `use_scholar` (boolean, optional, default: true): When `true`, uses Google Scholar search for research; otherwise uses regular Google search.
- `llm_provider` (string, optional, default: "openai"): Specifies the LLM provider to use. Supported options:
  - `"openai"`: Uses OpenAI models (default)

**Token Configuration Parameters:**

- `conv_simulator_max_tokens` (integer, optional, default: 500): Maximum tokens for conversation simulation
- `question_asker_max_tokens` (integer, optional, default: 500): Maximum tokens for question generation
- `outline_gen_max_tokens` (integer, optional, default: 400): Maximum tokens for outline generation
- `article_gen_max_tokens` (integer, optional, default: 700): Maximum tokens for article generation
- `article_polish_max_tokens` (integer, optional, default: 700): Maximum tokens for article polishing

**Request Body:**

```json
{
  "topic": "string",
  "webhook_url": "string (optional)",
  "do_research": true,
  "do_generate_outline": false,
  "do_generate_article": false,
  "do_polish_article": false,
  "remove_duplicate": false,
  "metadata": {},
  "use_scholar": true,
  "llm_provider": "openai",
  "conv_simulator_max_tokens": 500,
  "question_asker_max_tokens": 500,
  "outline_gen_max_tokens": 400,
  "article_gen_max_tokens": 700,
  "article_polish_max_tokens": 700
}
```

**Response:**

```json
{
  "status": "queued",
  "message": "Article generation has been queued and will be processed in the background"
}
```

The final result will be sent to the specified webhook URL with the following structure:

```json
{
  "status": "success",
  "result": {
    "content": content,
    "outline": outline if outline else None,
    "sources": sources,
    "polished_content": polished_content,
    "error": "error message if any"
  },
  "metadata": metadata attached to the request
}
```

> **Note:** The `sources` field contains a dictionary of citations used in the article, where each key is a citation identifier and the value contains the source's details including URL, title, snippet, and relevance score.

### 2. Find Citations (v2)

Find relevant citations for a given text.

```http
POST /v2/find-citations
```

**Request Body:**

```json
{
  "text": "string",
  "max_citations": 3,
  "exclude_urls": ["string"],
  "use_scholar": true
}
```

**Response:**

```json
{
  "citations": [
    {
      "url": "string",
      "title": "string",
      "snippet": "string",
      "relevance_score": 1.0
    }
  ],
  "error": "string (if any)"
}
```

### STORM examples

**To run STORM with `gpt` family models with default configurations:**

Run the following command.

```bash
python examples/storm_examples/run_storm_wiki_gpt.py \
    --output-dir $OUTPUT_DIR \
    --retriever you \
    --do-research \
    --do-generate-outline \
    --do-generate-article \
    --do-polish-article
```

**Response:**

```json
{
  "status": "healthy",
  "message": "API is running"
}
```

## Example Usage

Generate an article:

```bash
python examples/costorm_examples/run_costorm_gpt.py \
    --output-dir $OUTPUT_DIR \
    --retriever bing
```

## Customization of the Pipeline

### STORM

If you have installed the source code, you can customize STORM based on your own use case. STORM engine consists of 4 modules:

1. Knowledge Curation Module: Collects a broad coverage of information about the given topic.
2. Outline Generation Module: Organizes the collected information by generating a hierarchical outline for the curated knowledge.
3. Article Generation Module: Populates the generated outline with the collected information.
4. Article Polishing Module: Refines and enhances the written article for better presentation.

The interface for each module is defined in `knowledge_storm/interface.py`, while their implementations are instantiated in `knowledge_storm/storm_wiki/modules/*`. These modules can be customized according to your specific requirements (e.g., generating sections in bullet point format instead of full paragraphs).

### Co-STORM

If you have installed the source code, you can customize Co-STORM based on your own use case

1. Co-STORM introduces multiple LLM agent types (i.e. Co-STORM experts and Moderator). LLM agent interface is defined in `knowledge_storm/interface.py` , while its implementation is instantiated in `knowledge_storm/collaborative_storm/modules/co_storm_agents.py`. Different LLM agent policies can be customized.
2. Co-STORM introduces a collaborative discourse protocol, with its core function centered on turn policy management. We provide an example implementation of turn policy management through `DiscourseManager` in `knowledge_storm/collaborative_storm/engine.py`. It can be customized and further improved.

## Datasets

To facilitate the study of automatic knowledge curation and complex information seeking, our project releases the following datasets:

### FreshWiki

The FreshWiki Dataset is a collection of 100 high-quality Wikipedia articles focusing on the most-edited pages from February 2022 to September 2023. See Section 2.1 in [STORM paper](https://arxiv.org/abs/2402.14207) for more details.

You can download the dataset from [huggingface](https://huggingface.co/datasets/EchoShao8899/FreshWiki) directly. To ease the data contamination issue, we archive the [source code](https://github.com/stanford-oval/storm/tree/NAACL-2024-code-backup/FreshWiki) for the data construction pipeline that can be repeated at future dates.

### WildSeek

To study users' interests in complex information seeking tasks in the wild, we utilized data collected from the web research preview to create the WildSeek dataset. We downsampled the data to ensure the diversity of the topics and the quality of the data. Each data point is a pair comprising a topic and the user's goal for conducting deep search on the topic. For more details, please refer to Section 2.2 and Appendix A of [Co-STORM paper](https://www.arxiv.org/abs/2408.15232).

The WildSeek dataset is available [here](https://huggingface.co/datasets/YuchengJiang/WildSeek).

## Replicate STORM & Co-STORM paper result

For STORM paper experiments, please switch to the branch `NAACL-2024-code-backup` [here](https://github.com/stanford-oval/storm/tree/NAACL-2024-code-backup).

For Co-STORM paper experiments, please switch to the branch `EMNLP-2024-code-backup` (placeholder for now, will be updated soon).

## Roadmap & Contributions

Our team is actively working on:

1. Human-in-the-Loop Functionalities: Supporting user participation in the knowledge curation process.
2. Information Abstraction: Developing abstractions for curated information to support presentation formats beyond the Wikipedia-style report.

If you have any questions or suggestions, please feel free to open an issue or pull request. We welcome contributions to improve the system and the codebase!

Contact person: [Yijia Shao](mailto:shaoyj@stanford.edu) and [Yucheng Jiang](mailto:yuchengj@stanford.edu)

## Acknowledgement

We would like to thank Wikipedia for its excellent open-source content. The FreshWiki dataset is sourced from Wikipedia, licensed under the Creative Commons Attribution-ShareAlike (CC BY-SA) license.

We are very grateful to [Michelle Lam](https://michelle123lam.github.io/) for designing the logo for this project and [Dekun Ma](https://dekun.me) for leading the UI development.

## Citation

Please cite our paper if you use this code or part of it in your work:

```bibtex
@misc{jiang2024unknownunknowns,
      title={Into the Unknown Unknowns: Engaged Human Learning through Participation in Language Model Agent Conversations},
      author={Yucheng Jiang and Yijia Shao and Dekun Ma and Sina J. Semnani and Monica S. Lam},
      year={2024},
      eprint={2408.15232},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2408.15232},
}

@inproceedings{shao2024assisting,
      title={{Assisting in Writing Wikipedia-like Articles From Scratch with Large Language Models}},
      author={Yijia Shao and Yucheng Jiang and Theodore A. Kanell and Peter Xu and Omar Khattab and Monica S. Lam},
      year={2024},
      booktitle={Proceedings of the 2024 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies, Volume 1 (Long and Short Papers)}
}
```
