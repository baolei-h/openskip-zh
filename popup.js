/* SkipStream - popup v1.13.1 */
'use strict';

const br = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;

const KEYS = {
  enabled:    'skipEnabled',
  skipMode:   'skipMode',
  skipIntro:  'skipIntro',
  skipRecap:  'skipRecap',
  skipOutro:  'skipOutro',
  resumePlay: 'resumePlayback',
  autoNext:   'autoNextEpisode',
  playRate:   'playbackSpeed',
  stats:      'skipstream_stats',
  theme:      'skipstream_theme',
  subLang:    'subtitle_language',
  subSrt:     'subtitle_override_srt',
  seedColor:  'skipstream_seed_color',
};

const $ = id => document.getElementById(id);

function ssSystemMode() {
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
  catch (e) { return 'dark'; }
}


// Version
const verBadgeEl = $('versionBadge');
if (verBadgeEl) verBadgeEl.textContent = 'v' + br.runtime.getManifest().version;

// -- Theme: simple light/dark toggle, no system intermediate state --
let currentTheme = ssSystemMode();
let currentSeedHex = '#57A860';

function applyTheme(t) {
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(t === 'light' ? 'theme-light' : 'theme-dark');
  const isDark = t !== 'light';
  const sun  = document.querySelector('.icon-sun');
  const moon = document.querySelector('.icon-moon');
  if (sun)  sun.style.display  = isDark ? 'none' : 'block';
  if (moon) moon.style.display = isDark ? 'block' : 'none';
}

$('themeBtn')?.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
  br.storage.local.set({ [KEYS.theme]: currentTheme });
  if (window.applyThemeFromSeed) applyThemeFromSeed(currentSeedHex, currentTheme);
});

// -- Tabs --
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    document.body.dataset.tab = tab.dataset.tab;
    const targetId = 'page-' + tab.dataset.tab;
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('page-hidden', p.id !== targetId));
  });
});

// -- Domain --
async function detectDomain() {
  try {
    const [tab] = await br.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const url = new URL(tab.url);
    if (!url.hostname || ['chrome:', 'about:', 'moz-extension:', 'chrome-extension:'].includes(url.protocol)) {
      $('domainLabel').textContent = '没有正在播放视频的标签页'; return;
    }
    $('domainLabel').textContent = url.hostname.replace(/^www\./, '');
    $('domainDot').classList.add('active');
  } catch { $('domainLabel').textContent = '没有正在播放视频的标签页'; }
}

// -- Mode labels --
const MODE_LABELS = {
  off: '已停用', prompt: '询问',
  'auto-intro': '自动跳过片头', 'auto-recap': '自动跳过回顾',
  'auto-outro': '自动跳过片尾', 'auto-ir': '片头 + 回顾', 'auto-all': '全部自动',
};

// -- Mode <-> Toggle bidirectional mapping --
const MODE_TO_SEGS = {
  'off':        { i: false, r: false, o: false },
  'prompt':     { i: false, r: false, o: false },
  'auto-intro': { i: true,  r: false, o: false },
  'auto-recap': { i: false, r: true,  o: false },
  'auto-outro': { i: false, r: false, o: true  },
  'auto-ir':    { i: true,  r: true,  o: false },
  'auto-all':   { i: true,  r: true,  o: true  },
};
// What the player really does comes from skipIntro / skipRecap / skipOutro, so the
// shown mode is read from them. Up to 1.13 round 3 a fresh install showed "Auto
// all" while outros only asked (skipOutro is off by default): picking "Auto all"
// changed nothing, because it already looked picked. "auto-ir" is that default.
function modeFromPrefs(d) {
  if (!d || d.skipEnabled === false) return 'off';
  const i = d.skipIntro !== false, r = d.skipRecap !== false, o = d.skipOutro === true;
  if (!i && !r && !o) return 'prompt';
  if (i && r && o) return 'auto-all';
  if (i && r) return 'auto-ir';
  if (i && !r && !o) return 'auto-intro';
  if (!i && r && !o) return 'auto-recap';
  if (!i && !r && o) return 'auto-outro';
  return MODE_TO_SEGS[d.skipMode] ? d.skipMode : 'auto-all';
}

