"""Tests for CoStormRunner / CollaborativeStormLMConfigs serialization round-trip.

Covers the fix for issues #328 and #343:
  - LM configurations lost when reloading a saved CoSTORM runner
  - Sensitive credentials excluded from serialized output
"""

import copy
import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# ---------------------------------------------------------------------------
# Minimal stubs so that the engine module can be imported without heavy
# dependencies (litellm, dspy, etc.) during lightweight CI runs.
# ---------------------------------------------------------------------------

# Ensure the project root is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class _StubLitellmModel:
    """Lightweight stand-in for ``knowledge_storm.lm.LitellmModel``."""

    def __init__(self, model="stub/model", model_type="chat", **kwargs):
        self.model = model
        self.model_type = model_type
        self.cache = True
        self.kwargs = dict(kwargs)
        # Strip temperature/max_tokens from kwargs if passed — mirrors real LM.__init__
        self.kwargs.setdefault("temperature", 0.0)
        self.kwargs.setdefault("max_tokens", 1000)
        self.history = []
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def get_usage_and_reset(self):
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0
        return usage


from knowledge_storm.collaborative_storm.engine import (
    CollaborativeStormLMConfigs,
)
from knowledge_storm.lm import LitellmModel


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_config() -> CollaborativeStormLMConfigs:
    """Build a CollaborativeStormLMConfigs with distinct models per slot."""
    cfg = CollaborativeStormLMConfigs()
    cfg.question_answering_lm = LitellmModel(
        model="openai/gpt-4o", max_tokens=2000, temperature=0.7
    )
    cfg.discourse_manage_lm = LitellmModel(
        model="openai/gpt-4o-mini", max_tokens=500, temperature=0.5
    )
    cfg.utterance_polishing_lm = LitellmModel(
        model="openai/gpt-4o", max_tokens=3000, temperature=0.3
    )
    cfg.warmstart_outline_gen_lm = LitellmModel(
        model="together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        max_tokens=800,
        temperature=0.9,
        model_type="chat",
    )
    cfg.question_asking_lm = LitellmModel(
        model="openai/gpt-4o-mini", max_tokens=300, temperature=0.6
    )
    cfg.knowledge_base_lm = LitellmModel(
        model="openai/gpt-4o", max_tokens=1500, temperature=0.4
    )
    return cfg


