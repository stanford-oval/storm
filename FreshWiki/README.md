# FreshWiki Dataset
The FreshWiki Dataset is a collection of high-quality Wikipedia articles focusing on the most-edited pages from February 2022 to September 2023. See Section 2.1 in [our paper](https://arxiv.org/abs/2402.14207) for more details.

This dataset could be valuable for researchers working on tasks like report generation, knowledge curation, information retrieval, etc. The text data in this dataset is licensed under the Creative Commons Attribution-ShareAlike (CC BY-SA) license.  Please refer to the Wikipedia reuse guidelines for details: https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content

To ease data contamination issue, we provide the source code for the data construction pipeline that can be repeated at future dates. The code can be found in the following files:
- `get_fresh_wiki_page.py`
- `wikipage_extractor.py`

Please cite our paper if you found the dataset or data construction pipeline useful for your research.
```bibtex
@inproceedings{shao2024assisting,
      title={{Assisting in Writing Wikipedia-like Articles From Scratch with Large Language Models}}, 
      author={Yijia Shao and Yucheng Jiang and Theodore A. Kanell and Peter Xu and Omar Khattab and Monica S. Lam},
      year={2024},
      booktitle={Proceedings of the 2024 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies, Volume 1 (Long and Short Papers)}
}
```