function inferMode(i, r, o) {
  if (!i && !r && !o) return 'prompt';
  if (i  && !r && !o) return 'auto-intro';
  if (!i && r  && !o) return 'auto-recap';
  if (i  && r  && !o) return 'auto-ir';
  if (!i && !r && o)  return 'auto-outro';
  return 'auto-all';
}

let popupMode = 'auto-all';
// Last mode that was not 'off', so switching the master toggle off and on
// restores the user's mode instead of silently becoming Auto All.
let lastActiveMode = null;
br.storage.local.get('skipstream_last_mode').then(s => { lastActiveMode = s.skipstream_last_mode || lastActiveMode; }).catch(() => {});
let popupRate = 1;

function applyModeToUI(mode, enabled) {
  popupMode = mode;
  if (mode && mode !== 'off') lastActiveMode = mode;
  // Chips
  document.querySelectorAll('.smode-chip').forEach(c => {
    const isSel = c.dataset.mode === mode;
    c.classList.toggle('selected', isSel);
    c.setAttribute('aria-checked', isSel ? 'true' : 'false');
  });
  // Segment toggles
  const seg = MODE_TO_SEGS[mode] || { i: true, r: true, o: true };
  if ($('skipIntro')) $('skipIntro').checked = seg.i;
  if ($('skipRecap')) $('skipRecap').checked = seg.r;
  if ($('skipOutro')) $('skipOutro').checked = seg.o;
  // Status badge
  const badge = $('modeBadge');
  if (badge) {
    badge.textContent = MODE_LABELS[mode] || mode;
    badge.className = (!enabled || mode === 'off') ? 'mode-badge off' : 'mode-badge';
  }
}

// Mode chip click -> update toggles
document.querySelectorAll('.smode-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    applyModeToUI(chip.dataset.mode, !!$('masterToggle')?.checked);
    // Persist immediately
    const seg = MODE_TO_SEGS[chip.dataset.mode] || { i: true, r: true, o: true };
    br.storage.local.set({
      [KEYS.skipMode]:  chip.dataset.mode,
      [KEYS.enabled]: chip.dataset.mode !== 'off',
      [KEYS.skipIntro]: seg.i,
      [KEYS.skipRecap]: seg.r,
      [KEYS.skipOutro]: seg.o,
    });
    const mt = $('masterToggle');
    if (mt) mt.checked = chip.dataset.mode !== 'off';
    const ms = $('masterSub');
    if (ms) ms.textContent = chip.dataset.mode !== 'off' ? '扩展已启用' : '扩展已暂停';
  });
});

// Segment toggle click -> infer mode, update chips
['skipIntro', 'skipRecap', 'skipOutro'].forEach(id => {
  $(id)?.addEventListener('change', () => {
    const i = $('skipIntro')?.checked ?? true;
    const r = $('skipRecap')?.checked ?? true;
    const o = $('skipOutro')?.checked ?? false;
    const inferred = inferMode(i, r, o);
    popupMode = inferred;
    document.querySelectorAll('.smode-chip').forEach(c => {
      const isSel = c.dataset.mode === inferred;
      c.classList.toggle('selected', isSel);
      c.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });
    const badge = $('modeBadge');
    if (badge) {
      badge.textContent = MODE_LABELS[inferred] || inferred;
      badge.className = (!!$('masterToggle')?.checked && inferred !== 'off') ? 'mode-badge' : 'mode-badge off';
    }
    // Persist immediately
    br.storage.local.set({
      [KEYS.skipMode]:  inferred,
      [KEYS.enabled]:   inferred !== 'off',
      [KEYS.skipIntro]: i,
      [KEYS.skipRecap]: r,
      [KEYS.skipOutro]: o,
    });
  });
});

