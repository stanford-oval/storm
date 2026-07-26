# STORM Core API Reference

## Main Pipeline Classes

### `STORMWikiRunnerArguments`

Configuration for the STORM pipeline runner.

```python
from knowledge_storm import STORMWikiRunnerArguments

args = STORMWikiRunnerArguments(
    output_dir: str = "./results",           # Output directory
    max_conv_turn: int = 3,                  # Max Q&A turns in research
    max_perspective: int = 3,                # Max perspectives for question asking
    search_top_k: int = 10,                  # Top-k search results per query
    max_thread_num: int = 3,                 # Max concurrent threads
)
```

### `STORMWikiLMConfigs`

Container for all LM configurations used in the pipeline.

```python
from knowledge_storm import STORMWikiLMConfigs

lm_configs = STORMWikiLMConfigs()

# Set LMs for each pipeline stage
lm_configs.set_conv_simulator_lm(lm)        # Conversation simulator (Q&A simulation)
lm_configs.set_question_asker_lm(lm)        # Question generator
lm_configs.set_outline_gen_lm(lm)           # Outline generation
lm_configs.set_article_gen_lm(lm)           # Article section writing
lm_configs.set_article_polish_lm(lm)        # Article polishing
```

### `STORMWikiRunner`

Main pipeline orchestrator.

```python
from knowledge_storm import STORMWikiRunner

runner = STORMWikiRunner(
    engine_args: STORMWikiRunnerArguments,
    lm_configs: STORMWikiLMConfigs,
    rm: Retriever,                          # Any Retriever subclass
)

# Run full or partial pipeline
runner.run(
    topic: str,
    do_research: bool = True,               # Research phase (Q&A simulation)
    do_generate_outline: bool = True,       # Generate outline
    do_generate_article: bool = True,       # Write article sections
    do_polish_article: bool = False,        # Polish final article
)

# Post-processing
runner.post_run()   # Saves outputs to disk

# Summary stats
runner.summary()    # Prints timing, token usage, query counts
```

## Language Model Classes

All LM classes inherit from `dspy.LM` and implement `__call__(prompt, **kwargs) -> List[str]`.

### `OpenAIModel`

```python
from knowledge_storm.lm import OpenAIModel

lm = OpenAIModel(
    model: str = "gpt-4o",           # Model name
    max_tokens: int = 4000,          # Max output tokens
    api_key: str = "...",            # OpenAI API key
    temperature: float = 1.0,        # Sampling temperature
    top_p: float = 0.9,              # Nucleus sampling
    **kwargs,                        # Passed to openai.ChatCompletion.create
)
```

### `AzureOpenAIModel`

```python
from knowledge_storm.lm import AzureOpenAIModel

lm = AzureOpenAIModel(
    model: str = "gpt-4o",           # Deployment name
    max_tokens: int = 4000,
    api_key: str = "...",
    api_base: str = "https://xxx.openai.azure.com/",
    api_version: str = "2024-02-01",
    temperature: float = 1.0,
    top_p: float = 0.9,
)
```

### `ClaudeModel`

```python
from knowledge_storm.lm import ClaudeModel

lm = ClaudeModel(
    model: str = "claude-3-5-sonnet-20241022",
    max_tokens: int = 4000,
    api_key: str = "...",
    temperature: float = 1.0,
    top_p: float = 0.9,
)
```

### `OllamaModel`

```python
from knowledge_storm.lm import OllamaModel

lm = OllamaModel(
    model: str = "llama3.1:8b",      # Ollama model tag
    base_url: str = "http://localhost:11434",
    temperature: float = 0.7,
    num_predict: int = 4000,         # Max tokens
)
```

### `VLLMModel` / `TGIModel` / `TogetherAIModel`

```python
from knowledge_storm.lm import VLLMModel, TGIModel, TogetherAIModel

lm = VLLMModel(
    model: str = "mistralai/Mistral-7B-Instruct-v0.2",
    url: str = "http://localhost:8000/v1",
    max_tokens: int = 4000,
    temperature: float = 0.7,
)

lm = TGIModel(
    model: str = "mistralai/Mistral-7B-Instruct-v0.2",
    url: str = "http://localhost:8080",
    max_tokens: int = 4000,
)

lm = TogetherAIModel(
    model: str = "mistralai/Mistral-7B-Instruct-v0.2",
    api_key: str = "...",
    max_tokens: int = 4000,
)
```

### `LiteLLMModel` (Universal)

```python
from knowledge_storm.lm import LiteLLMModel

lm = LiteLLMModel(
    model: str = "ollama/llama3.1:8b",      # Provider/model format
    # model = "together_ai/meta-llama/Llama-3.1-70B-Instruct-Turbo"
    # model = "vertex_ai/gemini-1.5-pro"
    # model = "azure/gpt-4o"
    max_tokens: int = 4000,
    temperature: float = 0.7,
    api_key: str = "...",                   # If needed by provider
    **kwargs,                               # Passed to litellm.completion
)
```

