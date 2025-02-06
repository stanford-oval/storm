from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from openai import OpenAI
from typing import List, Optional, Dict, Any
import wikipedia
from knowledge_storm.utils import load_api_key
import toml
import os
import shutil
from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel
from knowledge_storm.rm import YouRM, SerperRM
import json
from pathlib import Path
import logging
import traceback
import time
import re
import hashlib
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, Security
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Security configuration
security = HTTPBearer()
# Convert comma-separated string of tokens to set, default to empty set if env var not set
API_TOKENS = set(os.getenv("API_TOKENS", "").split(",")) if os.getenv("API_TOKENS") else set()

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> bool:
    """
    Verify that the provided token is valid.
    Raises HTTPException if token is invalid.
    """
    if credentials.credentials not in API_TOKENS:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def create_safe_filename(text: str, max_length: int = 50) -> str:
    """
    Create a safe, shortened filename from text.
    
    Args:
        text: The input text to convert to a filename
        max_length: Maximum length of the base filename (before hash)
    
    Returns:
        A safe filename string
    """
    # Remove special characters and convert spaces to underscores
    safe_text = re.sub(r'[^\w\s-]', '', text.lower())
    safe_text = re.sub(r'[-\s]+', '_', safe_text)
    
    # If the text is too long, truncate it and add a hash
    if len(safe_text) > max_length:
        # Create a hash of the full text to ensure uniqueness
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        # Truncate the text and append the hash
        safe_text = f"{safe_text[:max_length]}_{text_hash}"
    
    return safe_text

app = FastAPI(title="CleverWrite API", description="API for article generation and citation finding")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# V2 Models
class StormArticleRequest(BaseModel):
    topic: str
    webhook_url: Optional[HttpUrl] = None  # Made optional
    do_research: bool = True
    do_generate_outline: bool = True
    do_generate_article: bool = True
    do_polish_article: bool = True
    remove_duplicate: bool = False
    metadata: Dict[str, Any] = {}

class StormArticleResponse(BaseModel):
    content: str            # The main generated article text
    outline: Optional[str]  # The article outline (if do_generate_outline=True)
    sources: Dict[str, Any] # Sources/references used in the article
    polished_content: Optional[str]  # Polished version of the article (if do_polish_article=True)
    error: Optional[str]    # Any error message if something went wrong

class StormCitationRequest(BaseModel):
    text: str
    max_citations: Optional[int] = 3
    exclude_urls: Optional[List[str]] = []

class StormCitationResponse(BaseModel):
    citations: List[Dict[str, Any]]
    error: Optional[str] = None

# V2 Endpoints
@app.post("/v2/generate-article", response_model=Dict[str, str])
async def generate_article_v2(request: StormArticleRequest, authenticated: bool = Depends(verify_token)):
    try:
        logger.info(f"Queueing article generation for topic: {request.topic}")
        
        # Get webhook URL from request or default from environment
        webhook_url = str(request.webhook_url) if request.webhook_url else os.getenv("DEFAULT_WEBHOOK_URL")
        if not webhook_url:
            raise HTTPException(
                status_code=400,
                detail="No webhook URL provided and no default webhook URL configured"
            )
        
        # Queue the task
        from tasks import generate_article_task
        article_params = {
            "topic": request.topic,
            "do_research": request.do_research,
            "do_generate_outline": request.do_generate_outline,
            "do_generate_article": request.do_generate_article,
            "do_polish_article": request.do_polish_article,
            "remove_duplicate": request.remove_duplicate
        }
        
        generate_article_task.delay(
            article_params=article_params,
            webhook_url=webhook_url,
            metadata=request.metadata
        )
        
        return {
            "status": "queued",
            "message": "Article generation has been queued and will be processed in the background"
        }
        
    except Exception as e:
        error_msg = f"Error queueing article generation: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/v2/find-citations", response_model=StormCitationResponse)
async def find_citations_v2(request: StormCitationRequest, authenticated: bool = Depends(verify_token)):
    base_dir = None
    try:
        logger.info(f"Starting citation search for text: {request.text[:100]}...")
        
        # Create base directory
        base_dir = Path("./results/api_generated/citations_temp")
        base_dir.mkdir(parents=True, exist_ok=True)
        
        try:

            # Configure Serper RM with API key from environment
            serper_api_key = os.getenv("SERPER_API_KEY")
            ydc_api_key = os.getenv("YDC_API_KEY")
            if serper_api_key:
                rm = SerperRM(
                serper_search_api_key=serper_api_key,
                query_params={'autocorrect': True, 'num': 10, 'page': 1}
            )
            elif ydc_api_key: 
                rm = YouRM(ydc_api_key=ydc_api_key, k=request.max_citations * 2)
            else:
                raise ValueError("SERPER_API_KEY or YDC_API_KEY not found in environment variables")

            
            # Search using YouRM's forward method
            logger.info("Starting search")
            search_results = rm.forward(request.text, exclude_urls=request.exclude_urls)
            logger.info(f"Got {len(search_results) if search_results else 0} search results")
            
            citations = []
            
            if search_results:
                for result in search_results:
                    try:
                        # Extract relevant information from search result
                        citation = {
                            'url': result.get('url', ''),
                            'title': result.get('title', ''),
                            'snippet': result.get('description', '')[:500] if result.get('description') else '',
                            'relevance_score': 1.0  # You.com results are already sorted by relevance
                        }
                        
                        # Only add if we have at least a title and URL
                        if citation['title'] and citation['url']:
                            citations.append(citation)
                            logger.info(f"Added citation: {citation['title']}")
                    except Exception as e:
                        logger.error(f"Error processing result: {str(e)}")
                        continue
                
                # Limit to requested number (already sorted by relevance from You.com)
                citations = citations[:request.max_citations]
                logger.info(f"Returning {len(citations)} citations")
            else:
                logger.warning("No search results found")
            
            response = StormCitationResponse(
                citations=citations,
                error=None
            )
            
            # Cleanup directory
            if base_dir and base_dir.exists():
                shutil.rmtree(base_dir)
                logger.info(f"Cleaned up directory: {base_dir}")
            
            return response
            
        except Exception as e:
            logger.error(f"Error in citation search: {str(e)}\n{traceback.format_exc()}")
            # Cleanup on error
            if base_dir and base_dir.exists():
                shutil.rmtree(base_dir)
                logger.info(f"Cleaned up directory after error: {base_dir}")
            return StormCitationResponse(
                citations=[],
                error=f"Citation search error: {str(e)}"
            )
            
    except Exception as e:
        error_msg = f"Error finding citations: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        # Cleanup on error
        if base_dir and base_dir.exists():
            shutil.rmtree(base_dir)
            logger.info(f"Cleaned up directory after error: {base_dir}")
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/health")
async def health_check() -> Dict[str, str]:
    return {
        "status": "healthy",
        "message": "API is running"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
