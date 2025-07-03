from celery_config import celery_app, send_webhook_with_retry
from knowledge_storm import STORMWikiRunner, STORMWikiRunnerArguments, STORMWikiLMConfigs
from knowledge_storm.rm import SerperRM, YouRM
from knowledge_storm.lm import LitellmModel
from knowledge_storm.utils import truncate_filename
import logging
import os
from dotenv import load_dotenv
from pathlib import Path
import json
import shutil
import re
import hashlib
import time
import uuid
from datetime import datetime

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

def sanitize_topic(topic: str) -> str:
    """
    Sanitize the topic name for use in file names.
    Remove or replace characters that are not allowed in file names.
    """
    # Replace spaces with underscores and forward slashes with underscores
    topic = topic.replace(" ", "_").replace("/", "_")
    # Truncate to avoid filesystem limits
    topic = truncate_filename(topic, max_length=125)
    
    logger.info(f"Sanitized topic: '{topic}' from original: '{topic}'")
    return topic

def verify_directory_permissions(path: Path) -> bool:
    """Verify that the directory exists and is writable."""
    try:
        path.mkdir(parents=True, exist_ok=True)
        test_file = path / '.write_test'
        test_file.touch()
        test_file.unlink()
        return True
    except (PermissionError, OSError) as e:
        logger.error(f"Directory permission error at {path}: {str(e)}")
        return False