// Speed chips
document.querySelectorAll('.speed-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    popupRate = parseFloat(chip.dataset.rate);
    document.querySelectorAll('.speed-chip').forEach(c => {
      const isSel = c === chip;
      c.classList.toggle('selected', isSel);
      c.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });
    br.storage.local.set({ [KEYS.playRate]: popupRate });
  });
});
['resumePlayback', 'autoNextEpisode'].forEach(id => {
  $(id)?.addEventListener('change', () => {
    br.storage.local.set({
      [KEYS.resumePlay]: $('resumePlayback')?.checked ?? true,
      [KEYS.autoNext]:   $('autoNextEpisode')?.checked ?? false,
    });
  });
});

// -- Stats --
function fmtTime(s) {
  if (!s || s < 60) return (s || 0) + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  return (s / 3600).toFixed(1) + 'h';
}

function applyStats(data) {
  const st = data[KEYS.stats] || {};
  const today = new Date().toDateString();
  $('statSkips').textContent = st.statsDate === today ? (st.skipsToday || 0) : 0;
  const todayTime = (st.statsDate === today) ? (st.timeSavedToday || 0) : 0;
  $('statTime').textContent = fmtTime(todayTime);
}

// -- Master toggle --
$('masterToggle')?.addEventListener('change', () => {
  const enabled = !!$('masterToggle')?.checked;
  const nextMode = enabled ? (popupMode !== 'off' ? popupMode : (lastActiveMode || 'auto-all')) : 'off';
  if (!enabled && popupMode !== 'off') br.storage.local.set({ skipstream_last_mode: popupMode }).catch(() => {});
  const nextSeg = MODE_TO_SEGS[nextMode] || { i: true, r: true, o: true };
  br.storage.local.set({
    [KEYS.enabled]: enabled,
    [KEYS.skipMode]: nextMode,
    [KEYS.skipIntro]: nextSeg.i,
    [KEYS.skipRecap]: nextSeg.r,
    [KEYS.skipOutro]: nextSeg.o,
  });
  $('masterSub').textContent = enabled ? '扩展已启用' : '扩展已暂停';
  applyModeToUI(nextMode, enabled);
});



// -- Load all state --
async function loadState() {
  const data = await br.storage.local.get(Object.values(KEYS));
  const enabled  = data[KEYS.enabled] !== false;
  const mode     = modeFromPrefs(data);
  currentTheme   = data[KEYS.theme] || ssSystemMode();
  currentSeedHex = data[KEYS.seedColor] || '#57A860';

  applyTheme(currentTheme);
  if (window.applyThemeFromSeed) applyThemeFromSeed(data[KEYS.seedColor] || '#57A860', currentTheme);
  const mtEl = $('masterToggle');
  if (mtEl) mtEl.checked = enabled;
  $('masterSub').textContent = enabled ? '扩展已启用' : '扩展已暂停';

  popupRate = parseFloat(data[KEYS.playRate]) || 1;
  document.querySelectorAll('.speed-chip').forEach(c => {
    const isSel = parseFloat(c.dataset.rate) === popupRate;
    c.classList.toggle('selected', isSel);
    c.setAttribute('aria-checked', isSel ? 'true' : 'false');
  });

  if ($('resumePlayback'))  $('resumePlayback').checked  = data[KEYS.resumePlay] !== false;
  if ($('autoNextEpisode')) $('autoNextEpisode').checked = !!data[KEYS.autoNext];

  applyModeToUI(mode, enabled);
  applyStats(data);

  // Subtitle state
  const subStatus = $('subStatus');
  if (subStatus && data[KEYS.subSrt]) subStatus.textContent = '已加载你的字幕文件';
  if ($('subLangSelect') && data[KEYS.subLang]) $('subLangSelect').value = data[KEYS.subLang];
}

