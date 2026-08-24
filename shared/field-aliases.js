/* shared/field-aliases.js — 表单字段别名词典（不包含任何个人数据）。 */
(() => {
  "use strict";
  const RAA = (globalThis.ResumeApplicationAssistant =
    globalThis.ResumeApplicationAssistant || {});

  /* key → 别名列表（含中英文常见写法）。匹配时与归一化后的标签比较。 */
  const ALIASES = {
    /* 个人基本信息 */
    name: ["姓名", "名字", "真实姓名", "中文姓名", "您的姓名", "姓名全称", "name", "fullname", "full name"],
    email: ["邮箱", "电子邮件", "电子邮箱", "邮箱地址", "常用邮箱", "联系邮箱", "email", "mail", "e-mail"],
    city: ["现居城市", "所在城市", "现居住城市", "居住城市", "常驻城市", "当前城市", "居住地", "现居住地", "city", "current city"],
    birthMonth: ["出生年月", "出生日期", "出生时间", "生日", "出生年月日", "出生年/月", "birthday", "birthdate", "date of birth"],
    gender: ["性别", "gender", "sex"],
    politicalStatus: ["政治面貌", "政治面貌情况", "党员", "political status"],
    hometown: ["籍贯", "户籍", "生源地", "户籍所在地", "户口所在地", "hometown", "native place"],
    blog: ["个人博客", "博客", "博客地址", "个人网站", "个人主页", "blog", "website"],
    graduationStatus: ["当前状态", "目前状态", "当前身份", "在读状态", "届别", "毕业状态", "毕业年份", "届", "graduation status", "graduate status"],
    /* 敏感字段（默认 autoFill:false） */
    phone: ["电话", "手机", "手机号", "手机号码", "联系电话", "联系方式", "电话号码", "电话号", "手机电话", "手机联系方式", "phone", "mobile", "tel", "cellphone", "telephone"],
    github: ["github", "github 主页", "github地址", "github 链接", "github账号", "git主页", "代码托管主页"],
    idCard: ["身份证", "身份证号", "身份证号码", "证件号码", "证件号", "居民身份证号码", "id number", "id card"],
    emergencyContact: ["紧急联系人", "紧急联络人", "紧急情况联系人", "应急联系人", "emergency contact"],
    emergencyPhone: ["紧急联系电话", "紧急联系人电话", "应急联系电话", "紧急情况联系电话", "emergency phone"],
    /* 教育记录 */
    school: ["学校", "毕业院校", "院校", "学校名称", "毕业学校", "高校", "学校全称", "就读院校", "school", "university", "college", "institution"],
    department: ["院系", "学院", "系别", "department"],
    major: ["专业", "所学专业", "专业名称", "专业类别", "专业方向", "major", "specialty"],
    degree: ["学历", "学位", "学历学位", "最高学历", "最高学位", "教育层次", "degree"],
    gpa: ["绩点", "gpa", "平均绩点", "专业绩点", "gpa成绩"],
    ranking: ["专业排名", "排名", "年级排名", "成绩排名", "综合排名", "ranking"],
    startDate: ["开始时间", "起始时间", "入学时间", "开始日期", "入学日期", "入校时间", "起止时间起", "startdate", "start date", "start"],
    endDate: ["结束时间", "毕业时间", "离校时间", "结束日期", "起止时间止", "enddate", "end date", "end", "graddate"],
    /* 工作/实习记录 */
    organization: ["公司", "公司名称", "单位", "工作单位", "企业", "企业名称", "任职单位", "公司全称", "organization", "company", "employer"],
    title: ["职位", "岗位", "职位名称", "岗位名称", "职务", "担任职位", "职位类别", "title", "position", "job"],
    description: ["工作内容", "工作描述", "职责", "主要职责", "工作职责", "职责描述", "岗位职责", "实习内容", "实习描述", "主要工作内容", "job description", "description"],
    /* 项目记录 */
    projectName: ["项目名称", "项目", "项目名", "课题名称", "项目题目", "project", "project name"],
    role: ["项目角色", "担任角色", "角色", "承担角色", "项目角色/职责", "role"],
    projectUrl: ["项目链接", "项目地址", "链接", "项目网址", "项目url", "project url", "url", "github链接"],
    projectDescription: ["项目描述", "项目简介", "项目内容", "项目详情", "主要工作", "项目职责与成果", "项目介绍", "project description"],
    technologies: ["技术栈", "使用技术", "涉及技术", "关键技术", "用到的技术", "技术点", "technologies", "tech stack"],
    outcomes: ["项目成果", "主要成果", "成果", "项目成果与收获", "成果与收获", "outcomes", "achievements"],
    /* 科研记录 */
    researchType: ["类型", "成果类型", "类别", "type"],
    researchTitle: ["题目", "论文题目", "成果名称", "名称", "论文名称", "paper title", "title"],
    venue: ["发表期刊", "期刊", "会议", "期刊/会议", "发表刊物", "venue", "journal", "conference"],
    status: ["状态", "进展情况", "status"],
    authorOrder: ["作者排序", "署名", "作者身份", "署名情况", "author order"],
    date: ["时间", "日期", "获奖时间", "时间/日期", "date"],
    /* 获奖/活动记录 */
    awardName: ["奖项名称", "获奖名称", "名称", "荣誉名称", "award name", "award"],
    levelOrRole: ["级别", "级别/角色", "奖项级别", "角色", "级别或角色", "level", "grade"],
    /* 技能 */
    skillCategory: ["技能分类", "分类", "类别", "category"],
    skillContent: ["技能内容", "专业技能", "技能", "个人技能", "技能特长", "skills", "skill"],
    /* 常用开放问题（答案匹配用） */
    selfEvaluation: ["自我评价", "个人评价", "个人简介", "自我介绍", "自我描述", "个人优势", "综合素质", "个人亮点", "自我评估", "自我认知", "self evaluation", "self-introduction", "introduction"],
    motivation: ["求职动机", "应聘动机", "为什么选择我们", "入职动机", "motivation"],
    careerPlan: ["职业规划", "职业发展计划", "未来规划", "职业目标", "career plan"],
    desiredRole: ["求职意向", "意向岗位", "期望职位", "意向职位", "目标岗位", "应聘岗位", "期望岗位", "意向岗位类别", "desired position", "expected position", "job intention"],
    desiredCity: ["期望城市", "意向城市", "期望工作城市", "工作地点", "意向地点", "期望工作地点", "desired city"],
    expectedSalary: ["期望薪资", "期望月薪", "薪资要求", "期望薪酬", "expected salary"],
    availableTime: ["到岗时间", "可到岗时间", "入职时间", "预计到岗", "何时可以入职", "available date"],
    strengths: ["特长", "优势", "擅长", "strengths"],
    educationSummary: ["教育经历简介", "学历简介"],
  };

  const LABELS = {
    name: "姓名",
    email: "邮箱",
    city: "现居城市",
    birthMonth: "出生年月",
    gender: "性别",
    politicalStatus: "政治面貌",
    hometown: "籍贯",
    blog: "个人博客",
    graduationStatus: "当前状态",
    phone: "电话",
    github: "GitHub",
    idCard: "身份证号",
    emergencyContact: "紧急联系人",
    emergencyPhone: "紧急联系电话",
  };

  function labelsOf(key) {
    return LABELS[key] || key;
  }

  function aliasesOf(key) {
    return ALIASES[key] || [];
  }

  /* 别名集合（含归一化），用于构建匹配字典。 */
  function allAliases(key) {
    return [key, ...(ALIASES[key] || [])];
  }

  RAA.fieldAliases = { ALIASES, LABELS, labelsOf, aliasesOf, allAliases };
})();
