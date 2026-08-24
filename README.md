# Resume Application Assistant · 履历投递助手

> Chrome / Edge Manifest V3 扩展：本地履历材料库与投递工作台。手动复制，绝不自动填写、绝不自动提交。
> A Chrome/Edge Manifest V3 extension: a local resume material library and application tracker. Manual copy only — never auto-fills, never auto-submits.

## 简介 / Overview

所有求职资料保存在浏览器本地（`chrome.storage.local`），不上传、不联网、不随账号同步。点击扩展图标打开右侧材料库，搜索并复制材料后手动粘贴到目标网页表单；"档案库"页面维护档案、版本、材料与开放问题答案；"投递工作台"页面按卡片与看板记录投递进度和行动计划。

All application materials are stored locally in the browser (`chrome.storage.local`) — nothing is uploaded, no network requests are made, and nothing syncs to an account. Click the extension icon to open the sidebar material library, search and copy materials, then paste them manually into web forms. The "Archive" page maintains profiles, variants, materials and open-question answers; the "Tracker" page records applications and action plans as cards and a kanban board.

## 核心功能 / Features

- 本地材料库：按分类搜索、敏感值遮罩、确认后复制到剪贴板 / Local material library: search by category, sensitive values masked, copy to clipboard after confirmation
- 档案库：多档案、投递版本、教育与工作等项目记录、自定义字段、敏感字段开关、待核对项 / Archive manager: multiple profiles, variants, repeatable records, custom fields, sensitive-field toggles, review items
- 投递工作台：投递卡片、状态历史、当前网页状态记录、四列行动计划看板 / Application tracker: application cards, status history, current-page status capture, four-column action-plan board
- XLSX 导入导出：备份与恢复全部档案；严格校验，失败不落盘 / XLSX import & export: full backup and restore with strict validation — nothing is written on error
- 隐私默认：敏感字段默认不参与自动填写，复制前需要确认 / Privacy by default: sensitive fields are never auto-filled and require confirmation before copying

## 隐私与数据 / Privacy & Data

- 数据仅保存在本机 `chrome.storage.local`（单键 `resumeAssistantData`）；"当前网页"上下文仅存于内存态 `chrome.storage.session`，浏览器关闭即清空 / Data lives only in the local `chrome.storage.local` (single key `resumeAssistantData`); the last-page context lives only in the in-memory `chrome.storage.session` and is cleared when the browser exits
- 零网络请求、无统计打点、无远程代码、无第三方域名 / Zero network requests, no analytics, no remote code, no third-party domains
- 敏感字段以明文存于本地存储（本机可读）；这是明确的设计取舍，请勿在共用电脑上使用 / Sensitive fields are stored in plaintext in local storage (readable on this machine) — a deliberate trade-off; do not use on shared computers
- 侧栏使用封闭 Shadow DOM + 隔离世界注入，网页脚本无法读取面板内容 / The sidebar uses a closed Shadow DOM and isolated-world injection — page scripts cannot read the panel
- 卸载扩展会删除全部数据；移动或重命名解压目录会改变扩展 ID（旧数据仍在旧 ID 目录）——请先导出 XLSX / Removing the extension deletes all data; moving or renaming the unpacked folder changes the extension ID (old data remains under the old ID) — export XLSX first

## 安装 / Installation

1. 下载仓库或解压发布包 `resume-application-assistant-release.zip` / Download the repository or extract `resume-application-assistant-release.zip`
2. 打开 `chrome://extensions` 或 `edge://extensions`，开启"开发者模式" / Open `chrome://extensions` or `edge://extensions` and enable "Developer mode"
3. 点击"加载已解压的扩展程序"，选择包含 `manifest.json` 的目录 / Click "Load unpacked" and select the directory containing `manifest.json`

## 使用 / Usage

1. 在目标网页点击扩展图标 → 打开右侧材料库 → 复制 → 手动粘贴 / Click the extension icon on the target page → open the sidebar → copy → paste manually
2. 侧栏底部"档案"按钮打开档案库，维护档案与材料 / The "Archive" button in the sidebar footer opens the archive manager
3. "投递工作台"按钮打开投递与计划看板 / The "Tracker" button opens the application and plan board

## 项目结构 / Structure

```text
manifest.json                扩展清单 / manifest
background.js                后台服务：注入控制与消息入口 / service worker
content.js                   内容侧栏消息入口 / content entry
content/material-sidebar.js  材料库侧栏（Shadow DOM）/ sidebar panel
manager.html/css/js          档案库页面 / archive manager page
tracker.html/css/js          投递工作台页面 / tracker page
shared/schema.js             数据模型与校验 / schema & validation
shared/field-aliases.js      字段别名 / field aliases
shared/material-library.js   材料库生成与遮罩 / material library
shared/profile-store.js      本地存储 CRUD / storage CRUD
shared/seed-profile.js       首次运行空白档案 / blank seed profile
shared/xlsx-workbook.js      XLSX 模板、导入导出 / XLSX template & I/O
vendor/xlsx.full.min.js      SheetJS 0.20.3（本地离线依赖）/ offline dependency
icons/                       图标 / icons
```

## 安全 / Security

- 权限最小化：仅 `storage`、`activeTab`、`scripting`；无 `content_scripts`、无 `host_permissions`、无 `externally_connectable`、无 `web_accessible_resources` / Minimal permissions: only `storage`, `activeTab`, `scripting`; no static content scripts, no host permissions, no externally connectable, no web-accessible resources
- 后台消息入口校验发送者身份；`file://` 目录打开拒绝路径穿越 / Background message handlers validate the sender; `file://` folder opening rejects path traversal
- 2026-08 安全审查：无已知可泄露个人隐私的通道；详见提交历史 `security: harden isolation boundary and background message entry (v4.4)` / 2026-08 security review: no known channel for personal-data leakage; see commit history `security: harden isolation boundary and background message entry (v4.4)`

## 技术栈 / Tech Stack

原生 JavaScript · Chrome/Edge MV3 · Shadow DOM · SheetJS 0.20.3 / Vanilla JavaScript · Chrome/Edge MV3 · Shadow DOM · SheetJS 0.20.3

## 仓库约定 / Repository Notes

- 仓库不含任何个人简历数据；含个人信息的 XLSX 与 ZIP 构建产物由 `.gitignore` 排除 / The repository contains no personal resume data; personal XLSX files and ZIP build artifacts are excluded via `.gitignore`
- 当前版本：4.4 / Current version: 4.4
