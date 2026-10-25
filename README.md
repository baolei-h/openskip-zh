# SkipStream 中文版

**自动跳过片头、前情回顾与片尾字幕，并从上次观看的位置继续。**

[![Firefox Add-ons](https://img.shields.io/badge/Firefox%20Add--ons-Active-blue?logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/skipstream/)
[![Chrome](https://img.shields.io/badge/Chrome-Manual%20Install-yellow?logo=googlechrome)](../../releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.13.0-green.svg)](https://github.com/govinda-rajulu/openskip/releases/tag/v1.13.0)

> 本仓库是 [govinda-rajulu/openskip](https://github.com/govinda-rajulu/openskip)（SkipStream 1.13.0）的**简体中文汉化版**：弹窗、设置页、页内提示与字幕菜单均已汉化，代码逻辑与上游保持一致。英文原文说明见 [README.en.md](README.en.md)。

---

## 安装

**Firefox 官方商店：** [addons.mozilla.org/en-US/firefox/addon/skipstream](https://addons.mozilla.org/en-US/firefox/addon/skipstream/)（英文原版）。

**安装本汉化版（手动加载）：**

1. 下载本仓库代码（Code → Download ZIP，或 `git clone`）。
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`；Firefox 为 `about:debugging#/runtime/this-firefox`）。
3. 打开「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择 `manifest-chrome.json` 所在目录（Firefox 选择 `manifest.json` 所在目录）。

**Android：** 使用 Firefox for Android（扩展菜单中安装）。

**电视：** 电视浏览器对扩展支持很差，建议用 HDMI 连接笔记本或迷你主机。

---

## SkipStream 能做什么

- **跳过**片头、前情回顾、片尾字幕与预告：可以立即跳过，也可以倒计时 3 秒后跳过并支持撤销。
- **获取跳过时间点**：来自 [IntroDB](https://introdb.app)、[TheIntroDB](https://theintrodb.org)、[SkipDB](https://skipdb.tv)、[AniSkip](https://github.com/aniskip) 与 [Anime Skip](https://anime-skip.com)，也会读取页面播放器自带的章节信息。
- **点击网站自带的「跳过」按钮**：支持 Netflix、Prime Video、Disney+、Hulu、Max、Crunchyroll 等。
- **YouTube**：跳过 [SponsorBlock](https://sponsor.ajay.app) 标记的片段，每类片段可设为「自动 / 询问 / 关闭」，进度条上会显示标记（m.youtube.com 同样支持）。
- **续播**：从上次看到的位置继续，内嵌播放器同样有效。地址里带的时间（例如 `?t=90`）优先级更高。
- **字幕**：可下载 OpenSubtitles 字幕，也可加载自己的 .srt / .vtt 文件。颜色、字体（9 种，含 Netflix 与 Prime Video 风格）、字重、背景、描边与字号均可调，设置页带实时预览。右键点击 CC 可校正时间轴，并按剧集分别记住。
- **历史**：保留最近 300 个视频，带海报、站点名称与站点图标，可按站点和最后播放设备筛选；另有统计、按站点规则、倍速控制与可选的「自动下一集」。
- **备份**：一个文件包含全部设置与历史；只有勾选时才会写入密钥，并由你的口令加密。
- **弹窗工具**：「检查本页」与「站点报告」展示 SkipStream 的检测结果，反馈问题时可直接附上。
- **主题**：浅色 / 深色，主题色可自定义。

自动跳过或续播后默认**不显示**提示。需要「已跳过，撤销」或「已从…继续」时，在「设置 > 跳过」中打开。任何时候按 Alt+Z 都能撤销上一次自动跳过。

## 配置

跳过、SponsorBlock 与续播都不需要账号或密钥。以下全部可选，在「设置」（弹窗里的齿轮）里添加。

| 服务 | 作用 | 获取方式 |
|---|---|---|
| TMDB 密钥 | 海报，以及仅有标题的站点的 id 匹配 | [themoviedb.org](https://www.themoviedb.org/settings/api) |
| Supabase 项目 | 历史与设置同步到你自己的云端 | [supabase.com](https://supabase.com) |
| OpenSubtitles 账号 | 每天 20 次字幕下载（未登录 5 次） | [opensubtitles.com](https://www.opensubtitles.com) |
| Anime Skip Client ID | 更多番剧跳过时间点 | [anime-skip.com](https://anime-skip.com/account/api-clients) |

**Supabase：** 填项目 URL 与 publishable key（`sb_publishable_...`），旧版 anon key 也可用，切勿使用 secret key。设置页会提示如何在 Supabase 里运行一次 `supabase_setup.sql`；SkipStream 本身不会在你的项目里执行 SQL。

所有密钥都由使用者自备，SkipStream 不内置任何密钥。

## 数据来源

SkipStream 使用以下服务。图标归各自所有者所有，仅用于标示数据来源，任何来源都不为 SkipStream 背书。

| | 来源 | 提供内容 | 登录 |
|---|---|---|---|
| <img src="https://icons.duckduckgo.com/ip3/introdb.app.ico" width="16" height="16" alt=""> | [IntroDB](https://introdb.app) | 按 IMDb id 提供片头、回顾与片尾时间点 | 无需（仅提交时间点需要密钥） |
| <img src="https://icons.duckduckgo.com/ip3/theintrodb.org.ico" width="16" height="16" alt=""> | [TheIntroDB](https://theintrodb.org) | 按 TMDB 或 IMDb id 提供片头、回顾、片尾与预告时间点 | 无需（仅提交时间点需要密钥） |
| <img src="https://icons.duckduckgo.com/ip3/skipdb.tv.ico" width="16" height="16" alt=""> | [SkipDB](https://skipdb.tv) | 片头、回顾、片尾与预告时间点（[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)） | 无需 |
| <img src="https://icons.duckduckgo.com/ip3/sponsor.ajay.app.ico" width="16" height="16" alt=""> | [SponsorBlock](https://sponsor.ajay.app) | YouTube 赞助、提醒、精彩片段（[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)） | 无需 |
| <img src="https://github.com/aniskip.png?size=32" width="16" height="16" alt=""> | [AniSkip](https://github.com/aniskip) | 番剧片头、片尾与回顾 | 无需 |
| <img src="https://icons.duckduckgo.com/ip3/jikan.moe.ico" width="16" height="16" alt=""> | [Jikan](https://jikan.moe) | 番剧标题对应的 MyAnimeList id | 无需 |
| <img src="https://icons.duckduckgo.com/ip3/anime-skip.com.ico" width="16" height="16" alt=""> | [Anime Skip](https://anime-skip.com) | 更多番剧时间点 | 可选 Client ID |
| <img src="https://icons.duckduckgo.com/ip3/themoviedb.org.ico" width="16" height="16" alt=""> | [TMDB](https://www.themoviedb.org) | 海报、片名与 id | 可选密钥 |
| <img src="https://icons.duckduckgo.com/ip3/opensubtitles.com.ico" width="16" height="16" alt=""> | [OpenSubtitles](https://www.opensubtitles.com) | 字幕 | 可选账号 |
| <img src="https://icons.duckduckgo.com/ip3/supabase.com.ico" width="16" height="16" alt=""> | [Supabase](https://supabase.com) | 在你自己的项目中做云同步 | 可选项目 |

本产品使用 TMDB 及 TMDB API，但未获得 TMDB 的认可、认证或其他形式的批准。

**同一视频有多个来源时：** 不同类型可以组合（片头来自一个来源，片尾来自另一个）；同一类型内只采用一个来源，按上表顺序取第一个有数据的来源，因为不同来源的时间点可能对应不同版本。

## 隐私

[PRIVACY.md](PRIVACY.md) 列出了每个服务以及会发送给它的数据。密钥只保存在你的浏览器里；只有你配置了 Supabase，历史才会写入你自己的项目。技术数据（设备名、设置备份与统计）可在 Firefox 扩展设置中关闭。SkipStream 没有广告，也不做跟踪。

## 文件结构

```
manifest.json / manifest-chrome.json   Firefox MV2 / Chrome MV3（版本一致）
background.js                          全部网络请求、跳过来源、同步、页面工具
content-scripts/content.js             查找视频、跳过、续播、字幕、消息
content-scripts/probe.js               「站点报告」（仅在点击时运行）
popup.* / options.* / theme-engine.js  弹窗、设置页、共用主题
tests/                                 node --test tests/*.test.mjs（无依赖）
knowledge/                             状态、经验、路线图、审计、手册
supabase_setup.sql                     一次性数据库安装脚本
```

## 参与开发

代码是纯 JavaScript，无构建步骤、无依赖。给开发者和智能体看的规则：[AGENTS.md](AGENTS.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)。发布流程：[HOW_TO_RELEASE.md](HOW_TO_RELEASE.md)。当前状态：[knowledge/STATE.md](knowledge/STATE.md)。文档写作规范：[knowledge/handbook/WRITING.md](knowledge/handbook/WRITING.md)。

## 汉化说明

- 翻译范围：弹窗、设置页全部面板、页内跳过按钮与提示、字幕菜单、站点报告与诊断信息、扩展名称与描述。
- 保留原文：品牌名 `SkipStream`、各项数据来源名称（如 IntroDB、TMDB、SponsorBlock）与服务地址，便于与上游文档对照。
- 代码逻辑未改动，只调整界面文案，因此跳过、续播、同步等行为与上游 1.13.0 一致。
- 汉化中的问题或措辞建议，欢迎在本仓库提 Issue。
