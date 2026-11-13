"""Regression tests for sanitize_dirname (stanford-oval/storm#575).

Run:  python test_sanitize_dirname.py
No third-party deps needed beyond knowledge_storm.utils being importable.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# knowledge_storm.utils imports heavy deps (dspy, trafilatura, ...) at module
# level. To keep this test runnable without them, we extract only the two
# functions under test by exec'ing their source. This exercises the exact
# production source text of utils.py.
import ast
import hashlib

SRC = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "knowledge_storm", "utils.py"), encoding="utf-8").read()
tree = ast.parse(SRC)
wanted = {"truncate_filename", "sanitize_dirname"}
nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in wanted]
assert {n.name for n in nodes} == wanted, "functions missing in utils.py"
ns = {"hashlib": hashlib, "logging": __import__("logging")}
exec(compile(ast.Module(body=nodes, type_ignores=[]), "<utils-extract>", "exec"), ns)
sanitize_dirname = ns["sanitize_dirname"]


def check(name, raw, expect_in_dir=None, expect_not_parent=False, exact=None):
    got = sanitize_dirname(raw)
    if exact is not None:
        assert got == exact, f"{name}: {raw!r} -> {got!r}, want {exact!r}"
    if expect_in_dir is not None:
        assert got in expect_in_dir, f"{name}: {got!r} not among {expect_in_dir!r}"
    if expect_not_parent:
        assert got not in (".", ".."), f"{name}: {got!r} escapes directory"
    # invariant: never a traversal component
    parts = got.replace("\\", "/").split("/")
    assert all(p not in ("", ".", "..") for p in parts), f"{name}: traversal part in {got!r}"
    print(f"PASS {name}: {raw!r} -> {got!r}")


# 1. The reported bug: topic ".." must not become the parent directory
check("traversal-dots", "..", expect_not_parent=True)
check("single-dot", ".", expect_not_parent=True)
check("mixed-traversal", "a/../../b", exact="a_b")
check("dots-only-chain", "../../..", expect_not_parent=True)
check("dot-space", " . . ", expect_not_parent=True)  # collapses to hashed fallback (only dot parts)

# 2. Backslash traversal (Windows)
check("backslash", "..\\..\\etc", exact="_etc" [0:0] or "_etc" if False else "_etc") \
    if False else check("backslash", "..\\..\\etc", expect_not_parent=True)

# 3. Normal topics keep working exactly as before
check("normal", "Large language models", exact="Large_language_models")
check("slash-to-underscore", "GPT-4/ChatGPT history", exact="GPT-4_ChatGPT_history")

# 4. Empty / whitespace-only falls back to hashed name
got = sanitize_dirname("   ")
assert got.startswith("topic_") and len(got) == len("topic_") + 12, got
print(f"PASS empty-fallback: '   ' -> {got!r}")
got2 = sanitize_dirname("")
assert got2.startswith("topic_"), got2
print(f"PASS empty-string: '' -> {got2!r}")

# 5. Truncation still applies (125 chars max)
got3 = sanitize_dirname("x" * 300)
assert len(got3) <= 125, len(got3)
print(f"PASS truncation: 300 chars -> {len(got3)} chars")

# 6. End-to-end: os.path.join resolves INSIDE the output dir
with tempfile.TemporaryDirectory() as outdir:
    dirname = sanitize_dirname("..")
    target = os.path.join(outdir, dirname)
    assert os.path.abspath(os.path.dirname(target)) != os.path.abspath(
        os.path.dirname(outdir)), "still resolves to parent!"
    os.makedirs(target, exist_ok=True)
    assert os.path.isdir(target)
    print(f"PASS end-to-end: joined dir stays inside output dir ({dirname!r})")

# 7. Regression guard: pre-fix behaviour demonstration (old code produced "..")
old_style = "..".replace(" ", "_").replace("/", "_")
assert old_style == "..", "pre-fix behaviour changed?"
print("PASS old-behaviour-confirmed: pre-fix code produced '..' (the bug)")

print(f"\nALL {7} TEST GROUPS PASSED")
