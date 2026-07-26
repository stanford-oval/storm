# Local LLM Guide for STORM

## Overview

STORM supports local/open-weight LLMs through multiple backends:
- **Ollama** — Easiest for local development
- **vLLM** — High-throughput OpenAI-compatible server
- **TGI** (Text Generation Inference) — Hugging Face's production server
- **Together.ai** — Managed inference for open models
- **LiteLLM** — Universal proxy for 100+ providers

All integrate via `knowledge_storm.lm` classes.

---

## Ollama (Easiest Local)

### Setup
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull llama3.1:8b
ollama pull llama3.1:70b  # Needs 48GB+ RAM
ollama pull qwen2.5:7b
ollama pull mistral:7b

# Start server (runs in background)
ollama serve
```

### Usage in STORM
```python
from knowledge_storm.lm import OllamaModel

lm = OllamaModel(
    model="llama3.1:8b",           # Any pulled model
    base_url="http://localhost:11434",
    temperature=0.7,
    num_predict=4000,              # Max output tokens
)

# Use in LM configs
lm_configs.set_conv_simulator_lm(lm)
lm_configs.set_question_asker_lm(lm)
lm_configs.set_outline_gen_lm(lm)
lm_configs.set_article_gen_lm(lm)
lm_configs.set_article_polish_lm(lm)
```

### Example Script
```bash
python examples/storm_examples/run_storm_wiki_ollama.py \
  --url http://localhost:11434 \
  --model llama3.1:8b \
  --output-dir ./results/ollama \
  --retriever you \
  --do-research --do-generate-outline --do-generate-article
```

### Model Recommendations

| Model | Size | RAM (4-bit) | Quality | Best For |
|-------|------|-------------|---------|----------|
| `llama3.1:8b` | 8B | ~8 GB | Good | General use, cost/quality balance |
| `llama3.1:70b` | 70B | ~48 GB | Excellent | High-quality articles |
| `qwen2.5:7b` | 7B | ~6 GB | Good | Multilingual, coding |
| `mistral:7b` | 7B | ~6 GB | Good | Fast inference |
| `nemotron-3-ultra:43b` | 43B | ~32 GB | Excellent | NVIDIA's strong model |

---

## vLLM (High Throughput)

### Setup
```bash
# Install
pip install vllm

# Start server (example with Mistral 7B)
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.2 \
  --port 8000 \
  --dtype auto \
  --gpu-memory-utilization 0.9 \
  --max-model-len 8192

# For larger models (needs multi-GPU)
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3.1-70B-Instruct \
  --tensor-parallel-size 4 \
  --port 8000
```

### Usage in STORM
```python
from knowledge_storm.lm import VLLMModel

lm = VLLMModel(
    model="mistralai/Mistral-7B-Instruct-v0.2",
    url="http://localhost:8000/v1",
    max_tokens=4000,
    temperature=0.7,
)
```

### Example Script
```bash
python examples/storm_examples/run_storm_wiki_mistral.py \
  --url http://localhost:8000 \
  --port 8000 \
  --output-dir ./results/vllm \
  --retriever you \
  --do-research --do-generate-outline --do-generate-article
```

### Performance Tips

| Setting | Recommendation |
|---------|----------------|
| `--gpu-memory-utilization` | 0.85-0.95 |
| `--max-model-len` | 8192 or 16384 for long contexts |
| `--tensor-parallel-size` | # GPUs for large models |
| `--enable-prefix-caching` | Faster for repeated prefixes |
| `--disable-log-stats` | Reduces overhead |

---

## TGI (Text Generation Inference)

### Setup
```bash
# Using Docker (recommended)
docker run --gpus all -p 8080:80 \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id mistralai/Mistral-7B-Instruct-v0.2 \
  --max-input-length 4096 \
  --max-total-tokens 8192

# For quantized models
docker run --gpus all -p 8080:80 \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id TheBloke/Mistral-7B-Instruct-v0.2-GPTQ \
  --quantize gptq
```

### Usage in STORM
```python
from knowledge_storm.lm import TGIModel

lm = TGIModel(
    model="mistralai/Mistral-7B-Instruct-v0.2",
    url="http://localhost:8080",
    max_tokens=4000,
    temperature=0.7,
)
```

---

## Together.ai (Managed Open Models)

### Setup
```bash
# Get API key from https://together.ai
export TOGETHER_API_KEY="your-key"
```

### Usage in STORM
```python
from knowledge_storm.lm import TogetherAIModel

lm = TogetherAIModel(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    api_key=os.getenv("TOGETHER_API_KEY"),
    max_tokens=4000,
    temperature=0.7,
)

# Other available models:
# "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo"  # 405B
# "mistralai/Mixtral-8x22B-Instruct-v0.1"
# "Qwen/Qwen2.5-72B-Instruct"
```

---

## LiteLLM (Universal Proxy)

### Setup
```bash
pip install litellm

# Optional: Start proxy server
litellm --port 4000
```

### Usage in STORM
```python
from knowledge_storm.lm import LiteLLMModel

