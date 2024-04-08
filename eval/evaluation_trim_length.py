import re

trimmed_message = "[content omitted]"
trimmed_message_len = len(trimmed_message.split())


def text_word_count(text):
    """
    Clean up text: remove reference section, URLS, non-ascii chars
    """
    # clean up empty line
    paragraphs = text.split("\n")
    paragraphs = [i for i in paragraphs if len(i) > 0]
    # clean up section title and remove reference section
    cleaned_pargraphs = []
    for i in paragraphs:
        if i == "# References":
            break
        if i.startswith("#"):
            i = "section: " + i.replace("#", "").strip()
        cleaned_pargraphs.append(i)
    text = "\n".join(cleaned_pargraphs)
    # remove URLS
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    # remove non-ascii char
    text = re.sub(r'[^\x00-\x7F]+', '', text)
    # remove citation bracket (e.g. [10])
    text = re.sub(r'\[\d+\]', '', text)
    # remove non alphanumeric char
    text = re.sub(r'[^\w\s]', '', text)
    return len(text.split())


class ArticleNode:
    def __init__(self, title, level=0):
        self.title = title
        self.content = []
        self.children = []
        self.length = 0
        self.is_trimmed = False
        self.level = level

    def add_child(self, child_node):
        self.children.append(child_node)

    def add_content(self, content_line):
        if len(content_line):
            self.content.append(content_line)

    def __repr__(self):
        return f"ArticleNode(title='{self.title}', content='{self.content}', children={self.children})"


def parse_article(article):
    """
    Given article, parse into tree structure
    @param article, string article
    @return root node
    """
    root = ArticleNode("Root")
    current_node = root
    node_stack = [root]
    for line in article.split('\n'):
        if line.startswith('#'):
            level = line.count('#')
            title = line.replace('#', '').strip()
            new_node = ArticleNode(title, level)
            while len(node_stack) > level:
                node_stack.pop()
            parent_node = node_stack[-1]
            parent_node.add_child(new_node)
            current_node = new_node
            node_stack.append(new_node)
        else:
            current_node.add_content(line.strip())
    return root


def update_count(node):
    """
    Update word count of each node. Defined as its own content word count
    and summation of all child count

    @param node, Article node as the root
    """
    for children in node.children:
        update_count(children)
    node.length = sum(text_word_count(sentence) for sentence in node.content)
    for children in node.children:
        node.length += children.length
    if node.is_trimmed:
        node.length += len(trimmed_message.split())


def find_node_with_lowest_length(node):
    """
    find Article node with lowest word count.
    """
    if node is None:
        return None

    min_node = node
    min_node_length = min_node.length - min_node.is_trimmed * trimmed_message_len
    for child in node.children:
        if len(child.content) == 0:
            continue
        candidate = find_node_with_lowest_length(child)
        candidate_length = candidate.length - candidate.is_trimmed * trimmed_message_len
        if candidate and candidate_length < min_node_length:
            min_node = candidate
            min_node_length = candidate_length
    return min_node


def iterative_trim(root_node, max_words):
    """
    Iteratively remove sentence from node with least word count
    until the word count the whole tree is below threshold
    """
    update_count(root_node)
    while root_node.length > max_words:
        smallest_node = find_node_with_lowest_length(root_node)
        smallest_node.is_trimmed = True
        smallest_node.content.pop()
        update_count(root_node)
        print(root_node.length)


def reconstruct_article(node):
    """
    Reconstruct article from tree structure
    """
    article = ""
    if node.level > 0:
        hashtags = "#" * node.level
        article += f"{hashtags} {node.title}\n"
    article += "\n\n".join(node.content)
    if node.is_trimmed:
        article += trimmed_message
    article += "\n\n"
    for child in node.children:
        article += reconstruct_article(child)
    return article


def process_document(document_path, max_words):
    """
    Trim document following the rule until total word count
    is below set threshold
    Rule: iteratively remove sentence from section with least word count

    @param document path: full path to document
    @param max_words: article total word count upper bound
    """
    with open(document_path) as f:
        article_example = f.read()
        root_node = parse_article(article_example)
        iterative_trim(root_node, max_words)
        updated_article = reconstruct_article(root_node)
        return updated_article
