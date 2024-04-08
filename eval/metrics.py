import re
from typing import List, Optional

from flair.data import Sentence
from flair.nn import Classifier
from rouge_score import rouge_scorer
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

tagger = Classifier.load('ner')

encoder = SentenceTransformer('paraphrase-MiniLM-L6-v2')


def card(l):
    encoded_l = encoder.encode(list(l))
    cosine_sim = cosine_similarity(encoded_l)
    soft_count = 1 / cosine_sim.sum(axis=1)

    return soft_count.sum()


def heading_soft_recall(golden_headings: List[str], predicted_headings: List[str]):
    """
    Given golden headings and predicted headings, compute soft recall.
        -  golden_headings: list of strings
        -  predicted_headings: list of strings

    Ref: https://www.sciencedirect.com/science/article/pii/S0167865523000296
    """

    g = set(golden_headings)
    p = set(predicted_headings)
    if len(p) == 0:
        return 0
    card_g = card(g)
    card_p = card(p)
    card_intersection = card_g + card_p - card(g.union(p))
    return card_intersection / card_g


def extract_entities_from_list(l):
    entities = []
    for sent in l:
        if len(sent) == 0:
            continue
        sent = Sentence(sent)
        tagger.predict(sent)
        entities.extend([e.text for e in sent.get_spans('ner')])

    entities = list(set([e.lower() for e in entities]))

    return entities


def heading_entity_recall(golden_entities: Optional[List[str]] = None,
                          predicted_entities: Optional[List[str]] = None,
                          golden_headings: Optional[List[str]] = None,
                          predicted_headings: Optional[List[str]] = None):
    """
    Given golden entities and predicted entities, compute entity recall.
        -  golden_entities: list of strings or None; if None, extract from golden_headings
        -  predicted_entities: list of strings or None; if None, extract from predicted_headings
        -  golden_headings: list of strings or None
        -  predicted_headings: list of strings or None
    """
    if golden_entities is None:
        assert golden_headings is not None, "golden_headings and golden_entities cannot both be None."
        golden_entities = extract_entities_from_list(golden_headings)
    if predicted_entities is None:
        assert predicted_headings is not None, "predicted_headings and predicted_entities cannot both be None."
        predicted_entities = extract_entities_from_list(predicted_headings)
    g = set(golden_entities)
    p = set(predicted_entities)
    if len(g) == 0:
        return 1
    else:
        return len(g.intersection(p)) / len(g)


def article_entity_recall(golden_entities: Optional[List[str]] = None,
                          predicted_entities: Optional[List[str]] = None,
                          golden_article: Optional[str] = None,
                          predicted_article: Optional[str] = None):
    """
    Given golden entities and predicted entities, compute entity recall.
        -  golden_entities: list of strings or None; if None, extract from golden_article
        -  predicted_entities: list of strings or None; if None, extract from predicted_article
        -  golden_article: string or None
        -  predicted_article: string or None
    """
    if golden_entities is None:
        assert golden_article is not None, "golden_article and golden_entities cannot both be None."
        sentences = re.split(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s', golden_article)
        golden_entities = extract_entities_from_list(sentences)
    if predicted_entities is None:
        assert predicted_article is not None, "predicted_article and predicted_entities cannot both be None."
        sentences = re.split(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s', predicted_article)
        predicted_entities = extract_entities_from_list(sentences)
    g = set(golden_entities)
    p = set(predicted_entities)
    if len(g) == 0:
        return 1
    else:
        return len(g.intersection(p)) / len(g)


def compute_rouge_scores(golden_answer: str, predicted_answer: str):
    """
    Compute rouge score for given output and golden answer to compare text overlap.
        - golden_answer: plain text of golden answer
        - predicted_answer: plain text of predicted answer
    """

    scorer = rouge_scorer.RougeScorer(['rouge1', 'rougeL'], use_stemmer=True)
    scores = scorer.score(golden_answer, predicted_answer)
    score_dict = {}
    for metric, metric_score in scores.items():
        score_dict[f'{metric.upper()}_precision'] = metric_score.precision
        score_dict[f'{metric.upper()}_recall'] = metric_score.recall
        score_dict[f'{metric.upper()}_f1'] = metric_score.fmeasure
    return score_dict