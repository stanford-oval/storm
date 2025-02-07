from celery_config import celery_app, send_webhook_with_retry
from knowledge_storm import STORMWikiRunner, STORMWikiRunnerArguments, STORMWikiLMConfigs
from knowledge_storm.rm import SerperRM, YouRM
from knowledge_storm.lm import OpenAIModel
import logging
import os
from dotenv import load_dotenv
from pathlib import Path
import json
import shutil
import re
import hashlib
import time

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

def create_safe_filename(text: str, max_length: int = 50) -> str:
    """Create a safe, shortened filename from text."""
    safe_text = re.sub(r'[^\w\s-]', '', text.lower())
    safe_text = re.sub(r'[-\s]+', '_', safe_text)
    
    if len(safe_text) > max_length:
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        safe_text = f"{safe_text[:max_length]}_{text_hash}"
    
    return safe_text

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

@celery_app.task(bind=True)
def generate_article_task(self, article_params: dict, webhook_url: str, metadata: dict):
    """
    Celery task for article generation
    """
    topic_dir = None
    try:
        # Initialize LM configurations
        lm_configs = STORMWikiLMConfigs()
        openai_kwargs = {
            'api_key': os.getenv("OPENAI_API_KEY"),
            'temperature': 1.0,
            'top_p': 0.9,
        }

        # Configure language models
        gpt_35_model_name = 'gpt-3.5-turbo'
        gpt_4_model_name = 'gpt-4o'

        # Initialize different LMs for different components
        conv_simulator_lm = OpenAIModel(model=gpt_35_model_name, max_tokens=10, **openai_kwargs)
        question_asker_lm = OpenAIModel(model=gpt_35_model_name, max_tokens=10, **openai_kwargs)
        outline_gen_lm = OpenAIModel(model=gpt_4_model_name, max_tokens=100, **openai_kwargs)
        article_gen_lm = OpenAIModel(model=gpt_4_model_name, max_tokens=150, **openai_kwargs)
        article_polish_lm = OpenAIModel(model=gpt_4_model_name, max_tokens=150, **openai_kwargs)

        # Set LM configurations
        lm_configs.set_conv_simulator_lm(conv_simulator_lm)
        lm_configs.set_question_asker_lm(question_asker_lm)
        lm_configs.set_outline_gen_lm(outline_gen_lm)
        lm_configs.set_article_gen_lm(article_gen_lm)
        lm_configs.set_article_polish_lm(article_polish_lm)

        # Create base directory for results using absolute path
        base_dir = Path(f"/app/results/api_generated")
        base_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created/verified base directory at {base_dir}")

        if not verify_directory_permissions(base_dir):
            raise RuntimeError(f"Cannot write to directory: {base_dir}")

        # Initialize engine arguments with absolute path
        engine_args = STORMWikiRunnerArguments(
            output_dir=str(base_dir),  # Convert Path to string
            max_conv_turn=3,
            max_perspective=3,
            search_top_k=3,
            max_thread_num=3,
        )
        
        # Configure Serper RM with API key from environment
        serper_api_key = os.getenv("SERPER_API_KEY")
        ydc_api_key = os.getenv("YDC_API_KEY")
        if serper_api_key:
            rm = SerperRM(
            serper_search_api_key=serper_api_key,
            query_params={'autocorrect': True, 'num': 10, 'page': 1}
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
        
        # Create a unique directory with a safe filename
        safe_topic = create_safe_filename(article_params['topic'])
        topic_dir = base_dir / safe_topic
        topic_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created topic directory at {topic_dir}")
        
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
        logger.info(f"Files in {topic_dir}:")
        for file in topic_dir.glob('*'):
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
                article_path = topic_dir / "storm_gen_article.txt"
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
                outline_path = topic_dir / "storm_gen_outline.txt"
                if outline_path.exists():
                    outline = outline_path.read_text()
                    logger.info(f"Read outline from {outline_path}, length: {len(outline)} chars")
                else:
                    logger.warning(f"Outline file not found at {outline_path}")
            
            if do_polish_article:
                polished_path = topic_dir / "storm_gen_article_polished.txt"
                if polished_path.exists():
                    polished_content = polished_path.read_text()
                    logger.info(f"Read polished content from {polished_path}, length: {len(polished_content)} chars")
                else:
                    logger.warning(f"Polished article file not found at {polished_path}")
            
            sources_path = topic_dir / "url_to_info.json"
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
        if topic_dir and topic_dir.exists():
            shutil.rmtree(topic_dir)
            logger.info(f"Cleaned up directory: {topic_dir}")
    
    # Send webhook with retries
    send_webhook_with_retry(webhook_url, payload) 