// -- Subtitle handlers --
// No file picker here: Firefox closes the popup the moment a file dialog opens
// (Mozilla bug 1378527). Your own file goes in through the CC button on the video.
const SUB_REASONS = {
  no_player:  '此标签页里没有找到视频播放器。请先开始播放，然后重试。',
  no_id:      '无法识别这个视频。在设置里填写 TMDB 密钥可让 SkipStream 匹配片名，也可以点击视频上的 CC 按钮加载自己的字幕文件。',
  youtube:    'YouTube 视频不是电影或剧集，OpenSubtitles 没有可匹配的内容。请点击视频上的 CC 按钮加载你自己的字幕文件。',
  no_results: 'OpenSubtitles 上没有这部视频的对应语言或英文字幕。',
  navigated:  '搜索过程中页面发生了变化，请重试。',
  unreadable: '取回的字幕文件里没有可读取的行。',
};

function subReason(r) {
  if (!r) return SUB_REASONS.no_player;
  if (r.ok) return '已加载 ' + r.count + ' 行' + (r.name ? '（来自 ' + r.name + '）' : '');
  return SUB_REASONS[r.reason] || ('OpenSubtitles 返回：' + String(r.reason || '无响应').slice(0, 120));
}

$('subFetchBtn')?.addEventListener('click', async () => {
  const btn = $('subFetchBtn'); const s = $('subStatus');
  if (btn) btn.disabled = true;
  if (s) s.textContent = '正在搜索 OpenSubtitles…';
  let r = null;
  try {
    const [tab] = await br.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) r = await br.tabs.sendMessage(tab.id, { type: 'SUBS_FETCH_NOW' });
  } catch (_) { r = null; }
  if (s) s.textContent = subReason(r);
  if (btn) btn.disabled = false;
});

// "Check this page": every frame reports what it sees (background runPageCheck).
function diagText(r) {
  if (!r || !r.ok) return '无法检查本页。请刷新页面后重试。';
  const f = Array.isArray(r.frames) ? r.frames : [];
  if (!f.length) return 'SkipStream 没有在这个页面上运行。浏览器内置页面和扩展商店页面不允许注入脚本；其他网站请刷新页面。';
  const lines = f.map(x => (x.top ? '页面 ' : '框架 ') + x.frame + '：' + x.videos + ' 个视频'
    + (x.hidden ? '，' + x.hidden + ' 个在播放器内部' : '')
    + (x.blankFrames ? '，' + x.blankFrames + ' 个空白画面' : '')
    + (x.attached ? '，正在使用' : '')
    + (x.attached && x.ident ? '\n  识别为：' + x.ident : '')
    + (x.attached && x.segs ? '\n  找到的跳过点：' + x.segs : '')
    + (x.attached && x.auto ? '\n  模式：' + x.auto : '')
    + (x.attached && x.last ? '\n  上次跳过：' + x.last : '')
    + (x.attached && x.subs ? '\n  字幕：' + x.subs : '')
    + (x.started === false ? '\n  SkipStream 在此框架中未能完成启动' + (x.error ? '：' + x.error : '') : (x.error ? '\n  错误：' + x.error : '')));
  const head = f.some(x => x.attached) ? 'SkipStream 正在这里跟踪一个视频。'
    : '还没有正在使用的视频。请先开始播放（影视站需要先选择片源），播放中再检查一次。';
  return head + '\n' + lines.join('\n');
}

