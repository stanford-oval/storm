from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from typing import List, Optional
import wikipedia
from knowledge_storm.utils import load_api_key
import toml
import os

app = FastAPI(title="CleverWrite API", description="API for article generation and citation finding")

# Load secrets
try:
    load_api_key(".streamlit/secrets.toml")
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    if not client.api_key:
        raise ValueError("OPENAI_API_KEY not found in secrets.toml")
except Exception as e:
    raise RuntimeError(f"Failed to load secrets: {str(e)}")

class ArticleRequest(BaseModel):
    topic: str
    length: Optional[int] = 800
    style: Optional[str] = "informative"

class Citation(BaseModel):
    text: str
    source: str
    url: Optional[str] = None

class ArticleResponse(BaseModel):
    content: str
    citations: List[Citation]

class CitationRequest(BaseModel):
    text: str

@app.post("/generate-article", response_model=ArticleResponse)
async def generate_article(request: ArticleRequest):
    try:
        # Generate article content
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert article writer. Write an informative article with clear sections that can be fact-checked."},
                {"role": "user", "content": f"Write a {request.style} article about {request.topic} in approximately {request.length} words."}
            ]
        )
        
        article_content = response.choices[0].message.content

        # Find relevant Wikipedia citations
        try:
            wiki_results = wikipedia.search(request.topic, results=3)
            citations = []
            
            for result in wiki_results:
                try:
                    page = wikipedia.page(result)
                    citations.append(Citation(
                        text=f"Information about {result}",
                        source=page.title,
                        url=page.url
                    ))
                except wikipedia.exceptions.DisambiguationError as e:
                    continue
                except wikipedia.exceptions.PageError:
                    continue
        except:
            citations = []

        return ArticleResponse(content=article_content, citations=citations)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/find-citations")
async def find_citations(request: CitationRequest):
    try:
        # Extract key terms from the text
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Extract 3-5 key topics or terms from the given text that would be good to find citations for."},
                {"role": "user", "content": request.text}
            ]
        )
        
        key_terms = response.choices[0].message.content.split('\n')
        
        citations = []
        for term in key_terms:
            try:
                wiki_results = wikipedia.search(term, results=1)
                if wiki_results:
                    page = wikipedia.page(wiki_results[0])
                    citations.append(Citation(
                        text=f"Reference for {term}",
                        source=page.title,
                        url=page.url
                    ))
            except:
                continue
                
        return {"citations": citations}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
