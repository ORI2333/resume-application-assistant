/* manager.js — 履历档案库：档案 CRUD、版本成员、材料、开放问题与 XLSX 备份。 */
(() => {
  "use strict";
  const RAA = globalThis.ResumeApplicationAssistant;
  const S = RAA.schema;
  const store = RAA.profileStore;
  const xw = RAA.xlsxWorkbook;

  const state = { data: null, profile: null, dirty: false };

  const $ = (id) => document.getElementById(id);
  const statusEl = $("status-line");

  function setStatus(text, isError) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("error", !!isError);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function markDirty() {
    state.dirty = true;
    $("save-btn").textContent = "保存（有未保存修改）";
  }

  async function persist() {
    const result = S.validateProfile(state.profile);
    if (!result.ok) {
      setStatus("保存失败：\n" + result.errors.slice(0, 8).join("\n"), true);
      return false;
    }
    state.profile.updatedAt = new Date().toISOString();
    const openItems = (state.profile.reviewItems || []).some((r) => r.status !== "dismissed");
    state.profile.needsReview = openItems;
    await store.upsertProfile(state.profile);
    state.dirty = false;
    $("save-btn").textContent = "保存";
    setStatus("已保存。");
    return true;
  }
  function trackerUrl() {
    return state.profile ? `tracker.html?profile=${encodeURIComponent(state.profile.id)}` : "tracker.html";
  }

  function updateTrackerLinks() {
    for (const id of ["tracker-link", "hero-tracker-link"]) {
      const link = $(id);
      if (link) link.href = trackerUrl();
    }
  }

  /* ---------- 档案选择 ---------- */
  function renderProfileSelect() {
    const sel = $("profile-select");
    sel.innerHTML = state.data.profiles
      .map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)
      .join("");
    sel.value = state.profile ? state.profile.id : "";
  }

  async function selectProfile(id) {
    const profile = state.data.profiles.find((p) => p.id === id);
    if (!profile) return;
    state.profile = profile;
    state.dirty = false;
    $("save-btn").textContent = "保存";
    renderAll();
  }

  /* ---------- 渲染 ---------- */
  function renderAll() {
    renderProfileSelect();
    updateTrackerLinks();
    if (!state.profile) {
      $("gate-banner").classList.add("hidden");
      $("review-count").textContent = "0";
      $("review-list").innerHTML = "";
      $("personal-table").querySelector("tbody").innerHTML = "";
      $("sensitive-table").querySelector("tbody").innerHTML = "";
      $("variants-area").innerHTML = '<p class="hint">暂无档案：可新建或导入。</p>';
      $("records-area").innerHTML = "";
      renderMaterials(); renderCustomFields();
      return;
    }
    renderGate();
    renderReview();
    renderFieldTable("personal-table", state.profile.personal || [], false);
    renderFieldTable("sensitive-table", state.profile.sensitive || [], true);
    renderMaterials();
    renderCustomFields();
    renderVariants();
    renderRecords();
  }

  function renderGate() {
    $("gate-banner").classList.add("hidden");
  }

  function renderReview() {
    const list = state.profile.reviewItems || [];
    $("review-count").textContent = list.filter((r) => r.status !== "dismissed").length;
    const ul = $("review-list");
    ul.innerHTML = "";
    if (!list.length) {
      const li = document.createElement("li");
      li.textContent = "暂无待核对项。";
      ul.appendChild(li);
      return;
    }
    for (const item of list) {
      const li = document.createElement("li");
      li.className = "review-item" + (item.status === "dismissed" ? " done" : "");
      const cat = document.createElement("span");
      cat.className = "cat";
      cat.textContent = item.category;
      const msg = document.createElement("span");
      msg.className = "msg";
      msg.textContent = item.message;
      li.appendChild(cat);
      li.appendChild(msg);
      if (item.status !== "dismissed") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "small";
        btn.textContent = "已核对，忽略";
        btn.addEventListener("click", () => {
          item.status = "dismissed";
          markDirty();
          renderAll();
        });
        li.appendChild(btn);
      }
      ul.appendChild(li);
    }
  }

  function renderFieldTable(tableId, fields, isSensitive) {
    const tbody = $(tableId).querySelector("tbody");
    tbody.innerHTML = "";
    for (const f of fields) {
      const tr = document.createElement("tr");
      const cell = (tag, text) => {
        const td = document.createElement("td");
        const el = document.createElement(tag);
        el.textContent = text;
        td.appendChild(el);
        return td;
      };
      const keyTd = cell("strong", f.key);
      const labelTd = document.createElement("td");
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.value = f.label;
            labelInput.addEventListener("input", () => { f.label = labelInput.value; markDirty(); });
      labelTd.appendChild(labelInput);

      const valueTd = document.createElement("td");
      const valueInput = document.createElement("input");
      valueInput.type = "text";
      valueInput.value = f.value;
      valueInput.placeholder = isSensitive ? "留空则不参与填写" : "";
            valueInput.addEventListener("input", () => { f.value = valueInput.value; markDirty(); renderGate(); });
      valueTd.appendChild(valueInput);

      const aliasTd = document.createElement("td");
      const aliasInput = document.createElement("input");
      aliasInput.type = "text";
      aliasInput.value = JSON.stringify(f.aliases || []);
      aliasInput.placeholder = '["别名1","别名2"]';
      aliasInput.addEventListener("change", () => {
        try {
          const v = JSON.parse(aliasInput.value.trim() || "[]");
          if (!Array.isArray(v)) throw new Error("not array");
          f.aliases = v.map((x) => String(x));
          markDirty();
        } catch (err) {
          setStatus("别名必须是 JSON 数组，如 [\"手机\",\"手机号\"]", true);
        }
      });
      aliasTd.appendChild(aliasInput);

      const autoTd = document.createElement("td");
      const autoCheck = document.createElement("input");
      autoCheck.type = "checkbox";
      autoCheck.checked = !!f.autoFill;
            autoCheck.addEventListener("change", () => { f.autoFill = autoCheck.checked; markDirty(); renderGate(); });
      autoTd.appendChild(autoCheck);

      const skipTd = document.createElement("td");
      const skipCheck = document.createElement("input");
      skipCheck.type = "checkbox";
      skipCheck.checked = !!f.skip;
      skipCheck.title = "标记“不使用”：该字段不参与匹配与填写";
            skipCheck.addEventListener("change", () => { f.skip = skipCheck.checked; markDirty(); renderGate(); });
      skipTd.appendChild(skipCheck);

      tr.append(keyTd, labelTd, valueTd, aliasTd, autoTd, skipTd);
      tbody.appendChild(tr);
    }
  }
  const customFieldView = { query: "" };

  function makeInput(value, placeholder, onInput, tag) {
    const el = document.createElement(tag || "input");
    if (el.tagName === "INPUT") el.type = "text";
    el.value = value == null ? "" : value;
    if (placeholder) el.placeholder = placeholder;
    el.addEventListener("input", () => { onInput(el.value); markDirty(); });
    return el;
  }
  function syncCustomFieldMaterial(field) {
    if (!state.profile || !field) return;
    state.profile.materials = state.profile.materials || [];
    const systemKey = `custom-field:${field.id}`;
    const data = { category: "自定义", label: field.label || field.key, value: field.value || "", sensitive: !!field.isSensitive, tags: [field.key, ...(field.aliases || [])], source: "custom-field", systemKey, updatedAt: new Date().toISOString() };
    const material = state.profile.materials.find((item) => item.systemKey === systemKey);
    if (material) Object.assign(material, data);
    else state.profile.materials.push(RAA.materialLibrary.material(state.profile.id, data.category, data.label, data.value, data.sensitive, false, data));
  }

  function renderCustomFields() {
    const area = $("custom-fields-list");
    const list = state.profile ? (state.profile.customFields || []) : [];
    const query = S.normalize(customFieldView.query);
    const visible = list.filter((f) => !query || S.normalize([f.key, f.label, f.value, ...(f.aliases || [])].join(" ")).includes(query));
    area.innerHTML = "";
    if (!visible.length) { area.innerHTML = `<p class="hint">${list.length ? "没有匹配的字段。" : "暂无自定义字段，请点击“新增字段”。"}</p>`; return; }
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>key</th><th>名称</th><th>值</th><th>类型</th><th>选项（JSON）</th><th>别名（JSON）</th><th>敏感</th><th>自动填写</th><th>不使用</th><th></th></tr></thead>";
    const tbody = document.createElement("tbody");
    for (const f of visible) {
      const tr = document.createElement("tr");
      const key = makeInput(f.key, "唯一 key", (v) => { f.key = v.trim(); syncCustomFieldMaterial(f); });
      const label = makeInput(f.label, "显示名称", (v) => { f.label = v; syncCustomFieldMaterial(f); });
      const value = makeInput(f.value, "字段值", (v) => { f.value = v; syncCustomFieldMaterial(f); }, f.kind === "richText" ? "textarea" : "input");
      const kind = document.createElement("select");
      for (const k of S.FIELD_KINDS) kind.appendChild(new Option({ text: "文本", date: "日期", select: "下拉选择", richText: "富文本" }[k], k));
      kind.value = f.kind || "text";
      kind.addEventListener("change", () => { f.kind = kind.value; markDirty(); renderCustomFields(); });
      const options = makeInput(JSON.stringify(f.options || []), '["选项1","选项2"]', (v) => { try { const x = JSON.parse(v || "[]"); if (!Array.isArray(x)) throw new Error(); f.options = x.map(String); } catch (_) { setStatus("字段选项必须是 JSON 数组", true); } });
      const aliases = makeInput(JSON.stringify(f.aliases || []), '["别名"]', (v) => { try { const x = JSON.parse(v || "[]"); if (!Array.isArray(x)) throw new Error(); f.aliases = x.map(String); syncCustomFieldMaterial(f); } catch (_) { setStatus("字段别名必须是 JSON 数组", true); } });
      const checkbox = (checked, fn, title) => { const x = document.createElement("input"); x.type = "checkbox"; x.checked = !!checked; x.title = title || ""; x.addEventListener("change", () => { fn(x.checked); markDirty(); }); return x; };
      const sensitive = checkbox(f.isSensitive, (v) => { f.isSensitive = v; if (v) f.autoFill = false; syncCustomFieldMaterial(f); renderCustomFields(); }, "敏感字段");
      const auto = checkbox(f.autoFill, (v) => { f.autoFill = v; }, "允许作为填写候选");
      const skip = checkbox(f.skip, (v) => { f.skip = v; }, "不使用");
      const del = document.createElement("button"); del.type = "button"; del.className = "remove"; del.textContent = "删除";
      del.addEventListener("click", () => { if (!confirm(`删除字段“${f.label || f.key}”？`)) return; state.profile.customFields = list.filter((x) => x.id !== f.id); state.profile.materials = (state.profile.materials || []).filter((item) => item.systemKey !== `custom-field:${f.id}`); markDirty(); renderCustomFields(); renderMaterials(); });
      for (const cell of [key, label, value, kind, options, aliases, sensitive, auto, skip, del]) { const td = document.createElement("td"); td.appendChild(cell); tr.appendChild(td); }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody); area.appendChild(table);
  }

  function addCustomField() {
    if (!state.profile) return;
    state.profile.customFields = state.profile.customFields || [];
    const key = `custom_${state.profile.customFields.length + 1}`;
    const field = { id: S.createId("cf"), key, label: "新字段", value: "", aliases: [], kind: "text", options: [], isSensitive: false, autoFill: false, skip: false, custom: true };
    state.profile.customFields.push(field);
    syncCustomFieldMaterial(field);
    markDirty(); renderCustomFields(); setStatus("已新增自定义字段，请填写后保存。");
  }
  /* ---------- 本地材料库 ---------- */
  const materialView = { query: "", category: "全部" };

  function renderMaterials() {
    const profile = state.profile;
    const list = profile ? (profile.materials || []) : [];
    const count = $("material-count");
    const area = $("materials-list");
    count.textContent = String(list.length);
    const categorySelect = $("material-category-filter");
    const categories = ["全部", ...RAA.materialLibrary.CATEGORIES.filter((c) => list.some((m) => m.category === c))];
    for (const m of list) if (m.category && !categories.includes(m.category)) categories.push(m.category);
    categorySelect.innerHTML = categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    if (!categories.includes(materialView.category)) materialView.category = "全部";
    categorySelect.value = materialView.category;
    const query = S.normalize(materialView.query);
    const visible = list.filter((m) => {
      if (materialView.category !== "全部" && m.category !== materialView.category) return false;
      if (!query) return true;
      const haystack = [m.label, m.category, ...(m.tags || [])];
      if (!m.sensitive) haystack.push(m.value);
      return S.normalize(haystack.join(" ")).includes(query);
    });
    area.innerHTML = "";
    if (!visible.length) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = list.length ? "当前筛选没有材料。" : "暂无材料，请点击“新增材料”。";
      area.appendChild(p);
      return;
    }
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>分类</th><th>名称</th><th>复制值</th><th>上传文件夹（可选）</th><th>安全选项</th><th></th></tr></thead>";
    const tbody = document.createElement("tbody");
    for (const item of visible) {
      const tr = document.createElement("tr");
      const categoryTd = document.createElement("td");
      const category = document.createElement("select");
      category.innerHTML = RAA.materialLibrary.CATEGORIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      if (item.category && !RAA.materialLibrary.CATEGORIES.includes(item.category)) {
        const custom = document.createElement("option"); custom.value = item.category; custom.textContent = item.category; category.appendChild(custom);
      }
      category.value = item.category || "自定义";
      category.addEventListener("change", () => { item.category = category.value; markDirty(); renderMaterials(); });
      categoryTd.appendChild(category);
      const labelTd = document.createElement("td");
      const label = document.createElement("input"); label.type = "text"; label.value = item.label || ""; label.placeholder = "材料名称";
      label.addEventListener("input", () => { item.label = label.value; markDirty(); }); labelTd.appendChild(label);
      const valueTd = document.createElement("td");
      const value = document.createElement("textarea"); value.value = item.value || ""; value.placeholder = "留空表示尚未填写";
      value.addEventListener("input", () => { item.value = value.value; item.updatedAt = new Date().toISOString(); markDirty(); }); valueTd.appendChild(value);
      const folderTd = document.createElement("td");
      const folder = document.createElement("input"); folder.type = "text"; folder.value = item.folderPath || ""; folder.placeholder = "D:\\资料\\头像";
      folder.addEventListener("input", () => { item.folderPath = folder.value.trim(); item.updatedAt = new Date().toISOString(); markDirty(); }); folderTd.appendChild(folder);
      const flagsTd = document.createElement("td"); flagsTd.className = "material-flags";
      const sensitiveLabel = document.createElement("label"); const sensitive = document.createElement("input"); sensitive.type = "checkbox"; sensitive.checked = !!item.sensitive;
      sensitive.addEventListener("change", () => { item.sensitive = sensitive.checked; markDirty(); renderMaterials(); }); sensitiveLabel.append(sensitive, document.createTextNode("敏感"));
      const manualLabel = document.createElement("label"); const manual = document.createElement("input"); manual.type = "checkbox"; manual.checked = !!item.manualOnly;
      manual.addEventListener("change", () => { item.manualOnly = manual.checked; markDirty(); }); manualLabel.append(manual, document.createTextNode("仅参考"));
      flagsTd.append(sensitiveLabel, manualLabel);
      const delTd = document.createElement("td");
      const del = document.createElement("button"); del.type = "button"; del.className = "remove"; del.textContent = "删除";
      del.addEventListener("click", () => { if (!confirm(`删除材料“${item.label || "未命名"}”？`)) return; profile.materials = profile.materials.filter((m) => m.id !== item.id); markDirty(); renderMaterials(); });
      delTd.appendChild(del);
      tr.append(categoryTd, labelTd, valueTd, folderTd, flagsTd, delTd); tbody.appendChild(tr);
    }
    table.appendChild(tbody); area.appendChild(table);
  }

  function addMaterial() {
    if (!state.profile) return;
    state.profile.materials = state.profile.materials || [];
    state.profile.materials.unshift(RAA.materialLibrary.material(state.profile.id, "自定义", "新材料", "", false, false, { source: "user" }));
    materialView.query = ""; materialView.category = "全部"; markDirty(); renderMaterials();
    setStatus("已新增材料，请填写名称和值后保存。", false);
  }

  /* ---------- 版本 ---------- */
  const RECORD_LABELS = {
    skills: "技能", education: "教育经历", experiences: "工作/实习经历", projects: "项目经历",
    research: "科研经历", awards: "获奖经历", activities: "校园/荣誉经历", answers: "开放问题答案",
  };

  function renderVariants() {
    const area = $("variants-area");
    area.innerHTML = "";
    const profile = state.profile;
    if (!profile.variants || !profile.variants.length) {
      const p = document.createElement("p");
      p.textContent = "暂无投递版本。";
      area.appendChild(p);
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "新建版本";
      add.addEventListener("click", addVariant);
      area.appendChild(add);
      return;
    }
    for (const v of profile.variants) {
      const block = document.createElement("div");
      block.className = "variant-block";

      const head = document.createElement("div");
      head.className = "variant-head";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = v.name;
      nameInput.title = "版本名称";
      nameInput.addEventListener("input", () => { v.name = nameInput.value; markDirty(); });
      const roleInput = document.createElement("input");
      roleInput.type = "text";
      roleInput.value = v.targetRole;
      roleInput.title = "目标岗位";
      roleInput.placeholder = "目标岗位";
      roleInput.addEventListener("input", () => { v.targetRole = roleInput.value; markDirty(); });
      const langInput = document.createElement("input");
      langInput.type = "text";
      langInput.value = v.language;
      langInput.title = "语言";
      langInput.style.maxWidth = "70px";
      langInput.addEventListener("input", () => { v.language = langInput.value; markDirty(); });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "small danger";
      del.textContent = "删除版本";
      del.addEventListener("click", async () => {
        if (!confirm(`删除版本「${v.name}」？记录本身保留。`)) return;
        profile.variants = profile.variants.filter((x) => x.id !== v.id);
        markDirty();
        renderVariants();
      });
      head.append(nameInput, roleInput, langInput, del);
      block.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "membership-grid";
      for (const [type, label] of Object.entries(RECORD_LABELS)) {
        const group = document.createElement("div");
        group.className = "membership-group";
        const h4 = document.createElement("h4");
        h4.textContent = label;
        group.appendChild(h4);
        const records = profile[type] || [];
        const selected = v[type] || [];
        const ordered = [...selected];
        for (const rec of records) {
          if (!ordered.includes(rec.id)) ordered.push(rec.id);
        }
        for (const rid of ordered) {
          const row = document.createElement("div");
          row.className = "item";
          const box = document.createElement("input");
          box.type = "checkbox";
          box.checked = selected.includes(rid);
          const lab = document.createElement("label");
          lab.textContent = labelOfRecord(type, records.find((r) => r.id === rid));
          lab.title = lab.textContent;
          box.addEventListener("change", () => {
            const idx = v[type].indexOf(rid);
            if (box.checked && idx === -1) v[type].push(rid);
            if (!box.checked && idx !== -1) v[type].splice(idx, 1);
            markDirty();
          });
          const up = document.createElement("button");
          up.type = "button";
          up.className = "small";
          up.textContent = "↑";
          up.disabled = !selected.includes(rid) || v[type].indexOf(rid) <= 0;
          up.addEventListener("click", () => {
            const i = v[type].indexOf(rid);
            if (i > 0) {
              const t = v[type][i - 1];
              v[type][i - 1] = v[type][i];
              v[type][i] = t;
              markDirty();
              renderVariants();
            }
          });
          row.append(box, lab, up);
          group.appendChild(row);
        }
        grid.appendChild(group);
      }
      block.appendChild(grid);
      area.appendChild(block);
    }
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "新建版本";
    addBtn.addEventListener("click", addVariant);
    area.appendChild(addBtn);
  }

  function labelOfRecord(type, rec) {
    if (!rec) return "(记录缺失)";
    switch (type) {
      case "education": return `${rec.school || ""} ${rec.major || ""}`.trim() || rec.id;
      case "experiences": return `${rec.organization || ""} ${rec.title || ""}`.trim() || rec.id;
      case "projects": return rec.name || rec.id;
      case "research": return rec.title || rec.id;
      case "awards":
      case "activities": return `${rec.name || ""} ${rec.levelOrRole || ""}`.trim() || rec.id;
      case "skills": return `${rec.category || ""}：${(rec.content || "").slice(0, 24)}` || rec.id;
      case "answers": return `${rec.title || "答案"}${rec.needsReview ? "（待核对草稿）" : ""}`;
      default: return rec.id;
    }
  }

  async function addVariant() {
    const result = await store.createVariant(state.profile.id, "新版本", "");
    if (!result.ok) {
      setStatus(result.errors.join("\n"), true);
      return;
    }
    await loadData();
    selectProfile(state.profile.id);
    setStatus("已创建版本，可调整成员与顺序。");
  }

  /* ---------- 重复记录 ---------- */
  const RECORD_EDITORS = {
    education: { columns: ["school", "department", "major", "degree", "startDate", "endDate", "gpa", "ranking"] },
    experiences: { columns: ["organization", "title", "startDate", "endDate", "description"] },
    projects: { columns: ["name", "role", "startDate", "endDate", "url", "description", "technologies", "outcomes"] },
    research: { columns: ["type", "title", "venue", "status", "authorOrder", "date", "description", "url"] },
    awards: { columns: ["name", "date", "levelOrRole", "description"] },
    activities: { columns: ["name", "date", "levelOrRole", "description"] },
    skills: { columns: ["category", "content"] },
    answers: { columns: ["title", "keywords", "content", "needsReview"] },
  };
  const COLUMN_LABELS = {
    school: "学校", department: "院系", major: "专业", degree: "学历", startDate: "开始时间",
    endDate: "结束时间", gpa: "绩点", ranking: "排名", organization: "公司", title: "职位",
    description: "描述", name: "名称", role: "角色", url: "链接", technologies: "技术栈(JSON)",
    outcomes: "成果", type: "类型", venue: "期刊/会议", status: "状态", authorOrder: "作者排序",
    date: "时间", levelOrRole: "级别/角色", category: "分类", content: "内容",
    keywords: "关键词(JSON)", needsReview: "待核对",
  };

  function renderRecords() {
    const area = $("records-area");
    area.innerHTML = "";
    for (const [type, spec] of Object.entries(RECORD_EDITORS)) {
      const card = document.createElement("div");
      card.className = "card records-head";
      const h3 = document.createElement("h3");
      h3.textContent = RECORD_LABELS[type] || type;
      card.appendChild(h3);
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "新增一条";
      addBtn.addEventListener("click", () => addRecord(type));
      card.appendChild(addBtn);

      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      for (const col of ["#", ...spec.columns]) {
        const th = document.createElement("th");
        th.textContent = COLUMN_LABELS[col] || col;
        headRow.appendChild(th);
      }
      const thDel = document.createElement("th");
      thDel.textContent = "";
      headRow.appendChild(thDel);
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      const list = state.profile[type] || [];
      for (const rec of list) {
        const tr = document.createElement("tr");
        const numTd = document.createElement("td");
        numTd.textContent = list.indexOf(rec) + 1;
        tr.appendChild(numTd);
        for (const col of spec.columns) {
          const td = document.createElement("td");
          if (col === "needsReview") {
            const box = document.createElement("input");
            box.type = "checkbox";
            box.checked = !!rec[col];
            box.addEventListener("change", () => { rec[col] = box.checked; markDirty(); });
            td.appendChild(box);
          } else {
            const input = document.createElement(col === "description" || col === "content" ? "textarea" : "input");
            if (input.tagName === "INPUT") input.type = "text";
            const value = col === "technologies" || col === "keywords" ? JSON.stringify(rec[col] || []) : rec[col];
            input.value = value == null ? "" : value;
            if (col === "startDate" || col === "endDate" || col === "date") {
              input.placeholder = "YYYY-MM-DD 或留空";
            }
            if (col === "technologies" || col === "keywords") {
              input.placeholder = '["a","b"]';
              input.addEventListener("change", () => {
                try {
                  const v = JSON.parse(input.value.trim() || "[]");
                  if (!Array.isArray(v)) throw new Error("not array");
                  rec[col] = v.map((x) => String(x));
                  markDirty();
                } catch (err) {
                  setStatus(`${COLUMN_LABELS[col]} 必须是 JSON 数组`, true);
                }
              });
            } else {
              input.addEventListener("input", () => { rec[col] = input.value; markDirty(); });
            }
            td.appendChild(input);
          }
          tr.appendChild(td);
        }
        const delTd = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "remove";
        delBtn.textContent = "删除";
        delBtn.addEventListener("click", () => removeRecord(type, rec.id));
        delTd.appendChild(delBtn);
        tr.appendChild(delTd);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      const wrap = document.createElement("div");
      wrap.className = "card";
      wrap.appendChild(card);
      wrap.appendChild(table);
      area.appendChild(wrap);
    }
  }

  function addRecord(type) {
    const profileId = state.profile.id;
    let rec;
    switch (type) {
      case "education": rec = S.newEducation(profileId, "", "", "", "", "", "", "", ""); break;
      case "experiences": rec = S.newExperience(profileId, "", "", "", "", ""); break;
      case "projects": rec = S.newProject(profileId, "", "", "", "", "", "", [], ""); break;
      case "research": rec = S.newResearch(profileId, "", "", "", "", "", "", "", ""); break;
      case "awards": rec = S.newAward(profileId, "", "", "", ""); break;
      case "activities": rec = S.newActivity(profileId, "", "", "", ""); break;
      case "skills": rec = S.newSkill(profileId, "", ""); break;
      case "answers": rec = S.newAnswer(profileId, "", [], "", true); break;
    }
    state.profile[type].push(rec);
    markDirty();
    renderRecords();
  }

  function removeRecord(type, id) {
    if (!confirm("删除这条记录？版本引用也会一并移除。")) return;
    const list = state.profile[type];
    state.profile[type] = list.filter((r) => r.id !== id);
    for (const v of state.profile.variants) {
      const idx = v[type].indexOf(id);
      if (idx !== -1) v[type].splice(idx, 1);
    }
    markDirty();
    renderRecords();
  }

  /* ---------- 档案 CRUD ---------- */
  async function newProfile() {
    const name = prompt("新档案名称：", "新档案");
    if (!name) return;
    const now = new Date().toISOString();
    const profile = {
      id: S.createId("pro"),
      name,
      createdAt: now,
      updatedAt: now,
      needsReview: false,
      reviewItems: [],
      personal: [],
      sensitive: [],
      customFields: [],
      applications: [],
      progressPlan: [],
      materials: [],
      skills: [], education: [], experiences: [], projects: [],
      research: [], awards: [], activities: [], answers: [],
      variants: [S.newVariant(S.createId("pro"), S.createId("var"), "默认版本", "", "zh")],
    };
    const v = profile.variants[0];
    v.profileId = profile.id;
    RAA.materialLibrary.ensureProfileMaterials(profile);
    state.data.profiles.push(profile);
    state.profile = profile;
    await persist();
    renderAll();
    setStatus("已创建空档案，请填写基本信息与记录。");
  }

  async function deleteProfile() {
    if (!state.profile) return;
    if (!confirm(`删除档案「${state.profile.name}」？此操作不可撤销。`)) return;
    await store.deleteProfile(state.profile.id);
    await loadData();
        renderAll();
    setStatus(state.profile ? "已删除档案。" : "已删除档案。当前无档案，可新建或导入。");
  }

  /* ---------- 导入导出 ---------- */
  async function onImport(file) {
    try {
      const buf = await file.arrayBuffer();
      const existingIds = state.data.profiles.map((p) => p.id);
      const result = xw.importWorkbook(buf, existingIds);
      if (!result.ok) {
        setStatus("导入失败（现有数据未改动）：\n" + result.errors.slice(0, 12).join("\n"), true);
        return;
      }
      for (const p of result.data.profiles) {
        state.data.profiles.push(p);
      }
      state.data.siteMappings = state.data.siteMappings || [];
      await store.save(state.data);
      await loadData();
      setStatus(`导入成功：新增 ${result.data.profiles.length} 个档案。`);
    } catch (err) {
      setStatus("导入出错：" + (err && err.message ? err.message : String(err)), true);
    }
  }

  /* ---------- 初始化 ---------- */
  async function loadData() {
    await store.ensureInitialized();
    state.data = await store.load();
    const queryProfileId = new URLSearchParams(location.search).get("profile");
    const wanted = queryProfileId || (state.profile ? state.profile.id : state.data.profiles[0] && state.data.profiles[0].id);
    state.profile = state.data.profiles.find((profile) => profile.id === wanted) || state.data.profiles[0] || null;
  }

  (async () => {
    $("save-btn").addEventListener("click", persist);
    $("new-profile-btn").addEventListener("click", newProfile);
    $("delete-profile-btn").addEventListener("click", deleteProfile);
    $("add-material-btn").addEventListener("click", addMaterial);
    $("material-search").addEventListener("input", (e) => { materialView.query = e.target.value; renderMaterials(); });
    $("material-category-filter").addEventListener("change", (e) => { materialView.category = e.target.value; renderMaterials(); });
    $("add-custom-field-btn").addEventListener("click", addCustomField);
    $("custom-field-search").addEventListener("input", (e) => { customFieldView.query = e.target.value; renderCustomFields(); });
    $("template-btn").addEventListener("click", () => {
      xw.downloadWorkbook(xw.buildTemplateWorkbook(), `简历助手-空白模板-${stamp()}.xlsx`);
    });
    $("export-btn").addEventListener("click", () => {
      if (!state.data.profiles.length) { setStatus("没有可导出的档案。", true); return; }
      xw.downloadWorkbook(xw.exportWorkbook(state.data.profiles), `简历助手-档案备份-${stamp()}.xlsx`);
      setStatus("已导出全部档案。");
    });
    $("import-btn").addEventListener("click", () => $("import-file").click());
    $("import-file").addEventListener("change", (e) => { if (e.target.files && e.target.files[0]) onImport(e.target.files[0]); e.target.value = ""; });
    $("profile-select").addEventListener("change", (e) => selectProfile(e.target.value));

    await loadData();
    renderAll();
    if (!state.profile) setStatus("暂无档案：可新建或导入。");
    else setStatus(`档案：${state.profile.name} · 材料库已就绪（${(state.profile.materials || []).length} 项）。`);
  })();

  function stamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }
})();
