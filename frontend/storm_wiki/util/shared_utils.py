import re


def parse(text):
    """
    Parses the given text.
    """
    regex = re.compile(r']:\s+"(.*?)"\s+http')
    text = regex.sub("]: http", text)
    return text
