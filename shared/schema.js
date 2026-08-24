/* shared/schema.js — 数据模型、校验、文本归一化、常量。
 * 无依赖 IIFE，暴露 globalThis.ResumeApplicationAssistant。 */
(() => {
  "use strict";
  const RAA = (globalThis.ResumeApplicationAssistant =
    globalThis.ResumeApplicationAssistant || {});

  const SCHEMA_VERSION = 2;
  const STORAGE_KEY = "resumeAssistantData";
  const UI_SESSION_KEY = "resumeAssistantSelection";

  const RECORD_TYPES = [
    "skill",
    "education",
    "experience",
    "project",
    "research",
    "award",
    "activity",
    "answer",
  ];

  /* recordType（单数，VariantSelections 用）→ 档案集合字段名（复数）。 */
  const RECORD_COLLECTION = {
    skill: "skills",
    education: "education",
    experience: "experiences",
    project: "projects",
    research: "research",
    award: "awards",
    activity: "activities",
    answer: "answers",
  };
  const FIELD_KINDS = ["text", "date", "select", "richText"];
  const STATUS_SOURCES = ["current-url", "manual"];
  const PROGRESS_STATUSES = ["planned", "in-progress", "done", "blocked"];

  /* 首次扫描前必须补齐或标记“不使用”的联系字段（种子档案中留空）。 */
  const GATE_KEYS = ["phone", "github"];

  /* 禁止生成候选的控件：密码/验证码/支付/银行卡/同意/协议/提交等。 */
  const PROHIBITED_PATTERNS = [
    "password", "passwd", "pwd", "captcha", "verificationcode", "verifycode",
    "验证码", "短信验证码", "图形验证", "校验码",
    "支付", "付款", "交易密码", "银行卡", "卡号", "卡密", "安全码", "cvv", "cvc",
    "同意", "协议", "条款", "声明", "授权", "承诺", "确认勾选",
    "submit", "提交", "登录", "注册密码",
  ];

  /* 重复分组中可点击的“新增”按钮文案。 */
  const ADD_LABEL_RE = /新增|添加|增加|\badd\b/i;

  /* 分组类型别名：用于把重复控件组分类为教育/工作/项目。 */
  const GROUP_ALIASES = {
    education: ["教育背景", "教育经历", "学习经历", "学历经历", "教育"],
    experience: ["实习经历", "工作经历", "实习经验", "工作经验", "社会实践", "工作", "实习"],
    project: ["项目经历", "项目经验", "项目实践", "项目"],
  };

  function createId(prefix) {
    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  /* 归一化：小写、去空白与常见标点、全角转半角。用于标签/别名/选项比较。 */
  function normalize(text) {
    if (text == null) return "";
    return String(text)
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0)
      )
      .replace(/[\s\u3000]+/g, "")
      .replace(/[：:，,。．.（）()【】\[\]《》〈〉<>、/\\|·—–‐-]+/g, "")
      .toLowerCase();
  }

  /* 日期的月份级比较：写入值与渲染值在“年+月”上一致即通过（容忍 2024-09 与 2024年9月）。 */
  function normalizedDateMatch(written, rendered) {
    const digits = (s) => String(s == null ? "" : s).replace(/\D/g, "");
    const w = digits(written);
    const r = digits(rendered);
    if (w.length < 6 || r.length < 6) return false;
    const wYear = w.slice(0, 4);
    const rYear = r.slice(0, 4);
    if (wYear !== rYear) return false;
    const wMonth = parseInt(w.slice(4, 6), 10);
    const rMonth = parseInt(r.slice(4, 6), 10);
    return wMonth === rMonth;
  }

  /* ISO 日期校验：YYYY-MM-DD 或空字符串。 */
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function isValidIsoDate(value) {
    if (value == null || value === "") return true;
    if (!ISO_DATE_RE.test(value)) return false;
    const d = new Date(value + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }

  function newPersonalField(key, label, value, aliases, autoFill, extra) {
    return Object.assign(
      { id: createId("pf"), key, label, value: value == null ? "" : String(value), aliases: aliases || [], autoFill: !!autoFill, skip: false },
      extra || {}
    );
  }

  function newEducation(profileId, school, department, major, degree, startDate, endDate, gpa, ranking) {
    return { id: createId("ed"), profileId, school, department, major, degree, startDate, endDate, gpa, ranking };
  }
  function newExperience(profileId, organization, title, startDate, endDate, description) {
    return { id: createId("ex"), profileId, organization, title, startDate, endDate, description };
  }
  function newProject(profileId, name, role, startDate, endDate, url, description, technologies, outcomes) {
    return { id: createId("pr"), profileId, name, role, startDate, endDate, url, description, technologies: technologies || [], outcomes };
  }
  function newResearch(profileId, type, title, venue, status, authorOrder, date, description, url) {
    return { id: createId("rs"), profileId, type, title, venue, status, authorOrder, date, description, url };
  }
  function newAward(profileId, name, date, levelOrRole, description) {
    return { id: createId("aw"), profileId, name, date, levelOrRole, description };
  }
  function newActivity(profileId, name, date, levelOrRole, description) {
    return { id: createId("ac"), profileId, name, date, levelOrRole, description };
  }
  function newSkill(profileId, category, content) {
    return { id: createId("sk"), profileId, category, content };
  }
  function newAnswer(profileId, title, keywords, content, needsReview) {
    return { id: createId("an"), profileId, title, keywords: keywords || [], content, needsReview: !!needsReview };
  }
  function newApplication(profileId, initial) {
    const now = new Date().toISOString();
    return Object.assign({
      id: createId("app"), profileId, companyName: "", position: "", appliedDate: "",
      applicationUrl: "", variantId: "", currentStatus: "已投递", statusSource: "manual",
      statusUrl: "", statusInfo: "", statusUpdatedAt: "", nextActionDate: "",
      nextAction: "", notes: "", statusHistory: [], createdAt: now, updatedAt: now,
    }, initial || {});
  }

  function newApplicationStatus(applicationId, initial) {
    return Object.assign({
      id: createId("st"), applicationId, date: new Date().toISOString().slice(0, 10),
      status: "", source: "manual", url: "", info: "", notes: "",
    }, initial || {});
  }

  function newProgressItem(profileId, stage, initial) {
    return Object.assign({
      id: createId("plan"), profileId, stage: stage || "", plannedDate: "",
      status: "planned", completedDate: "", nextAction: "", notes: "",
    }, initial || {});
  }

  function newVariant(profileId, id, name, targetRole, language) {
    const empty = () => [];
    return {
      id,
      profileId,
      name,
      targetRole: targetRole || "",
      language: language || "zh",
      skills: empty(), education: empty(), experiences: empty(),
      research: empty(), awards: empty(), activities: empty(), answers: empty(),
      projects: empty(),
    };
  }

  /* 档案内可被侧栏“填入当前焦点”使用的叶子值。 */
  function profileLeafValues(profile) {
    const out = [];
    for (const f of [...(profile.personal || []), ...(profile.sensitive || []), ...(profile.customFields || [])]) {
      if (f.value && String(f.value).trim() !== "" && f.autoFill && !f.skip) {
        out.push({ key: `${f.custom ? "custom" : (profile.sensitive || []).includes(f) ? "sensitive" : "personal"}.${f.key}`, label: f.label, value: f.value, kind: f.kind || "text", needsReview: false, sensitive: (profile.sensitive || []).includes(f) || !!f.isSensitive });
      }
    }
    for (const a of profile.answers || []) {
      if (a.content && a.content.trim() !== "") {
        out.push({ key: "answer." + a.id, label: a.title || "开放问题", value: a.content, kind: "richText", needsReview: !!a.needsReview });
      }
    }
    return out;
  }

  /* 扫描门禁：GATE_KEYS 对应的字段必须非空或标记 skip。 */
  function canScan(profile) {
    if (!profile) return { ok: false, missing: GATE_KEYS.slice() };
    const all = [...(profile.personal || []), ...(profile.sensitive || [])];
    const missing = GATE_KEYS.filter((key) => {
      const f = all.find((x) => x.key === key);
      return !f || (!f.skip && !(f.value && f.value.trim() !== ""));
    });
    return { ok: missing.length === 0, missing };
  }

  function validateProfile(profile) {
    const errors = [];
    if (!profile || typeof profile.id !== "string" || !profile.id) {
      errors.push("档案缺少 id");
      return { ok: false, errors };
    }
    if (!profile.name || !profile.name.trim()) errors.push("档案缺少名称");
    if (!Array.isArray(profile.variants) || profile.variants.length === 0) {
      errors.push("档案至少需要一个投递版本");
    }
    const keySeen = new Set();
    validateFieldList(profile.personal, "个人", keySeen, errors);
    validateFieldList(profile.sensitive, "敏感", keySeen, errors);
    validateFieldList(profile.customFields, "自定义", keySeen, errors);
    for (const type of RECORD_TYPES) {
      const list = profile[type + (type === "skill" ? "s" : "")] || [];
      /* skills/experiences/... 复数命名映射 */
    }
    const recordLists = {
      skills: profile.skills, education: profile.education, experiences: profile.experiences,
      projects: profile.projects, research: profile.research, awards: profile.awards,
      activities: profile.activities, answers: profile.answers,
    };
    for (const [type, list] of Object.entries(recordLists)) {
      if (!Array.isArray(list)) continue;
      const seen = new Set();
      for (const r of list) {
        if (!r || typeof r.id !== "string" || !r.id) errors.push(`${type} 记录缺少 id`);
        if (r.profileId !== profile.id) errors.push(`${type} 记录 ${r.id} 的 profileId 不匹配`);
        if (seen.has(r.id)) errors.push(`${type} 记录 id 重复: ${r.id}`);
        seen.add(r.id);
        for (const d of ["startDate", "endDate", "date"]) {
          if (r[d] !== undefined && !isValidIsoDate(r[d])) {
            errors.push(`${type} 记录 ${r.id} 的 ${d} 非法（需要 YYYY-MM-DD 或空）: ${r[d]}`);
          }
        }
      }
    }
    for (const v of profile.variants || []) {
      if (!v.id || !v.name) errors.push("投递版本缺少 id 或名称");
      const vSeen = new Set();
      if (vSeen.has(v.id)) errors.push(`投递版本 id 重复: ${v.id}`);
      vSeen.add(v.id);
      for (const type of Object.keys(recordLists)) {
        const list = recordLists[type] || [];
        const ids = new Set(list.map((r) => r.id));
        const sel = v[type];
        if (Array.isArray(sel)) {
          for (const rid of sel) {
            if (!ids.has(rid)) errors.push(`版本 ${v.id} 引用了不存在的 ${type} 记录: ${rid}`);
          }
        }
      }
    }
    validateApplicationRecords(profile, errors);
    validateProgressPlan(profile, errors);
    return { ok: errors.length === 0, errors };
  }
  function validateFieldList(fields, name, keySeen, errors) {
    if (!Array.isArray(fields)) return;
    const ids = new Set();
    for (const f of fields) {
      if (!f || typeof f.id !== "string" || !f.id) errors.push(`${name} 字段缺少 id`);
      if (!f || !f.key || !String(f.key).trim()) errors.push(`${name} 字段缺少 key`);
      if (f && keySeen.has(f.key)) errors.push(`字段重复 key: ${f.key}`);
      if (f) keySeen.add(f.key);
      if (f && ids.has(f.id)) errors.push(`${name} 字段 id 重复: ${f.id}`);
      if (f) ids.add(f.id);
      if (f && f.kind && !FIELD_KINDS.includes(f.kind)) errors.push(`${name} 字段 ${f.key} 的类型非法: ${f.kind}`);
    }
  }

  function validateApplicationRecords(profile, errors) {
    const apps = Array.isArray(profile.applications) ? profile.applications : [];
    const appIds = new Set();
    const statusIds = new Set();
    const variantIds = new Set((profile.variants || []).map((v) => v.id));
    for (const app of apps) {
      if (!app || !app.id) { errors.push("投递记录缺少 id"); continue; }
      if (appIds.has(app.id)) errors.push(`投递记录 id 重复: ${app.id}`);
      appIds.add(app.id);
      if (app.profileId !== profile.id) errors.push(`投递记录 ${app.id} 的 profileId 不匹配`);
      for (const d of ["appliedDate", "nextActionDate", "statusUpdatedAt"]) {
        if (app[d] && !isValidIsoDate(String(app[d]).slice(0, 10))) errors.push(`投递记录 ${app.id} 的 ${d} 非法: ${app[d]}`);
      }
      if (app.variantId && !variantIds.has(app.variantId)) errors.push(`投递记录 ${app.id} 引用了不存在的版本: ${app.variantId}`);
      if (app.statusSource && !STATUS_SOURCES.includes(app.statusSource)) errors.push(`投递记录 ${app.id} 的状态来源非法: ${app.statusSource}`);
      for (const status of Array.isArray(app.statusHistory) ? app.statusHistory : []) {
        if (!status || !status.id) { errors.push(`投递记录 ${app.id} 的状态缺少 id`); continue; }
        if (statusIds.has(status.id)) errors.push(`状态记录 id 重复: ${status.id}`);
        statusIds.add(status.id);
        if (status.applicationId !== app.id) errors.push(`状态记录 ${status.id} 的 applicationId 不匹配`);
        if (status.date && !isValidIsoDate(status.date)) errors.push(`状态记录 ${status.id} 的日期非法: ${status.date}`);
        if (status.source && !STATUS_SOURCES.includes(status.source)) errors.push(`状态记录 ${status.id} 的来源非法: ${status.source}`);
      }
    }
  }

  function validateProgressPlan(profile, errors) {
    const seen = new Set();
    for (const item of Array.isArray(profile.progressPlan) ? profile.progressPlan : []) {
      if (!item || !item.id) { errors.push("求职计划记录缺少 id"); continue; }
      if (seen.has(item.id)) errors.push(`求职计划 id 重复: ${item.id}`);
      seen.add(item.id);
      if (item.profileId !== profile.id) errors.push(`求职计划 ${item.id} 的 profileId 不匹配`);
      for (const d of ["plannedDate", "completedDate"]) if (item[d] && !isValidIsoDate(item[d])) errors.push(`求职计划 ${item.id} 的日期非法: ${item[d]}`);
      if (item.status && !PROGRESS_STATUSES.includes(item.status)) errors.push(`求职计划 ${item.id} 的状态非法: ${item.status}`);
    }
  }

  RAA.schema = {
    SCHEMA_VERSION,
    STORAGE_KEY,
    RECORD_TYPES,
    RECORD_COLLECTION,
    FIELD_KINDS,
    STATUS_SOURCES,
    PROGRESS_STATUSES,
    GATE_KEYS,
    PROHIBITED_PATTERNS,
    ADD_LABEL_RE,
    GROUP_ALIASES,
    createId,
    normalize,
    normalizedDateMatch,
    isValidIsoDate,
    newPersonalField,
    newEducation,
    newExperience,
    newProject,
    newResearch,
    newAward,
    newActivity,
    newSkill,
    newAnswer,
    newApplication,
    newApplicationStatus,
    newProgressItem,
    newVariant,
    profileLeafValues,
    canScan,
    validateProfile,
  };
})();
