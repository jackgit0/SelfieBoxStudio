// Tes lingkup IMK (Kelompok 6): tanpa onboarding (rekomendasi paket/preferensi), dst. per fase rencana imk/dev/imk-code-plan.
// Jalankan: node --disable-warning=ExperimentalWarning test-imk.js
const { spawn } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const PORT = 3960, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia-imk-'));
const DB = k => path.join(TMP, k + '.db');
const start = (k, extra = {}) => { const p = spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: __dirname, env: { ...process.env, PORT, DB_FILE: DB(k), UPLOAD_DIR: path.join(TMP, k + '-up'), MEDIA_DIR: path.join(TMP, k + '-media'), ADMIN_PASS: 'Admin#12345', AUTH_RATE_LIMIT: '1000', SMTP_HOST: '', ...extra } });
  p.stderr.on('data', d => process.stderr.write(d)); return p; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const up = async () => { for (let i = 0; i < 60; i++) { try { await fetch(`http://localhost:${PORT}/api/master`); return; } catch (e) { await wait(100); } } throw new Error('server tidak menyala'); };
const down = p => new Promise(r => { if (p.exitCode !== null) return r(); p.once('exit', r); p.kill(); });
const call = async (m, p, body, tok) => { const r = await fetch(`http://localhost:${PORT}/api` + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
const file = async p => (await fetch(`http://localhost:${PORT}` + p)).text();
const tables = k => { const D = new DatabaseSync(DB(k)); const t = D.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name); D.close(); return t; };
let srv = null;
(async () => { let n = 0; const ok = (c, m) => { assert(c, m); console.log('✔', m); n++; };

  // ===== Fase 1: onboarding (rekomendasi paket, preferensi) dihapus =====
  srv = start('a'); await up();
  const tok = (await call('POST', '/auth/register', { name: 'Ana', email: 'ana@x.id', phone: '0811111111', password: 'secret1' })).j.token; ok(tok, 'fixture: customer terdaftar');
  for (const m of ['GET', 'PUT']) { const r = await call(m, '/preferences', m === 'PUT' ? { people: 1, budget: 100000, vibe: 1 } : null, tok); ok(r.s === 404 && r.j.error === 'Endpoint tidak ada', `${m} /api/preferences sudah tidak ada (404)`); }
  { const t = tables('a'); ok(!t.includes('schedule_preference') && !t.includes('setup_preference'), 'database baru tanpa tabel schedule_preference / setup_preference'); }
  { const cj = await file('/js/customer.js'), core = await file('/js/core.js'), ses = await file('/js/session.js'), css = await file('/css/style.css');
    for (const s of ['Preferensi', 'rec-banner', 'recPkg', 'recommend(', 'Rekomendasi untuk kamu', 'Dapatkan rekomendasi paket', 'savePref', 'PURPOSES', 'quiz']) ok(!cj.includes(s), `customer.js tanpa "${s}"`);
    ok(!core.includes('/preferences'), 'core.js tidak memanggil /preferences'); ok(!/quiz:\s*null/.test(core), 'state awal di core.js tanpa quiz');
    ok(!ses.includes('S.quiz'), 'session.js tidak membaca S.quiz'); ok(!css.includes('.rec-banner') && !css.includes('.pk.rec'), 'CSS tanpa .rec-banner / .pk.rec'); }
  await down(srv);

  // migrasi database lama: tambahkan kembali tabel preferensi + isinya, hapus flag, lalu nyalakan server
  { const D = new DatabaseSync(DB('a'));
    D.exec(`CREATE TABLE IF NOT EXISTS schedule_preference(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER REFERENCES user(id),people INTEGER,budget INTEGER,schedule TEXT);
CREATE TABLE IF NOT EXISTS setup_preference(user_id INTEGER PRIMARY KEY REFERENCES user(id),vibe INTEGER,property TEXT);`);
    const uid = D.prepare("SELECT id FROM user WHERE email='ana@x.id'").get().id;
    D.prepare('INSERT INTO schedule_preference(user_id,people,budget) VALUES(?,?,?)').run(uid, 1, 150000); D.prepare('INSERT INTO setup_preference(user_id,vibe) VALUES(?,?)').run(uid, 2);
    D.prepare("INSERT INTO booking(user_id,package_id,status,amount,created_at) VALUES(?,1,'Selesai',90000,?)").run(uid, Date.now());
    D.prepare("DELETE FROM setting WHERE key='drop_onboarding_v1'").run(); D.close(); }
  ok(tables('a').includes('schedule_preference'), 'fixture: database lama punya tabel preferensi berisi data');
  for (const round of [1, 2]) {
    srv = start('a'); await up(); await down(srv);
    const t = tables('a'), D = new DatabaseSync(DB('a'));
    ok(!t.includes('schedule_preference') && !t.includes('setup_preference'), `migrasi (start ke-${round}): tabel preferensi terhapus`);
    ok(D.prepare("SELECT 1 FROM setting WHERE key='drop_onboarding_v1'").get(), `migrasi (start ke-${round}): flag drop_onboarding_v1 tercatat`);
    ok(D.prepare("SELECT COUNT(*) c FROM user WHERE email='ana@x.id'").get().c === 1 && D.prepare("SELECT COUNT(*) c FROM booking WHERE amount=90000").get().c === 1, `migrasi (start ke-${round}): user dan booking tetap utuh`);
    D.close();
  }
  srv = start('a'); await up();
  ok((await call('POST', '/auth/login', { email: 'ana@x.id', password: 'secret1' })).j.token, 'setelah migrasi: customer tetap bisa masuk');
  await down(srv);

  console.log(`\n${n} tes lulus`); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(async e => { console.error('✘ GAGAL:', e.message); if (srv) await down(srv); process.exit(1); });
