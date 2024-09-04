# Contributing

Thank you for your interest in contributing to STORM! 

Contributions aren't just about code. Currently (last edit: 7/22/2024), we are accepting the following forms of contribution:
- Pull requests for additional language model support to `knowledge_storm/lm.py`.
- Pull requests for additional retrieval model/search engine support to `knowledge_storm/rm.py`.
- Pull requests for new features to `frontend/demo_light` to assist other developers.
- Identification and reporting of issues or bugs.
- Helping each other by responding to issues.

Please note that we are not accepting code refactoring PRs at this time to avoid conflicts with our team's efforts.

## Development
This section contains technical instructions & hints for contributors.

### Setting up
1. Fork this repository and clone your forked repository.
2. Install the required packages:
    ```
    conda create -n storm python=3.11
    conda activate storm
    pip install -r requirements.txt
    ```
3. If you want to contribute to `frontend/demo_light`, follow its [Setup guide](https://github.com/stanford-oval/storm/tree/main/frontend/demo_light#setup) to install additional packages.

### PR suggestions

Following the suggested format can lead to a faster review process.

**Title:**

[New LM/New RM/Demo Enhancement] xxx

**Description:**
- For new language model support, (1) describe how to use the new LM class, (2) create an example script following the style of existing example scripts under `examples/`, (3) attach an input-output example of the example script.
- For new retrieval model/search engine support, (1) describe how to use the new RM class and (2) attach input-output examples of the RM class.
- For demo light enhancements, (1) describe what's new and (2) attach screenshots to demonstrate the UI change.
- Please clearly describe the required API keys and provide instructions on how to get them (if applicable). This project manages API key with `secrets.toml`.

**Code Format:**

We adopt [`black`](https://github.com/psf/black) for arranging and formatting Python code. To streamline the contribution process, we set up a [pre-commit hook](https://pre-commit.com/) to format the code under `knowledge_storm/` before committing. To install the pre-commit hook, run:
```
pip install pre-commit
pre-commit install
```
The hook will automatically format the code before each commit.
