import os
from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.lm import OpenAIModel
from knowledge_storm.rm import YouRM

OPENAI_API_KEY="sk-GeCKZFOuJoUidsnvKiF33Di9WMlkTI4vr97zu1ZS3grYIwxx"
BASE_URL="https://api.fe8.cn/v1"
YOU_API_KEY="3235af6c-829c-4274-ad32-987418079a78<__>1Pi6xMETU8N2v5f4keJJyP5a"

lm_configs = STORMWikiLMConfigs()
openai_kwargs = {
    'api_key': OPENAI_API_KEY,
    'temperature': 1.0,
    'top_p': 0.9,
    'base_url': BASE_URL
}
# STORM is a LM system so different components can be powered by different models to reach a good balance between cost and quality.
# For a good practice, choose a cheaper/faster model for `conv_simulator_lm` which is used to split queries, synthesize answers in the conversation.
# Choose a more powerful model for `article_gen_lm` to generate verifiable text with citations.
gpt_35 = OpenAIModel(model='gpt-3.5-turbo', max_tokens=500, **openai_kwargs)
gpt_4 = OpenAIModel(model='gpt-4-o', max_tokens=3000, **openai_kwargs)
lm_configs.set_conv_simulator_lm(gpt_35)
lm_configs.set_question_asker_lm(gpt_35)
lm_configs.set_outline_gen_lm(gpt_4)
lm_configs.set_article_gen_lm(gpt_4)
lm_configs.set_article_polish_lm(gpt_4)
# Check out the STORMWikiRunnerArguments class for more configurations.
engine_args = STORMWikiRunnerArguments(...)
rm = YouRM(ydc_api_key=YOU_API_KEY, k=engine_args.search_top_k)
runner = STORMWikiRunner(engine_args, lm_configs, rm)

topic = "Large Language Model, Correlation and Causal Inference"
runner.run(
    topic=topic,
    do_research=True,
    do_generate_outline='output',
    do_generate_article=True,
    do_polish_article=True,
)
runner.post_run()
runner.summary()