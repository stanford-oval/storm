# Contributing to STORM (Upstream)

## What the Upstream Accepts

The `stanford-oval/storm` repository currently accepts PRs for:

1. **New Language Model Support** → `knowledge_storm/lm.py` + example script
2. **New Retrieval Model/Search Engine Support** → `knowledge_storm/rm.py` + example script
3. **Demo Light Enhancements** → `frontend/demo_light/`
4. **Bug Reports & Issue Triage**

**NOT accepting:** Code refactoring PRs (to avoid conflicts with internal development).

---

## PR Requirements

### Title Format
```
[New LM/New RM/Demo Enhancement] Short description
```

Examples:
- `[New LM] Add support for Anthropic Claude 3.5 Sonnet`
- `[New RM] Add Brave Search retrieval model`
- `[Demo Enhancement] Add dark mode toggle to Streamlit UI`

### Description Must Include

For **New LM**:
1. How to use the new LM class (constructor args, config)
2. Example script under `examples/storm_examples/` following existing patterns
3. Input/output example of the script
4. Required API keys + how to obtain them

For **New RM**:
1. How to use the new RM class
2. Example script or usage snippet
3. Input/output example
4. Required API keys + how to obtain them

For **Demo Enhancement**:
1. What's new
2. Screenshots demonstrating the change

---

## Code Style

- **Formatter:** `black` (line length 88)
- **Hook:** `pre-commit` runs on `knowledge_storm/` directory only
- **Setup:**
  ```bash
  pip install pre-commit
  pre-commit install
  ```

The hook auto-formats staged files in `knowledge_storm/` before commit.

---

## Development Setup

```bash
# 1. Fork & clone
git clone https://github.com/YOUR_USERNAME/storm.git
cd storm

# 2. Create env
conda create -n storm-dev python=3.11
conda activate storm-dev
pip install -r requirements.txt
pip install pre-commit && pre-commit install

# 3. Install in editable mode
pip install -e .

# 4. Add API keys to secrets.toml (copy from templates/secrets.toml.example)
cp templates/secrets.toml.example secrets.toml
# Edit secrets.toml with your keys
```

---

## Testing Your Changes

### For New LM
```bash
# Test with your new LM class
python examples/storm_examples/run_storm_wiki_<your_lm>.py \
  --retriever you \
  --do-research --do-generate-outline --do-generate-article

# Verify output has citations and reasonable content
cat results/<topic>/storm_gen_article.txt
```

### For New RM
```bash
# Test retriever directly
python -c "
from knowledge_storm.rm import YourNewRM
rm = YourNewRM(api_key='...', k=3)
results = rm('test query')
for r in results:
    print(r['title'], r['url'])
    print(r['snippets'][0][:100])
    print('---')
"

# Then test full pipeline
python examples/storm_examples/run_storm_wiki_gpt.py \
  --retriever your_rm_name \
  --do-research --do-generate-outline --do-generate-article
```

### For Demo Light
```bash
cd frontend/demo_light
pip install -r requirements.txt
streamlit run app.py
# Verify UI changes work
```

---

## Pre-commit Checklist

- [ ] `pre-commit run --files knowledge_storm/lm.py` passes (if LM change)
- [ ] `pre-commit run --files knowledge_storm/rm.py` passes (if RM change)
- [ ] Example script runs without errors
- [ ] Output article contains proper citations `[1]`, `[2]`
- [ ] No hardcoded API keys in code
- [ ] Secrets loaded via `load_api_key("secrets.toml")`
- [ ] Example follows existing naming: `run_storm_wiki_<provider>.py`

---

## Submitting

1. Push to your fork
2. Open PR against `stanford-oval/storm:main`
3. Fill in PR template with required info
4. Tag maintainers if needed: `@shaoyj @yuchengj`

---

## Issue Triage (Non-Code Contribution)

Help by:
- Reproducing reported bugs
- Adding `regression` / `bug` / `feature` labels
- Suggesting workarounds
- Closing stale/duplicate issues

---

## Contact

- Yijia Shao: `shaoyj@stanford.edu`
- Yucheng Jiang: `yuchengj@stanford.edu`
- Issues: GitHub Issues on `stanford-oval/storm`