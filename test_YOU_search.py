import requests
YOU_API_KEY = "3235af6c-829c-4274-ad32-987418079a78<__>1Pi6xMETU8N2v5f4keJJyP5a"

def get_ai_snippets_for_query(query):
    headers = {"X-API-Key": YOU_API_KEY}
    params = {"query": query}
    return requests.get(
        f"https://api.ydc-index.io/search?query={query}",
        params=params,
        headers=headers,
    ).json()

results = get_ai_snippets_for_query("Tell me how can I describe ChatGPT service.")
print(results)