## Retrieval Model (RM) Classes

All RM classes inherit from `dspy.Retrieve` and implement `forward(query_or_queries, exclude_urls) -> List[Dict]`.

Return format per result:
```python
{
    "url": "https://...",           # Unique identifier
    "title": "Page Title",
    "description": "Brief description",
    "snippets": ["passage 1", "passage 2", ...],  # Text chunks for citation
}
```

### `YouRM` (You.com Search)

```python
from knowledge_storm.rm import YouRM

rm = YouRM(
    ydc_api_key: str = "...",
    k: int = 10,                    # Results per query
    is_valid_source: Callable[[str], bool] = None,  # Optional URL filter
)
```

### `BingSearch`

```python
from knowledge_storm.rm import BingSearch

rm = BingSearch(
    bing_search_api_key: str = "...",
    k: int = 10,
    min_char_count: int = 150,      # Min article length
    snippet_chunk_size: int = 1000, # Max chars per snippet
    webpage_helper_max_threads: int = 10,
    mkt: str = "en-US",
    language: str = "en",
    is_valid_source: Callable[[str], bool] = None,
)
```

### `BraveRM`

```python
from knowledge_storm.rm import BraveRM

rm = BraveRM(
    brave_search_api_key: str = "...",
    k: int = 10,
)
```

### `SerperRM` (Google via Serper)

```python
from knowledge_storm.rm import SerperRM

rm = SerperRM(
    serper_search_api_key: str = "...",
    k: int = 10,
    query_params: dict = {"autocorrect": True, "num": 10, "page": 1},
)
```

### `TavilySearchRM`

```python
from knowledge_storm.rm import TavilySearchRM

rm = TavilySearchRM(
    tavily_search_api_key: str = "...",
    k: int = 10,
    include_raw_content: bool = True,
)
```

### `DuckDuckGoSearchRM` (No API Key)

```python
from knowledge_storm.rm import DuckDuckGoSearchRM

rm = DuckDuckGoSearchRM(
    k: int = 10,
    safe_search: str = "On",        # "On", "Moderate", "Off"
    region: str = "us-en",          # Region code
)
```

### `SearXNG`

```python
from knowledge_storm.rm import SearXNG

rm = SearXNG(
    searxng_api_key: str = "...",   # If instance requires auth
    k: int = 10,
)
```

### `AzureAISearch`

```python
from knowledge_storm.rm import AzureAISearch

rm = AzureAISearch(
    azure_ai_search_api_key: str = "...",
    azure_ai_search_url: str = "https://xxx.search.windows.net",
    azure_ai_search_index_name: str = "your-index",
    k: int = 10,
)
```

### `VectorRM` (Custom Corpus via Qdrant)

```python
from knowledge_storm.rm import VectorRM
from knowledge_storm.lm import OpenAIModel

embedding_model = OpenAIModel(model="text-embedding-3-small", api_key="...")

# Offline (local Qdrant)
rm = VectorRM(
    vector_db_mode: str = "offline",
    offline_vector_db_dir: str = "./vector_db",
    csv_file_path: str = "./corpus.csv",
    embedding_model: LM = embedding_model,
    device: str = "cuda",           # "cuda", "mps", "cpu"
    k: int = 10,
)

# Online (Qdrant Cloud)
rm = VectorRM(
    vector_db_mode: str = "online",
    online_vector_db_url: str = "https://xxx.qdrant.io",
    csv_file_path: str = "./corpus.csv",
    embedding_model: LM = embedding_model,
    k: int = 10,
    # api_key via QDRANT_API_KEY env var
)
```

**CSV format:** `content,title,url,description`

## Data Classes

### `Information`

Represents a retrieved piece of information.

```python
from knowledge_storm.dataclass import Information

info = Information(
    url: str,
    description: str,
    snippets: List[str],
    title: str,
    meta: dict = None,
)
info.citation_uuid  # Assigned during article generation
info.to_dict()      # Serialize
Information.from_dict(dict)  # Deserialize
```

### `InformationTable`

Abstract base class for collected information storage.

```python
from knowledge_storm.interface import InformationTable

class MyInfoTable(InformationTable):
    def retrieve_information(self, **kwargs):
        pass
```

### `Article` & `ArticleSectionNode`

Hierarchical article representation.

```python
from knowledge_storm.interface import Article, ArticleSectionNode

article = Article(topic_name: str)
article.root                          # Root ArticleSectionNode
article.find_section(node, name)      # Find section by name
article.get_outline_tree()            # Dict outline
article.get_first_level_section_names()  # Top-level sections
article.to_string()                   # Full text with citations
Article.from_string(topic, text)      # Parse from text
article.prune_empty_nodes()           # Remove empty sections
```