// "Site report": players, stream type, frames, subtitle tracks and ids found in
// every frame (content-scripts/probe.js). Shown here and copied only on request;
// addresses are host + path only.
function siteReportText(r, version) {
  if (!r || !r.ok) return '无法读取本页' + (r && r.err ? '：' + r.err : '') + '。请刷新后重试。';
  const f = Array.isArray(r.frames) ? r.frames : [];
  const L = ['SkipStream ' + (version || '') + ' 站点报告，共 ' + f.length + ' 个框架'];
  for (const x of f) {
    L.push('');
    L.push((x.top ? '页面 ' : '框架 ') + x.frame + (x.skipstream ? '' : '  [SkipStream 未在此运行]'));
    if (x.title) L.push('  标题：' + x.title);
    if (!x.top && x.referrer) L.push('  来源页：' + x.referrer);
    if (x.players && x.players.length) L.push('  播放器：' + x.players.join(', '));
    if (x.libs && x.libs.length) L.push('  脚本：' + x.libs.join(', '));
    for (const v of x.videos || []) {
      L.push('  视频 ' + v.size + '，' + v.kind + (v.source ? '（' + v.source + '）' : '') + '，' + (v.duration ? v.duration + ' 秒' : '无时长') + (v.playing ? '，播放中' : '，已暂停') + (v.at ? '，位于 ' + v.at + ' 秒' : '') + (v.inShadow ? '，位于播放器组件内部' : ''));
      if (v.tracks && v.tracks.length) L.push('    字幕轨：' + v.tracks.join('; '));
    }
    for (const fr of x.iframes || []) L.push('  内嵌框架 ' + fr.src + ' ' + fr.size + (fr.sandbox ? ' sandbox=' + fr.sandbox : ''));
    if (x.ids && x.ids.length) L.push('  标识：' + x.ids.join(', '));
    if (x.ss) L.push('  SkipStream：' + (x.ss.started === false ? '未完成启动' : '运行中') + '，正在使用 ' + (Number(x.ss.attached) || 0) + ' 个视频'
      + (x.ss.ident ? '，识别为：' + x.ss.ident : '') + (x.ss.segs ? '，跳过点：' + x.ss.segs : '') + (x.ss.error ? '，错误：' + x.ss.error : ''));
    if (x.globals && x.globals.length) L.push('  页面播放器代码：' + x.globals.join(', '));
    const many = (head, list) => { if (list && list.length) { L.push('  ' + head + '（' + list.length + '）：'); for (const s of list) L.push('    ' + s); } };
    many('片源按钮', x.sources);
    many('延迟加载框架', x.lazyFrames);
    many('字幕文件', x.trackFiles);
    many('已加载媒体', x.loaded);
    many('脚本中的媒体', x.inScripts);
    if (x.error) L.push('  错误：' + x.error);
  }
  return L.join('\n');
}

$('siteReportBtn')?.addEventListener('click', async () => {
  const btn = $('siteReportBtn'); const s = $('diagStatus'); const ta = $('siteReportText'); const cp = $('siteReportCopy');
  if (btn) btn.disabled = true;
  if (s) s.textContent = '正在读取每一帧…';
  let r = null;
  try {
    const [tab] = await br.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) r = await br.runtime.sendMessage({ type: 'SS_SITE_REPORT', tabId: tab.id });
  } catch (_) { r = null; }
  const text = siteReportText(r, 'v' + br.runtime.getManifest().version);
  if (ta) { ta.value = text; ta.style.display = 'block'; }
  if (cp) cp.style.display = r && r.ok ? 'inline-block' : 'none';
  if (s) s.textContent = r && r.ok ? '站点报告已生成。复制后可粘贴到对话或问题反馈中。' : text;
  if (btn) btn.disabled = false;
});

$('siteReportCopy')?.addEventListener('click', async () => {
  const ta = $('siteReportText'); const s = $('diagStatus');
  if (!ta) return;
  try { await navigator.clipboard.writeText(ta.value); if (s) s.textContent = '已复制。'; }
  catch (_) { ta.focus(); ta.select(); if (s) s.textContent = '已选中：按 Ctrl+C 复制。'; }
});

$('diagBtn')?.addEventListener('click', async () => {
  const btn = $('diagBtn'); const s = $('diagStatus');
  if (btn) btn.disabled = true;
  if (s) s.textContent = '正在检查每一帧…';
  let r = null;
  try {
    const [tab] = await br.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) r = await br.runtime.sendMessage({ type: 'SS_DIAG_RUN', tabId: tab.id });
  } catch (_) { r = null; }
  if (s) s.textContent = diagText(r);
  if (btn) btn.disabled = false;
});