def _make_config_with_secrets() -> CollaborativeStormLMConfigs:
    """Build a config where kwargs contain api_key and api_base."""
    cfg = CollaborativeStormLMConfigs()
    cfg.question_answering_lm = LitellmModel(
        model="openai/gpt-4o",
        max_tokens=1000,
        temperature=0.5,
        api_key="sk-SUPER-SECRET-KEY",
        api_base="https://internal.corp/v1",
    )
    cfg.discourse_manage_lm = LitellmModel(
        model="azure/gpt-4o",
        max_tokens=500,
        temperature=0.3,
        api_key="az-SECRET",
        api_version="2024-02-15",
    )
    # Leave remaining slots as None to test partial configs
    cfg.utterance_polishing_lm = LitellmModel(model="openai/gpt-4o", max_tokens=500)
    cfg.warmstart_outline_gen_lm = LitellmModel(model="openai/gpt-4o", max_tokens=500)
    cfg.question_asking_lm = LitellmModel(model="openai/gpt-4o", max_tokens=300)
    cfg.knowledge_base_lm = LitellmModel(model="openai/gpt-4o", max_tokens=1000)
    return cfg


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestCollaborativeStormLMConfigsSerialization(unittest.TestCase):
    """Verify to_dict / from_dict round-trip for CollaborativeStormLMConfigs."""

    def test_to_dict_includes_model_and_model_type(self):
        """Each slot in to_dict output must contain 'model' and 'model_type'."""
        cfg = _make_config()
        d = cfg.to_dict()
        for slot_name, slot_data in d.items():
            self.assertIn("model", slot_data, f"{slot_name} missing 'model'")
            self.assertIn("model_type", slot_data, f"{slot_name} missing 'model_type'")

    def test_to_dict_preserves_generation_params(self):
        """Generation parameters (temperature, max_tokens) survive serialization."""
        cfg = _make_config()
        d = cfg.to_dict()
        self.assertEqual(d["question_answering_lm"]["temperature"], 0.7)
        self.assertEqual(d["question_answering_lm"]["max_tokens"], 2000)
        self.assertEqual(d["discourse_manage_lm"]["temperature"], 0.5)

    def test_to_dict_excludes_api_key(self):
        """Sensitive keys must never appear in serialized output."""
        cfg = _make_config_with_secrets()
        d = cfg.to_dict()
        serialized = json.dumps(d)
        self.assertNotIn("sk-SUPER-SECRET-KEY", serialized)
        self.assertNotIn("az-SECRET", serialized)
        for slot_data in d.values():
            self.assertNotIn("api_key", slot_data)
            self.assertNotIn("api_base", slot_data)
            self.assertNotIn("api_version", slot_data)

    def test_to_dict_is_json_serializable(self):
        """The output of to_dict must be safely JSON-serializable."""
        cfg = _make_config()
        d = cfg.to_dict()
        try:
            json.dumps(d)
        except (TypeError, ValueError) as exc:
            self.fail(f"to_dict output is not JSON-serializable: {exc}")

    def test_from_dict_restores_model_names(self):
        """from_dict must reconstruct LM instances with the correct model names."""
        cfg = _make_config()
        d = cfg.to_dict()
        restored = CollaborativeStormLMConfigs.from_dict(d)

        self.assertEqual(restored.question_answering_lm.model, "openai/gpt-4o")
        self.assertEqual(restored.discourse_manage_lm.model, "openai/gpt-4o-mini")
        self.assertEqual(
            restored.warmstart_outline_gen_lm.model,
            "together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        )

    def test_from_dict_restores_generation_params(self):
        """from_dict must reconstruct LM instances with correct generation parameters."""
        cfg = _make_config()
        d = cfg.to_dict()
        restored = CollaborativeStormLMConfigs.from_dict(d)

        self.assertEqual(restored.question_answering_lm.kwargs["temperature"], 0.7)
        self.assertEqual(restored.question_answering_lm.kwargs["max_tokens"], 2000)
        self.assertEqual(restored.discourse_manage_lm.kwargs["temperature"], 0.5)
        self.assertEqual(restored.discourse_manage_lm.kwargs["max_tokens"], 500)

    def test_from_dict_restores_model_type(self):
        """from_dict must preserve model_type for each slot."""
        cfg = _make_config()
        d = cfg.to_dict()
        restored = CollaborativeStormLMConfigs.from_dict(d)

        self.assertEqual(restored.question_answering_lm.model_type, "chat")
        self.assertEqual(restored.warmstart_outline_gen_lm.model_type, "chat")

    def test_round_trip_preserves_all_slots(self):
        """Every LM slot must survive a to_dict -> from_dict round-trip."""
        cfg = _make_config()
        d = cfg.to_dict()
        restored = CollaborativeStormLMConfigs.from_dict(d)

        slots = [
            "question_answering_lm",
            "discourse_manage_lm",
            "utterance_polishing_lm",
            "warmstart_outline_gen_lm",
            "question_asking_lm",
            "knowledge_base_lm",
        ]
        for slot in slots:
            orig = getattr(cfg, slot)
            rest = getattr(restored, slot)
            self.assertIsNotNone(rest, f"{slot} was not restored")
            self.assertEqual(orig.model, rest.model, f"{slot} model mismatch")

    def test_from_dict_with_empty_dict(self):
        """from_dict with empty dict should produce a config with all None slots."""
        restored = CollaborativeStormLMConfigs.from_dict({})
        self.assertIsNone(restored.question_answering_lm)
        self.assertIsNone(restored.discourse_manage_lm)

    def test_from_dict_with_partial_dict(self):
        """from_dict with only some slots should leave missing slots as None."""
        cfg = _make_config()
        d = cfg.to_dict()
        # Remove some slots
        del d["discourse_manage_lm"]
        del d["knowledge_base_lm"]
        restored = CollaborativeStormLMConfigs.from_dict(d)
        self.assertIsNotNone(restored.question_answering_lm)
        self.assertIsNone(restored.discourse_manage_lm)
        self.assertIsNone(restored.knowledge_base_lm)

    def test_from_dict_ignores_unknown_keys(self):
        """from_dict should not crash on unknown slot names in the dict."""
        d = {"unknown_future_lm": {"model": "foo", "model_type": "chat"}}
        try:
            restored = CollaborativeStormLMConfigs.from_dict(d)
        except Exception as exc:
            self.fail(f"from_dict crashed on unknown key: {exc}")

    def test_double_round_trip_is_stable(self):
        """Two consecutive round-trips should produce identical dicts."""
        cfg = _make_config()
        d1 = cfg.to_dict()
        restored1 = CollaborativeStormLMConfigs.from_dict(d1)
        d2 = restored1.to_dict()
        self.assertEqual(d1, d2)


class TestCoStormRunnerFromDictLMConfig(unittest.TestCase):
    """Verify CoStormRunner.from_dict restores LM config from saved data."""

    def test_from_dict_uses_saved_lm_config(self):
        """When serialized data contains lm_config, from_dict should use it
        instead of falling back to OPENAI_API_TYPE defaults."""
        from knowledge_storm.collaborative_storm.engine import (
            CoStormRunner,
            RunnerArgument,
        )

        cfg = _make_config()
        runner_arg = RunnerArgument(topic="Test Topic")

        # Build minimal serialized data with the LM config
        data = {
            "runner_argument": runner_arg.to_dict(),
            "lm_config": cfg.to_dict(),
            "conversation_history": [],
            "warmstart_conv_archive": [],
            "experts": [],
            "knowledge_base": None,
        }

        # Patch heavy dependencies to avoid requiring API keys / network
        with patch(
            "knowledge_storm.collaborative_storm.engine.KnowledgeBase"
        ) as MockKB, patch(
            "knowledge_storm.collaborative_storm.engine.Encoder"
        ) as MockEncoder, patch(
            "knowledge_storm.collaborative_storm.engine.LoggingWrapper"
        ) as MockLW, patch(
            "knowledge_storm.collaborative_storm.engine.BingSearch"
        ) as MockBing:
            MockKB.return_value = MagicMock()
            MockKB.from_dict = MagicMock(return_value=MagicMock())
            MockEncoder.return_value = MagicMock()
            MockLW.return_value = MagicMock()
            MockBing.return_value = MagicMock()

            # We should NOT need OPENAI_API_TYPE if saved config is present
            env = {k: v for k, v in os.environ.items() if k != "OPENAI_API_TYPE"}
            with patch.dict(os.environ, env, clear=True):
                runner = CoStormRunner.from_dict(data)

            # Verify the restored runner has the correct models
            self.assertEqual(
                runner.lm_config.question_answering_lm.model,
                "openai/gpt-4o",
            )
            self.assertEqual(
                runner.lm_config.discourse_manage_lm.model,
                "openai/gpt-4o-mini",
            )

    def test_from_dict_allows_lm_config_override(self):
        """Callers can pass their own lm_config to override saved data."""
        from knowledge_storm.collaborative_storm.engine import (
            CoStormRunner,
            RunnerArgument,
        )

        cfg_saved = _make_config()
        cfg_override = CollaborativeStormLMConfigs()
        cfg_override.question_answering_lm = LitellmModel(
            model="custom/my-model", max_tokens=4000
        )
        # Fill remaining slots to avoid None errors
        for attr in [
            "discourse_manage_lm", "utterance_polishing_lm",
            "warmstart_outline_gen_lm", "question_asking_lm", "knowledge_base_lm",
        ]:
            setattr(cfg_override, attr, LitellmModel(model="custom/default"))

        runner_arg = RunnerArgument(topic="Override Test")
        data = {
            "runner_argument": runner_arg.to_dict(),
            "lm_config": cfg_saved.to_dict(),
            "conversation_history": [],
            "warmstart_conv_archive": [],
            "experts": [],
            "knowledge_base": None,
        }

        with patch(
            "knowledge_storm.collaborative_storm.engine.KnowledgeBase"
        ) as MockKB, patch(
            "knowledge_storm.collaborative_storm.engine.Encoder"
        ) as MockEncoder, patch(
            "knowledge_storm.collaborative_storm.engine.LoggingWrapper"
        ) as MockLW, patch(
            "knowledge_storm.collaborative_storm.engine.BingSearch"
        ) as MockBing:
            MockKB.return_value = MagicMock()
            MockKB.from_dict = MagicMock(return_value=MagicMock())
            MockEncoder.return_value = MagicMock()
            MockLW.return_value = MagicMock()
            MockBing.return_value = MagicMock()

            runner = CoStormRunner.from_dict(data, lm_config=cfg_override)

        self.assertEqual(
            runner.lm_config.question_answering_lm.model,
            "custom/my-model",
        )


class TestSensitiveKeyExclusion(unittest.TestCase):
    """Verify that no sensitive information leaks through serialization."""

    def test_all_sensitive_keys_excluded(self):
        """Each key in _SENSITIVE_KEYS must be stripped from every slot."""
        cfg = _make_config_with_secrets()
        d = cfg.to_dict()
        for key in CollaborativeStormLMConfigs._SENSITIVE_KEYS:
            for slot_name, slot_data in d.items():
                self.assertNotIn(
                    key,
                    slot_data,
                    f"Sensitive key '{key}' found in {slot_name}",
                )

    def test_credentials_not_in_json_dump(self):
        """Even a full JSON dump of the serialized config must not contain secrets."""
        cfg = _make_config_with_secrets()
        d = cfg.to_dict()
        blob = json.dumps(d)
        for secret in ["sk-SUPER-SECRET-KEY", "az-SECRET", "https://internal.corp/v1"]:
            self.assertNotIn(secret, blob, f"Secret '{secret}' leaked in JSON output")


if __name__ == "__main__":
    unittest.main()
