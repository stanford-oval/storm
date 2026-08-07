window.PAPERSTORM_SAMPLE_DATA = {
  "project": {
    "name": "PaperStorm Agent",
    "version": "v0.9",
    "description": "Task-control RAG + Memory + Multi-Agent dashboard demo"
  },
  "tasks": [
    {
      "task_id": "448d5e999f5d4b91b16157a0ef385b63",
      "topic": "pim 神经网络抑制",
      "retriever": "arxiv",
      "output_language": "zh",
      "run_mode": "fake",
      "status": "succeeded",
      "output_dir": "demo://paperstorm_dashboard/tasks/448d5e999f5d4b91b16157a0ef385b63",
      "created_at": "2026-07-28T07:48:38.742236+00:00",
      "updated_at": "2026-07-28T07:48:38.750017+00:00",
      "queue_index": 1,
      "expected_keywords": [
        "passive intermodulation",
        "RF"
      ],
      "forbidden_keywords": [
        "processing-in-memory",
        "DRAM",
        "RAM"
      ],
      "options": {},
      "started_at": "2026-07-28T07:48:38.742236+00:00",
      "finished_at": "2026-07-28T07:48:38.750017+00:00"
    }
  ],
  "article": {
    "task_id": "448d5e999f5d4b91b16157a0ef385b63",
    "path": "demo://paperstorm_dashboard/storm_gen_article_polished.txt",
    "content": "# pim 神经网络抑制\n\nPIM 在本任务中指 passive intermodulation，是 RF 系统中由无源器件非线性导致的互调杂散问题。[1]\n\n神经网络方法可以学习非线性抵消器，用于 passive intermodulation suppression 和 cancellation。[2]\n"
  },
  "qa": {
    "question": "PIM 是什么？",
    "answer": "PIM 在本任务中指 passive intermodulation，是 RF 系统中由无源器件非线性导致的互调杂散问题。[1][1]",
    "citations": [
      {
        "id": 1,
        "title": "Generated article paragraph 1",
        "url": "demo://paperstorm_dashboard\\service\\results\\448d5e999f5d4b91b16157a0ef385b63\\storm_gen_article_polished.txt",
        "source": "article",
        "document_id": "article-1"
      }
    ],
    "grounded": true,
    "memory_context": {},
    "evidence": [
      {
        "id": "article-1",
        "title": "Generated article paragraph 1",
        "content": "PIM 在本任务中指 passive intermodulation，是 RF 系统中由无源器件非线性导致的互调杂散问题。[1]",
        "url": "demo://paperstorm_dashboard\\service\\results\\448d5e999f5d4b91b16157a0ef385b63\\storm_gen_article_polished.txt",
        "source": "article"
      }
    ]
  },
  "scorecard": {
    "topic": "pim 神经网络抑制",
    "scores": {
      "total": 85.0,
      "task_completion": 20.0,
      "retrieval_quality": 30.0,
      "offtopic_penalty": 0.0,
      "article_quality": 20.0,
      "runtime_observability": 15.0
    },
    "metrics": {
      "source_count": 1,
      "expected_hits": [
        "passive intermodulation",
        "RF"
      ],
      "forbidden_hits": [],
      "offtopic_result_count": 0,
      "chinese_char_ratio": 0.3768,
      "trace_event_count": 4
    },
    "checks": {
      "has_article": true,
      "has_outline": true,
      "has_search_results": true,
      "has_trace": true,
      "run_success": true
    },
    "notes": [
      "本次运行的核心指标满足当前规则评估要求。"
    ]
  },
  "trace": {
    "task_id": "448d5e999f5d4b91b16157a0ef385b63",
    "events": [
      {
        "event": "run_start",
        "task_id": "448d5e999f5d4b91b16157a0ef385b63",
        "success": true
      },
      {
        "event": "tool_start",
        "task_id": "448d5e999f5d4b91b16157a0ef385b63",
        "tool": "fake_research"
      },
      {
        "event": "tool_end",
        "task_id": "448d5e999f5d4b91b16157a0ef385b63",
        "tool": "fake_research"
      },
      {
        "event": "run_end",
        "task_id": "448d5e999f5d4b91b16157a0ef385b63",
        "success": true
      }
    ]
  },
  "pipeline_worker": {
    "runner": "fake",
    "run_mode": "fake",
    "retriever": "arxiv",
    "status": "succeeded",
    "score": 85.0
  },
  "service_snapshot": {
    "task_id": "448d5e999f5d4b91b16157a0ef385b63",
    "output_dir": "demo://paperstorm_dashboard/tasks/448d5e999f5d4b91b16157a0ef385b63",
    "status": "succeeded",
    "run_mode": "fake",
    "retriever": "arxiv"
  },
  "multi_agent": {
    "topic": "pim 神经网络抑制",
    "query_plan": [
      {
        "query": "passive intermodulation RF neural network suppression",
        "intent": "definition",
        "source": "topic"
      },
      {
        "query": "passive intermodulation RF neural network suppression suppression neural network",
        "intent": "method",
        "source": "topic+method"
      },
      {
        "query": "passive intermodulation RF",
        "intent": "disambiguation",
        "source": "expected_keywords"
      }
    ],
    "retrieved_results": [
      {
        "title": "Neural passive intermodulation cancellation",
        "description": "RF passive intermodulation suppression with neural networks.",
        "url": "https://example.com/pim",
        "query": "passive intermodulation RF neural network suppression",
        "query_intent": "definition"
      },
      {
        "title": "Processing-in-memory accelerator",
        "description": "DRAM and RAM architecture unrelated to RF PIM.",
        "url": "https://example.com/ram",
        "query": "passive intermodulation RF neural network suppression",
        "query_intent": "definition"
      }
    ],
    "kept_results": [
      {
        "title": "Neural passive intermodulation cancellation",
        "description": "RF passive intermodulation suppression with neural networks.",
        "url": "https://example.com/pim",
        "query": "passive intermodulation RF neural network suppression",
        "query_intent": "definition",
        "expected_hits": [
          "passive intermodulation",
          "RF"
        ],
        "forbidden_hits": [],
        "reason": "matches expected domain evidence"
      }
    ],
    "rejected_results": [
      {
        "title": "Processing-in-memory accelerator",
        "description": "DRAM and RAM architecture unrelated to RF PIM.",
        "url": "https://example.com/ram",
        "query": "passive intermodulation RF neural network suppression",
        "query_intent": "definition",
        "expected_hits": [
          "RF"
        ],
        "forbidden_hits": [
          "processing-in-memory",
          "DRAM",
          "RAM"
        ],
        "reason": "contains forbidden keyword: processing-in-memory, DRAM, RAM"
      }
    ],
    "metrics": {
      "query_count": 3,
      "retrieved_count": 2,
      "kept_count": 1,
      "rejected_count": 1
    },
    "evaluation": {
      "agent": "EvaluatorAgent",
      "scores": {
        "multi_agent_trace": 100.0,
        "critic_signal": 20.0
      },
      "checks": {
        "has_query_plan": true,
        "has_kept_results": true,
        "critic_rejected_offtopic": true
      }
    }
  },
  "agent_trace": [
    {
      "event": "agent_start",
      "agent": "PlannerAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.862950+00:00",
      "payload_summary": {
        "topic": "pim 神经网络抑制",
        "expected_keywords": {
          "type": "list",
          "count": 2
        }
      }
    },
    {
      "event": "agent_end",
      "agent": "PlannerAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.862950+00:00",
      "payload_summary": {
        "agent": "PlannerAgent",
        "topic": "pim 神经网络抑制",
        "queries": {
          "type": "list",
          "count": 3
        }
      }
    },
    {
      "event": "agent_start",
      "agent": "RetrieverAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.862950+00:00",
      "payload_summary": {
        "session": {
          "type": "PaperStormRuntimeSession"
        },
        "search_tool": "demo_search",
        "queries": {
          "type": "list",
          "count": 3
        },
        "top_k": 3
      }
    },
    {
      "event": "agent_end",
      "agent": "RetrieverAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.873142+00:00",
      "payload_summary": {
        "agent": "RetrieverAgent",
        "results": {
          "type": "list",
          "count": 2
        }
      }
    },
    {
      "event": "agent_start",
      "agent": "CriticAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.873142+00:00",
      "payload_summary": {
        "results": {
          "type": "list",
          "count": 2
        },
        "expected_keywords": {
          "type": "list",
          "count": 2
        },
        "forbidden_keywords": {
          "type": "list",
          "count": 3
        }
      }
    },
    {
      "event": "agent_end",
      "agent": "CriticAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.873142+00:00",
      "payload_summary": {
        "agent": "CriticAgent",
        "kept": {
          "type": "list",
          "count": 1
        },
        "rejected": {
          "type": "list",
          "count": 1
        }
      }
    },
    {
      "event": "agent_start",
      "agent": "MemoryAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.873142+00:00",
      "payload_summary": {
        "memory": {
          "type": "PaperStormMemoryStore"
        },
        "topic": "pim 神经网络抑制",
        "kept": {
          "type": "list",
          "count": 1
        },
        "rejected": {
          "type": "list",
          "count": 1
        }
      }
    },
    {
      "event": "agent_end",
      "agent": "MemoryAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.873142+00:00",
      "payload_summary": {
        "agent": "MemoryAgent",
        "episodic_count": 2,
        "semantic_count": 0
      }
    },
    {
      "event": "agent_start",
      "agent": "EvaluatorAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.873142+00:00",
      "payload_summary": {
        "query_plan": {
          "type": "list",
          "count": 3
        },
        "kept": {
          "type": "list",
          "count": 1
        },
        "rejected": {
          "type": "list",
          "count": 1
        },
        "agents": {
          "type": "list",
          "count": 5
        }
      }
    },
    {
      "event": "agent_end",
      "agent": "EvaluatorAgent",
      "run_id": "demo-agents",
      "task_id": "demo-agents",
      "timestamp": "2026-07-28T07:48:38.873142+00:00",
      "payload_summary": {
        "agent": "EvaluatorAgent",
        "scores": {
          "type": "object",
          "keys": [
            "critic_signal",
            "multi_agent_trace"
          ]
        },
        "checks": {
          "type": "object",
          "keys": [
            "critic_rejected_offtopic",
            "has_kept_results",
            "has_query_plan"
          ]
        }
      }
    }
  ],
  "stress_report": {
    "total_tasks": 6,
    "succeeded": 4,
    "failed": 2,
    "failure_rate": 0.3333,
    "avg_latency_sec": 0.0103,
    "p95_latency_sec": 0.0166,
    "max_concurrent_tasks": 2,
    "max_observed_running": 2,
    "retry_count": 0
  }
};