$('subClearBtn')?.addEventListener('click', async () => {
  await br.storage.local.remove(KEYS.subSrt);
  const s = $('subStatus');
  if (s) s.textContent = '字幕已移除。使用自己的 .srt / .vtt：点击视频上的 CC';
});

$('subLangSelect')?.addEventListener('change', async () => {
  await br.storage.local.set({ [KEYS.subLang]: $('subLangSelect').value });
});

// -- Action bar --
$('settingsBtn').addEventListener('click', () => br.tabs.create({ url: br.runtime.getURL('options.html') }));
$('historyBtn').addEventListener('click', () => br.tabs.create({ url: br.runtime.getURL('options.html') + '#history' }));
$('statsBtn').addEventListener('click', () => br.tabs.create({ url: br.runtime.getURL('options.html') + '#stats' }));
// Sources and logins live in Settings (1.13 5S); the accent colour moved to Settings > Customise.
$('sourcesLink')?.addEventListener('click', (e) => { e.preventDefault(); br.tabs.create({ url: br.runtime.getURL('options.html') + '#sources' }); });

// -- Live stats --
br.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[KEYS.stats]) return;
  br.storage.local.get([KEYS.stats]).then(d => applyStats(d)).catch(() => {});
});

// -- Init --
detectDomain();
loadState();

// ── Easter egg: 5-click version badge ──────────────────────────────────────────
(() => {
  let clickCount = 0;
  let lastClickTime = 0;
  let easterEggTriggered = false;
  const vBadge = $('versionBadge');
  if (!vBadge) return;
  
  vBadge.style.cursor = 'pointer';
  vBadge.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastClickTime > 1000) clickCount = 0; // Reset if >1sec between clicks
    clickCount++;
    lastClickTime = now;
    
    if (clickCount === 5 && !easterEggTriggered) {
      easterEggTriggered = true;
      clickCount = 0;
      br.storage.local.get('skipstream_stats').then(s => {
        const st = s.skipstream_stats || {};
        const lines = [
          '一个人和一屋子被跳过的片头做出来的。',
          '提示：在视频上右键点击 CC 可校正字幕时间，按剧集分别记住。',
          '提示：Alt+→ 立即跳过当前片段，Alt+Z 后退 15 秒。',
          '小声说：在这里和设置页都能用科乐美秘技。',
        ];
        if (st.skipsTotal) lines.push('到目前为止已跳过 ' + st.skipsTotal + ' 次。片头作曲者永远不会知道。');
        if (st.timeSavedSec >= 600) lines.push('已节省 ' + Math.round(st.timeSavedSec / 60) + ' 分钟，分一点时间去外面走走吧。');
        const overlay = document.createElement('div');
        overlay.className = 'easter-egg-overlay';
        overlay.textContent = lines[Math.floor(Math.random() * lines.length)];
        document.body.appendChild(overlay);
        setTimeout(() => { overlay.remove(); easterEggTriggered = false; }, 3800);
      }).catch(() => { easterEggTriggered = false; });
    }
  });
})();

// -- Theme color picker --
(() => {
  const picker = document.getElementById('seedColorPicker');
  if (!picker) return;
  const br2 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;

  br2.storage.local.get([KEYS.seedColor]).then(data => {
    if (data[KEYS.seedColor]) picker.value = data[KEYS.seedColor];
  }).catch(() => {});

  picker.addEventListener('input', () => {
    currentSeedHex = picker.value;
    br2.storage.local.set({ [KEYS.seedColor]: picker.value });
    if (window.applyThemeFromSeed) applyThemeFromSeed(picker.value, currentTheme);
  });

  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const color = dot.dataset.color;
      picker.value = color;
      currentSeedHex = color;
      br2.storage.local.set({ [KEYS.seedColor]: color });
      if (window.applyThemeFromSeed) applyThemeFromSeed(color, currentTheme);
    });
  });
})();
