from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from typing import List, Optional, Dict, Any
import wikipedia
from knowledge_storm.utils import load_api_key
import toml
import os
from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel
from knowledge_storm.rm import YouRM
import json
from pathlib import Path
import logging
import traceback
import time
import re
import hashlib

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

# Load secrets
try:
    load_api_key(".streamlit/secrets.toml")
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    ydc_api_key = os.getenv("YDC_API_KEY")
    if not client.api_key:
        raise ValueError("OPENAI_API_KEY not found in secrets.toml")
    if not ydc_api_key:
        raise ValueError("YDC_API_KEY not found in secrets.toml")
except Exception as e:
    logger.error(f"Failed to load secrets: {str(e)}\n{traceback.format_exc()}")
    raise RuntimeError(f"Failed to load secrets: {str(e)}")

# Initialize STORM components
def init_storm():
    try:
        lm_configs = STORMWikiLMConfigs()
        openai_kwargs = {
            'api_key': os.getenv("OPENAI_API_KEY"),
            'temperature': 1.0,
            'top_p': 0.9,
        }

        ModelClass = OpenAIModel
        gpt_35_model_name = 'gpt-3.5-turbo'
        gpt_4_model_name = 'gpt-4'

        conv_simulator_lm = ModelClass(model=gpt_35_model_name, max_tokens=500, **openai_kwargs)
        question_asker_lm = ModelClass(model=gpt_35_model_name, max_tokens=500, **openai_kwargs)
        outline_gen_lm = ModelClass(model=gpt_4_model_name, max_tokens=400, **openai_kwargs)
        article_gen_lm = ModelClass(model=gpt_4_model_name, max_tokens=700, **openai_kwargs)
        article_polish_lm = ModelClass(model=gpt_4_model_name, max_tokens=4000, **openai_kwargs)

        lm_configs.set_conv_simulator_lm(conv_simulator_lm)
        lm_configs.set_question_asker_lm(question_asker_lm)
        lm_configs.set_outline_gen_lm(outline_gen_lm)
        lm_configs.set_article_gen_lm(article_gen_lm)
        lm_configs.set_article_polish_lm(article_polish_lm)

        engine_args = STORMWikiRunnerArguments(
            output_dir="./results/api_generated",
            max_conv_turn=3,
            max_perspective=3,
            search_top_k=3,
            max_thread_num=3,
        )

        ydc_api_key = os.getenv("YDC_API_KEY")
        if not ydc_api_key:
            raise ValueError("YDC_API_KEY not found in environment variables")
            
        rm = YouRM(ydc_api_key=ydc_api_key, k=engine_args.search_top_k)
        logger.info("Successfully initialized STORM components with You.com search")
        return STORMWikiRunner(engine_args, lm_configs, rm)
    except Exception as e:
        logger.error(f"Failed to initialize STORM: {str(e)}\n{traceback.format_exc()}")
        raise

# V1 Models
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

# V2 Models
class StormArticleRequest(BaseModel):
    topic: str
    length: Optional[int] = 100  # Default to 100 words
    do_research: bool = True
    do_generate_outline: bool = True
    do_generate_article: bool = True
    do_polish_article: bool = True

class StormArticleResponse(BaseModel):
    content: str
    outline: Optional[str]
    sources: Dict[str, Any]
    polished_content: Optional[str]
    error: Optional[str] = None

class StormCitationRequest(BaseModel):
    text: str
    max_citations: Optional[int] = 3

class StormCitationResponse(BaseModel):
    citations: List[Dict[str, Any]]
    error: Optional[str] = None

