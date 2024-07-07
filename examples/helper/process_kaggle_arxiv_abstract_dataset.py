"""Process `arxiv_data_210930-054931.csv` from https://www.kaggle.com/datasets/spsayakpaul/arxiv-paper-abstracts
to a csv file that is compatible with VectorRM.
"""

from argparse import ArgumentParser

import pandas as pd

if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--input-path", type=str, help="Path to arxiv_data_210930-054931.csv.")
    parser.add_argument("--output-path", type=str,
                        help="Path to store the csv file that is compatible with VectorRM.")
    args = parser.parse_args()

    df = pd.read_csv(args.input_path)
    print(f'The original dataset has {len(df)} samples.')

    # Downsample the dataset.
    df = df[df['terms'] == "['cs.CV']"]

    # Reformat the dataset to match the VectorRM input format.
    df.rename(columns={"abstracts": "content", "titles": "title"}, inplace=True)
    df['url'] = ['uid_' + str(idx) for idx in range(len(df))]  # Ensure the url is unique.
    df['description'] = ''

    print(f'The downsampled dataset has {len(df)} samples.')
    df.to_csv(args.output_path, index=False)
