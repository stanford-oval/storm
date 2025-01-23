"""
This STORM Wiki pipeline powered by GPT-4o-mini and GPT-4l and DuckDuckGo retrieval mode.

Installation instructions:

git clone https://github.com/stanford-oval/storm.git
cd storm
python -m venv .
.\Scripts\activate
pip install -r requirements.txt
pip install duckduckgo_search

**Since I wanted to latest updates I intentionally did NOT pip install knowledge_storm.  Thus, this script is geared towards that
installation procedure only.

Create secrets.toml in the installation directory with the following:
OPENAI_API_KEY="[INSERT KEY HERE]"
OPENAI_API_TYPE="openai"

Put this script in the directory and run it:
python run_storm_wiki_gpt_with_DuckDuckGo_RM.py

The command prompt will ask you for a search topic and will eventually run to completion.

Output will be structured as follows:
args.output_dir/
├── topic_name/
    ├── conversation_log.json           # Log of information-seeking conversation
    ├── raw_search_results.json         # Raw search results from search engine
    ├── direct_gen_outline.txt          # Outline directly generated with LLM's parametric knowledge
    ├── storm_gen_outline.txt           # Outline refined with collected information
    ├── url_to_info.json                # Sources that are used in the final article
    ├── storm_gen_article.txt           # Final article generated
    └── storm_gen_article_polished.txt  # Polished final article (if args.do_polish_article is True)

PLEASE NOTE:

(1)  This script DOES NOT accept command line argument flags.  Rather, the "do_research," "do_generate_outline," "do_generate_article,"
and "do_polish_article" are hardcoded into the script.  I found that this more easily allows users to, for example, pull updated
settings from a config.yaml file or pass them from a graphical user interface.

(2)  DuckDuckGo has extreme rate limiting.  This script deals with that through various strategies while still complying with robots.txt.
Just be aware, it'll take approximately 20 minutes to finish due to all of the backoffs and retries, but it will in-fact complete.

(3) In my test, researching "floating point numbers" cost:

+------------------------+--------+--------+
| Model                  |  Type  |  Cost  |
+------------------------+--------+--------+
| gpt-4o-mini-2024-07-18 | input  | $0.01  |
| gpt-4o-mini-2024-07-18 | output | $0.02  |
| chatgpt-4o-latest      | input  | $0.16  |
| chatgpt-4o-latest      | output | $0.13  |
+------------------------+--------+--------+
"""

import os
from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.rm import DuckDuckGoSearchRM, backoff_hdlr, giveup_hdlr
from knowledge_storm.lm import OpenAIModel
from knowledge_storm.utils import load_api_key
from duckduckgo_search.exceptions import DuckDuckGoSearchException
import random
import time
import backoff
from typing import Dict, List

