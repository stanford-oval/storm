---
name: storm
description: Use when running STORM/Co-STORM from Hermes.
version: 1.0.0
author: Sean Kilfoy
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [storm, knowledge-curation, storm-wiki, costorm, llm-research, citations]
    related_skills: [corpus-knowledge-base-construction, agent-native-research-workflows, jupyter-notebook, local-web-crawling]
    source_repo: https://github.com/skilfoy/storm
    upstream_repo: https://github.com/stanford-oval/storm
---

# STORM Skill for Hermes Agent

## Overview

This skill integrates **STORM** (Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking) and **Co-STORM** (Collaborative STORM) into Hermes Agent. STORM is Stanford's LLM-powered knowledge curation system that researches a topic and generates a full-length Wikipedia-style article with citations. Co-STORM adds human-AI collaborative knowledge curation.

**Upstream:** `stanford-oval/storm` | **Fork:** `skilfoy/storm` | **Package:** `pip install knowledge-storm`

## When to Use

- Generating Wikipedia-style articles with citations from web research
- Collaborative human-AI knowledge curation (Co-STORM)
- Running STORM with custom LLMs (OpenAI, Anthropic, local models via Ollama/vLLM/TGI)
- Using custom corpora via VectorRM (Qdrant-backed)
- Adding new retrieval models (search engines) or language model backends

## Prerequisites

```bash
# System dependencies
conda create -n storm python=3.11
conda activate storm
pip install -r requirements.txt
pip install pre-commit && pre-commit install  # formats knowledge_storm/ with black

# API keys managed via secrets.toml (see examples/storm_examples/)
# Required: OPENAI_API_KEY or ANTHROPIC_API_KEY, plus at least one search API:
# YDC_API_KEY (You.com), BING_SEARCH_API_KEY, BRAVE_API_KEY, SERPER_API_KEY,
# TAVILY_API_KEY, SEARXNG_API_KEY, AZURE_AI_SEARCH_API_KEY
```

## Quick Start — STORM Wiki (Automated)

```bash
# From repo root
python examples/storm_examples/run_storm_wiki_gpt.py \
  --output-dir ./results/gpt \
  --retriever you \
  --do-research \
  --do-generate-outline \
  --do-generate-article \
  --do-polish-article
# Then enter topic at prompt, e.g. "Retrieval-augmented generation"
```

Output appears in `./results/gpt/<topic_name>/`:
- `storm_gen_article.txt` — final article
- `storm_gen_article_polished.txt` — polished version
- `storm_gen_outline.txt` — outline with citations
- `conversation_log.json` — simulated conversation log
- `raw_search_results.json` — raw search engine results

## Quick Start — Co-STORM (Human-AI Collaboration)

```bash
python examples/costorm_examples/run_costorm_gpt.py \
  --output-dir ./results/costorm \
  --retriever you \
  --do-research
# Opens Streamlit UI for collaborative session
```

## Using from Hermes (Python API)

```python
from knowledge_storm import (
    STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
)
from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel
from knowledge_storm.rm import YouRM, BingSearch, BraveRM, SerperRM, TavilySearchRM
from knowledge_storm.utils import load_api_key

load_api_key(toml_file_path="secrets.toml")

lm_configs = STORMWikiLMConfigs()
lm_configs.set_conv_simulator_lm(OpenAIModel(model="gpt-3.5-turbo", max_tokens=500, api_key=os.getenv("OPENAI_API_KEY")))
lm_configs.set_question_asker_lm(OpenAIModel(model="gpt-3.5-turbo", max_tokens=500, api_key=os.getenv("OPENAI_API_KEY")))
lm_configs.set_outline_gen_lm(OpenAIModel(model="gpt-4o", max_tokens=400, api_key=os.getenv("OPENAI_API_KEY")))
lm_configs.set_article_gen_lm(OpenAIModel(model="gpt-4o", max_tokens=700, api_key=os.getenv("OPENAI_API_KEY")))
lm_configs.set_article_polish_lm(OpenAIModel(model="gpt-4o", max_tokens=4000, api_key=os.getenv("OPENAI_API_KEY")))

engine_args = STORMWikiRunnerArguments(
    output_dir="./results/gpt",
    max_conv_turn=3,
    max_perspective=3,
    search_top_k=3,
    max_thread_num=3,
)

rm = YouRM(ydc_api_key=os.getenv("YDC_API_KEY"), k=engine_args.search_top_k)

runner = STORMWikiRunner(engine_args, lm_configs, rm)
runner.run(
    topic="Retrieval-augmented generation",
    do_research=True,
    do_generate_outline=True,
    do_generate_article=True,
    do_polish_article=True,
)
runner.post_run()
runner.summary()
```

## Supported Retrieval Models (RM)

| Class | Search Engine | Key Env Var | Example |
|-------|---------------|-------------|---------|
| `YouRM` | You.com | `YDC_API_KEY` | `YouRM(ydc_api_key=..., k=10)` |
| `BingSearch` | Bing | `BING_SEARCH_API_KEY` | `BingSearch(bing_search_api=..., k=10)` |
| `BraveRM` | Brave Search | `BRAVE_API_KEY` | `BraveRM(brave_search_api_key=..., k=10)` |
| `SerperRM` | Serper (Google) | `SERPER_API_KEY` | `SerperRM(serper_search_api_key=..., k=10)` |
| `TavilySearchRM` | Tavily | `TAVILY_API_KEY` | `TavilySearchRM(tavily_search_api_key=..., k=10)` |
| `DuckDuckGoSearchRM` | DuckDuckGo | — (no key) | `DuckDuckGoSearchRM(k=10)` |
| `SearXNG` | SearXNG instance | `SEARXNG_API_KEY` | `SearXNG(searxng_api_key=..., k=10)` |
| `AzureAISearch` | Azure AI Search | `AZURE_AI_SEARCH_*` | `AzureAISearch(...)` |
| `VectorRM` | Qdrant (custom corpus) | `OPENAI_API_KEY` + `QDRANT_*` | See VectorRM section below |

