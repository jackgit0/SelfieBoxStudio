// Tes akun admin di database: hash, paksa ganti password bawaan, kunci akun, cabut sesi, reset lewat CLI
const { spawn, execFileSync } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), fs = require('fs');
const PORT = 3928, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia4-')), DB = path.join(TMP, 't.db'), B = `http://localhost:${PORT}/api`;
const env = { ...process.env, AUTH_RATE_LIMIT: '1000', PORT, DB_FILE: DB, UPLOAD_DIR: path.join(TMP, 'up'), MEDIA_DIR: path.join(TMP, 'm') }; delete env.ADMIN_PASS; delete env.ADMIN_USER;
const srv = spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: __dirname, env });
const call = async (m, p, body, tok) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const wait = ms => new Promise(r => setTimeout(r, ms)), login = (u, p) => call('POST', '/admin/login', { username: u, password: p });
(async () => { await wait(1200); let n = 0; const ok = (c, m) => { assert(c, m); console.log('✔', m); n++; };
  const raw = fs.readFileSync(DB).toString('latin1'); ok(!raw.includes('admin123'), 'password admin tidak tersimpan sebagai teks biasa di database');
  const { DatabaseSync } = require('node:sqlite'), row = new DatabaseSync(DB).prepare('SELECT * FROM admin').get(); ok(row.username === 'adminstudio' && /^[0-9a-f]{32}:[0-9a-f]{64}$/.test(row.password) && row.must_change === 1, 'akun admin ada di tabel admin (hash scrypt + salt)');
  ok((await login('adminstudio', 'salah')).s === 401 && (await login('tidakada', 'admin123')).s === 401 && (await login('tidakada', 'admin123')).j.error === (await login('adminstudio', 'salah')).j.error, 'login salah: pesan sama untuk username salah & password salah');
  const l = (await login('adminstudio', 'admin123')).j; ok(l.token && l.admin.must_change === true, 'login dengan password bawaan -> wajib ganti password'); const T = l.token;
  ok((await call('GET', '/admin/customers', null, T)).s === 403 && (await call('GET', '/admin/revenue', null, T)).s === 403, 'fitur admin diblokir selama password masih bawaan'); ok((await call('GET', '/admin/me', null, T)).j.must_change === true, 'endpoint /admin/me tetap dapat dibuka');
  ok((await call('PATCH', '/admin/account', { current_password: 'salah', new_password: 'KataSandi99' }, T)).s === 403, 'ganti password butuh password saat ini yang benar');
  ok((await call('PATCH', '/admin/account', { current_password: 'admin123', new_password: 'pendek1' }, T)).s === 400 && (await call('PATCH', '/admin/account', { current_password: 'admin123', new_password: 'hurufsajaa' }, T)).s === 400 && (await call('PATCH', '/admin/account', { current_password: 'admin123', new_password: 'admin123' }, T)).s === 400, 'password baru lemah ditolak (pendek / tanpa angka / sama dengan bawaan)');
  await wait(1100); const ch = (await call('PATCH', '/admin/account', { current_password: 'admin123', username: 'pemilik.studio', new_password: 'Rahasia2026x' }, T)).j; ok(ch.ok && ch.token && ch.username === 'pemilik.studio', 'username & password diganti'); const T2 = ch.token;
  ok((await call('GET', '/admin/customers', null, T)).s === 401, 'sesi admin lama dicabut setelah ganti password'); ok((await call('GET', '/admin/customers', null, T2)).s === 200, 'token baru langsung bisa dipakai & fitur admin terbuka');
  ok((await login('adminstudio', 'admin123')).s === 401 && (await login('pemilik.studio', 'admin123')).s === 401 && (await login('pemilik.studio', 'Rahasia2026x')).s === 200, 'akun/password lama tidak berlaku, yang baru berlaku');
  ok(new DatabaseSync(DB).prepare('SELECT must_change FROM admin').get().must_change === 0, 'status wajib-ganti dibersihkan');
  // kunci akun: 5x salah
  for (let i = 0; i < 5; i++) await login('pemilik.studio', 'tebakan' + i); const lk = await login('pemilik.studio', 'Rahasia2026x'); ok(lk.s === 429 && /terkunci/.test(lk.j.error), 'akun terkunci 15 menit setelah 5x salah (password benar pun ditolak)');
  // reset lewat CLI
  const out = execFileSync('node', ['--disable-warning=ExperimentalWarning', 'reset-admin.js', 'pemilik.studio', 'ResetBaru2026'], { cwd: __dirname, env }).toString(); ok(/diperbarui/.test(out), 'reset-admin.js memperbarui password langsung di database');
  const l3 = await login('pemilik.studio', 'ResetBaru2026'); ok(l3.s === 200 && (await call('GET', '/admin/customers', null, T2)).s === 401 && (await call('GET', '/admin/customers', null, l3.j.token)).s === 200, 'reset membuka kunci akun, mencabut sesi lama, login baru berhasil');
  // formulir Contact Us (homepage): validasi + pesan terkirim (mode dev: disimpan ke outbox)
  ok((await call('POST', '/contact', { name: '', email: 'x', message: 'hi' })).s === 400, 'formulir kontak: data tidak valid ditolak');
  const ct = await call('POST', '/contact', { name: 'Budi', email: 'budi@x.id', message: 'Apakah studio buka hari Minggu?' }); ok(ct.s === 200 && /Terima kasih/.test(ct.j.message), 'formulir kontak: pesan diterima & diteruskan lewat email');
  const ob = path.join(__dirname, 'outbox'); ok(fs.existsSync(ob) && fs.readdirSync(ob).some(f => fs.readFileSync(path.join(ob, f), 'latin1').includes('Reply-To: budi@x.id')), 'email kontak memuat Reply-To ke pengirim');
  console.log(`\n${n} tes lulus`); srv.kill(); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); srv.kill(); process.exit(1); });
