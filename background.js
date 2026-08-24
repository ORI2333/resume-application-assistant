/* background.js — 用户点击扩展图标后，仅向当前页面按需注入材料库侧栏。 */
(() => {
  "use strict";

  const INJECT_FILES = [
    "shared/schema.js",
    "shared/field-aliases.js",
    "shared/material-library.js",
    "shared/seed-profile.js",
    "shared/profile-store.js",
    "content/material-sidebar.js",
    "content.js",
  ];
  const LAST_PAGE_KEY = "resumeAssistantLastPageContext";

  function supported(url) {
    try {
      const protocol = new URL(url || "").protocol;
      return protocol === "http:" || protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  async function send(tabId, message) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (_) {
      return null;
    }
  }

  async function openMaterials(tab) {
    if (!tab || tab.id == null || !supported(tab.url)) return;
    try {
      await chrome.storage.session.set({ [LAST_PAGE_KEY]: { url: tab.url, title: tab.title || "", capturedAt: new Date().toISOString() } });
    } catch (error) {
      console.warn("无法保存当前网页上下文", error);
    }
    let reply = await send(tab.id, { type: "resume-assistant/materials-status" });
    if (!reply || reply.mode !== "materials-sidebar") {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: INJECT_FILES });
      } catch (error) {
        console.warn("履历材料库无法注入当前页面", error);
        return;
      }
    }
    await send(tab.id, { type: "resume-assistant/materials-open" });
  }

  chrome.action.onClicked.addListener((tab) => {
    openMaterials(tab).catch((error) => console.warn("履历材料库启动失败", error));
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return;
    if (!sender || sender.id !== chrome.runtime.id) return;
    if (message.type === "resume-assistant/current-page-context") {
      chrome.storage.session.get(LAST_PAGE_KEY)
        .then((data) => sendResponse({ ok: true, context: data[LAST_PAGE_KEY] || null }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }
    if (message.type === "resume-assistant/open-manager") {
      chrome.tabs.create({ url: chrome.runtime.getURL("manager.html") })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }
    if (message.type === "resume-assistant/open-tracker") {
      chrome.tabs.create({ url: chrome.runtime.getURL("tracker.html") })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }
    if (message.type !== "resume-assistant/open-folder") return;
    const path = String(message.path || "");
    if (!/^([A-Za-z]:[\\/]|\\\\)/.test(path)) {
      sendResponse({ ok: false, error: "文件夹路径格式不受支持" });
      return;
    }
    /* 浏览器没有直接启动 Windows 资源管理器的通用 MV3 API。
     * 这里打开 file URL 目录；用户需在扩展详情中开启“允许访问文件网址”。 */
    const segments = path.replace(/\\/g, "/").replace(/^\/+/, "").split("/").filter((part) => part && part !== ".");
    if (segments.some((part) => part === "..")) {
      sendResponse({ ok: false, error: "文件夹路径包含不允许的上级目录段（..）" });
      return;
    }
    const fileUrl = "file:///" + segments.map((part, index) => index === 0 ? part : encodeURIComponent(part)).join("/");
    chrome.tabs.create({ url: fileUrl })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  });
})();
