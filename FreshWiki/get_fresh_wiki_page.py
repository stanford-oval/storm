import logging
import re

import pandas as pd
import requests
from tqdm import tqdm

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)-8s : %(message)s")


def get_most_edited_wikipedia_titles(year: str, month: str, day: str = "all-days"):
    a = requests.get(
        f"https://wikimedia.org/api/rest_v1/metrics/edited-pages/top-by-edits/en.wikipedia/all-editor-types/content/{year}/{month}/{day}"
    )
    results = a.json()["items"][0]["results"][0]["top"]
    titles = [result["page_title"].replace("_", " ") for result in results]
    return titles


def get_html_content(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching the URL: {e}")
        return None


def call_ORES_api(revids):
    """
    Example: https://en.wikipedia.org/w/index.php?title=Zagreb_Film&oldid=1182715485
    Put that into ORES > https://ores.wikimedia.org/v3/scores/enwiki?models=articlequality&revids=1182715485
    Return format:
    {"enwiki": {"models": {"articlequality": {"version": "0.9.2"}},
    "scores": {
      "1182715485": {
        "articlequality": {
          "score": {
            "prediction": "C",
            "probability": {"B": 0.13445393715303733, "C": 0.4728322988805659, "FA": 0.004610104723503904,
            "GA": 0.048191603091353855, "Start": 0.3326359821017828, "Stub": 0.007276074049756365}
          }
        }
      }}}}
    """
    base_url = "https://ores.wikimedia.org/v3/scores/enwiki"
    params = {
        "models": "articlequality",
        "revids": revids
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()  # Raise an exception for HTTP errors
        return response.json()['enwiki']['scores'][f'{revids}']['articlequality']['score']
    except requests.RequestException as e:
        return None


def get_predicted_quality(title):
    url = f'https://en.wikipedia.org/w/index.php?title={title.replace(" ", "_")}&action=history'
    html_content = get_html_content(url)
    if html_content is None:
        logger.error(f'Cannot get the content of {url}')
        return None
    match = re.search(r'"wgCurRevisionId":(\d+)', html_content)
    if match:
        revids = match.group(1)
    else:
        logger.error(f'Cannot find revids for {title}.')
        return None

    predicted_quality = call_ORES_api(revids)
    return predicted_quality


def main():
    # You can change the time_periods to get the most edited Wikipedia articles in different time periods.
    time_periods = [("2022", "02"), ("2022", "03"), ("2022", "04"), ("2022", "05"), ("2022", "06"), ("2022", "07"),
                    ("2022", "08"), ("2022", "09"), ("2022", "10"), ("2022", "11"), ("2022", "12"),
                    ("2023", "01"), ("2023", "02"), ("2023", "03"), ("2023", "04"), ("2023", "05"), ("2023", "06"),
                    ("2023", "07"), ("2023", "08"), ("2023", "09")]

    data = {
        'topic': [],
        'url': [],
        'predicted_class': [],
        'predicted_scores': []
    }

    for year, month in tqdm(time_periods):
        titles = get_most_edited_wikipedia_titles(year, month)
        for title in titles:
            predicted_quality = get_predicted_quality(title)
            if predicted_quality is None:
                logger.error(f'Fail to include "{title}"')
                continue
            data['topic'].append(title)
            data['url'].append(f'https://en.wikipedia.org/wiki/{title.replace(" ", "_")}')
            data['predicted_class'].append(predicted_quality['prediction'])
            data['predicted_scores'].append(predicted_quality['probability'])

    df = pd.DataFrame(data)
    df.to_csv('recent_edit_topic.csv')


if __name__ == '__main__':
    main()
