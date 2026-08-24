/* content/material-sidebar.js — 页面右侧本地材料库，不扫描表单、不注入值、不提交。 */
(() => {
  "use strict";
  const RAA = (globalThis.ResumeApplicationAssistant = globalThis.ResumeApplicationAssistant || {});
  const S = RAA.schema;
  const LIB = RAA.materialLibrary;
  const HOST_ID = "resume-application-assistant-host";

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: Inter, system-ui, "Microsoft YaHei", sans-serif; }
    .wrap { position: fixed; inset: 0 0 0 auto; width: 430px; max-width: min(94vw, 430px); z-index: 2147483000; display:flex; flex-direction:column; color:#182235; background:#f6f8fc; border-left:1px solid #dce3ef; box-shadow:-12px 0 35px rgba(15,23,42,.16); }
    .head { padding:16px 17px 14px; color:white; background:linear-gradient(135deg,#193b72 0%,#2463ad 58%,#3987c9 100%); }
    .head-line { display:flex; align-items:center; gap:9px; }
    .logo { width:34px; height:34px; display:grid; place-items:center; border-radius:11px; background:rgba(255,255,255,.18); font-size:18px; font-weight:800; }
    .title { flex:1; min-width:0; font-size:16px; font-weight:800; letter-spacing:.2px; }
    .sub { margin-top:3px; color:rgba(255,255,255,.78); font-size:11px; }
    .head-actions { display:flex; gap:5px; }
    button { border:1px solid #d5deeb; border-radius:8px; background:#fff; color:#26364d; padding:6px 9px; font-size:12px; cursor:pointer; }
    button:hover { border-color:#3f83d1; color:#1559a3; }
    button:disabled { opacity:.45; cursor:not-allowed; }
    .head button { color:#fff; border-color:rgba(255,255,255,.28); background:rgba(255,255,255,.12); }
    .head button:hover { background:rgba(255,255,255,.23); color:#fff; }
    .tools { padding:11px 13px 9px; background:#fff; border-bottom:1px solid #e5ebf4; }
    .search { width:100%; padding:9px 11px; border:1px solid #d7e0ed; border-radius:9px; outline:none; font-size:13px; }
    .search:focus { border-color:#4d8fd7; box-shadow:0 0 0 3px rgba(77,143,215,.14); }
    .chips { display:flex; gap:6px; margin-top:9px; overflow:auto; padding-bottom:2px; scrollbar-width:thin; }
    .chip { flex:none; padding:5px 9px; border-radius:999px; color:#5e718a; background:#f4f7fb; border-color:#e5ebf4; white-space:nowrap; }
    .chip.active { color:#1559a3; background:#e7f1ff; border-color:#9fc5ef; font-weight:700; }
    .notice { padding:7px 13px; color:#86621c; background:#fff9e8; border-bottom:1px solid #f5df9e; font-size:11px; line-height:1.45; }
    .body { flex:1; overflow:auto; padding:7px 10px 13px; }
    .group-title { display:flex; justify-content:space-between; align-items:center; margin:8px 3px 5px; color:#5b6d84; font-size:11px; font-weight:800; letter-spacing:.5px; }
    .group-title span { color:#9aa8ba; font-weight:500; }
    .card { margin:6px 0; padding:10px 10px 8px; border:1px solid #e3eaf3; border-radius:10px; background:#fff; transition:box-shadow .15s,border-color .15s; }
    .card:hover { border-color:#b9d1eb; box-shadow:0 4px 12px rgba(30,64,102,.07); }
    .card.sensitive { border-left:3px solid #eab54c; }
    .card-top { display:flex; align-items:center; gap:6px; }
    .label { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:750; }
    .badge { padding:2px 5px; border-radius:5px; color:#8b6419; background:#fff4d6; font-size:10px; }
    .value { margin:6px 0 7px; max-height:92px; overflow:auto; color:#384b64; white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; line-height:1.55; }
    .value.empty { color:#a2adba; font-style:italic; }
    .note { margin:-2px 0 7px; color:#8492a4; font-size:10px; line-height:1.4; }
    .actions { display:flex; justify-content:flex-end; gap:5px; }
    .copy { color:#fff; border-color:#266bb5; background:#286fba; font-weight:700; }
    .copy:hover { color:#fff; border-color:#195a9e; background:#195f9f; }
    .link { color:#2468aa; border-color:transparent; background:transparent; }
    .empty { padding:35px 15px; text-align:center; color:#8b99aa; font-size:12px; }
    .foot { display:flex; gap:7px; padding:10px 12px; background:#fff; border-top:1px solid #e3eaf3; }
    .foot button { flex:1; }
    .status { min-height:18px; padding:2px 13px 6px; color:#65758a; font-size:11px; }
    .status.error { color:#b23838; }
  `;

  let host = null;
  let shadow = null;
  let panelRoot = null;
  let profile = null;
  let items = [];
  let query = "";
  let category = "全部";
  const revealed = new Set();

  const $ = (selector) => panelRoot ? panelRoot.querySelector(selector) : null;
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  function build() {
    host = document.createElement("div");
    host.id = `${HOST_ID}-${Math.random().toString(36).slice(2, 10)}`;
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style"); style.textContent = CSS; shadow.appendChild(style);
    const wrap = document.createElement("div"); wrap.className = "wrap";
    panelRoot = wrap;
    wrap.innerHTML = `
      <div class="head">
        <div class="head-line"><div class="logo">履</div><div class="title">履历材料库<div class="sub">只复制，不扫描、不自动填写、不自动提交</div></div><div class="head-actions"><button id="manager" type="button" title="打开档案库">档案</button><button id="close" type="button" title="关闭侧栏">×</button></div></div>
      </div>
      <div class="tools"><input class="search" id="search" type="search" placeholder="搜索档案、项目、技能或开放问题…" autocomplete="off"><div class="chips" id="chips"></div></div>
      <div class="notice">敏感材料默认遮罩。点击“显示”后仍需确认才能复制；复制后请及时清理剪贴板。</div>
      <div class="body" id="body"></div>
      <div class="status" id="status"></div>
      <div class="foot"><button id="tracker" type="button">投递工作台</button><button id="close-footer" type="button">关闭侧栏</button></div>`;
    shadow.appendChild(wrap);
    document.documentElement.appendChild(host);
    $("#close").addEventListener("click", close);
    $("#manager").addEventListener("click", () => chrome.runtime.sendMessage({ type:"resume-assistant/open-manager" }));
    $("#search").addEventListener("input", () => { query = $("#search").value; render(); });
    $("#tracker").addEventListener("click", () => chrome.runtime.sendMessage({ type:"resume-assistant/open-tracker" }));
    $("#close-footer").addEventListener("click", close);
  }

  function setStatus(text, error) { $("#status").textContent = text || ""; $("#status").className = "status" + (error ? " error" : ""); }
  function getCategories() { return ["全部", ...LIB.CATEGORIES.filter((c) => items.some((m) => m.category === c))]; }
  function visibleItems() {
    const q = S.normalize(query);
    return items.filter((item) => {
      if (category !== "全部" && item.category !== category) return false;
      const hay = [item.label, item.category, ...(item.tags || [])];
      if (!item.sensitive) hay.push(item.value);
      return !q || S.normalize(hay.join(" ")).includes(q);
    });
  }
  function valueOf(item) {
    if (!item.value) return "尚未填写";
    if (item.sensitive && !revealed.has(item.id)) return LIB.maskValue(item.value);
    return item.value;
  }

  function renderChips() {
    const root = $("#chips"); root.innerHTML = "";
    for (const name of getCategories()) {
      const button = document.createElement("button"); button.type = "button"; button.className = "chip" + (category === name ? " active" : ""); button.textContent = name;
      button.addEventListener("click", () => { category = name; renderChips(); renderBody(); }); root.appendChild(button);
    }
  }
  function render() { renderChips(); renderBody(); }
  function renderBody() {
    const root = $("#body"); root.innerHTML = "";
    const filtered = visibleItems();
    if (!filtered.length) { const p = document.createElement("div"); p.className = "empty"; p.textContent = items.length ? "没有找到匹配材料" : "材料库为空，请点击“管理”添加材料"; root.appendChild(p); return; }
    const groups = new Map();
    for (const item of filtered) { if (!groups.has(item.category)) groups.set(item.category, []); groups.get(item.category).push(item); }
    for (const [name, group] of groups) {
      const title = document.createElement("div"); title.className = "group-title"; title.innerHTML = `<span>${esc(name)}</span><span>${group.length} 项</span>`; root.appendChild(title);
      for (const item of group) root.appendChild(card(item));
    }
  }
  function card(item) {
    const card = document.createElement("article"); card.className = "card" + (item.sensitive ? " sensitive" : "");
    const top = document.createElement("div"); top.className = "card-top";
    const label = document.createElement("div"); label.className = "label"; label.textContent = item.label || "未命名材料"; top.appendChild(label);
    if (item.sensitive) { const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = "敏感"; top.appendChild(badge); }
    const value = document.createElement("div"); value.className = "value" + (!item.value ? " empty" : ""); value.textContent = valueOf(item); card.append(top, value);
    if (item.note) { const note = document.createElement("div"); note.className = "note"; note.textContent = item.note; card.appendChild(note); }
    const actions = document.createElement("div"); actions.className = "actions";
    if (item.sensitive && item.value) { const reveal = document.createElement("button"); reveal.type = "button"; reveal.className = "link"; reveal.textContent = revealed.has(item.id) ? "隐藏" : "显示"; reveal.addEventListener("click", () => { if (revealed.has(item.id)) revealed.delete(item.id); else revealed.add(item.id); renderBody(); }); actions.appendChild(reveal); }
    if (item.folderPath) { const folder = document.createElement("button"); folder.type = "button"; folder.className = "link"; folder.textContent = "打开所在文件夹"; folder.addEventListener("click", () => openFolder(item.folderPath, item.label)); actions.appendChild(folder); }
    const copyValueText = item.filePath || item.value;
    const copy = document.createElement("button"); copy.type = "button"; copy.className = "copy"; copy.textContent = item.filePath ? "复制路径" : (item.manualOnly ? "复制参考" : "复制"); copy.disabled = !copyValueText;
    copy.addEventListener("click", () => copyValue(copyValueText, item.filePath ? `${item.label}路径` : item.label, !!item.sensitive)); actions.appendChild(copy); card.appendChild(actions); return card;
  }
  async function copyValue(value, label, sensitive) {
    if (!value) return;
    if (sensitive && !confirm(`确定复制敏感材料“${label}”？复制后请及时清理剪贴板。`)) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(value));
      } else {
        const area = document.createElement("textarea");
        area.value = String(value);
        area.setAttribute("readonly", "");
        area.style.cssText = "position:fixed;left:-9999px;opacity:0";
        document.body.appendChild(area);
        area.select();
        if (!document.execCommand("copy")) throw new Error("浏览器拒绝访问剪贴板");
        area.remove();
      }
      setStatus(`已复制“${label}”，请手动粘贴。`);
    } catch (error) {
      setStatus(`复制失败：${error.message || error}`, true);
    }
  }
  function openFolder(path, label) {
    if (!path) {
      setStatus(`“${label || "该材料"}”尚未设置本地文件夹；请在“管理”中填写。`, true);
      return;
    }
    chrome.runtime.sendMessage({ type: "resume-assistant/open-folder", path }, (reply) => {
      if (chrome.runtime.lastError || !reply || !reply.ok) setStatus("无法直接打开目录：请在扩展详情开启“允许访问文件网址”，或使用复制路径。", true);
      else setStatus(`已打开“${label || "材料"}”所在目录；请在网页上传控件中手动选择文件。`, false);
    });
  }
  async function open() {
    if (!host || !shadow || !panelRoot || !panelRoot.querySelector("#chips")) {
      if (host) host.remove();
      host = null;
      shadow = null;
      panelRoot = null;
      build();
    }
    const data = await RAA.profileStore.load();
    profile = data.profiles[0] || null;
    items = profile && Array.isArray(profile.materials) ? profile.materials : [];
    render();
    setStatus(profile ? `档案：${profile.name} · ${items.length} 项材料` : "暂无档案，请点击“管理”创建", !profile);
  }
  function close() {
    host?.remove();
    host = null;
    shadow = null;
    panelRoot = null;
    profile = null;
    items = [];
  }
  RAA.materialSidebar = { open, close };
})();
