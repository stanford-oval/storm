from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.lm import OpenAIModel
import os

app = FastAPI()

class GenerateRequest(BaseModel):
    topic: str
    do_polish_article: bool = True

class CitationRequest(BaseModel):
    article_text: str
    search_top_k: int = 5
    topic: str = None

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
        output_dir=None,  # No file output needed
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

@app.post("/generate")
async def generate_article(request: GenerateRequest):
    try:
        # Initialize STORM without retrieval
        runner = get_storm_runner(with_retrieval=False)
        
        # Generate article
        results = runner.run(
            topic=request.topic,
            do_research=False,
            do_generate_outline=True,
            do_generate_article=True,
            do_polish_article=request.do_polish_article,
            return_results=True
        )
        
        return {
            "topic": request.topic,
            "outline": results.get("outline"),
            "article": results.get("article")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/find-citations")
async def find_citations(request: CitationRequest):
    try:
        # Initialize STORM with retrieval enabled
        runner = get_storm_runner(with_retrieval=True, search_top_k=request.search_top_k)
        
        # Extract topic if not provided
        topic = request.topic
        if not topic:
            topic = extract_topic(request.article_text, runner.lm_configs)
        
        # Run research to find citations
        results = runner.run(
            topic=topic,
            article_text=request.article_text,
            do_research=True,
            do_generate_outline=False,
            do_generate_article=False,
            do_polish_article=False,
            return_results=True
        )
        
        return {
            "topic": topic,
            "citations": results.get("citations", []),
            "message": f"Found {len(results.get('citations', []))} citations"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 