## Pipeline Stage Interfaces

### `KnowledgeCurationModule`

```python
from knowledge_storm.interface import KnowledgeCurationModule

module = KnowledgeCurationModule(retriever: Retriever)
info_table = module.research(topic: str)  # Returns InformationTable
```

### `OutlineGenerationModule`

```python
from knowledge_storm.interface import OutlineGenerationModule

module = OutlineGenerationModule()
outline = module.generate_outline(
    topic: str,
    information_table: InformationTable,
    **kwargs,  # e.g., draft_outline, user_outline
)  # Returns Article (outline only)
```

### `ArticleGenerationModule`

```python
from knowledge_storm.interface import ArticleGenerationModule

module = ArticleGenerationModule()
article = module.generate_article(
    topic: str,
    information_table: InformationTable,
    article_with_outline: Article,
    **kwargs,
)  # Returns Article (with content)
```

### `ArticlePolishingModule`

```python
from knowledge_storm.interface import ArticlePolishingModule

module = ArticlePolishingModule()
polished = module.polish_article(
    topic: str,
    draft_article: Article,
    **kwargs,
)  # Returns Article (polished)
```

## Co-STORM Classes

### `CollaborativeStormRunner`

```python
from knowledge_storm.collaborative_storm import CollaborativeStormRunner

runner = CollaborativeStormRunner(...)
# Runs interactive Streamlit session
```

### `Agent` (Co-STORM)

```python
from knowledge_storm.dataclass import Agent, KnowledgeBase, ConversationTurn

class MyAgent(Agent):
    def generate_utterance(
        self,
        knowledge_base: KnowledgeBase,
        conversation_history: List[ConversationTurn],
        logging_wrapper: LoggingWrapper,
        **kwargs,
    ) -> ConversationTurn:
        # Generate response
        pass
```

### `ConversationTurn` & `KnowledgeBase`

```python
from knowledge_storm.dataclass import ConversationTurn, KnowledgeBase

turn = ConversationTurn(
    role: str,                    # "expert", "moderator", "human"
    utterance: str,               # The response
    utterance_type: str,          # "answer", "question", "injection"
    meta: dict = None,            # Citations, references, etc.
)

kb = KnowledgeBase(mind_map: MindMap)  # Hierarchical concept map
```

## Utility Functions

### `load_api_key`

```python
from knowledge_storm.utils import load_api_key

load_api_key(toml_file_path: str = "secrets.toml")
# Loads all keys from TOML into os.environ
```

### `ArticleTextProcessing`

```python
from knowledge_storm.utils import ArticleTextProcessing

ArticleTextProcessing.remove_citations(text: str) -> str
# Removes [1], [2] citation markers from text
```

## Example: Minimal Custom Pipeline

```python
from knowledge_storm import (
    STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
)
from knowledge_storm.lm import OpenAIModel
from knowledge_storm.rm import YouRM
from knowledge_storm.utils import load_api_key

load_api_key("secrets.toml")

# LMs
lm_configs = STORMWikiLMConfigs()
api_key = os.getenv("OPENAI_API_KEY")

lm_configs.set_conv_simulator_lm(OpenAIModel("gpt-3.5-turbo", 500, api_key=api_key))
lm_configs.set_question_asker_lm(OpenAIModel("gpt-3.5-turbo", 500, api_key=api_key))
lm_configs.set_outline_gen_lm(OpenAIModel("gpt-4o", 400, api_key=api_key))
lm_configs.set_article_gen_lm(OpenAIModel("gpt-4o", 700, api_key=api_key))
lm_configs.set_article_polish_lm(OpenAIModel("gpt-4o", 4000, api_key=api_key))

# Retriever
rm = YouRM(ydc_api_key=os.getenv("YDC_API_KEY"), k=10)

# Runner
args = STORMWikiRunnerArguments(
    output_dir="./results",
    max_conv_turn=3,
    max_perspective=3,
    search_top_k=10,
    max_thread_num=3,
)

runner = STORMWikiRunner(args, lm_configs, rm)

# Run
runner.run(
    topic="Retrieval-Augmented Generation",
    do_research=True,
    do_generate_outline=True,
    do_generate_article=True,
    do_polish_article=True,
)

runner.post_run()
runner.summary()
```

## Output Files

After `runner.post_run()`, the output directory contains:

| File | Description |
|------|-------------|
| `storm_gen_article.txt` | Final article with citations |
| `storm_gen_article_polished.txt` | Polished version (if enabled) |
| `storm_gen_outline.txt` | Outline with section hierarchy |
| `direct_gen_outline.txt` | Outline from parametric knowledge only |
| `conversation_log.json` | Simulated Q&A conversation |
| `raw_search_results.json` | Raw search engine responses |
| `url_to_info.json` | All retrieved information keyed by URL |