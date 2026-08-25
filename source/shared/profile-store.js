/* shared/profile-store.js — chrome.storage.local 单记录存取 + CRUD。
 * 无 chrome.storage 环境（测试夹具页）时退化为页面内内存存储。 */
(() => {
  "use strict";
  const RAA = (globalThis.ResumeApplicationAssistant =
    globalThis.ResumeApplicationAssistant || {});
  const S = RAA.schema;

  let memoryData = null;

  function memoryBackend() {
    return {
      async get() {
        if (memoryData === null) {
          memoryData = {
            schemaVersion: S.SCHEMA_VERSION,
            profiles: [],
            siteMappings: [],
          };
        }
        return { [S.STORAGE_KEY]: memoryData };
      },
      async set(value) {
        memoryData = value[S.STORAGE_KEY];
        return undefined;
      },
    };
  }

  function backend() {
    if (globalThis.chrome && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return memoryBackend();
  }

  function emptyData() {
    return { schemaVersion: S.SCHEMA_VERSION, profiles: [], siteMappings: [] };
  }

  async function load() {
    const res = await backend().get(S.STORAGE_KEY);
    const data = res && res[S.STORAGE_KEY];
    if (!data || !Array.isArray(data.profiles)) return emptyData();
    if (!Array.isArray(data.siteMappings)) data.siteMappings = [];
    let changed = false;
    if (data.schemaVersion !== S.SCHEMA_VERSION) {
      data.schemaVersion = S.SCHEMA_VERSION;
      changed = true;
    }
    for (const profile of data.profiles) {
      if (!Array.isArray(profile.customFields)) { profile.customFields = []; changed = true; }
      if (!Array.isArray(profile.applications)) { profile.applications = []; changed = true; }
      if (!Array.isArray(profile.progressPlan)) { profile.progressPlan = []; changed = true; }
      for (const field of profile.customFields) {
        if (!field.id) { field.id = S.createId("cf"); changed = true; }
        field.custom = true;
        if (!Array.isArray(field.aliases)) { field.aliases = []; changed = true; }
        if (field.autoFill == null) { field.autoFill = false; changed = true; }
        if (field.skip == null) { field.skip = false; changed = true; }
        if (!field.kind) { field.kind = "text"; changed = true; }
        if (!Array.isArray(field.options)) { field.options = []; changed = true; }
      }
      for (const app of profile.applications) {
        if (!Array.isArray(app.statusHistory)) { app.statusHistory = []; changed = true; }
        if (!app.statusSource) { app.statusSource = "manual"; changed = true; }
        if (!app.updatedAt) { app.updatedAt = app.createdAt || new Date().toISOString(); changed = true; }
      }
      if (RAA.materialLibrary && RAA.materialLibrary.ensureProfileMaterials(profile)) changed = true;
    }
    if (changed) await save(data);
    return data;
  }

  async function save(data) {
    const record = {
      schemaVersion: S.SCHEMA_VERSION,
      profiles: Array.isArray(data.profiles) ? data.profiles : [],
      siteMappings: Array.isArray(data.siteMappings) ? data.siteMappings : [],
      initialized: data.initialized === true || data.profiles.length > 0,
    };
    await backend().set({ [S.STORAGE_KEY]: record });
    return record;
  }

  async function ensureInitialized() {
    const data = await load();
    if (data.initialized !== true && data.profiles.length === 0) {
      const seed = RAA.seedProfile.buildInitialProfile();
      data.profiles.push(seed);
      data.initialized = true;
      await save(data);
      return seed;
    }
    return data.profiles[0];
  }

  function getProfile(data, profileId) {
    return (data.profiles || []).find((p) => p.id === profileId) || null;
  }

  function getVariant(profile, variantId) {
    return (profile.variants || []).find((v) => v.id === variantId) || null;
  }

  /* 校验并持久化一个档案；返回 { ok } 或 { ok:false, errors }。 */
  async function upsertProfile(profile) {
    const data = await load();
    const idx = data.profiles.findIndex((p) => p.id === profile.id);
    if (idx === -1) {
      data.profiles.push(profile);
    } else {
      data.profiles[idx] = profile;
    }
    await save(data);
    return { ok: true };
  }

  async function deleteProfile(profileId) {
    const data = await load();
    data.profiles = data.profiles.filter((p) => p.id !== profileId);
    await save(data);
    return data;
  }

  async function createVariant(profileId, name, targetRole) {
    const data = await load();
    const profile = getProfile(data, profileId);
    if (!profile) return { ok: false, errors: ["档案不存在"] };
    const v = S.newVariant(profileId, S.createId("var"), name, targetRole, "zh");
    for (const type of [
      "skills", "education", "experiences", "projects",
      "research", "awards", "activities", "answers",
    ]) {
      v[type] = (profile[type] || []).map((r) => r.id);
    }
    profile.variants.push(v);
    profile.updatedAt = new Date().toISOString();
    await save(data);
    return { ok: true, variant: v };
  }

  async function deleteVariant(profileId, variantId) {
    const data = await load();
    const profile = getProfile(data, profileId);
    if (!profile) return { ok: false, errors: ["档案不存在"] };
    profile.variants = profile.variants.filter((v) => v.id !== variantId);
    profile.updatedAt = new Date().toISOString();
    await save(data);
    return { ok: true };
  }

  /* 站点映射：仅存 { origin, normalizedFingerprint, profileFieldKey }，不含档案值。 */
  async function addSiteMapping(origin, normalizedFingerprint, profileFieldKey) {
    const data = await load();
    const exists = (data.siteMappings || []).some(
      (m) =>
        m.origin === origin &&
        m.normalizedFingerprint === normalizedFingerprint &&
        m.profileFieldKey === profileFieldKey
    );
    if (!exists) {
      data.siteMappings.push({ origin, normalizedFingerprint, profileFieldKey });
      await save(data);
    }
    return data.siteMappings;
  }

  async function getSiteMappings(origin) {
    const data = await load();
    return (data.siteMappings || []).filter((m) => m.origin === origin);
  }

  async function deleteSiteMapping(origin, normalizedFingerprint, profileFieldKey) {
    const data = await load();
    data.siteMappings = (data.siteMappings || []).filter(
      (m) =>
        !(
          m.origin === origin &&
          m.normalizedFingerprint === normalizedFingerprint &&
          m.profileFieldKey === profileFieldKey
        )
    );
    await save(data);
    return data.siteMappings;
  }

  RAA.profileStore = {
    load,
    save,
    ensureInitialized,
    getProfile,
    getVariant,
    upsertProfile,
    deleteProfile,
    createVariant,
    deleteVariant,
    addSiteMapping,
    getSiteMappings,
    deleteSiteMapping,
    canScan: (profile) => S.canScan(profile),
    _backend: backend,
  };
})();
