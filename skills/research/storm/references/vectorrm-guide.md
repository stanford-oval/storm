# VectorRM Guide: Custom Corpus with Qdrant

## Overview

`VectorRM` lets you ground STORM on your own document corpus instead of (or in addition to) web search. It uses Qdrant as a vector database with embeddings from an LLM.

## Installation

```bash
pip install qdrant-client langchain-huggingface langchain-qdrant
```

## CSV Corpus Format

Prepare a CSV file with these columns:

```csv
content,title,url,description
"Full document text...","Document Title","https://unique-id-1","Optional description"
"Another document...","Another Title","https://unique-id-2","Optional description"
```

- **content** (required): Full text content
- **title** (required): Document title
- **url** (required): Unique identifier — used as citation key in STORM
- **description** (optional): Short summary

## Offline Mode (Local Qdrant)

Best for development and private data.

```python
from knowledge_storm.rm import VectorRM
from knowledge_storm.lm import OpenAIModel
import os

embedding_model = OpenAIModel(
    model="text-embedding-3-small",
    api_key=os.getenv("OPENAI_API_KEY"),
)

rm = VectorRM(
    vector_db_mode="offline",
    offline_vector_db_dir="./my_vector_db",  # Local Qdrant storage
    csv_file_path="./corpus.csv",
    embedding_model=embedding_model,
    device="cuda",  # "mps" for Apple Silicon, "cpu" for CPU
    k=10,  # Top-k results per query
)
```

**First run:** Creates the Qdrant collection and embeds all documents (can take time for large corpora).

**Subsequent runs:** Loads existing collection instantly.

## Online Mode (Qdrant Cloud)

For production or shared access.

```python
rm = VectorRM(
    vector_db_mode="online",
    online_vector_db_url="https://your-cluster.qdrant.io",
    csv_file_path="./corpus.csv",
    embedding_model=embedding_model,
    # Qdrant API key via env var QDRANT_API_KEY or:
    # api_key=os.getenv("QDRANT_API_KEY"),
)
```

## Using with STORM Runner

```python
from knowledge_storm import STORMWikiRunner, STORMWikiRunnerArguments, STORMWikiLMConfigs

engine_args = STORMWikiRunnerArguments(
    output_dir="./results/vector",
    max_conv_turn=3,
    max_perspective=3,
    search_top_k=10,  # Matches VectorRM k
    max_thread_num=3,
)

runner = STORMWikiRunner(engine_args, lm_configs, rm)

runner.run(
    topic="Your topic",
    do_research=True,
    do_generate_outline=True,
    do_generate_article=True,
)
```

## Kaggle arXiv Example

The repo includes a helper to process the Kaggle arXiv abstracts dataset:

```bash
# 1. Download arxiv_data_210930-054931.csv from Kaggle
# https://www.kaggle.com/datasets/spsayakpaul/arxiv-paper-abstracts

# 2. Process to STORM format (filters for cs.CV papers)
python examples/storm_examples/helper/process_kaggle_arxiv_abstract_dataset.py \
  --input-path ./arxiv_data_210930-054931.csv \
  --output-path ./arxiv_cv.csv

# 3. Run STORM with VectorRM
python examples/storm_examples/run_storm_wiki_gpt_with_VectorRM.py \
  --output-dir ./results/arxiv \
  --vector-db-mode offline \
  --offline-vector-db-dir ./arxiv_vector_db \
  --csv-file-path ./arxiv_cv.csv \
  --device cuda \
  --do-research --do-generate-outline --do-generate-article --do-polish-article
```

## Pre-built Vector Store (Quick Test)

Download pre-embedded arXiv CS.CV vector store:
```bash
# From Google Drive: https://drive.google.com/file/d/1bijFkw5BKU7bqcmXMhO-5hg2fdKAL9bf/view?usp=share_link
# Extract to ./arxiv_vector_db

python examples/storm_examples/run_storm_wiki_gpt_with_VectorRM.py \
  --output-dir ./results/arxiv \
  --vector-db-mode offline \
  --offline-vector-db-dir ./arxiv_vector_db \
  --do-research --do-generate-outline --do-generate-article --do-polish-article
```

## Embedding Model Options

| Model | Dimensions | Speed | Quality | Use Case |
|-------|------------|-------|---------|----------|
| `text-embedding-3-small` | 1536 | Fast | Good | General purpose |
| `text-embedding-3-large` | 3072 | Slower | Best | High quality needed |
| `text-embedding-ada-002` | 1536 | Fast | Good | Legacy/compatibility |
| Local (HuggingFace) | Varies | Fast (GPU) | Good | Offline/private |

For local embeddings, use `HuggingFaceEmbeddings` via langchain:

```python
from langchain_huggingface import HuggingFaceEmbeddings

embedding_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2",
    model_kwargs={"device": "cuda"},
    encode_kwargs={"normalize_embeddings": True},
)
```

## Common Issues

| Issue | Solution |
|-------|----------|
| `Collection does not exist` | Run with `--vector-db-mode offline` first time to create |
| `CUDA OOM` | Use `device="cpu"` or smaller embedding model |
| `ImportError: qdrant_client` | `pip install qdrant-client` |
| Slow first run | Normal — embedding all docs takes time |
| Duplicate URLs in CSV | Ensure each document has unique `url` field |
| Citations not linking | Check that `url` in CSV matches what STORM expects |

## Performance Tips

1. **Batch embedding** — VectorRM embeds in batches; large corpora benefit from GPU
2. **Collection persistence** — Offline mode persists to disk; don't delete the folder
3. **Hybrid search** — Combine with web search RM for broader coverage
4. **Filtering** — Pre-filter corpus by topic/domain before indexing