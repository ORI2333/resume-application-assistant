/* shared/material-library.js — 本地可复制材料库。值只保存在 chrome.storage.local，不接触网页表单。 */
(() => {
  "use strict";
  const RAA = (globalThis.ResumeApplicationAssistant = globalThis.ResumeApplicationAssistant || {});
  const S = RAA.schema;

  const CATEGORIES = [
    "基本信息", "联系方式", "求职意向", "教育经历", "工作经历", "项目经历",
    "专业技能", "科研论文", "奖励荣誉", "校园经历", "开放问题", "家庭情况",
    "声明与其他", "附件", "自定义",
  ];
  const MATERIAL_SCHEMA_VERSION = 3;

  const APPLICATION_FIELDS = [
    ["基本信息", "姓名拼音", "", false],
    ["基本信息", "姓名（英文）", "", false],
    ["基本信息", "出生日期", "", false],
    ["基本信息", "性别", "", false],
    ["基本信息", "国家/地区", "", false],
    ["基本信息", "证件类型", "", true],
    ["基本信息", "证件号码", "", true],
    ["基本信息", "民族", "", false],
    ["基本信息", "籍贯", "", false],
    ["基本信息", "政治面貌", "", false],
    ["联系方式", "手机号", "", true],
    ["联系方式", "邮箱", "", false],
    ["联系方式", "QQ", "", true],
    ["联系方式", "微信号", "", true],
    ["联系方式", "紧急联系人姓名", "", true],
    ["联系方式", "紧急联系人电话", "", true],
    ["联系方式", "现居住地址", "", true],
    ["联系方式", "邮寄地址", "", true],
    ["求职意向", "期望月薪", "", false],
    ["求职意向", "期望年薪", "", false],
    ["求职意向", "意向工作地", "", false],
    ["求职意向", "是否接受海外工作", "", false],
    ["求职意向", "招聘信息来源", "", false],
    ["求职意向", "资格证书", "", false],
    ["求职意向", "英语等级", "", false],
    ["求职意向", "英语等级成绩", "", false],
    ["求职意向", "爱好特长", "", false],
    ["教育经历", "学校所在地", "", false],
    ["教育经历", "专业排名", "", false],
    ["教育经历", "毕业专业名称", "", false],
    ["教育经历", "学习形式", "", false],
    ["教育经历", "研究方向", "", false],
    ["教育经历", "毕业时间", "", false],
    ["教育经历", "是否取得学位证", "", false],
    ["教育经历", "实验室", "", false],
    ["教育经历", "期刊或论文名称", "", false],
    ["教育经历", "学号", "", true],
    ["教育经历", "院系名称", "", false],
    ["教育经历", "学历", "", false],
    ["教育经历", "学位", "", false],
    ["教育经历", "学制", "", false],
    ["教育经历", "是否取得毕业证", "", false],
    ["科研论文", "论文发表等级", "", false],
    ["科研论文", "导师", "", false],
    ["奖励荣誉", "奖项名称", "", false],
    ["奖励荣誉", "获奖时间", "", false],
    ["奖励荣誉", "奖项描述", "", false],
    ["奖励荣誉", "竞赛名称", "", false],
    ["奖励荣誉", "竞赛时间", "", false],
    ["奖励荣誉", "所获名次", "", false],
    ["奖励荣誉", "竞赛描述", "", false],
    ["专业技能", "技能类别", "", false],
    ["专业技能", "技能名称", "", false],
    ["专业技能", "熟练程度", "", false],
    ["专业技能", "语言类别", "", false],
    ["家庭情况", "姓名", "", true, true],
    ["家庭情况", "与本人关系", "", true, true],
    ["家庭情况", "年龄", "", true, true],
    ["家庭情况", "工作单位", "", true, true],
    ["家庭情况", "职位", "", true, true],
    ["家庭情况", "电话", "", true, true],
    ["声明与其他", "是否有重大疾病/传染病", "", true, true],
    ["声明与其他", "是否有不良记录", "", true, true],
    ["声明与其他", "是否持有其他公司股权或参与业务经营", "", true, true],
    ["声明与其他", "是否有恋人/亲属/朋友在本公司（包括本公司的关联公司）任职", "", true, true],
    ["声明与其他", "是否有恋人/亲属/朋友在同行业任职", "", true, true],
    ["声明与其他", "在校是否有处罚记录", "", true, true],
  ];
  function material(profileId, category, label, value, sensitive, manualOnly, extra) {
    return Object.assign({
      id: S.createId("mat"), profileId, category, label,
      value: value == null ? "" : String(value),
      sensitive: !!sensitive, manualOnly: !!manualOnly,
      tags: [], note: "", source: "profile", updatedAt: new Date().toISOString(),
    }, extra || {});
  }

  function addField(out, profileId, category, label, value, sensitive, extra) {
    if (!label) return;
    out.push(material(profileId, category, label, value, sensitive, false, extra));
  }

  function recordLabel(type, record) {
    const map = {
      education: "教育经历", experiences: "工作经历", projects: "项目经历",
      research: "科研论文", awards: "奖励荣誉", activities: "校园经历",
      skills: "专业技能", answers: "开放问题",
    };
    return map[type] || type;
  }

  function addRecordMaterials(out, profileId, type, record, fields, title) {
    if (!record) return;
    const category = recordLabel(type, record);
    const clean = (v) => Array.isArray(v) ? v.join("、") : (v == null ? "" : String(v));
    const lines = [];
    for (const [key, label] of fields) {
      const value = clean(record[key]);
      if (value) lines.push(`${label}：${value}`);
      addField(out, profileId, category, `${title || record.name || record.title || record.school || category}｜${label}`, value, false, { tags: [category] });
    }
    if (lines.length) {
      out.push(material(profileId, category, `${title || record.name || record.title || record.school || category}｜完整信息`, lines.join("\n"), false, false, { tags: [category, "整段复制"] }));
    }
  }

  function buildMaterials(profile) {
    const out = [];
    const pid = profile.id;
    const categories = {
      personal: "基本信息", sensitive: "联系方式",
    };
    for (const f of profile.personal || []) addField(out, pid, categories.personal, f.label || f.key, f.value, false, { tags: [f.key] });
    for (const f of profile.sensitive || []) addField(out, pid, categories.sensitive, f.label || f.key, f.value, true, { tags: [f.key] });
    for (const f of profile.customFields || []) {
      addField(out, pid, "自定义", f.label || f.key, f.value, !!f.isSensitive, { tags: [f.key, ...(f.aliases || [])], source: "custom-field", systemKey: `custom-field:${f.id}` });
    }

    for (const [category, label, value, sensitive, manualOnly] of APPLICATION_FIELDS) {
      if (!out.some((m) => m.label === label)) out.push(material(pid, category, label, value, sensitive, manualOnly, { source: "application-template" }));
    }

    for (const r of profile.education || []) addRecordMaterials(out, pid, "education", r, [
      ["school", "学校"], ["department", "院系"], ["major", "专业"], ["degree", "学历"],
      ["startDate", "开始时间"], ["endDate", "结束时间"], ["gpa", "绩点"], ["ranking", "专业排名"],
    ]);
    for (const r of profile.experiences || []) addRecordMaterials(out, pid, "experiences", r, [
      ["organization", "单位"], ["title", "职位"], ["startDate", "开始时间"], ["endDate", "结束时间"], ["description", "工作描述"],
    ]);
    for (const r of profile.projects || []) addRecordMaterials(out, pid, "projects", r, [
      ["name", "项目名称"], ["role", "项目角色"], ["startDate", "开始时间"], ["endDate", "结束时间"], ["url", "项目链接"],
      ["description", "项目描述"], ["technologies", "技术栈"], ["outcomes", "项目成果"],
    ]);
    for (const r of profile.research || []) addRecordMaterials(out, pid, "research", r, [
      ["type", "类型"], ["title", "名称"], ["venue", "期刊/会议"], ["status", "状态"], ["authorOrder", "作者排序"], ["date", "时间"], ["description", "说明"], ["url", "链接"],
    ]);
    for (const r of profile.awards || []) addRecordMaterials(out, pid, "awards", r, [["name", "奖项名称"], ["date", "时间"], ["levelOrRole", "级别"], ["description", "描述"]]);
    for (const r of profile.activities || []) addRecordMaterials(out, pid, "activities", r, [["name", "活动/职务名称"], ["date", "时间"], ["levelOrRole", "角色"], ["description", "描述"]]);
    for (const r of profile.skills || []) addRecordMaterials(out, pid, "skills", r, [["category", "技能类别"], ["content", "技能内容"]], r.category);
    for (const r of profile.answers || []) addRecordMaterials(out, pid, "answers", r, [["title", "问题/标题"], ["keywords", "关键词"], ["content", "答案内容"]], r.title);

    out.push(material(pid, "附件", "上传简历文件", "", false, true, {
      source: "upload", systemKey: "resume-upload",
      note: "在管理器中新建附件材料后，可记录你自己的本地文件或文件夹；插件不会读取或上传文件。",
    }));
    out.push(material(pid, "附件", "头像/证件照所在文件夹", "", false, true, {
      source: "upload", systemKey: "portrait-folder", folderPath: "",
      note: "可在管理器填写照片所在文件夹；插件只打开目录，仍由你在网页上传控件中选择文件。",
    }));
    return out;
  }

  function ensureProfileMaterials(profile) {
    if (!profile) return false;
    if (!Array.isArray(profile.materials) || profile.materials.length === 0) {
      profile.materials = buildMaterials(profile);
      profile.materialSchemaVersion = MATERIAL_SCHEMA_VERSION;
      return true;
    }
    if ((profile.materialSchemaVersion || 1) < MATERIAL_SCHEMA_VERSION) {
      let changed = false;
      const legacyResume = profile.materials.find((item) => item && item.source === "resume");
      if (legacyResume) {
        Object.assign(legacyResume, {
          label: "上传简历文件", source: "upload", systemKey: "resume-upload",
          note: legacyResume.note || "插件不会读取或上传文件；请手动在网页上传控件中选择文件。",
        });
        changed = true;
      }
      if (!profile.materials.some((item) => item && item.systemKey === "portrait-folder")) {
        profile.materials.push(material(profile.id, "附件", "头像/证件照所在文件夹", "", false, true, {
          source: "upload", systemKey: "portrait-folder", folderPath: "",
          note: "请在管理器填写照片所在文件夹；插件只打开目录，仍由你在网页上传控件中选择文件。",
        }));
        changed = true;
      }
      if ((profile.materialSchemaVersion || 1) < 3) {
        for (const field of profile.customFields || []) {
          const systemKey = `custom-field:${field.id}`;
          if (!profile.materials.some((item) => item && item.systemKey === systemKey)) {
            profile.materials.push(material(profile.id, "自定义", field.label || field.key, field.value, !!field.isSensitive, false, { tags: [field.key, ...(field.aliases || [])], source: "custom-field", systemKey }));
            changed = true;
          }
        }
      }
      profile.materialSchemaVersion = MATERIAL_SCHEMA_VERSION;
      return true;
    }
    return false;
  }

  function maskValue(value) {
    const s = String(value == null ? "" : value);
    if (!s) return "";
    if (s.length <= 4) return "••••";
    if (/^\d{15,18}$/.test(s)) return `${s.slice(0, 4)}••••••••${s.slice(-4)}`;
    if (/^\d{7,}$/.test(s)) return `${s.slice(0, 3)}••••${s.slice(-4)}`;
    return `${s.slice(0, 1)}••••${s.slice(-1)}`;
  }

  RAA.materialLibrary = {
    MATERIAL_SCHEMA_VERSION,
    CATEGORIES,
    APPLICATION_FIELDS,
    material,
    buildMaterials,
    ensureProfileMaterials,
    maskValue,
  };
})();
