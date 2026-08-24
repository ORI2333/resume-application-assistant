/* content.js — 右侧材料库侧栏消息入口。
 * 只读取扩展本地材料，不扫描网页控件、不自动填充、不自动提交。 */
(() => {
  "use strict";
  const RAA = globalThis.ResumeApplicationAssistant;
  if (!RAA || !RAA.materialSidebar || RAA.__materialBooted) return;
  RAA.__materialBooted = true;

  if (!globalThis.chrome || !chrome.runtime || !chrome.runtime.onMessage) return;
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "resume-assistant/materials-status") {
      sendResponse({ ok: true, mode: "materials-sidebar" });
      return;
    }
    if (msg.type === "resume-assistant/materials-open") {
      RAA.materialSidebar.open()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }
    if (msg.type === "resume-assistant/materials-close") {
      RAA.materialSidebar.close();
      sendResponse({ ok: true });
    }
  });
})();
