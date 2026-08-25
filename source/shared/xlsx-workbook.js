/* shared/xlsx-workbook.js — 结构化工作簿：模板生成、导出、严格导入。
 * 依赖：manager.html 中先加载 vendor/xlsx.full.min.js（SheetJS，读写能力已验证）。 */
(() => {
  "use strict";
  const RAA = (globalThis.ResumeApplicationAssistant =
    globalThis.ResumeApplicationAssistant || {});
  const S = RAA.schema;

  const SHEETS = {
    Profiles: ["profileId", "name", "needsReview", "createdAt", "updatedAt"],
    Variants: ["variantId", "profileId", "name", "targetRole", "language"],
    VariantSelections: ["variantId", "recordType", "recordId", "sortOrder"],
    Personal: ["fieldId", "profileId", "key", "label", "value", "aliases", "isSensitive", "autoFill"],
    Education: ["id", "profileId", "school", "department", "major", "degree", "startDate", "endDate", "gpa", "ranking"],
    Experiences: ["id", "profileId", "organization", "title", "startDate", "endDate", "description"],
    Projects: ["id", "profileId", "name", "role", "startDate", "endDate", "url", "description", "technologies", "outcomes"],
    Research: ["id", "profileId", "type", "title", "venue", "status", "authorOrder", "date", "description", "url"],
    Awards: ["id", "profileId", "name", "date", "levelOrRole", "description"],
    Activities: ["id", "profileId", "name", "date", "levelOrRole", "description"],
    Skills: ["id", "profileId", "category", "content"],
    Answers: ["id", "profileId", "title", "keywords", "content", "needsReview"],
    Materials: ["id", "profileId", "category", "label", "value", "sensitive", "manualOnly", "tags", "note", "folderPath", "filePath", "source", "systemKey"],
    CustomFields: ["fieldId", "profileId", "key", "label", "value", "aliases", "kind", "options", "isSensitive", "autoFill", "skip"],
    Applications: ["id", "profileId", "companyName", "position", "appliedDate", "applicationUrl", "variantId", "currentStatus", "statusSource", "statusUrl", "statusInfo", "statusUpdatedAt", "nextActionDate", "nextAction", "notes", "createdAt", "updatedAt"],
    ApplicationStatuses: ["id", "applicationId", "date", "status", "source", "url", "info", "notes"],
    ProgressPlan: ["id", "profileId", "stage", "plannedDate", "status", "completedDate", "nextAction", "notes"],
  };


  /* 记录集合 → 工作表名 / 数据列 */
  const RECORD_SHEETS = {
    education: { sheet: "Education", columns: ["school", "department", "major", "degree", "startDate", "endDate", "gpa", "ranking"] },
    experiences: { sheet: "Experiences", columns: ["organization", "title", "startDate", "endDate", "description"] },
    projects: { sheet: "Projects", columns: ["name", "role", "startDate", "endDate", "url", "description", "technologies", "outcomes"] },
    research: { sheet: "Research", columns: ["type", "title", "venue", "status", "authorOrder", "date", "description", "url"] },
    awards: { sheet: "Awards", columns: ["name", "date", "levelOrRole", "description"] },
    activities: { sheet: "Activities", columns: ["name", "date", "levelOrRole", "description"] },
    skills: { sheet: "Skills", columns: ["category", "content"] },
    answers: { sheet: "Answers", columns: ["title", "keywords", "content", "needsReview"] },
  };

  /* VariantSelections.recordType（单数）→ 工作表配置。 */
  const RECORD_TYPE_SPECS = {
    skill: RECORD_SHEETS.skills,
    education: RECORD_SHEETS.education,
    experience: RECORD_SHEETS.experiences,
    project: RECORD_SHEETS.projects,
    research: RECORD_SHEETS.research,
    award: RECORD_SHEETS.awards,
    activity: RECORD_SHEETS.activities,
    answer: RECORD_SHEETS.answers,
  };

  const JSON_FIELDS = new Set(["aliases", "technologies", "keywords", "tags", "options"]);
  const BOOL_FIELDS = new Set(["needsReview", "isSensitive", "autoFill", "skip", "sensitive", "manualOnly"]);
  const OPTIONAL_SHEETS = new Set(["Materials", "CustomFields", "Applications", "ApplicationStatuses", "ProgressPlan"]);

  function newWorkbook() {
    if (!globalThis.XLSX) throw new Error("SheetJS 未加载（xlsx-workbook.js 需在 vendor/xlsx.full.min.js 之后加载）");
    const wb = XLSX.utils.book_new();
    for (const [name, headers] of Object.entries(SHEETS)) {
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
    return wb;
  }

  function jsonCell(value) {
    return JSON.stringify(Array.isArray(value) ? value : []);
  }

  function parseJsonArray(text, rowDesc) {
    const t = String(text == null ? "" : text).trim();
    if (t === "") return [];
    try {
      const v = JSON.parse(t);
      if (!Array.isArray(v)) throw new Error("not array");
      return v.map((x) => String(x));
    } catch (_) {
      return { error: `${rowDesc} 的 JSON 数组非法: ${t}` };
    }
  }

  function parseBool(text, rowDesc) {
    const t = String(text == null ? "" : text).trim().toLowerCase();
    if (t === "" || t === "false" || t === "0") return false;
    if (t === "true" || t === "1") return true;
    return { error: `${rowDesc} 的布尔值非法: ${t}（应为 true/false/1/0/空）` };
  }

  /* 模板：仅表头。 */
  function buildTemplateWorkbook() {
    return newWorkbook();
  }

  /* 导出：所有档案。 */
  function exportWorkbook(profiles) {
    const wb = XLSX.utils.book_new();
    const order = Object.keys(SHEETS);
    const allRows = {};
    for (const name of order) allRows[name] = [SHEETS[name].slice()];

    for (const profile of profiles) {
      allRows.Profiles.push([
        profile.id, profile.name, profile.needsReview ? "true" : "false",
        profile.createdAt || "", profile.updatedAt || "",
      ]);
      const personalAll = [...(profile.personal || []), ...(profile.sensitive || [])];
      for (const f of personalAll) {
        const isSensitive = (profile.sensitive || []).some((x) => x.id === f.id);
        allRows.Personal.push([
          f.id, profile.id, f.key, f.label, f.value,
          jsonCell(f.aliases), isSensitive ? "true" : "false", f.autoFill ? "true" : "false",
        ]);
      }
      for (const material of profile.materials || []) {
        allRows.Materials.push([
          material.id, profile.id, material.category || "", material.label || "", material.value || "",
          material.sensitive ? "true" : "false", material.manualOnly ? "true" : "false",
          jsonCell(material.tags), material.note || "", material.folderPath || "", material.filePath || "",
          material.source || "", material.systemKey || "",
        ]);
      }
      for (const f of profile.customFields || []) {
        allRows.CustomFields.push([
          f.id, profile.id, f.key || "", f.label || "", f.value || "", jsonCell(f.aliases),
          f.kind || "text", jsonCell(f.options), f.isSensitive ? "true" : "false",
          f.autoFill ? "true" : "false", f.skip ? "true" : "false",
        ]);
      }
      for (const app of profile.applications || []) {
        allRows.Applications.push([
          app.id, profile.id, app.companyName || "", app.position || "", app.appliedDate || "",
          app.applicationUrl || "", app.variantId || "", app.currentStatus || "", app.statusSource || "manual",
          app.statusUrl || "", app.statusInfo || "", app.statusUpdatedAt || "", app.nextActionDate || "",
          app.nextAction || "", app.notes || "", app.createdAt || "", app.updatedAt || "",
        ]);
        for (const status of app.statusHistory || []) {
          allRows.ApplicationStatuses.push([
            status.id, app.id, status.date || "", status.status || "", status.source || "manual",
            status.url || "", status.info || "", status.notes || "",
          ]);
        }
      }
      for (const item of profile.progressPlan || []) {
        allRows.ProgressPlan.push([
          item.id, profile.id, item.stage || "", item.plannedDate || "", item.status || "planned",
          item.completedDate || "", item.nextAction || "", item.notes || "",
        ]);
      }
      for (const v of profile.variants || []) {
        allRows.Variants.push([v.id, profile.id, v.name, v.targetRole || "", v.language || "zh"]);
        for (const type of S.RECORD_TYPES) {
          const key = S.RECORD_COLLECTION[type];
          const sel = v[key] || [];
          sel.forEach((rid, i) => {
            allRows.VariantSelections.push([v.id, type, rid, i + 1]);
          });
        }
      }
      for (const [type, spec] of Object.entries(RECORD_SHEETS)) {
        for (const rec of profile[type] || []) {
          const row = [rec.id, profile.id];
          for (const col of spec.columns) {
            row.push(JSON_FIELDS.has(col) ? jsonCell(rec[col]) : rec[col]);
          }
          allRows[spec.sheet].push(row);
        }
      }
    }

    for (const name of order) {
      const ws = XLSX.utils.aoa_to_sheet(allRows[name]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }

    /* 身份证号等长数字列按文本格式导出，防止 Excel 打开时丢失精度 */
    const personalWs = wb.Sheets.Personal;
    const personalHeader = SHEETS.Personal;
    const valueCol = personalHeader.indexOf("value") + 1;
    const keyCol = personalHeader.indexOf("key") + 1;
    if (personalWs) {
      for (const cell of Object.keys(personalWs)) {
        const m = /^([A-Z]+)(\d+)$/.exec(cell);
        if (!m) continue;
        const colIdx = colToIndex(m[1]);
        const rowIdx = parseInt(m[2], 10);
        if (rowIdx <= 1) continue;
        const keyCell = personalWs[`${indexToCol(keyCol)}${rowIdx}`];
        if (colIdx === valueCol && keyCell && keyCell.v === "idCard") {
          personalWs[cell].z = "@";
        }
      }
    }
    return wb;
  }

  function colToIndex(col) {
    let n = 0;
    for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  }
  function indexToCol(n) {
    let s = "";
    while (n > 0) {
      n -= 1;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  function downloadWorkbook(wb, filename) {
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* 严格导入：全部校验通过才返回数据；任何错误都不落盘。 */
  function parseWorkbook(arrayBuffer) {
    const errors = [];
    let wb;
    try {
      wb = XLSX.read(arrayBuffer, { type: "array", raw: false });
    } catch (err) {
      return { ok: false, errors: ["无法解析 XLSX 文件：" + (err && err.message ? err.message : String(err))] };
    }

    const sheetRows = {};
    for (const [name, headers] of Object.entries(SHEETS)) {
      if (!wb.SheetNames.includes(name)) {
        if (OPTIONAL_SHEETS.has(name)) {
          sheetRows[name] = [];
          continue;
        }
        errors.push(`缺少必需工作表: ${name}`);
        continue;
      }
      if (!wb.Sheets[name]) {
        errors.push(`工作表 ${name} 无法读取`);
        continue;
      }
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" });
      const headerRow = (rows[0] || []).map((h) => String(h).trim());
      const missing = headers.filter((h) => !headerRow.includes(h));
      if (missing.length) {
        errors.push(`工作表 ${name} 缺少必需表头: ${missing.join(", ")}`);
        continue;
      }
      const colIndex = {};
      headers.forEach((h) => {
        colIndex[h] = headerRow.indexOf(h);
      });
      const dataRows = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const isEmpty = headers.every((h) => String(row[colIndex[h]] == null ? "" : row[colIndex[h]]).trim() === "");
        if (isEmpty) continue;
        const rec = {};
        for (const h of headers) rec[h] = String(row[colIndex[h]] == null ? "" : row[colIndex[h]]).trim();
        rec.__row = i + 1;
        dataRows.push(rec);
      }
      sheetRows[name] = dataRows;
    }
    if (errors.length) return { ok: false, errors };

    const profileRows = sheetRows.Profiles;
    const profileIds = new Set();
    const profileIdRows = new Map();
    for (const r of profileRows) {
      if (profileIds.has(r.profileId)) errors.push(`Profiles 第 ${r.__row} 行：profileId 重复: ${r.profileId}`);
      profileIds.add(r.profileId);
      profileIdRows.set(r.profileId, r);
    }
    if (profileRows.length === 0) errors.push("Profiles 表没有任何档案行");

    /* 个人字段 */
    const personalRows = sheetRows.Personal;
    const fieldIdSeen = new Set();
    for (const r of personalRows) {
      if (!profileIds.has(r.profileId)) errors.push(`Personal 第 ${r.__row} 行：引用了不存在的档案 ${r.profileId}`);
      if (fieldIdSeen.has(r.fieldId)) errors.push(`Personal 第 ${r.__row} 行：fieldId 重复: ${r.fieldId}`);
      fieldIdSeen.add(r.fieldId);
      if (!r.key) errors.push(`Personal 第 ${r.__row} 行：缺少 key`);
      const aliases = parseJsonArray(r.aliases, `Personal 第 ${r.__row} 行`);
      if (aliases && aliases.error) errors.push(aliases.error);
    }

    /* 材料库（可选工作表，兼容旧版本导出的工作簿） */
    const materialIdSeen = new Set();
    for (const r of sheetRows.Materials || []) {
      if (!profileIds.has(r.profileId)) errors.push(`Materials 第 ${r.__row} 行：引用了不存在的档案 ${r.profileId}`);
      if (!r.id) errors.push(`Materials 第 ${r.__row} 行：缺少 id`);
      if (materialIdSeen.has(r.id)) errors.push(`Materials 第 ${r.__row} 行：id 重复: ${r.id}`);
      materialIdSeen.add(r.id);
      if (!r.category) errors.push(`Materials 第 ${r.__row} 行：缺少分类`);
      if (!r.label) errors.push(`Materials 第 ${r.__row} 行：缺少名称`);
      for (const field of ["sensitive", "manualOnly"]) {
        const parsed = parseBool(r[field], `Materials 第 ${r.__row} 行`);
        if (parsed && parsed.error) errors.push(parsed.error);
      }
      const tags = parseJsonArray(r.tags, `Materials 第 ${r.__row} 行`);
      if (tags && tags.error) errors.push(tags.error);
    }
    const customFieldIds = new Set();
    const customKeysByProfile = new Map();
    for (const r of sheetRows.CustomFields || []) {
      if (!profileIds.has(r.profileId)) errors.push(`CustomFields 第 ${r.__row} 行：引用了不存在的档案 ${r.profileId}`);
      if (!r.fieldId) errors.push(`CustomFields 第 ${r.__row} 行：缺少 fieldId`);
      if (customFieldIds.has(r.fieldId)) errors.push(`CustomFields 第 ${r.__row} 行：fieldId 重复: ${r.fieldId}`);
      customFieldIds.add(r.fieldId);
      if (!r.key) errors.push(`CustomFields 第 ${r.__row} 行：缺少 key`);
      const keySet = customKeysByProfile.get(r.profileId) || new Set();
      if (keySet.has(r.key)) errors.push(`CustomFields 第 ${r.__row} 行：key 重复: ${r.key}`);
      keySet.add(r.key); customKeysByProfile.set(r.profileId, keySet);
      if (r.kind && !S.FIELD_KINDS.includes(r.kind)) errors.push(`CustomFields 第 ${r.__row} 行：kind 非法: ${r.kind}`);
      for (const field of ["aliases", "options"]) { const parsed = parseJsonArray(r[field], `CustomFields 第 ${r.__row} 行`); if (parsed && parsed.error) errors.push(parsed.error); }
      for (const field of ["isSensitive", "autoFill", "skip"]) { const parsed = parseBool(r[field], `CustomFields 第 ${r.__row} 行`); if (parsed && parsed.error) errors.push(parsed.error); }
    }
    for (const r of sheetRows.CustomFields || []) {
      if (personalRows.some((field) => field.profileId === r.profileId && field.key === r.key)) {
        errors.push(`CustomFields 第 ${r.__row} 行：key 与 Personal 字段重复: ${r.key}`);
      }
    }
    const applicationIds = new Set();
    for (const r of sheetRows.Applications || []) {
      if (!profileIds.has(r.profileId)) errors.push(`Applications 第 ${r.__row} 行：引用了不存在的档案 ${r.profileId}`);
      if (!r.id) errors.push(`Applications 第 ${r.__row} 行：缺少 id`);
      if (applicationIds.has(r.id)) errors.push(`Applications 第 ${r.__row} 行：id 重复: ${r.id}`);
      applicationIds.add(r.id);
      for (const field of ["appliedDate", "statusUpdatedAt", "nextActionDate"]) if (r[field] && !S.isValidIsoDate(r[field].slice(0, 10))) errors.push(`Applications 第 ${r.__row} 行：${field} 非法: ${r[field]}`);
      if (r.statusSource && !S.STATUS_SOURCES.includes(r.statusSource)) errors.push(`Applications 第 ${r.__row} 行：statusSource 非法: ${r.statusSource}`);
    }
    const applicationStatusIds = new Set();
    for (const r of sheetRows.ApplicationStatuses || []) {
      if (!applicationIds.has(r.applicationId)) errors.push(`ApplicationStatuses 第 ${r.__row} 行：引用了不存在的投递记录 ${r.applicationId}`);
      if (!r.id) errors.push(`ApplicationStatuses 第 ${r.__row} 行：缺少 id`);
      if (applicationStatusIds.has(r.id)) errors.push(`ApplicationStatuses 第 ${r.__row} 行：id 重复: ${r.id}`);
      applicationStatusIds.add(r.id);
      if (r.date && !S.isValidIsoDate(r.date)) errors.push(`ApplicationStatuses 第 ${r.__row} 行：date 非法: ${r.date}`);
      if (r.source && !S.STATUS_SOURCES.includes(r.source)) errors.push(`ApplicationStatuses 第 ${r.__row} 行：source 非法: ${r.source}`);
    }
    const progressIds = new Set();
    for (const r of sheetRows.ProgressPlan || []) {
      if (!profileIds.has(r.profileId)) errors.push(`ProgressPlan 第 ${r.__row} 行：引用了不存在的档案 ${r.profileId}`);
      if (!r.id) errors.push(`ProgressPlan 第 ${r.__row} 行：缺少 id`);
      if (progressIds.has(r.id)) errors.push(`ProgressPlan 第 ${r.__row} 行：id 重复: ${r.id}`);
      progressIds.add(r.id);
      for (const field of ["plannedDate", "completedDate"]) if (r[field] && !S.isValidIsoDate(r[field])) errors.push(`ProgressPlan 第 ${r.__row} 行：${field} 非法: ${r[field]}`);
      if (r.status && !S.PROGRESS_STATUSES.includes(r.status)) errors.push(`ProgressPlan 第 ${r.__row} 行：status 非法: ${r.status}`);
    }
    const recordIdsBySheet = {};
    const allRecordIds = new Set();
    for (const [type, spec] of Object.entries(RECORD_SHEETS)) {
      const rows = sheetRows[spec.sheet];
      recordIdsBySheet[spec.sheet] = new Set();
      const seen = new Set();
      for (const r of rows) {
        if (seen.has(r.id)) errors.push(`${spec.sheet} 第 ${r.__row} 行：记录 id 重复: ${r.id}`);
        seen.add(r.id);
        if (r.id && allRecordIds.has(r.id)) {
          errors.push(`${spec.sheet} 第 ${r.__row} 行：记录 id 与其他工作表重复: ${r.id}`);
        }
        if (r.id) allRecordIds.add(r.id);
        recordIdsBySheet[spec.sheet].add(r.id);
        if (!profileIds.has(r.profileId)) errors.push(`${spec.sheet} 第 ${r.__row} 行：引用了不存在的档案 ${r.profileId}`);
        for (const col of spec.columns) {
          if (JSON_FIELDS.has(col)) {
            const v = parseJsonArray(r[col], `${spec.sheet} 第 ${r.__row} 行`);
            if (v && v.error) errors.push(v.error);
          } else if (BOOL_FIELDS.has(col)) {
            const v = parseBool(r[col], `${spec.sheet} 第 ${r.__row} 行`);
            if (v && v.error) errors.push(v.error);
          } else if (col === "startDate" || col === "endDate" || col === "date") {
            if (!S.isValidIsoDate(r[col])) errors.push(`${spec.sheet} 第 ${r.__row} 行：${col} 非法（需要 YYYY-MM-DD 或空）: ${r[col]}`);
          }
        }
      }
    }

    /* 版本与选择 */
    const variantRows = sheetRows.Variants;
    const variantIds = new Set();
    const variantById = new Map();
    for (const r of variantRows) {
      if (variantIds.has(r.variantId)) errors.push(`Variants 第 ${r.__row} 行：variantId 重复: ${r.variantId}`);
      variantIds.add(r.variantId);
      variantById.set(r.variantId, r);
      if (!profileIds.has(r.profileId)) errors.push(`Variants 第 ${r.__row} 行：引用了不存在的档案 ${r.profileId}`);
      if (!r.name) errors.push(`Variants 第 ${r.__row} 行：缺少名称`);
    }
    for (const r of sheetRows.Applications || []) {
      if (!r.variantId) continue;
      const variant = variantById.get(r.variantId);
      if (!variant) errors.push(`Applications 第 ${r.__row} 行：引用了不存在的版本 ${r.variantId}`);
      else if (variant.profileId !== r.profileId) errors.push(`Applications 第 ${r.__row} 行：版本 ${r.variantId} 不属于同一档案`);
    }

    const selRows = sheetRows.VariantSelections;
    const sortSeen = new Set();
    for (const r of selRows) {
      if (!variantIds.has(r.variantId)) errors.push(`VariantSelections 第 ${r.__row} 行：引用了不存在的版本 ${r.variantId}`);
      if (!S.RECORD_TYPES.includes(r.recordType)) {
        errors.push(`VariantSelections 第 ${r.__row} 行：recordType 非法: ${r.recordType}`);
        continue;
      }
      const spec = RECORD_TYPE_SPECS[r.recordType];
      const sheetName = spec.sheet;
      if (!recordIdsBySheet[sheetName].has(r.recordId)) {
        errors.push(`VariantSelections 第 ${r.__row} 行：${r.recordType} 记录不存在: ${r.recordId}`);
      }
      const sortNum = parseInt(r.sortOrder, 10);
      if (!Number.isInteger(sortNum) || sortNum < 1) {
        errors.push(`VariantSelections 第 ${r.__row} 行：sortOrder 需要正整数: ${r.sortOrder}`);
      } else {
        const key = `${r.variantId}|${r.recordType}|${sortNum}`;
        if (sortSeen.has(key)) errors.push(`VariantSelections 第 ${r.__row} 行：sortOrder 重复（${r.variantId}/${r.recordType}/${r.sortOrder}）`);
        sortSeen.add(key);
      }
      /* 记录必须属于同一档案 */
      const variant = variantById.get(r.variantId);
      if (variant) {
        const recRow = sheetRows[sheetName].find((x) => x.id === r.recordId);
        if (recRow && recRow.profileId !== variant.profileId) {
          errors.push(`VariantSelections 第 ${r.__row} 行：记录 ${r.recordId} 与版本 ${r.variantId} 不属于同一档案`);
        }
      }
    }
    /* 与现有存储的档案 ID 冲突检查 */
    /* 由调用方（manager）负责：传 existingProfileIds 进来 */
    return errors.length ? { ok: false, errors } : { ok: true, sheetRows, profileRows, personalRows, variantRows, selRows, recordIdsBySheet };
  }

  /* 把校验通过的 sheetRows 组装成完整 data（不落盘）。 */
  function buildDataFromSheets(parsed) {
    const { profileRows, personalRows, variantRows, selRows } = parsed;
    const recordsByProfile = {};
    for (const [type, spec] of Object.entries(RECORD_SHEETS)) {
      for (const r of parsed.sheetRows[spec.sheet]) {
        const rec = { id: r.id, profileId: r.profileId };
        for (const col of spec.columns) {
          if (JSON_FIELDS.has(col)) {
            const v = parseJsonArray(r[col], `${spec.sheet} ${r.__row}`);
            rec[col] = Array.isArray(v) ? v : [];
          } else if (BOOL_FIELDS.has(col)) {
            rec[col] = parseBool(r[col], `${spec.sheet} ${r.__row}`) === true;
          } else {
            rec[col] = r[col];
          }
        }
        (recordsByProfile[r.profileId] = recordsByProfile[r.profileId] || {})[type] =
          recordsByProfile[r.profileId][type] || [];
        recordsByProfile[r.profileId][type].push(rec);
      }
    }
    const materialsByProfile = {};
    for (const r of parsed.sheetRows.Materials || []) {
      const tags = parseJsonArray(r.tags, `Materials ${r.__row}`);
      const material = {
        id: r.id, profileId: r.profileId, category: r.category, label: r.label, value: r.value,
        sensitive: parseBool(r.sensitive, `Materials ${r.__row}`) === true,
        manualOnly: parseBool(r.manualOnly, `Materials ${r.__row}`) === true,
        tags: Array.isArray(tags) ? tags : [], note: r.note, folderPath: r.folderPath,
        filePath: r.filePath, source: r.source || "import", systemKey: r.systemKey || "",
        updatedAt: new Date().toISOString(),
      };
      (materialsByProfile[r.profileId] = materialsByProfile[r.profileId] || []).push(material);
    }

    const customFieldsByProfile = {};
    for (const r of parsed.sheetRows.CustomFields || []) {
      const aliases = parseJsonArray(r.aliases, `CustomFields ${r.__row}`);
      const options = parseJsonArray(r.options, `CustomFields ${r.__row}`);
      const field = { id: r.fieldId, key: r.key, label: r.label, value: r.value, aliases: Array.isArray(aliases) ? aliases : [], kind: r.kind || "text", options: Array.isArray(options) ? options : [], isSensitive: parseBool(r.isSensitive, `CustomFields ${r.__row}`) === true, autoFill: parseBool(r.autoFill, `CustomFields ${r.__row}`) === true, skip: parseBool(r.skip, `CustomFields ${r.__row}`) === true, custom: true };
      (customFieldsByProfile[r.profileId] = customFieldsByProfile[r.profileId] || []).push(field);
    }
    const statusByApplication = {};
    for (const r of parsed.sheetRows.ApplicationStatuses || []) {
      (statusByApplication[r.applicationId] = statusByApplication[r.applicationId] || []).push({ id: r.id, applicationId: r.applicationId, date: r.date, status: r.status, source: r.source || "manual", url: r.url, info: r.info, notes: r.notes });
    }
    const applicationsByProfile = {};
    for (const r of parsed.sheetRows.Applications || []) {
      const app = { id: r.id, profileId: r.profileId, companyName: r.companyName, position: r.position, appliedDate: r.appliedDate, applicationUrl: r.applicationUrl, variantId: r.variantId, currentStatus: r.currentStatus, statusSource: r.statusSource || "manual", statusUrl: r.statusUrl, statusInfo: r.statusInfo, statusUpdatedAt: r.statusUpdatedAt, nextActionDate: r.nextActionDate, nextAction: r.nextAction, notes: r.notes, createdAt: r.createdAt, updatedAt: r.updatedAt, statusHistory: statusByApplication[r.id] || [] };
      (applicationsByProfile[r.profileId] = applicationsByProfile[r.profileId] || []).push(app);
    }
    const progressByProfile = {};
    for (const r of parsed.sheetRows.ProgressPlan || []) {
      const item = { id: r.id, profileId: r.profileId, stage: r.stage, plannedDate: r.plannedDate, status: r.status || "planned", completedDate: r.completedDate, nextAction: r.nextAction, notes: r.notes };
      (progressByProfile[r.profileId] = progressByProfile[r.profileId] || []).push(item);
    }
    const variantsByProfile = {};
    for (const r of variantRows) {
      variantsByProfile[r.profileId] = variantsByProfile[r.profileId] || [];
      variantsByProfile[r.profileId].push(r);
    }
    const selByVariant = {};
    for (const r of selRows) {
      selByVariant[r.variantId] = selByVariant[r.variantId] || [];
      selByVariant[r.variantId].push(r);
    }

    const profiles = [];
    for (const pr of profileRows) {
      const personal = [];
      const sensitive = [];
      const materials = materialsByProfile[pr.profileId] || [];
      for (const r of personalRows.filter((x) => x.profileId === pr.profileId)) {
        const aliases = parseJsonArray(r.aliases, "Personal");
        const f = {
          id: r.fieldId,
          key: r.key,
          label: r.label,
          value: r.value,
          aliases: Array.isArray(aliases) ? aliases : [],
          autoFill: parseBool(r.autoFill, "Personal") === true,
          skip: false,
        };
        if (parseBool(r.isSensitive, "Personal") === true) sensitive.push(f);
        else personal.push(f);
      }
      const variants = (variantsByProfile[pr.profileId] || []).map((vr) => {
        const v = {
          id: vr.variantId,
          profileId: vr.profileId,
          name: vr.name,
          targetRole: vr.targetRole,
          language: vr.language || "zh",
          skills: [], education: [], experiences: [], projects: [],
          research: [], awards: [], activities: [], answers: [],
        };
        const sels = (selByVariant[vr.variantId] || []).slice().sort((a, b) => parseInt(a.sortOrder, 10) - parseInt(b.sortOrder, 10));
        for (const s of sels) {
          const key = S.RECORD_COLLECTION[s.recordType];
          v[key].push(s.recordId);
        }
        return v;
      });
      const profile = {
        id: pr.profileId,
        name: pr.name,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        needsReview: parseBool(pr.needsReview, "Profiles") === true,
        reviewItems: [],
        personal,
        sensitive,
        customFields: customFieldsByProfile[pr.profileId] || [],
        applications: applicationsByProfile[pr.profileId] || [],
        progressPlan: progressByProfile[pr.profileId] || [],
        variants,
        skills: [], education: [], experiences: [], projects: [],
        research: [], awards: [], activities: [], answers: [],
        materials,
        materialSchemaVersion: materials.length ? 2 : 0,
      };
      for (const [type, list] of Object.entries(recordsByProfile[pr.profileId] || {})) {
        profile[type] = list;
      }
      profiles.push(profile);
    }
    return { schemaVersion: S.SCHEMA_VERSION, profiles, siteMappings: [] };
  }

  /* 导入入口：检查与现有档案的 ID 冲突后返回新数据。 */
  function importWorkbook(arrayBuffer, existingProfileIds) {
    const parsed = parseWorkbook(arrayBuffer);
    if (!parsed.ok) return parsed;
    const conflicts = parsed.profileRows
      .map((r) => r.profileId)
      .filter((id) => existingProfileIds.includes(id));
    if (conflicts.length) {
      return {
        ok: false,
        errors: [`导入失败：以下档案 ID 与现有档案冲突（不会覆盖）: ${conflicts.join(", ")}`],
      };
    }
    return { ok: true, data: buildDataFromSheets(parsed) };
  }

  RAA.xlsxWorkbook = {
    SHEETS,
    buildTemplateWorkbook,
    exportWorkbook,
    downloadWorkbook,
    parseWorkbook,
    buildDataFromSheets,
    importWorkbook,
  };
})();