def generate_unique_dir_name(topic: str) -> str:
    """
    Generate a unique directory name using topic, timestamp and UUID.
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]  # Use first 8 chars of UUID for brevity
    return f"{timestamp}_{unique_id}"

@celery_app.task(bind=True)
def generate_article_task(self, article_params: dict, webhook_url: str, metadata: dict):
    """
    Celery task for article generation
    """
    base_dir = None
    task_dir = None
    try:
        # Initialize LM configurations
        lm_configs = STORMWikiLMConfigs()
        
        # Common parameters for language models
        openai_kwargs = {
            'api_key': os.getenv("OPENROUTER_API_KEY"),
            'api_base': "https://openrouter.ai/api/v1",
            'temperature': 1.0,
            'top_p': 0.9,
        }

        llm_provider = article_params.get('openai')
        
        logger.info(f"Using webhook url: {webhook_url}")
        # Configure model names based on provider
        # For OpenRouter, use the model name without the openrouter/ prefix
        gpt_4o_mini_model_name = 'openai/gpt-4o-mini'
        gpt_4_model_name = 'openai/gpt-4o'
        
        logger.info(f"Using LLM provider: {llm_provider} with models {gpt_4o_mini_model_name} and {gpt_4_model_name}")
        
        # Use LitellmModel instead of OpenAIModel for better provider compatibility
        conv_simulator_lm = LitellmModel(
            model=gpt_4o_mini_model_name, 
            max_tokens=article_params.get('conv_simulator_max_tokens', 500), 
            **openai_kwargs
        )
        question_asker_lm = LitellmModel(
            model=gpt_4o_mini_model_name, 
            max_tokens=article_params.get('question_asker_max_tokens', 500), 
            **openai_kwargs
        )
        outline_gen_lm = LitellmModel(
            model=gpt_4_model_name, 
            max_tokens=article_params.get('outline_gen_max_tokens', 400), 
            **openai_kwargs
        )
        article_gen_lm = LitellmModel(
            model=gpt_4_model_name, 
            max_tokens=article_params.get('article_gen_max_tokens', 700), 
            **openai_kwargs
        )
        article_polish_lm = LitellmModel(
            model=gpt_4_model_name, 
            max_tokens=article_params.get('article_polish_max_tokens', 1000), 
            **openai_kwargs
        )

        # Set LM configurations
        lm_configs.set_conv_simulator_lm(conv_simulator_lm)
        lm_configs.set_question_asker_lm(question_asker_lm)
        lm_configs.set_outline_gen_lm(outline_gen_lm)
        lm_configs.set_article_gen_lm(article_gen_lm)
        lm_configs.set_article_polish_lm(article_polish_lm)

        # Create base directory for results using absolute path
        base_dir = Path(f"./results/api_generated")
        base_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created/verified base directory at {base_dir}")

        if not verify_directory_permissions(base_dir):
            raise RuntimeError(f"Cannot write to directory: {base_dir}")

        # Create a unique task directory
        unique_dir = generate_unique_dir_name(article_params['topic'])
        task_dir = base_dir / unique_dir
        task_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created task directory at {task_dir}")


        # Initialize engine arguments with absolute path
        engine_args = STORMWikiRunnerArguments(
            output_dir=str(task_dir),
            max_conv_turn=3,
            max_perspective=3,
            search_top_k=3,
            max_thread_num=3,
        )
        
        # Get the language parameter, defaulting to 'en' if not specified
        language = article_params.get('language', 'en')
        logger.info(f"Using language: {language}")
        
        # Configure Serper RM with API key from environment
        serper_api_key = os.getenv("SERPER_API_KEY")
        ydc_api_key = os.getenv("YDC_API_KEY")
        if serper_api_key:
            if article_params.get('use_scholar', False):
                query_params = {
                    'autocorrect': True, 
                    'num': 10, 
                    'page': 1,
                    'type': 'scholar',
                    'engine': 'google-scholar'
                }
                logger.info("Using Google Scholar search for research")
            else:
                query_params = {
                    'autocorrect': True, 
                    'num': 10, 
                    'page': 1,
                    'type': 'search',
                    'engine': 'google'
                }
                
            # Add language to search query parameters
            # For Portuguese, setting gl parameter to 'br' (Brazil) or 'pt' (Portugal)
            # and hl parameter to 'pt' (Portuguese language)
            if language == 'pt':
                query_params['gl'] = 'br'  # Country: Brazil
                query_params['hl'] = 'pt-br'  # Language: Portuguese
            elif language != 'en':
                # Handle other languages
                query_params['hl'] = language
                
            rm = SerperRM(
                serper_search_api_key=serper_api_key,
                query_params=query_params
            )
        elif ydc_api_key:
            rm = YouRM(ydc_api_key=ydc_api_key, k=engine_args.search_top_k)
        else:
            raise ValueError("SERPER_API_KEY or YDC_API_KEY not found in environment variables")
        

        # Initialize STORM runner with all components
        runner = STORMWikiRunner(engine_args, lm_configs, rm)
        
        # Extract parameters
        topic = article_params.get('topic')
        do_research = article_params.get('do_research', True)
        do_generate_outline = article_params.get('do_generate_outline', True)
        do_generate_article = article_params.get('do_generate_article', True)
        do_polish_article = article_params.get('do_polish_article', True)
        remove_duplicate = article_params.get('remove_duplicate', False)
        
        # Pass language info to runner context
        runner.language = language
        
        # Run article generation
        result = runner.run(
            topic=topic,
            do_research=do_research,
            do_generate_outline=do_generate_outline,
            do_generate_article=do_generate_article,
            do_polish_article=do_polish_article,
            remove_duplicate=remove_duplicate
        )
        
        # List directory contents after generation
        logger.info(f"Files in {task_dir}:")
        for file in task_dir.glob('*'):
            logger.info(f"Found file: {file.name} - Size: {file.stat().st_size} bytes")
        
        # Add small delay to ensure file system sync
        time.sleep(1)
        
        # Read results from files
        content = ""
        outline = ""
        polished_content = ""
        sources = {}
        
        try:
            if do_generate_article:
                article_path = task_dir / sanitize_topic(topic) / "storm_gen_article.txt"
                logger.info(f"Checking for article at: {article_path}")
                if article_path.exists():
                    content = article_path.read_text()
                    logger.info(f"Read article content from {article_path}, length: {len(content)} chars")
                else:
                    logger.warning(f"Article file not found at {article_path}")
                    # List parent directory contents
                    logger.info(f"Parent directory contents:")
                    for file in article_path.parent.glob('*'):
                        logger.info(f"- {file.name}")
            
            if do_generate_outline:
                outline_path = task_dir / sanitize_topic(topic) / "storm_gen_outline.txt"
                if outline_path.exists():
                    outline = outline_path.read_text()
                    logger.info(f"Read outline from {outline_path}, length: {len(outline)} chars")
                else:
                    logger.warning(f"Outline file not found at {outline_path}")
            
            if do_polish_article:
                polished_path = task_dir / sanitize_topic(topic) / "storm_gen_article_polished.txt"
                if polished_path.exists():
                    polished_content = polished_path.read_text()
                    logger.info(f"Read polished content from {polished_path}, length: {len(polished_content)} chars")
                else:
                    logger.warning(f"Polished article file not found at {polished_path}")
            
            sources_path = task_dir / sanitize_topic(topic) / "url_to_info.json"
            if sources_path.exists():
                sources = json.loads(sources_path.read_text())
                logger.info(f"Read sources from {sources_path}, found {len(sources)} sources")
            else:
                logger.warning(f"Sources file not found at {sources_path}")
            
            # Prepare success response
            payload = {
                "status": "success",
                "result": {
                    "content": content if content else "No content generated",
                    "outline": outline if outline else None,
                    "sources": sources,
                    "polished_content": polished_content if polished_content else None,
                    "error": None
                },
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Error reading results: {str(e)}")
            payload = {
                "status": "error",
                "result": {
                    "content": "Error reading results",
                    "outline": None,
                    "sources": {},
                    "polished_content": None,
                    "error": str(e)
                },
                "metadata": metadata
            }
            
    except Exception as e:
        logger.error(f"Error in article generation: {str(e)}")
        payload = {
            "status": "error",
            "result": {
                "content": "Error generating article",
                "outline": None,
                "sources": {},
                "polished_content": None,
                "error": str(e)
            },
            "metadata": metadata
        }
    
    finally:
        # Cleanup directory after reading all files
        if task_dir and task_dir.exists():
            shutil.rmtree(task_dir)
            logger.info(f"Cleaned up directory: {task_dir}")
    
    # Send webhook with retries
    send_webhook_with_retry(webhook_url, payload) 