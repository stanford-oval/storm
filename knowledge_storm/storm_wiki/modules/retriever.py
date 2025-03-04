from typing import Union, List
from urllib.parse import urlparse

import dspy

from ...interface import Retriever, Information
from ...utils import ArticleTextProcessing

import json
import os

current_dir = os.path.dirname(os.path.abspath(__file__))

# Internet source restrictions according to Wikipedia standard:
# https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources/Perennial_sources
file_path = os.path.join(current_dir, 'wikipedia_unreliable_sources.json')

def load_unreliable_sources(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

def is_valid_wikipedia_source(url):
    parsed_url = urlparse(url)
    domain = parsed_url.netloc
    data = load_unreliable_sources(file_path)
    # Remove 'www.' if the URL domain starts with 'www.'
    if domain.startswith('www.'):
        domain = domain[4:]
    # Check if domain partially matches any pattern in the 'Use' column of the JSON data
    for entry in data:
        for pattern in entry['Use']:
            if domain in pattern:
                return False
    return True

# # Example usage
# url_to_check = "https://theblaze.com"
# if is_source_reliable(url_to_check):
#     print(f"The URL {url_to_check} is considered reliable.")
# else:
#     print(f"The URL {url_to_check} is considered unreliable.")
#
# # Expected output
# > The URL https://theblaze.com is considered unreliable.