# V1 Endpoints
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
        except Exception as e:
            logger.error(f"Error finding citations: {str(e)}\n{traceback.format_exc()}")
            citations = []

        return ArticleResponse(content=article_content, citations=citations)

    except Exception as e:
        logger.error(f"Error generating article: {str(e)}\n{traceback.format_exc()}")
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
            except Exception as e:
                logger.error(f"Error processing term '{term}': {str(e)}")
                continue
                
        return {"citations": citations}
        
    except Exception as e:
        logger.error(f"Error finding citations: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# V2 Endpoints
@app.post("/v2/generate-article", response_model=StormArticleResponse)
async def generate_article_v2(request: StormArticleRequest):
    try:
        logger.info(f"Starting article generation for topic: {request.topic}")
        runner = init_storm()
        
        # Create a unique directory with a safe filename
        safe_topic = create_safe_filename(request.topic)
        topic_dir = Path(f"./results/api_generated/{safe_topic}")
        topic_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created directory: {topic_dir}")
        
        try:
            # Run STORM pipeline with length control
            runner.run(
                topic=request.topic,
                do_research=request.do_research,
                do_generate_outline=request.do_generate_outline,
                do_generate_article=request.do_generate_article,
                do_polish_article=request.do_polish_article,
            )

            # If length is specified, we'll trim the article using GPT
            if request.do_generate_article and request.length:
                article_path = topic_dir / "storm_gen_article.txt"
                if article_path.exists():
                    original_content = article_path.read_text()
                    
                    # Use GPT to create a shorter version
                    response = client.chat.completions.create(
                        model="gpt-4",
                        messages=[
                            {"role": "system", "content": "You are an expert at summarizing articles while maintaining key information and citations."},
                            {"role": "user", "content": f"Summarize this article in approximately {request.length} words while preserving key points and any citations:\n\n{original_content}"}
                        ]
                    )
                    
                    shortened_content = response.choices[0].message.content
                    
                    # Save the shortened version
                    with open(article_path, 'w') as f:
                        f.write(shortened_content)
                    logger.info(f"Successfully shortened article to ~{request.length} words")

        except Exception as e:
            logger.error(f"Error in STORM pipeline: {str(e)}\n{traceback.format_exc()}")
            return StormArticleResponse(
                content="Error occurred during generation",
                outline=None,
                sources={},
                polished_content=None,
                error=f"Pipeline error: {str(e)}"
            )
        
        # Read results
        content = ""
        outline = ""
        polished_content = ""
        sources = {}
        
        try:
            if request.do_generate_article:
                article_path = topic_dir / "storm_gen_article.txt"
                if article_path.exists():
                    content = article_path.read_text()
                    logger.info("Successfully read article content")
            
            if request.do_generate_outline:
                outline_path = topic_dir / "storm_gen_outline.txt"
                if outline_path.exists():
                    outline = outline_path.read_text()
                    logger.info("Successfully read outline")
            
            if request.do_polish_article:
                polished_path = topic_dir / "storm_gen_article_polished.txt"
                if polished_path.exists():
                    polished_content = polished_path.read_text()
                    logger.info("Successfully read polished content")
            
            sources_path = topic_dir / "url_to_info.json"
            if sources_path.exists():
                sources = json.loads(sources_path.read_text())
                logger.info(f"Successfully loaded sources data")
        except Exception as e:
            logger.error(f"Error reading results: {str(e)}\n{traceback.format_exc()}")
        
        return StormArticleResponse(
            content=content,
            outline=outline if outline else None,
            sources=sources,
            polished_content=polished_content if polished_content else None
        )
        
    except Exception as e:
        error_msg = f"Error generating article: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/v2/find-citations", response_model=StormCitationResponse)
async def find_citations_v2(request: StormCitationRequest):
    try:
        logger.info(f"Starting citation search for text: {request.text[:100]}...")
        
        # Create base directory
        base_dir = Path("./results/api_generated")
        base_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # Initialize You.com search
            ydc_api_key = os.getenv("YDC_API_KEY")
            if not ydc_api_key:
                raise ValueError("YDC_API_KEY not found in environment variables")
            
            rm = YouRM(ydc_api_key=ydc_api_key, k=request.max_citations * 2)
            logger.info("Successfully initialized You.com search")
            
            # Search using YouRM's forward method
            logger.info("Starting search")
            search_results = rm.forward(request.text)
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
            
            return StormCitationResponse(
                citations=citations,
                error=None
            )
            
        except Exception as e:
            logger.error(f"Error in citation search: {str(e)}\n{traceback.format_exc()}")
            return StormCitationResponse(
                citations=[],
                error=f"Citation search error: {str(e)}"
            )
            
    except Exception as e:
        error_msg = f"Error finding citations: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
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
