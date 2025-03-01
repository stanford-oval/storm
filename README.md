# Storm CW API Documentation

The Storm CW API provides endpoints for article generation and citation finding. The API requires authentication using a Bearer token.

## Getting Started



Start the API server:

```bash
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

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
  "metadata": {}
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
  "exclude_urls": ["string"]
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

### 3. Health Check

Check if the API is running.

```http
GET /health
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
curl -X POST "http://localhost:8000/v2/generate-article" \
     -H "Authorization: Bearer Ap-xvOcEH16cnL6827_a4By_DkooYQFsUdEDWFr1Lh4" \
     -H "Content-Type: application/json" \
     -d '{
      "topic": "AI in healthcare",
      "length": 100,
      "do_research": true,
      "do_generate_outline": true,
      "do_generate_article": false,
      "do_polish_article": false
     }'
```

Find citations:

```bash
curl -X POST "http://localhost:8000/v2/find-citations"
  -H "Authorization: Bearer Ap-xvOcEH16cnL6827_a4By_DkooYQFsUdEDWFr1Lh4"
  -H "Content-Type: application/json"
  -d '{
    "text": "AI has revolutionized medical imaging and diagnosis",
    "max_citations": 3
}'
```
