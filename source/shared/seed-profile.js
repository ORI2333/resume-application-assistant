/* shared/seed-profile.js — 首次运行创建空白本地档案；不含任何个人简历或文件路径。 */
(() => {
  "use strict";
  const RAA = (globalThis.ResumeApplicationAssistant = globalThis.ResumeApplicationAssistant || {});
  const S = RAA.schema;

  function buildInitialProfile() {
    const now = new Date().toISOString();
    const profileId = S.createId("profile");
    const field = (key, label, aliases, kind) =>
      S.newPersonalField(key, label, "", aliases, false, { kind: kind || "text" });
    const personal = [
      field("name", "姓名", RAA.fieldAliases.aliasesOf("name")),
      field("email", "邮箱", RAA.fieldAliases.aliasesOf("email")),
      field("city", "现居城市", RAA.fieldAliases.aliasesOf("city")),
      field("birthMonth", "出生日期", RAA.fieldAliases.aliasesOf("birthMonth"), "date"),
      field("gender", "性别", RAA.fieldAliases.aliasesOf("gender"), "select"),
      field("politicalStatus", "政治面貌", RAA.fieldAliases.aliasesOf("politicalStatus"), "select"),
      field("hometown", "籍贯", RAA.fieldAliases.aliasesOf("hometown")),
      field("blog", "个人主页", RAA.fieldAliases.aliasesOf("blog")),
      field("graduationStatus", "当前状态", RAA.fieldAliases.aliasesOf("graduationStatus")),
    ];
    const sensitive = [
      field("phone", "电话", RAA.fieldAliases.aliasesOf("phone")),
      field("github", "GitHub", RAA.fieldAliases.aliasesOf("github")),
      field("idCard", "身份证号", RAA.fieldAliases.aliasesOf("idCard")),
      field("emergencyContact", "紧急联系人", RAA.fieldAliases.aliasesOf("emergencyContact")),
      field("emergencyPhone", "紧急联系电话", RAA.fieldAliases.aliasesOf("emergencyPhone")),
    ];
    const variant = S.newVariant(profileId, S.createId("variant"), "默认版本", "", "zh");
    const profile = {
      id: profileId,
      name: "我的档案",
      createdAt: now,
      updatedAt: now,
      needsReview: false,
      reviewItems: [],
      personal,
      sensitive,
      customFields: [],
      applications: [],
      progressPlan: [],
      materials: [],
      skills: [],
      education: [],
      experiences: [],
      projects: [],
      research: [],
      awards: [],
      activities: [],
      answers: [],
      variants: [variant],
    };
    if (RAA.materialLibrary) RAA.materialLibrary.ensureProfileMaterials(profile);
    return profile;
  }

  RAA.seedProfile = { buildInitialProfile };
})();
