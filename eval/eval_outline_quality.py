"""Compute outline quality metrics on a dataset.

The script expects
    - a CSV file (args.input_path) with a column 'topic' containing the topics for evaluation.
    - a directory (args.gt_dir) containing human-written articles. The articles should be named as txt/{topic_name}.txt.
    - a directory (args.pred_dir) containing generated outlines. The outlines should be named as {topic_name}/{args.pred_file_name}.
"""

import os.path
import re
from argparse import ArgumentParser
import pandas as pd
from tqdm import tqdm
from metrics import heading_soft_recall, heading_entity_recall

def load_str(path):
    with open(path, 'r') as f:
        return '\n'.join(f.readlines())

def get_sections(path):
    s = load_str(path)
    s = re.sub(r"\d+\.\ ", '#', s)
    sections = []
    for line in s.split('\n'):
        line = line.strip()
        if "# References" in line:
            break
        if line.startswith('#'):
            if any(keyword in line.lower() for keyword in ["references", "external links", "see also", "notes"]):
                break
            sections.append(line.strip('#').strip())
    return sections

def main(args):
    df = pd.read_csv(args.input_path)
    entity_recalls = []
    heading_soft_recalls = []
    topics = []
    for _, row in tqdm(df.iterrows()):
        topic_name = row['topic'].replace(' ', '_').replace('/', '_')
        gt_sections = get_sections(os.path.join(args.gt_dir, 'txt', f'{topic_name}.txt'))
        pred_sections = get_sections(os.path.join(args.pred_dir, topic_name, args.pred_file_name))
        entity_recalls.append(heading_entity_recall(golden_headings=gt_sections, predicted_headings=pred_sections))
        heading_soft_recalls.append(heading_soft_recall(gt_sections, pred_sections))
        topics.append(row['topic'])

    results = pd.DataFrame({'topic': topics, 'entity_recall': entity_recalls, 'heading_soft_recall': heading_soft_recalls})
    results.to_csv(args.result_output_path, index=False)
    avg_entity_recall = sum(entity_recalls) / len(entity_recalls)
    avg_heading_soft_recall = sum(heading_soft_recalls) / len(heading_soft_recalls)
    print(f'Average Entity Recall: {avg_entity_recall}')
    print(f'Average Heading Soft Recall: {avg_heading_soft_recall}')

if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('--input-path', type=str, help='Path to the CSV file storing topics and ground truth URLs.')
    parser.add_argument('--gt-dir', type=str, help='Path of human-written articles.')
    parser.add_argument('--pred-dir', type=str, help='Path of generated outlines.')
    parser.add_argument('--pred-file-name', type=str, help='Name of the outline file.')
    parser.add_argument('--result-output-path', type=str, help='Path to save the results.')
    main(parser.parse_args())
