import functools
import logging
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from typing import Dict, List, Optional, Union

logging.basicConfig(level=logging.INFO, format='%(name)s : %(levelname)-8s : %(message)s')
logger = logging.getLogger(__name__)


class Information(ABC):
    """Abstract base class to represent basic information.

    Attributes:
        uuid (str): The unique identifier for the information.
        meta (dict): The meta information associated with the information.
    """

    def __init__(self, uuid, meta={}):
        self.uuid = uuid
        self.meta = meta


class InformationTable(ABC):
    """
    The InformationTable class serves as data class to store the information
    collected during KnowledgeCuration stage.

    Create subclass to incorporate more information as needed. For example,
    in STORM paper https://arxiv.org/pdf/2402.14207.pdf, additional information
    would be perspective guided dialogue history.
    """

    def __init__(self):
        pass

    @abstractmethod
    def retrieve_information(**kwargs):
        pass


class ArticleSectionNode:
    """
    The ArticleSectionNode is the dataclass for handling the section of the article.
    The content storage, section writing preferences are defined in this node.
    """

    def __init__(self, section_name: str, content=None):
        """
        section_name: section heading in string format. E.g. Introduction, History, etc.
        content: content of the section. Up to you for design choice of the data structure.
        """
        self.section_name = section_name
        self.content = content
        self.children = []
        self.preference = None

    def add_child(self, new_child_node, insert_to_front=False):
        if insert_to_front:
            self.children.insert(0, new_child_node)
        else:
            self.children.append(new_child_node)

    def remove_child(self, child):
        self.children.remove(child)


class Article(ABC):
    def __init__(self, topic_name):
        self.root = ArticleSectionNode(topic_name)

    def find_section(self, node: ArticleSectionNode, name: str) -> Optional[ArticleSectionNode]:
        """
        Return the node of the section given the section name.

        Args:
            node: the node as the root to find.
            name: the name of node as section name

        Return:
            reference of the node or None if section name has no match
        """
        if node.section_name == name:
            return node
        for child in node.children:
            result = self.find_section(child, name)
            if result:
                return result
        return None

    @abstractmethod
    def to_string(self) -> str:
        """
        Export Article object into string representation.
        """

    def get_outline_tree(self):
        """
        Generates a hierarchical tree structure representing the outline of the document.

        Returns:
            Dict[str, Dict]: A nested dictionary representing the hierarchical structure of the document's outline.
                             Each key is a section name, and the value is another dictionary representing the child sections,
                             recursively forming the tree structure of the document's outline. If a section has no subsections,
                             its value is an empty dictionary.

        Example:
            Assuming a document with a structure like:
            - Introduction
                - Background
                - Objective
            - Methods
                - Data Collection
                - Analysis
            The method would return:
            {
                'Introduction': {
                    'Background': {},
                    'Objective': {}
                },
                'Methods': {
                    'Data Collection': {},
                    'Analysis': {}
                }
            }
        """

        def build_tree(node) -> Dict[str, Dict]:
            tree = {}
            for child in node.children:
                tree[child.section_name] = build_tree(child)
            return tree if tree else {}

        return build_tree(self.root)

    def get_first_level_section_names(self) -> List[str]:
        """
        Get first level section names
        """
        return [i.section_name for i in self.root.children]

    @classmethod
    @abstractmethod
    def from_string(cls, topic_name: str, article_text: str):
        """
        Create an instance of the Article object from a string
        """
        pass

    def prune_empty_nodes(self, node=None):
        if node is None:
            node = self.root

        node.children[:] = [child for child in node.children if self.prune_empty_nodes(child)]

        if (node.content is None or node.content == "") and not node.children:
            return None
        else:
            return node