# Any LiteLLM-supported model string
lm = LiteLLMModel(
    model="ollama/llama3.1:8b",              # Local Ollama
    # model="together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"
    # model="vertex_ai/gemini-1.5-pro"
    # model="azure/gpt-4o"
    # model="bedrock/anthropic.claude-3-5-sonnet-20241022-v1:0"
    max_tokens=4000,
    temperature=0.7,
    api_key=os.getenv("TOGETHER_API_KEY"),   # If provider needs it
)
```

### Provider Prefix Reference

| Provider | Prefix | Example |
|----------|--------|---------|
| Ollama | `ollama/` | `ollama/llama3.1:8b` |
| Together.ai | `together_ai/` | `together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` |
| Vertex AI | `vertex_ai/` | `vertex_ai/gemini-1.5-pro` |
| Azure | `azure/` | `azure/gpt-4o` |
| AWS Bedrock | `bedrock/` | `bedrock/anthropic.claude-3-5-sonnet-20241022-v1:0` |
| Groq | `groq/` | `groq/llama-3.1-70b-versatile` |
| OpenRouter | `openrouter/` | `openrouter/meta-llama/llama-3.1-70b-instruct` |
| Replicate | `replicate/` | `replicate/meta/meta-llama-3.1-70b-instruct` |
| Anyscale | `anyscale/` | `anyscale/meta-llama/Meta-Llama-3.1-70B-Instruct` |

---

## Model Selection Strategy for STORM Stages

Different pipeline stages benefit from different model strengths:

| Stage | Role | Recommended Model Tier | Why |
|-------|------|------------------------|-----|
| `conv_simulator_lm` | Simulates Q&A conversation | **Cheaper/Faster** (8B-13B) | Many short calls, speed matters |
| `question_asker_lm` | Generates questions | **Cheaper/Faster** (8B-13B) | High volume, simple task |
| `outline_gen_lm` | Organizes info into outline | **Stronger** (70B+) | Complex reasoning, structure |
| `article_gen_lm` | Writes article sections | **Strongest** (70B-405B) | Long-form generation with citations |
| `article_polish_lm` | Polishes full article | **Strongest** (70B-405B) | Large context, quality critical |

### Cost-Optimized Local Setup

```python
# Use smaller model for research stages, larger for writing
lm_configs.set_conv_simulator_lm(OllamaModel("llama3.1:8b", ...))
lm_configs.set_question_asker_lm(OllamaModel("llama3.1:8b", ...))
lm_configs.set_outline_gen_lm(OllamaModel("llama3.1:70b", ...))  # If RAM allows
lm_configs.set_article_gen_lm(OllamaModel("llama3.1:70b", ...))
lm_configs.set_article_polish_lm(OllamaModel("llama3.1:70b", ...))
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `Connection refused` | Ensure server is running: `curl http://localhost:11434/api/tags` |
| `CUDA OOM` | Use smaller model, enable quantization, or reduce `max_tokens` |
| `Context length exceeded` | Reduce `max_tokens`, use model with larger context (8K/16K/32K) |
| `Model not found` | `ollama pull <model>` or check vLLM/TGI model ID |
| Slow generation | Use vLLM/TGI instead of raw Ollama; enable `--enable-prefix-caching` |
| `Rate limit` from local model | Check `--max-concurrent-requests` on server |

### Debugging

```bash
# Test Ollama
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "llama3.1:8b", "prompt": "Hello", "stream": false}'

# Test vLLM
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "mistralai/Mistral-7B-Instruct-v0.2", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 10}'

# Check vLLM models
curl http://localhost:8000/v1/models
```

### Performance Comparison

| Backend | Throughput | Latency | Ease of Use | Best For |
|---------|------------|---------|-------------|----------|
| Ollama | Medium | Medium | ⭐⭐⭐⭐⭐ | Local dev, single user |
| vLLM | High | Low | ⭐⭐⭐ | Production, batch, multi-user |
| TGI | High | Low | ⭐⭐⭐ | Hugging Face ecosystem |
| Together.ai | Very High | Low | ⭐⭐⭐⭐ | No GPU, large models |
| LiteLLM | Varies | Varies | ⭐⭐⭐⭐ | Multi-provider, fallback |

---

## Hardware Requirements

| Model Size | Quantization | VRAM/RAM | Recommended Backend |
|------------|--------------|----------|---------------------|
| 7B-8B | 4-bit | 8-10 GB | Ollama, vLLM (1 GPU) |
| 13B-14B | 4-bit | 12-16 GB | vLLM (1-2 GPUs) |
| 30B-34B | 4-bit | 24-32 GB | vLLM (2-4 GPUs) |
| 70B | 4-bit | 48-64 GB | vLLM/TGI (4-8 GPUs) or Together.ai |
| 405B | 4-bit | 300+ GB | Together.ai, massive GPU cluster |

---

## Example: Complete Local STORM Run

```bash
# 1. Start Ollama with Llama 3.1 8B
ollama serve &
ollama pull llama3.1:8b

# 2. Set API keys
export OPENAI_API_KEY="..."      # For embeddings in VectorRM (optional)
export YDC_API_KEY="..."         # You.com search

# 3. Run STORM
python examples/storm_examples/run_storm_wiki_ollama.py \
  --url http://localhost:11434 \
  --model llama3.1:8b \
  --output-dir ./results/local_llama8b \
  --retriever you \
  --max-thread-num 3 \
  --do-research \
  --do-generate-outline \
  --do-generate-article \
  --do-polish-article

# Topic prompt: "Retrieval-Augmented Generation"
```

Output in `./results/local_llama8b/Retrieval-Augmented_Generation/`