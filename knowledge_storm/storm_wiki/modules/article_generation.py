import concurrent.futures
import copy
import logging
from concurrent.futures import as_completed
from typing import List, Union

import dspy

from .callback import BaseCallbackHandler
from .storm_dataclass import StormInformationTable, StormArticle
from ...interface import ArticleGenerationModule, Information
from ...utils import ArticleTextProcessing


class StormArticleGenerationModule(ArticleGenerationModule):
    """
    The interface for article generation stage. Given topic, collected information from
    knowledge curation stage, generated outline from outline generation stage,
    """

    def __init__(
        self,
        article_gen_lm=Union[dspy.dsp.LM, dspy.dsp.HFModel],
        retrieve_top_k: int = 5,
        max_thread_num: int = 10,
        custom_sources: List[Information] = None,
        news_mode: bool = False,
    ):
        super().__init__()
        self.retrieve_top_k = retrieve_top_k
        self.article_gen_lm = article_gen_lm
        self.max_thread_num = max_thread_num
        self.section_gen = ConvToSection(engine=self.article_gen_lm, news_mode=news_mode)
        self.custom_sources = custom_sources or []

    def generate_section(
        self, topic, section_name, information_table, section_outline, section_query
    ):
        collected_info: List[Information] = []
        if information_table is not None:
            collected_info = information_table.retrieve_information(
                queries=section_query, search_top_k=self.retrieve_top_k
            )
            
        # Add custom sources to the collected information
        if self.custom_sources:
            collected_info.extend(self.custom_sources)
            
        output = self.section_gen(
            topic=topic,
            outline=section_outline,
            section=section_name,
            collected_info=collected_info,
        )
        return {
            "section_name": section_name,
            "section_content": output.section,
            "collected_info": collected_info,
        }

    def generate_article(
        self,
        topic: str,
        information_table: StormInformationTable,
        article_with_outline: StormArticle,
        callback_handler: BaseCallbackHandler = None,
    ) -> StormArticle:
        """
        Generate article for the topic based on the information table and article outline.

        Args:
            topic (str): The topic of the article.
            information_table (StormInformationTable): The information table containing the collected information.
            article_with_outline (StormArticle): The article with specified outline.
            callback_handler (BaseCallbackHandler): An optional callback handler that can be used to trigger
                custom callbacks at various stages of the article generation process. Defaults to None.
        """
        information_table.prepare_table_for_retrieval()

        if article_with_outline is None:
            article_with_outline = StormArticle(topic_name=topic)

        sections_to_write = article_with_outline.get_first_level_section_names()

        section_output_dict_collection = []
        if len(sections_to_write) == 0:
            logging.error(
                f"No outline for {topic}. Will directly search with the topic."
            )
            section_output_dict = self.generate_section(
                topic=topic,
                section_name=topic,
                information_table=information_table,
                section_outline="",
                section_query=[topic],
            )
            section_output_dict_collection = [section_output_dict]
        else:
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=self.max_thread_num
            ) as executor:
                future_to_sec_title = {}
                for section_title in sections_to_write:
                    # We don't want to write a separate introduction section.
                    if section_title.lower().strip() == "introduction":
                        continue
                        # We don't want to write a separate conclusion section.
                    if section_title.lower().strip().startswith(
                        "conclusion"
                    ) or section_title.lower().strip().startswith("summary"):
                        continue
                    section_query = article_with_outline.get_outline_as_list(
                        root_section_name=section_title, add_hashtags=False
                    )
                    queries_with_hashtags = article_with_outline.get_outline_as_list(
                        root_section_name=section_title, add_hashtags=True
                    )
                    section_outline = "\n".join(queries_with_hashtags)
                    future_to_sec_title[
                        executor.submit(
                            self.generate_section,
                            topic,
                            section_title,
                            information_table,
                            section_outline,
                            section_query,
                        )
                    ] = section_title

                for future in as_completed(future_to_sec_title):
                    section_output_dict_collection.append(future.result())

        article = copy.deepcopy(article_with_outline)
        for section_output_dict in section_output_dict_collection:
            article.update_section(
                parent_section_name=topic,
                current_section_content=section_output_dict["section_content"],
                current_section_info_list=section_output_dict["collected_info"],
            )
            
        # Ensure custom sources are added to the article's references
        if self.custom_sources:
            # Add custom sources to the article's references using the merge method
            article._merge_new_info_to_references(self.custom_sources)
                
        article.post_processing()
        return article


class ConvToSection(dspy.Module):
    """Use the information collected from the information-seeking conversation to write a section."""

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel], news_mode: bool = False):
        super().__init__()
        self.write_section = dspy.Predict(WriteSection)
        self.engine = engine
        self.news_mode = news_mode

    def forward(
        self, topic: str, outline: str, section: str, collected_info: List[Information]
    ):
        info = ""
        for idx, storm_info in enumerate(collected_info):
            info += f"[{idx + 1}]\n" + "\n".join(storm_info.snippets)
            info += "\n\n"

        info = ArticleTextProcessing.limit_word_count_preserve_newline(info, 1500)

        # Prepare parameters, ensuring backward compatibility
        params = {
            "topic": topic,
            "info": info,
            "section": section,
        }
        
        # Only add news_mode if it's defined in the class
        if hasattr(self, 'news_mode'):
            params["news_mode"] = str(self.news_mode)

        with dspy.settings.context(lm=self.engine):
            section = ArticleTextProcessing.clean_up_section(
                self.write_section(**params).output
            )

        return dspy.Prediction(section=section)


class WriteSection(dspy.Signature):
    """Write a section based on the collected information. You will be given the topic, the section you are writing and relevant information.
    Each information will be provided with the raw content along with question and query lead to that information.
    
    If news_mode is True:
    Write in a news article style that presents facts while maintaining a clear perspective. Follow these guidelines:
    1. Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, "###" Title" to indicate subsubsection title, and so on.
    2. Use [1], [2], ..., [n] in line (for example, "Washington, D.C., is the capital of the United States.[1][3].") to cite your sources.
    3. Follow journalistic writing principles:
       - Present key facts first, then provide context and analysis
       - Attribute statements and claims to specific sources
       - Use precise language over dramatic flourishes
       - Maintain a professional tone even when expressing a perspective
    4. Present a clear viewpoint but support it with evidence and reasoned argument
    5. Include multiple perspectives when relevant, even if you ultimately favor one position
    6. Avoid overly emotional language, rhetorical questions, and excessive adjectives
    
    If news_mode is False or not specified:
    Write a Wikipedia section based on the collected information.
    Here is the format of your writing:
    1. Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, "###" Title" to indicate subsubsection title, and so on.
    2. Use [1], [2], ..., [n] in line (for example, "Washington, D.C., is the capital of the United States.[1][3]."). You DO NOT need to include a References or Sources section to list the sources at the end.
    """

    info = dspy.InputField(prefix="The collected information:\n", format=str)
    topic = dspy.InputField(prefix="The topic of the page: ", format=str)
    section = dspy.InputField(prefix="The section you need to write: ", format=str)
    news_mode = dspy.InputField(prefix="Whether to write in news style (True/False): ", format=str, required=False)
    output = dspy.OutputField(
        prefix="Write the section with proper inline citations (Start your writing with # section title. Don't include the page title or try to write other sections):\n",
        format=str,
    )