class Retriever(ABC):
    """
    An abstract base class for retriever modules. It provides a template for retrieving information based on a query.

    This class should be extended to implement specific retrieval functionalities.
    Users can design their retriever modules as needed by implementing the retrieve method.
    The retrieval model/search engine used for each part should be declared with a suffix '_rm' in the attribute name.
    """

    def __init__(self, search_top_k):
        self.search_top_k = search_top_k

    def update_search_top_k(self, k):
        self.search_top_k = k

    def collect_and_reset_rm_usage(self):
        combined_usage = []
        for attr_name in self.__dict__:
            if '_rm' in attr_name and hasattr(getattr(self, attr_name), 'get_usage_and_reset'):
                combined_usage.append(getattr(self, attr_name).get_usage_and_reset())

        name_to_usage = {}
        for usage in combined_usage:
            for model_name, query_cnt in usage.items():
                if model_name not in name_to_usage:
                    name_to_usage[model_name] = query_cnt
                else:
                    name_to_usage[model_name] += query_cnt

        return name_to_usage

    @abstractmethod
    def retrieve(self, query: Union[str, List[str]], **kwargs) -> List[Information]:
        """
        Retrieves information based on a query.

        This method must be implemented by subclasses to specify how information is retrieved.

        Args:
            query (Union[str, List[str]]): The query or list of queries to retrieve information for.
            **kwargs: Additional keyword arguments that might be necessary for the retrieval process.

        Returns:
            List[Information]: A list of Information objects retrieved based on the query.
        """
        pass


class KnowledgeCurationModule(ABC):
    """
    The interface for knowledge curation stage. Given topic, return collected information.
    """

    def __init__(self, retriever: Retriever):
        """
        Store args and finish initialization.
        """
        self.retriever = retriever

    @abstractmethod
    def research(self, topic) -> InformationTable:
        """
        Curate information and knowledge for the given topic

        Args:
            topic: topic of interest in natural language.

        Returns:
            collected_information: collected information in InformationTable type.
        """
        pass


class OutlineGenerationModule(ABC):
    """
    The interface for outline generation stage. Given topic, collected information from knowledge
    curation stage, generate outline for the article.
    """

    @abstractmethod
    def generate_outline(self, topic: str, information_table: InformationTable, **kwargs) -> Article:
        """
        Generate outline for the article. Required arguments include:
            topic: the topic of interest
            information_table: knowledge curation data generated from KnowledgeCurationModule

        More arguments could be
            1. draft outline
            2. user provided outline

        Returns:
            article_outline of type ArticleOutline
        """
        pass


class ArticleGenerationModule(ABC):
    """
    The interface for article generation stage. Given topic, collected information from
    knowledge curation stage, generated outline from outline generation stage,
    """

    @abstractmethod
    def generate_article(self,
                         topic: str,
                         information_table: InformationTable,
                         article_with_outline: Article,
                         **kwargs) -> Article:
        """
        Generate article. Required arguments include:
            topic: the topic of interest
            information_table: knowledge curation data generated from KnowledgeCurationModule
            article_with_outline: article with specified outline from OutlineGenerationModule
        """
        pass


class ArticlePolishingModule(ABC):
    """
    The interface for article generation stage. Given topic, collected information from
    knowledge curation stage, generated outline from outline generation stage,
    """

    @abstractmethod
    def polish_article(self, topic: str, draft_article: Article, **kwargs) -> Article:
        """
        Polish article. Required arguments include:
            topic: the topic of interest
            draft_article: draft article from ArticleGenerationModule.
        """
        pass


def log_execution_time(func):
    """Decorator to log the execution time of a function."""

    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        start_time = time.time()
        result = func(self, *args, **kwargs)
        end_time = time.time()
        execution_time = end_time - start_time
        logger.info(f"{func.__name__} executed in {execution_time:.4f} seconds")
        self.time[func.__name__] = execution_time
        return result

    return wrapper