# This class inherits from knowledge_storm's and builds upon it.  This is absolutely necessary due to DuckDuckGo's extreme rate limiting.
class EnhancedDuckDuckGoSearchRM(DuckDuckGoSearchRM):
    # NOTE, these are windows-specific.
    WINDOWS_PLATFORMS = [
        'Windows NT 10.0; Win64; x64',
        'Windows NT 10.0; WOW64',
        'Windows NT 10.0',
        'Windows NT 6.3; Win64; x64',
        'Windows NT 6.2; Win64; x64',
        'Windows NT 6.1; Win64; x64'
    ]
    
    MODERN_BROWSERS = [
        'Chrome/120.0.0.0',
        'Chrome/119.0.0.0',
        'Chrome/118.0.0.0',
        'Edge/120.0.0.0',
        'Edge/119.0.0.0',
        'Firefox/120.0',
        'Firefox/119.0'
    ]
    
    def __init__(
        self,
        k: int = 3,
        safe_search: str = "On",
        region: str = "us-en",
        min_char_count: int = 150,
        snippet_chunk_size: int = 1000,
        webpage_helper_max_threads: int = 10,
        request_delay: float = 0.2,
        max_retries: int = 8,
        max_time: int = 1000,
        backend: str = "auto"
    ):
        super().__init__(
            k=k,
            safe_search=safe_search,
            region=region,
            min_char_count=min_char_count,
            snippet_chunk_size=snippet_chunk_size,
            webpage_helper_max_threads=webpage_helper_max_threads
        )
        self.request_delay = request_delay
        self.current_delay = request_delay
        self.max_retries = max_retries
        self.max_time = max_time
        self.request_count = 0
        self.duck_duck_go_backend = backend

    def get_random_headers(self) -> Dict[str, str]:
        """Generate random headers to mimic different browsers"""
        platform = random.choice(self.WINDOWS_PLATFORMS)
        browser = random.choice(self.MODERN_BROWSERS)
        user_agent = f'Mozilla/5.0 ({platform}) AppleWebKit/537.36 (KHTML, like Gecko) {browser}'
        
        return {
            'User-Agent': user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        }

    def custom_backoff_handler(self, details):
        pass

    def custom_giveup_handler(self, exc):
        return False

    def get_backoff_decorator(self):
        return backoff.on_exception(
            backoff.expo,
            Exception,
            max_time=self.max_time,
            max_tries=self.max_retries,
            on_backoff=self.custom_backoff_handler,
            giveup=self.custom_giveup_handler
        )

    @property
    def request(self):
        @self.get_backoff_decorator()
        def _request(query: str):
            try:
                self.request_count += 1
                random_delay = random.uniform(0.1, 5.0)
                time.sleep(random_delay)
                
                self.ddgs.headers = self.get_random_headers()
                
                results = self.ddgs.text(
                    query, 
                    max_results=self.k, 
                    backend=self.duck_duck_go_backend,
                    region=self.duck_duck_go_region,
                    safesearch=self.duck_duck_go_safe_search
                )
                
                self.current_delay = self.request_delay
                
                return results
                
            except DuckDuckGoSearchException as e:
                if "202 Ratelimit" in str(e):
                    self.current_delay *= 2
                    time.sleep(self.current_delay)
                
                raise

        return _request

    def forward(self, query_or_queries, exclude_urls=[]):
        return super().forward(query_or_queries, exclude_urls)

def main():
    load_api_key(toml_file_path='secrets.toml')

    lm_configs = STORMWikiLMConfigs()
    openai_kwargs = {
        'api_key': os.getenv("OPENAI_API_KEY"),
        # feel free to change these two
        'temperature': 1.0,
        'top_p': 0.9,
    }

    gpt_35 = OpenAIModel(model='gpt-4o-mini', max_tokens=500, **openai_kwargs)
    gpt_4 = OpenAIModel(model='chatgpt-4o-latest', max_tokens=3000, **openai_kwargs)

    lm_configs.set_conv_simulator_lm(gpt_35)
    lm_configs.set_question_asker_lm(gpt_35)
    lm_configs.set_outline_gen_lm(gpt_4)
    lm_configs.set_article_gen_lm(gpt_4)
    lm_configs.set_article_polish_lm(gpt_4)

    engine_args = STORMWikiRunnerArguments(
        output_dir='./results',
        max_conv_turn=3,
        max_perspective=3,
        search_top_k=3,
        max_thread_num=3
    )

    # parameters set here will supersede the default values, which is sometime necessary with DuckDuckGo
    rm = EnhancedDuckDuckGoSearchRM(
        k=engine_args.search_top_k,
        # don't change these two parameters
        safe_search='On',
        backend='auto', # "api" has been deprecated in the duckduckgo_search library
        # but feel free to experiment with the rest
        region='us-en',
        min_char_count=100,
        snippet_chunk_size=800,
        webpage_helper_max_threads=1,
        request_delay=2.0,
        max_retries=12,
        max_time=2000
    )

    runner = STORMWikiRunner(engine_args, lm_configs, rm)

    topic = input('Topic: ')
    try:
        runner.run(
            topic=topic,
            do_research=True,
            do_generate_outline=True,
            do_generate_article=True,
            do_polish_article=True,
            remove_duplicate=True
        )
        runner.post_run()
        runner.summary()
    except Exception as e:
        print("\nFull exception details:")
        print("Type:", type(e))
        print("String:", str(e))
        print("Repr:", repr(e))
        print("Dir:", dir(e))
        if hasattr(e, 'args'):
            print("Args:", e.args)
        raise

if __name__ == "__main__":
    main()
