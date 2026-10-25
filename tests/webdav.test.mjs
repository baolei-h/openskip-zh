// WebDAV sync: merge rules and status, tested against the real background.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBackground } from './harness.mjs';

const bgWith = (storage = {}) => loadBackground({ storage, fetchImpl: () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }) });

const entry = (t, p = 100) => ({ p, d: 2400, t, url: 'https://x/y', title: 'T', site: 'x', site_name: 'X', device: 'A' });

test('webdav merge: newer position wins per video, in both directions', async () => {
  const bg = bgWith({ skipstream_cache: { 'a': entry(100), 'b': entry(300) }, wd_settings_at: 5 });
  const local = await bg.ctx.wdLocalSnapshot();
  const remote = {
    v: 1, settings_at: 0, settings: { prefs: {}, site_rules: {}, theme: null },
    history: { 'a': entry(200, 555), 'b': entry(100), 'c': entry(50, 42) },
  };
  const { merged } = bg.ctx.wdMerge(local, remote);
  assert.equal(merged.history['a'].p, 555, 'remote is newer for a');
  assert.equal(merged.history['b'].p, 100, 'local is newer for b');
  assert.equal(merged.history['b'].t, 300);
  assert.equal(merged.history['c'].p, 42, 'a video only the other device knows is kept');
  assert.equal(Object.keys(merged.history).length, 3);
});

test('webdav merge: settings come from the device that edited them last', async () => {
  const bg = bgWith({ skipstream_cache: {}, wd_settings_at: 900, skipMode: 'auto-all' });
  const local = await bg.ctx.wdLocalSnapshot();
  const older = { v: 1, settings_at: 100, settings: { prefs: { skipMode: 'off' }, site_rules: { 'a.com': 'off' }, theme: 'light' }, history: {} };
  let out = bg.ctx.wdMerge(local, older).merged;
  assert.equal(out.settings.prefs.skipMode, 'auto-all', 'an older remote must not overwrite local');
  assert.equal(out.settings_at, 900);

  const newer = { v: 1, settings_at: 1000, settings: { prefs: { skipMode: 'off' }, site_rules: { 'a.com': 'off' }, theme: 'light' }, history: {} };
  out = bg.ctx.wdMerge(local, newer).merged;
  assert.equal(out.settings.prefs.skipMode, 'off', 'a newer remote is applied');
  assert.equal(out.settings.theme, 'light');
  assert.equal(out.settings_at, 1000);
});

test('webdav merge: history stays at 300 entries, newest kept', async () => {
  const cache = {};
  for (let i = 0; i < 320; i++) cache['v' + i] = entry(i);
  const bg = bgWith({ skipstream_cache: cache, wd_settings_at: 1 });
  const local = await bg.ctx.wdLocalSnapshot();
  const { merged } = bg.ctx.wdMerge(local, { v: 1, settings_at: 0, settings: { prefs: {} }, history: {} });
  const ids = Object.keys(merged.history);
  assert.equal(ids.length, 300);
  assert.ok(ids.includes('v319'), 'the newest entry stays');
  assert.equal(ids.includes('v0'), false, 'the oldest entry is dropped');
});

test('webdav status: not configured is reported without touching the network', async () => {
  const bg = bgWith({});
  const r = await bg.send({ type: 'WD_STATUS' });
  assert.equal(r.ok, true);
  assert.equal(r.configured, false);
  assert.equal(bg.calls.length, 0);
});

test('webdav sync: first run creates the folder, writes the file, and keeps both devices', async () => {
  const files = {};
  const seen = [];
  const bg = loadBackground({
    storage: {
      wdUrl: 'https://dav.jianguoyun.com/dav', wdUser: 'me@example.com', wdPass: 'app-pass',
      wd_settings_at: 500, skipMode: 'auto-all',
      skipstream_cache: { 'local/1': entry(600, 120) },
    },
    fetchImpl: (url, opts = {}) => {
      seen.push({ url, method: opts.method, auth: opts.headers && opts.headers.Authorization, body: opts.body });
      if (opts.method === 'MKCOL') return { ok: true, status: 201, text: async () => '' };
      if (opts.method === 'PUT') { files[url] = opts.body; return { ok: true, status: 201, text: async () => '' }; }
      if (files[url]) return { ok: true, status: 200, text: async () => files[url] };
      return { ok: false, status: 404, text: async () => '' };
    },
  });
  const r = await bg.send({ type: 'WD_SYNC_NOW' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.count, 1);
  const put = seen.find((c) => c.method === 'PUT');
  assert.ok(put && put.url.endsWith('/skipstream/sync.json'), 'writes the one file');
  assert.match(put.auth, /^Basic /);
  const payload = JSON.parse(put.body);
  assert.equal(payload.history['local/1'].p, 120);
  assert.equal(payload.settings.prefs.skipMode, 'auto-all');
  assert.equal(bg.storage.wd_state.error, '');
  assert.ok(bg.storage.wd_state.at > 0);

  // Second run reads the file back and keeps the newer side per video.
  files[put.url] = JSON.stringify({
    v: 1, settings_at: 100, settings: { prefs: { skipMode: 'off' } },
    history: { 'local/1': entry(700, 999), 'other/2': entry(800, 30) },
  });
  const r2 = await bg.send({ type: 'WD_SYNC_NOW' });
  assert.equal(r2.ok, true);
  assert.equal(r2.count, 2);
  assert.equal(bg.storage.skipstream_cache['local/1'].p, 999, 'the newer remote position wins');
  assert.equal(bg.storage.skipstream_cache['other/2'].p, 30);
  assert.equal(bg.storage.skipMode, 'auto-all', 'an older remote setting does not overwrite local');
});

test('webdav sync: a bad password surfaces as an error, never as ok', async () => {
  const bg = loadBackground({
    storage: { wdUrl: 'https://dav.jianguoyun.com/dav', wdUser: 'me@example.com', wdPass: 'bad' },
    fetchImpl: () => ({ ok: false, status: 401, text: async () => '' }),
  });
  const r = await bg.send({ type: 'WD_SYNC_NOW' });
  assert.equal(r.ok, false);
  assert.match(r.err, /账号|密码/);
  assert.match(String(bg.storage.wd_state.error), /账号|密码/);
});
