from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.lm import OpenAIModel
import os
import json

app = FastAPI()

class ArticleRequest(BaseModel):
    article_text: str
    search_top_k: int = 5
    topic: str = None
    do_polish_article: bool = True

def get_storm_runner(with_retrieval=False, search_top_k=3):
    lm_configs = STORMWikiLMConfigs()
    openai_kwargs = {
        'api_key': os.getenv("OPENAI_API_KEY"),
        'temperature': 1.0,
        'top_p': 0.9,
    }

    gpt_35_model_name = 'gpt-3.5-turbo'
    gpt_4_model_name = 'gpt-4'
    
    # Set up language models
    conv_simulator_lm = OpenAIModel(model=gpt_35_model_name, max_tokens=500, **openai_kwargs)
    question_asker_lm = OpenAIModel(model=gpt_35_model_name, max_tokens=500, **openai_kwargs)
    outline_gen_lm = OpenAIModel(model=gpt_4_model_name, max_tokens=400, **openai_kwargs)
    article_gen_lm = OpenAIModel(model=gpt_4_model_name, max_tokens=700, **openai_kwargs)
    article_polish_lm = OpenAIModel(model=gpt_4_model_name, max_tokens=4000, **openai_kwargs)

    lm_configs.set_conv_simulator_lm(conv_simulator_lm)
    lm_configs.set_question_asker_lm(question_asker_lm)
    lm_configs.set_outline_gen_lm(outline_gen_lm)
    lm_configs.set_article_gen_lm(article_gen_lm)
    lm_configs.set_article_polish_lm(article_polish_lm)

    engine_args = STORMWikiRunnerArguments(
        output_dir="./results",
        max_conv_turn=3,
        max_perspective=3,
        search_top_k=search_top_k if with_retrieval else 0,
        max_thread_num=3,
    )

    # Initialize retrieval module if needed
    rm = None
    if with_retrieval:
        from knowledge_storm.rm import YouRM
        rm = YouRM(ydc_api_key=os.getenv('YDC_API_KEY'), k=search_top_k)

    return STORMWikiRunner(engine_args, lm_configs, rm=rm)

def extract_topic(article_text: str, lm_config: STORMWikiLMConfigs) -> str:
    """Extract main topic from article text using LLM."""
    prompt = f"""Extract the main topic or subject from this text in 2-3 words:
    
    {article_text[:1000]}...
    
    Topic:"""
    
    response = lm_config.conv_simulator_lm.complete(prompt)
    return response.strip()

def ensure_results_dir():
    """Ensure the results directory exists"""
    os.makedirs("./results", exist_ok=True)

@app.post("/generate-with-citations")
async def generate_with_citations(request: ArticleRequest):
    try:
        ensure_results_dir()
        
        # Initialize STORM with retrieval enabled
        runner = get_storm_runner(with_retrieval=True, search_top_k=request.search_top_k)
        
        # Extract topic if not provided
        topic = request.topic
        if not topic:
            topic = extract_topic(request.article_text, runner.lm_configs)
        
        # Save the article to a temporary file
        output_dir = os.path.join("./results", topic.replace(" ", "_").lower())
        os.makedirs(output_dir, exist_ok=True)
        
        article_path = os.path.join(output_dir, "input_article.txt")
        with open(article_path, "w") as f:
            f.write(request.article_text)
            
        # Create initial conversation log
        conv_log_path = os.path.join(output_dir, "conversation_log.json")
        if not os.path.exists(conv_log_path):
            with open(conv_log_path, "w") as f:
                json.dump([], f)
        
        # Run the full pipeline
        runner.run(
            topic=topic,
            do_research=True,
            do_generate_outline=True,
            do_generate_article=True,
            do_polish_article=request.do_polish_article,
        )
        
        # Collect all results
        response = {
            "topic": topic,
            "original_text": request.article_text
        }
        
        # Get the outline
        try:
            with open(os.path.join(output_dir, "storm_gen_outline.txt")) as f:
                response["outline"] = f.read()
        except FileNotFoundError:
            response["outline"] = None
            
        # Get the generated article
        try:
            article_file = "storm_gen_article_polished.txt" if request.do_polish_article else "storm_gen_article.txt"
            with open(os.path.join(output_dir, article_file)) as f:
                response["generated_article"] = f.read()
        except FileNotFoundError:
            response["generated_article"] = None
            
        # Get the citations/search results
        try:
            with open(os.path.join(output_dir, "raw_search_results.json"), "r") as f:
                response["citations"] = json.load(f)
        except FileNotFoundError:
            response["citations"] = []
            
        response["message"] = f"Found {len(response.get('citations', []))} citations"
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 