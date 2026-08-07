async function loadDashboard() {
  try {
    const data = window.PAPERSTORM_SAMPLE_DATA || await fetchSampleData();
    renderDashboard(data);
    setStatus("sample data");
  } catch (error) {
    document.querySelector("#task-list").innerHTML =
      `<div class="item">请先运行 <code>python examples/storm_examples/build_paperstorm_demo_bundle.py --output-dir frontend/paperstorm_dashboard</code></div>`;
    document.querySelector("#project-version").textContent = "no data";
    setStatus(error.message);
  }
}

function renderDashboard(data) {
  renderProject(data.project || {});
  renderTasks(data.tasks || []);
  renderScorecard(data.scorecard || {});
  renderArticle(data.article || {});
  renderQA(data.qa || {});
  renderTrace(data.trace || {});
  renderMultiAgent(data.multi_agent || {}, data.agent_trace || []);
  renderPipelineWorker(data.pipeline_worker || {}, data.service_snapshot || {});
  renderTaskError((data.tasks || [])[0] || {});
  renderStress(data.stress_report || {});
}

async function fetchSampleData() {
  const response = await fetch("sample_data.json");
  if (!response.ok) {
    throw new Error("sample_data.json not found");
  }
  return response.json();
}

async function loadServiceTask() {
  const taskId = getSelectedTaskId();
  if (!taskId) {
    setStatus("请输入 task_id");
    return;
  }
  setStatus("loading service task");
  try {
    const data = await fetchJson(`/research-tasks/${encodeURIComponent(taskId)}/dashboard`);
    renderDashboard(data);
    setStatus(`service task ${taskId}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function loadSampleData() {
  const data = window.PAPERSTORM_SAMPLE_DATA || await fetchSampleData();
  renderDashboard(data);
  setStatus("sample data");
}

async function submitTask() {
  const payload = {
    topic: document.querySelector("#task-topic").value.trim(),
    run_mode: document.querySelector("#task-run-mode").value,
    retriever: document.querySelector("#task-retriever").value,
    output_language: document.querySelector("#task-output-language").value,
    expected_keywords: splitKeywords(document.querySelector("#task-expected-keyword").value),
    forbidden_keywords: splitKeywords(document.querySelector("#task-forbidden-keyword").value),
    max_conv_turn: 1,
    max_perspective: 1,
    search_top_k: 2,
    max_thread_num: 1,
  };
  if (!payload.topic) {
    setStatus("请输入 topic");
    return;
  }
  try {
    const task = await fetchJson("/research-tasks", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    document.querySelector("#service-task-id").value = task.task_id;
    await fetchTaskList();
    setStatus(`created ${task.task_id}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function runSelectedTask() {
  const taskId = getSelectedTaskId();
  if (!taskId) {
    setStatus("请输入 task_id");
    return;
  }
  try {
    const task = await fetchJson(`/research-tasks/${encodeURIComponent(taskId)}/run`, {
      method: "POST",
    });
    setStatus(`run ${task.status}`);
    await pollSelectedTask();
  } catch (error) {
    setStatus(error.message);
  }
}

async function pollSelectedTask() {
  const taskId = getSelectedTaskId();
  if (!taskId) {
    setStatus("请输入 task_id");
    return;
  }
  try {
    const data = await fetchJson(`/research-tasks/${encodeURIComponent(taskId)}/dashboard`);
    renderDashboard(data);
    setStatus(`polled ${(data.tasks || [])[0]?.status || "unknown"}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function fetchTaskList() {
  try {
    const data = await fetchJson("/research-tasks");
    renderTasks(data.tasks || []);
    setStatus(`tasks ${(data.tasks || []).length}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function fetchJson(path, options) {
  const baseUrl = document.querySelector("#service-url").value.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) {
    throw new Error(`service ${response.status}`);
  }
  return response.json();
}

function getSelectedTaskId() {
  return document.querySelector("#service-task-id").value.trim();
}

function splitKeywords(value) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

function renderProject(project) {
  document.querySelector("#project-version").textContent = project.version || "v0.9";
}

function renderTasks(tasks) {
  document.querySelector("#task-list").innerHTML = tasks.map(task => `
    <div class="item task-row" data-task-id="${escapeHtml(task.task_id || "")}">
      <div class="label">${escapeHtml(task.task_id || "")}</div>
      <div class="value">${escapeHtml(task.status || "")}</div>
      <p>${escapeHtml(task.topic || "")}</p>
      <button type="button" data-select-task="${escapeHtml(task.task_id || "")}">选择</button>
    </div>
  `).join("");
  document.querySelectorAll("[data-select-task]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector("#service-task-id").value = button.dataset.selectTask;
      setStatus(`selected ${button.dataset.selectTask}`);
    });
  });
}

function renderScorecard(scorecard) {
  const scores = scorecard.scores || {};
  document.querySelector("#scorecard").innerHTML = Object.entries(scores).map(([name, value]) => metric(name, value)).join("");
}

function renderArticle(article) {
  document.querySelector("#article-content").textContent = article.content || "";
}

function renderQA(qa) {
  const citations = qa.citations || [];
  document.querySelector("#qa-answer").innerHTML = `
    <div class="item">
      <div class="label">${escapeHtml(qa.question || "知识库问题")}</div>
      <p>${escapeHtml(qa.answer || "")}</p>
      <div class="label">grounded: ${Boolean(qa.grounded)}</div>
    </div>
    ${citations.map(c => `<div class="item">${escapeHtml(c.title || c.url || "")}</div>`).join("")}
  `;
}

function renderTrace(trace) {
  const events = trace.events || [];
  document.querySelector("#trace-list").innerHTML = events.map(event => `
    <li>
      <strong>${escapeHtml(event.event || "")}</strong>
      <span>${escapeHtml(event.tool || event.status || "")}</span>
    </li>
  `).join("");
}

function renderMultiAgent(report, agentTrace) {
  const kept = report.kept_results || [];
  const rejected = report.rejected_results || [];
  document.querySelector("#multi-agent").innerHTML = `
    <div class="metric-grid">
      ${metric("queries", (report.query_plan || []).length)}
      ${metric("kept", kept.length)}
      ${metric("rejected", rejected.length)}
      ${metric("agent events", agentTrace.length)}
    </div>
    <div class="stack">
      ${kept.map(item => `<div class="item kept"><strong>保留</strong> ${escapeHtml(item.title || "")}</div>`).join("")}
      ${rejected.map(item => `<div class="item rejected"><strong>过滤</strong> ${escapeHtml(item.title || "")}<br>${escapeHtml(item.reason || "")}</div>`).join("")}
    </div>
  `;
}

function renderPipelineWorker(worker, snapshot) {
  const data = Object.keys(worker).length ? worker : snapshot;
  document.querySelector("#pipeline-worker").innerHTML = [
    "runner",
    "run_mode",
    "retriever",
    "llm_provider",
    "llm_model",
    "status",
    "score",
  ].map(name => metric(name, data[name])).join("");
}

function renderTaskError(task) {
  document.querySelector("#task-error").innerHTML = task.error
    ? `<div class="item rejected">${escapeHtml(task.error)}</div>`
    : `<div class="item">当前任务没有结构化错误。</div>`;
}

function renderStress(report) {
  document.querySelector("#stress-report").innerHTML = [
    "total_tasks",
    "succeeded",
    "failed",
    "failure_rate",
    "avg_latency_sec",
    "p95_latency_sec",
    "max_observed_running",
  ].map(name => metric(name, report[name])).join("");
}

function setStatus(message) {
  document.querySelector("#data-source-status").textContent = message;
}

function metric(name, value) {
  return `
    <div class="metric">
      <div class="label">${escapeHtml(name)}</div>
      <div class="value">${escapeHtml(String(value ?? ""))}</div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelector("#load-service-task").addEventListener("click", loadServiceTask);
document.querySelector("#load-sample-data").addEventListener("click", loadSampleData);
document.querySelector("#submit-task").addEventListener("click", submitTask);
document.querySelector("#run-selected-task").addEventListener("click", runSelectedTask);
document.querySelector("#poll-selected-task").addEventListener("click", pollSelectedTask);
document.querySelector("#refresh-task-list").addEventListener("click", fetchTaskList);

loadDashboard();
