# knowledge_storm/llm_base.py

"""
This module provides access to various Large Language Model (LLM) classes
used in the STORM framework.

The LLM classes are organized into a subpackage called 'providers' for
better modularity and maintainability.

This file serves as a central point for importing LLM classes,
preserving backwards compatibility with the previous structure
where classes were directly defined within this file.

For new code, it is recommended to import directly from the 'providers'
subpackage (e.g., 'from knowledge_storm.lm.providers import OpenAIModel').
"""

import logging

# Import all LLM classes from their respective providers
from .lm.providers import (
    OpenAIModel, AzureOpenAIModel, ClaudeModel, DeepSeekModel, VLLMClient,
    TGIClient, OllamaClient, TogetherClient
)

# The following lines maintain backwards compatibility
OpenAIModel = OpenAIModel
AzureOpenAIModel = AzureOpenAIModel
ClaudeModel = ClaudeModel
DeepSeekModel = DeepSeekModel
VLLMClient = VLLMClient
TGIClient = TGIClient
OllamaClient = OllamaClient
TogetherClient = TogetherClient