class LMConfigs(ABC):
    """Abstract base class for language model configurations of the knowledge curation engine.

    The language model used for each part should be declared with a suffix '_lm' in the attribute name."""

    def __init__(self):
        pass

    def init_check(self):
        for attr_name in self.__dict__:
            if '_lm' in attr_name and getattr(self, attr_name) is None:
                logging.warning(
                    f"Language model for {attr_name} is not initialized. Please call set_{attr_name}()"
                )

    def collect_and_reset_lm_history(self):
        history = []
        for attr_name in self.__dict__:
            if '_lm' in attr_name and hasattr(getattr(self, attr_name), 'history'):
                history.extend(getattr(self, attr_name).history)
                getattr(self, attr_name).history = []

        return history

    def collect_and_reset_lm_usage(self):
        combined_usage = []
        for attr_name in self.__dict__:
            if '_lm' in attr_name and hasattr(getattr(self, attr_name), 'get_usage_and_reset'):
                combined_usage.append(getattr(self, attr_name).get_usage_and_reset())

        model_name_to_usage = {}
        for usage in combined_usage:
            for model_name, tokens in usage.items():
                if model_name not in model_name_to_usage:
                    model_name_to_usage[model_name] = tokens
                else:
                    model_name_to_usage[model_name]['prompt_tokens'] += tokens['prompt_tokens']
                    model_name_to_usage[model_name]['completion_tokens'] += tokens['completion_tokens']

        return model_name_to_usage

    def log(self):

        return OrderedDict(
            {
                attr_name: getattr(self, attr_name).kwargs for attr_name in self.__dict__ if
                '_lm' in attr_name and hasattr(getattr(self, attr_name), 'kwargs')
            }
        )


class Engine(ABC):
    def __init__(self, lm_configs: LMConfigs):
        self.lm_configs = lm_configs
        self.time = {}
        self.lm_cost = {}  # Cost of language models measured by in/out tokens.
        self.rm_cost = {}  # Cost of retrievers measured by number of queries.

    def log_execution_time_and_lm_rm_usage(self, func):
        """Decorator to log the execution time, language model usage, and retrieval model usage of a function."""

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = func(*args, **kwargs)
            end_time = time.time()
            execution_time = end_time - start_time
            self.time[func.__name__] = execution_time
            logger.info(f"{func.__name__} executed in {execution_time:.4f} seconds")
            self.lm_cost[func.__name__] = self.lm_configs.collect_and_reset_lm_usage()
            if hasattr(self, 'retriever'):
                self.rm_cost[func.__name__] = self.retriever.collect_and_reset_rm_usage()
            return result

        return wrapper

    def apply_decorators(self):
        """Apply decorators to methods that need them."""
        methods_to_decorate = [method_name for method_name in dir(self)
                               if callable(getattr(self, method_name)) and method_name.startswith('run_')]
        for method_name in methods_to_decorate:
            original_method = getattr(self, method_name)
            decorated_method = self.log_execution_time_and_lm_rm_usage(original_method)
            setattr(self, method_name, decorated_method)

    @abstractmethod
    def run_knowledge_curation_module(self, **kwargs) -> Optional[InformationTable]:
        pass

    @abstractmethod
    def run_outline_generation_module(self, **kwarg) -> Article:
        pass

    @abstractmethod
    def run_article_generation_module(self, **kwarg) -> Article:
        pass

    @abstractmethod
    def run_article_polishing_module(self, **kwarg) -> Article:
        pass

    @abstractmethod
    def run(self, **kwargs):
        pass

    def summary(self):
        print("***** Execution time *****")
        for k, v in self.time.items():
            print(f"{k}: {v:.4f} seconds")

        print("***** Token usage of language models: *****")
        for k, v in self.lm_cost.items():
            print(f"{k}")
            for model_name, tokens in v.items():
                print(f"    {model_name}: {tokens}")

        print("***** Number of queries of retrieval models: *****")
        for k, v in self.rm_cost.items():
            print(f"{k}: {v}")

    def reset(self):
        self.time = {}
        self.lm_cost = {}
        self.rm_cost = {}
