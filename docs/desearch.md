# Desearch retrieval

Create an API key at https://console.desearch.ai and set `DESEARCH_API_KEY` in your environment. You can also add `DESEARCH_API_KEY="your_api_key"` to `secrets.toml` and load it with `knowledge_storm.utils.load_api_key`.

```python
from knowledge_storm.rm import DesearchRM

rm = DesearchRM(k=3)
results = rm("Stanford STORM research")
print(results)
```

Pass `rm` to your runner as its retrieval module. Each result contains `url`, `title`, `description`, and `snippets`. `k` limits accepted results per query to between 1 and 20. The web endpoint can return up to 20 candidates; the retriever applies the limit after source filtering. Supply `is_valid_source` to filter URLs and `exclude_urls` when calling the retriever to omit already used sources. A list of queries is also supported. `get_usage_and_reset()` reports the number of queries attempted.

Requests use `https://api.desearch.ai/web` with Bearer authentication. See the [API documentation](https://desearch.ai/docs).