## Using Local / Open-Weight Models

### Ollama
```python
from knowledge_storm.lm import OllamaModel
lm = OllamaModel(model="llama3.1:8b", base_url="http://localhost:11434")
```

### vLLM / TGI / Together.ai
```python
from knowledge_storm.lm import VLLMModel, TGIModel, TogetherAIModel
lm = VLLMModel(model="mistralai/Mistral-7B-Instruct-v0.2", url="http://localhost:8000/v1")
lm = TGIModel(model="mistralai/Mistral-7B-Instruct-v0.2", url="http://localhost:8080")
lm = TogetherAIModel(model="mistralai/Mistral-7B-Instruct-v0.2", api_key=os.getenv("TOGETHER_API_KEY"))
```

### LiteLLM (Universal)
```python
from knowledge_storm.lm import LiteLLMModel
lm = LiteLLMModel(model="ollama/llama3.1:8b")  # any litellm-supported model string
```

See `examples/storm_examples/run_storm_wiki_ollama.py`, `run_storm_wiki_mistral.py`, `run_storm_wiki_groq.py`.

## Using Custom Corpus with VectorRM

```python
from knowledge_storm.rm import VectorRM
from knowledge_storm.lm import OpenAIModel

# Offline vector DB (local Qdrant)
rm = VectorRM(
    vector_db_mode="offline",
    offline_vector_db_dir="./vector_db",
    csv_file_path="./corpus.csv",
    embedding_model=OpenAIModel(model="text-embedding-3-small", api_key=os.getenv("OPENAI_API_KEY")),
    device="cuda",  # or "mps", "cpu"
)

# Online Qdrant Cloud
rm = VectorRM(
    vector_db_mode="online",
    online_vector_db_url="https://xxx.qdrant.io",
    csv_file_path="./corpus.csv",
    embedding_model=OpenAIModel(model="text-embedding-3-small", api_key=os.getenv("OPENAI_API_KEY")),
)
```

**CSV format:**
```csv
content,title,url,description
"Transformers are...", "Attention Is All You Need", "https://arxiv.org/abs/1706.03762", "Original Transformer paper"
```

See `examples/storm_examples/run_storm_wiki_gpt_with_VectorRM.py` and `helper/process_kaggle_arxiv_abstract_dataset.py`.

## Co-STORM Collaboration Protocol

Co-STORM implements a turn-based discourse with three roles:

1. **Co-STORM LLM Experts** — generate grounded answers + follow-up questions
2. **Moderator** — poses thought-provoking questions from retriever findings
3. **Human User** — observes or injects utterances to steer discourse

A dynamic **mind map** organizes collected information hierarchically, reducing cognitive load during long sessions.

Run the Streamlit demo:
```bash
cd frontend/demo_light
pip install -r requirements.txt
streamlit run app.py
```

## Contributing to the Upstream Repo

The upstream (`stanford-oval/storm`) accepts PRs for:
- **New LM support** → `knowledge_storm/lm.py` + example script under `examples/storm_examples/`
- **New RM support** → `knowledge_storm/rm.py` + example script
- **Demo Light enhancements** → `frontend/demo_light/`
- **Bug reports / issue triage**

**PR Title Format:**
```
[New LM/New RM/Demo Enhancement] Short description
```

**Required in PR Description:**
- How to use the new class
- Example script following existing style
- Input/output example
- Required API keys + how to obtain them

**Code Style:** `black` via `pre-commit` hook (runs on `knowledge_storm/`).

```bash
pip install pre-commit && pre-commit install
```

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Rate limit errors (`Exceed rate limit`) | Reduce `--max-thread-num`, increase delays, or use batch-friendly APIs |
| Empty articles / no citations | Ensure `--do-research` runs first; check search API keys |
| `VectorRM` import errors | `pip install qdrant-client` |
| `ModuleNotFoundError: knowledge_storm` | `pip install -e .` from repo root |
| Pre-commit fails on non-`knowledge_storm` files | Hook only formats `knowledge_storm/` — ignore other dirs |
| Co-STORM Streamlit won't start | Run from `frontend/demo_light/` with its own `requirements.txt` |

## Verification Checklist

- [ ] `pip install -e .` succeeds
- [ ] `python examples/storm_examples/run_storm_wiki_gpt.py --retriever you --do-research --do-generate-outline --do-generate-article` runs and produces `storm_gen_article.txt`
- [ ] Output article contains citations in `[1]`, `[2]` format linking to `url_to_info.json`
- [ ] `pre-commit run --files knowledge_storm/lm.py knowledge_storm/rm.py` passes
- [ ] Co-STORM Streamlit UI launches: `cd frontend/demo_light && streamlit run app.py`

## Reference Files

- `references/storm-api.md` — Core class reference (Runner, LMConfigs, RM classes)
- `references/contributing-guide.md` — Upstream contribution checklist
- `references/vectorrm-guide.md` — Custom corpus setup with Qdrant
- `references/local-llm-guide.md` — Ollama, vLLM, TGI, Together.ai, LiteLLM patterns
- `templates/storm-runner.py` — Minimal runner template
- `templates/secrets.toml.example` — API key template