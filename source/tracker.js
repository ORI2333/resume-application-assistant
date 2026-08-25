/* tracker.js — 独立投递工作台：投递卡片、状态历史与行动看板。 */
(() => {
  "use strict";
  const RAA = globalThis.ResumeApplicationAssistant;
  const S = RAA.schema;
  const store = RAA.profileStore;
  const state = { data: null, profile: null, dirty: false, query: "", stage: "all" };
  const $ = (id) => document.getElementById(id);
  const statusEl = $("status-line");
  const columns = [
    { key: "planned", label: "待开始", note: "尚未安排到今天的事项" },
    { key: "in-progress", label: "进行中", note: "正在处理的关键动作" },
    { key: "blocked", label: "已阻塞", note: "等待信息、机会或外部反馈" },
    { key: "done", label: "已完成", note: "已完成且保留记录" },
  ];

  function setStatus(text, isError) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("error", !!isError);
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function markDirty() {
    state.dirty = true;
    $("save-btn").textContent = "保存更改（未保存）";
  }
  function touch(target) {
    target.updatedAt = new Date().toISOString();
    markDirty();
  }
  async function persist() {
    if (!state.profile) return false;
    const valid = S.validateProfile(state.profile);
    if (!valid.ok) {
      setStatus("保存失败：\n" + valid.errors.slice(0, 8).join("\n"), true);
      return false;
    }
    state.profile.updatedAt = new Date().toISOString();
    await store.upsertProfile(state.profile);
    state.dirty = false;
    $("save-btn").textContent = "保存更改";
    setStatus("已保存投递工作台。\n");
    return true;
  }
  function archiveUrl() { return state.profile ? `manager.html?profile=${encodeURIComponent(state.profile.id)}` : "manager.html"; }
  function syncArchiveLinks() {
    for (const id of ["archive-link", "hero-archive-link"]) {
      const link = $(id);
      if (link) link.href = archiveUrl();
    }
  }
  function renderProfileSelect() {
    const select = $("profile-select");
    select.innerHTML = (state.data.profiles || []).map((profile) => `<option value="${esc(profile.id)}">${esc(profile.name)}</option>`).join("");
    select.value = state.profile ? state.profile.id : "";
  }
  function setProfile(id) {
    const next = state.data.profiles.find((profile) => profile.id === id);
    if (!next) return;
    state.profile = next;
    state.dirty = false;
    $("save-btn").textContent = "保存更改";
    renderAll();
  }
  function classifyStatus(status) {
    const normalized = S.normalize(status);
    if (/淘汰|拒绝|失败|撤回|终止|放弃/.test(normalized)) return "closed";
    if (/录用|offer|入职|签约/.test(normalized)) return "success";
    if (/笔试|测评|面试|复试|一面|二面|三面|沟通|筛选通过|推进/.test(normalized)) return "active";
    return "submitted";
  }
  function stageLabel(stage) {
    return ({ active: "推进中", submitted: "已投递", success: "已录用", closed: "已结束" }[stage] || "已投递");
  }
  function formatDate(value) { return value || "未设置"; }
  function dateInNextWeek(value) {
    if (!value || !S.isValidIsoDate(value)) return false;
    const now = new Date(`${today()}T00:00:00`);
    const target = new Date(`${value}T00:00:00`);
    return target >= now && target <= new Date(now.getTime() + 7 * 86400000);
  }
  function renderSummary() {
    const apps = state.profile ? (state.profile.applications || []) : [];
    const plan = state.profile ? (state.profile.progressPlan || []) : [];
    $("summary-total").textContent = String(apps.length);
    $("summary-active").textContent = String(apps.filter((app) => classifyStatus(app.currentStatus) === "active").length);
    $("summary-next").textContent = String(apps.filter((app) => dateInNextWeek(app.nextActionDate)).length);
    $("summary-done").textContent = String(plan.filter((item) => item.status === "done").length);
  }
  function input(value, type, update, placeholder) {
    const el = document.createElement(type === "textarea" ? "textarea" : "input");
    if (el.tagName === "INPUT") el.type = type || "text";
    el.value = value == null ? "" : value;
    if (placeholder) el.placeholder = placeholder;
    el.addEventListener("input", () => update(el.value));
    return el;
  }
  function select(value, options, update) {
    const el = document.createElement("select");
    for (const [key, label] of options) el.appendChild(new Option(label, key));
    el.value = value || options[0][0];
    el.addEventListener("change", () => update(el.value));
    return el;
  }
  function formField(label, control, wide) {
    const wrap = document.createElement("label");
    wrap.className = "form-field" + (wide ? " wide" : "");
    const name = document.createElement("span");
    name.textContent = label;
    wrap.append(name, control);
    return wrap;
  }
  function statusChip(app) {
    const stage = classifyStatus(app.currentStatus);
    const chip = document.createElement("span");
    chip.className = `status-chip ${stage}`;
    chip.textContent = app.currentStatus || stageLabel(stage);
    return chip;
  }
  function variantOptions() {
    return [["", "未指定版本"], ...(state.profile?.variants || []).map((variant) => [variant.id, variant.name])];
  }
  function createApplicationCard(app) {
    const card = document.createElement("article");
    card.className = "application-card";
    const header = document.createElement("header");
    const title = document.createElement("div");
    title.className = "application-title";
    const name = document.createElement("h3");
    name.textContent = app.companyName || "未命名公司";
    const role = document.createElement("p");
    role.textContent = app.position || "尚未填写岗位";
    title.append(name, role);
    header.append(title, statusChip(app));
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "application-meta";
    meta.innerHTML = `<span>投递：${esc(formatDate(app.appliedDate))}</span><span>下一步：${esc(formatDate(app.nextActionDate))}</span>`;
    card.appendChild(meta);
    if (app.nextAction) {
      const next = document.createElement("p");
      next.className = "next-action";
      next.textContent = `下一步 · ${app.nextAction}`;
      card.appendChild(next);
    }

    const details = document.createElement("details");
    details.className = "application-editor";
    const summary = document.createElement("summary");
    summary.textContent = "编辑记录与状态历史";
    details.appendChild(summary);
    const editor = document.createElement("div");
    editor.className = "application-form";
    const update = (key, value) => { app[key] = value; touch(app); };
    editor.append(
      formField("公司", input(app.companyName, "text", (value) => update("companyName", value), "公司名称")),
      formField("岗位", input(app.position, "text", (value) => update("position", value), "岗位名称")),
      formField("投递版本", select(app.variantId, variantOptions(), (value) => update("variantId", value))),
      formField("投递日期", input(app.appliedDate, "date", (value) => update("appliedDate", value))),
      formField("申请网址", input(app.applicationUrl, "url", (value) => update("applicationUrl", value), "https://…"), true),
      formField("当前状态", input(app.currentStatus, "text", (value) => { update("currentStatus", value); renderSummary(); }, "如：笔试、面试")),
      formField("状态来源", select(app.statusSource, [["manual", "手动填写"], ["current-url", "当前网页"]], (value) => update("statusSource", value))),
      formField("状态网址", input(app.statusUrl, "url", (value) => update("statusUrl", value), "状态页链接"), true),
      formField("状态信息", input(app.statusInfo, "textarea", (value) => update("statusInfo", value), "状态说明"), true),
      formField("下一步日期", input(app.nextActionDate, "date", (value) => { update("nextActionDate", value); renderSummary(); })),
      formField("下一步安排", input(app.nextAction, "text", (value) => update("nextAction", value), "准备或跟进事项"), true),
      formField("备注", input(app.notes, "textarea", (value) => update("notes", value), "补充记录"), true),
    );
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const record = document.createElement("button");
    record.type = "button";
    record.textContent = "记录当前状态";
    record.addEventListener("click", () => recordApplicationStatus(app));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "删除投递";
    remove.addEventListener("click", () => removeApplication(app));
    actions.append(record, remove);
    editor.appendChild(actions);
    editor.appendChild(createHistory(app));
    details.appendChild(editor);
    card.appendChild(details);
    return card;
  }
  function createHistory(app) {
    const details = document.createElement("details");
    details.className = "status-history";
    const summary = document.createElement("summary");
    summary.textContent = `状态历史（${(app.statusHistory || []).length}）`;
    details.appendChild(summary);
    const list = document.createElement("div");
    list.className = "history-list";
    if (!(app.statusHistory || []).length) {
      const empty = document.createElement("p");
      empty.className = "empty-copy";
      empty.textContent = "尚未记录状态。填写当前状态后点击“记录当前状态”。";
      list.appendChild(empty);
    }
    for (const record of app.statusHistory || []) {
      const row = document.createElement("article");
      row.className = "history-entry";
      const update = (key, value) => { record[key] = value; touch(app); };
      row.append(
        formField("日期", input(record.date, "date", (value) => update("date", value))),
        formField("状态", input(record.status, "text", (value) => update("status", value))),
        formField("来源", select(record.source, [["manual", "手动填写"], ["current-url", "当前网页"]], (value) => update("source", value))),
        formField("网址", input(record.url, "url", (value) => update("url", value), "https://…"), true),
        formField("信息", input(record.info, "textarea", (value) => update("info", value), "状态补充"), true),
        formField("备注", input(record.notes, "textarea", (value) => update("notes", value), "备注"), true),
      );
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-history";
      remove.textContent = "删除这条状态";
      remove.addEventListener("click", () => {
        app.statusHistory = app.statusHistory.filter((item) => item.id !== record.id);
        touch(app);
        renderApplications();
      });
      row.appendChild(remove);
      list.appendChild(row);
    }
    details.appendChild(list);
    return details;
  }
  function renderApplications() {
    const area = $("application-list");
    area.innerHTML = "";
    const query = S.normalize(state.query);
    const apps = (state.profile?.applications || []).filter((app) => {
      const matchesText = !query || S.normalize([app.companyName, app.position, app.currentStatus, app.applicationUrl, app.statusInfo, app.nextAction, app.notes].join(" ")).includes(query);
      return matchesText && (state.stage === "all" || classifyStatus(app.currentStatus) === state.stage);
    });
    if (!apps.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<strong>${state.profile?.applications?.length ? "没有匹配的投递记录" : "从第一份投递开始"}</strong><span>${state.profile?.applications?.length ? "调整搜索或状态筛选后再试。" : "新增投递后，可在这里记录公司、岗位和后续节点。"}</span>`;
      area.appendChild(empty);
      return;
    }
    for (const app of apps) area.appendChild(createApplicationCard(app));
  }
  async function currentPageContext() {
    return new Promise((resolve) => {
      if (!globalThis.chrome?.runtime?.sendMessage) { resolve(null); return; }
      chrome.runtime.sendMessage({ type: "resume-assistant/current-page-context" }, (reply) => {
        if (chrome.runtime.lastError || !reply?.ok) { resolve(null); return; }
        resolve(reply.context || null);
      });
    });
  }
  async function recordApplicationStatus(app) {
    const source = app.statusSource || "manual";
    const context = source === "current-url" ? await currentPageContext() : null;
    if (source === "current-url" && !context?.url) {
      setStatus("没有可记录的当前网页。请先在招聘网页点击扩展图标，再回来记录状态。", true);
      return;
    }
    const url = source === "current-url" ? context.url : app.statusUrl || "";
    const record = S.newApplicationStatus(app.id, { date: today(), status: app.currentStatus || "", source, url, info: app.statusInfo || "", notes: app.notes || "" });
    app.statusHistory = app.statusHistory || [];
    app.statusHistory.unshift(record);
    app.statusUrl = url;
    app.statusUpdatedAt = new Date().toISOString();
    touch(app);
    renderAll();
    setStatus(source === "current-url" ? `已记录网页状态：${context.title || context.url}` : "已记录当前状态，请保存更改。");
  }
  function addApplication() {
    if (!state.profile) return;
    state.profile.applications = state.profile.applications || [];
    state.profile.applications.unshift(S.newApplication(state.profile.id, { appliedDate: today(), variantId: state.profile.variants?.[0]?.id || "" }));
    markDirty();
    renderAll();
    setStatus("已新增投递，请展开卡片补充信息。 ");
  }
  function removeApplication(app) {
    if (!confirm(`删除“${app.companyName || "未命名公司"}”的投递记录？`)) return;
    state.profile.applications = (state.profile.applications || []).filter((item) => item.id !== app.id);
    markDirty();
    renderAll();
    setStatus("已删除投递记录。 ");
  }
  function createPlanCard(item) {
    const card = document.createElement("article");
    card.className = "plan-card";
    const title = input(item.stage, "text", (value) => { item.stage = value; markDirty(); }, "计划事项");
    title.className = "plan-title-input";
    card.appendChild(title);
    const detail = document.createElement("div");
    detail.className = "plan-meta";
    detail.textContent = item.plannedDate ? `计划于 ${item.plannedDate}` : "尚未设置计划日期";
    card.appendChild(detail);
    if (item.nextAction) {
      const action = document.createElement("p");
      action.className = "plan-next-action";
      action.textContent = item.nextAction;
      card.appendChild(action);
    }
    const editor = document.createElement("details");
    editor.className = "plan-editor";
    const summary = document.createElement("summary");
    summary.textContent = "编辑事项";
    editor.appendChild(summary);
    const fields = document.createElement("div");
    fields.className = "plan-form";
    const update = (key, value) => { item[key] = value; markDirty(); };
    fields.append(
      formField("计划日期", input(item.plannedDate, "date", (value) => update("plannedDate", value))),
      formField("完成日期", input(item.completedDate, "date", (value) => update("completedDate", value))),
      formField("下一步", input(item.nextAction, "text", (value) => update("nextAction", value), "下一步安排"), true),
      formField("备注", input(item.notes, "textarea", (value) => update("notes", value), "补充说明"), true),
    );
    const tools = document.createElement("div");
    tools.className = "plan-tools";
    const move = select(item.status, columns.map((column) => [column.key, `移动到：${column.label}`]), (value) => {
      item.status = value;
      if (value === "done" && !item.completedDate) item.completedDate = today();
      markDirty();
      renderAll();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-history";
    remove.textContent = "删除计划";
    remove.addEventListener("click", () => {
      if (!confirm(`删除计划事项“${item.stage || "未命名"}”？`)) return;
      state.profile.progressPlan = (state.profile.progressPlan || []).filter((entry) => entry.id !== item.id);
      markDirty();
      renderAll();
    });
    tools.append(move, remove);
    fields.appendChild(tools);
    editor.appendChild(fields);
    card.appendChild(editor);
    return card;
  }
  function renderPlanBoard() {
    const board = $("plan-board");
    board.innerHTML = "";
    const items = state.profile?.progressPlan || [];
    for (const column of columns) {
      const lane = document.createElement("section");
      lane.className = `plan-lane ${column.key}`;
      const head = document.createElement("header");
      head.innerHTML = `<div><h3>${column.label}</h3><p>${column.note}</p></div><span>${items.filter((item) => item.status === column.key).length}</span>`;
      const body = document.createElement("div");
      body.className = "plan-cards";
      const laneItems = items.filter((item) => item.status === column.key);
      if (!laneItems.length) {
        const empty = document.createElement("p");
        empty.className = "lane-empty";
        empty.textContent = "暂无事项";
        body.appendChild(empty);
      }
      for (const item of laneItems) body.appendChild(createPlanCard(item));
      lane.append(head, body);
      board.appendChild(lane);
    }
  }
  function addProgress() {
    if (!state.profile) return;
    state.profile.progressPlan = state.profile.progressPlan || [];
    state.profile.progressPlan.unshift(S.newProgressItem(state.profile.id, "新求职事项", { plannedDate: today() }));
    markDirty();
    renderAll();
    setStatus("已新增计划事项。 ");
  }
  function renderAll() {
    renderProfileSelect();
    syncArchiveLinks();
    renderSummary();
    renderApplications();
    renderPlanBoard();
  }
  async function loadData() {
    await store.ensureInitialized();
    state.data = await store.load();
    const requested = new URLSearchParams(location.search).get("profile");
    state.profile = state.data.profiles.find((profile) => profile.id === requested) || state.data.profiles[0] || null;
  }
  (async () => {
    $("save-btn").addEventListener("click", persist);
    $("profile-select").addEventListener("change", (event) => setProfile(event.target.value));
    $("add-application-btn").addEventListener("click", addApplication);
    $("section-add-application-btn").addEventListener("click", addApplication);
    $("add-progress-btn").addEventListener("click", addProgress);
    $("section-add-progress-btn").addEventListener("click", addProgress);
    $("application-search").addEventListener("input", (event) => { state.query = event.target.value; renderApplications(); });
    $("application-stage-filter").addEventListener("change", (event) => { state.stage = event.target.value; renderApplications(); });
    await loadData();
    renderAll();
    setStatus(state.profile ? `档案：${state.profile.name} · 独立投递工作台已就绪。` : "暂无档案，请先前往档案库新建或导入。");
  })();
})();
