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
const down = p => new Promise(r => { if (p.exitCode !== null || p.signalCode !== null) return r(); p.once('exit', r); p.kill(); }); // sudah berhenti (keluar sendiri atau dibunuh sinyal): langsung selesai, agar cek yang gagal tetap keluar dengan kode 1
const call = async (m, p, body, tok) => { const r = await fetch(`http://localhost:${PORT}/api` + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
const file = async p => (await fetch(`http://localhost:${PORT}` + p)).text();
// sumber frontend dibaca dari disk: cek teks memindai semua berkas (allJs/allCss) agar tidak bergantung pada letak kode; src() = satu berkas untuk cek bentuk kode (test-map.md)
const FRONT = path.join(__dirname, '..', 'frontend');
const readAll = (dir, ext) => fs.readdirSync(path.join(FRONT, dir), { recursive: true }).filter(f => f.endsWith(ext)).sort().map(f => fs.readFileSync(path.join(FRONT, dir, f), 'utf8')).join('\n');
const allJs = () => readAll('js', '.js'), allCss = () => readAll('css', '.css'), src = rel => fs.readFileSync(path.join(FRONT, rel), 'utf8');
// gradient di JS = gaya UI; create*Gradient milik canvas tidak dihitung di cek lama ini (sejak fase 7 foto simulasi sesi foto pun datar, dicek ketat di blok fase 7)
const uiGradient = js => /gradient/i.test(js.replace(/\.create(Linear|Radial|Conic)Gradient\(/g, ''));
const tables = k => { const D = new DatabaseSync(DB(k)); const t = D.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name); D.close(); return t; };
let srv = null;
(async () => { let n = 0; const ok = (c, m) => { assert(c, m); console.log('✔', m); n++; };

  // ===== Fase 1: onboarding (rekomendasi paket, preferensi) dihapus =====
  srv = start('a'); await up();
  const tok = (await call('POST', '/auth/register', { name: 'Ana', email: 'ana@x.id', phone: '0811111111', password: 'secret1' })).j.token; ok(tok, 'fixture: customer terdaftar');
  for (const m of ['GET', 'PUT']) { const r = await call(m, '/preferences', m === 'PUT' ? { people: 1, budget: 100000, vibe: 1 } : null, tok); ok(r.s === 404 && r.j.error === 'Endpoint tidak ada', `${m} /api/preferences sudah tidak ada (404)`); }
  { const t = tables('a'); ok(!t.includes('schedule_preference') && !t.includes('setup_preference'), 'database baru tanpa tabel schedule_preference / setup_preference'); }
  { const JS = allJs(), CSS = allCss();
    for (const s of ['Preferensi', 'rec-banner', 'recPkg', 'recommend(', 'Rekomendasi untuk kamu', 'Dapatkan rekomendasi paket', 'savePref', 'PURPOSES']) ok(!JS.includes(s), `frontend tanpa "${s}"`);
    ok(!JS.includes('/preferences'), 'frontend tidak memanggil /preferences'); // state awal tanpa quiz/setup dan pembersihan state lama: frontend/tests/core/store.test.js (refactor MVC fase 2)
    ok(!CSS.includes('.rec-banner') && !CSS.includes('.pk.rec'), 'CSS tanpa .rec-banner / .pk.rec'); }
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

  // ===== Fase 2: properti hanya tampilan, tanpa add-on dan kode promo =====
  const cols = (k, t) => { const D = new DatabaseSync(DB(k)); const c = D.prepare(`PRAGMA table_info(${t})`).all().map(r => r.name); D.close(); return c; };
  const dayAhead = d => new Date(Date.now() + 7 * 3600e3 + d * 864e5).toISOString().slice(0, 10);
  srv = start('b'); await up();
  { const U = (await call('POST', '/auth/register', { name: 'Bima', email: 'bima@x.id', phone: '0812222222', password: 'secret1' })).j.token;
    const AD = (await call('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' })).j.token; ok(U && AD, 'fixture: customer dan admin masuk');
    ok((await call('PATCH', '/admin/studios/1', { price: 20000 }, AD)).s === 200 && (await call('PUT', '/admin/discount', { pct: 10, label: 'Uji' }, AD)).s === 200, 'fixture: biaya studio 20.000 dan diskon utama 10%');
    // 1. harga = biaya studio + paket - diskon utama; setup/kode promo di body diabaikan
    const extra = { setup: { vibe: 1, bg: 2, acc: [3] }, code: 'NGAWUR', promo_code: 'NGAWUR' };
    const q = await call('POST', '/quote', { package_id: 2, studio_id: 1 }, U), qx = await call('POST', '/quote', { package_id: 2, studio_id: 1, ...extra }, U);
    ok(q.s === 200 && q.j.studio_fee === 20000 && q.j.mainDisc === 9000 && q.j.subtotal === 110000 && q.j.total === 101000, 'quote: studio 20.000 + paket 90.000 - diskon 9.000 = 101.000');
    ok(qx.s === 200 && qx.j.total === q.j.total, 'quote: setup dan kode promo di body diabaikan (tanpa error, tanpa efek)');
    for (const k of ['add', 'promoDisc', 'promo_code', 'json']) ok(!(k in q.j), `quote tanpa field "${k}"`);
    const slot = dayAhead(10) + ' 10:00', b = await call('POST', '/bookings', { package_id: 2, studio_id: 1, date: slot, ...extra }, U);
    ok(b.s === 200 && b.j.amount === 101000 && b.j.subtotal === 110000 && b.j.main_disc === 9000 && b.j.studio_fee === 20000, 'booking: total = studio + paket - diskon utama (setup/promo diabaikan)');
    for (const k of ['setup', 'promo_code', 'promo_disc']) ok(!(k in b.j), `booking tanpa field "${k}"`);
    const pd = await call('POST', `/bookings/${b.j.id}/pay`, { method: 'QRIS' }, U); ok(pd.s === 200 && pd.j.status === 'Terbayar' && pd.j.amount === 101000, 'booking dibayar dengan total yang sama');
    const inv = await fetch(`http://localhost:${PORT}/api/bookings/${b.j.id}/invoice?t=${U}`).then(r => r.text());
    ok(inv.includes('TOTAL') && inv.includes('Rp101.000') && inv.includes('Paket Standard') && !/Add-on|Kode promo/.test(inv), 'invoice: tanpa baris add-on dan kode promo');
    const dt = (await call('GET', `/admin/bookings/${b.j.id}`, null, AD)).j; ok(dt.id === b.j.id && dt.items_price === 90000 && !('add_ons' in dt) && !('promo_code' in dt) && !('promo_disc' in dt), 'detail booking admin: tanpa add_ons dan promo');
    const hist = (await call('GET', `/admin/customers/${b.j.user_id}/bookings`, null, AD)).j.bookings; ok(hist.length === 1 && !('promo_code' in hist[0]) && !('promo_disc' in hist[0]), 'riwayat pembelian admin: tanpa kolom promo');
    const rs = await call('PATCH', `/bookings/${b.j.id}`, { studio_id: 1, date: dayAhead(11) + ' 13:00' }, U), after = (await call('GET', '/bookings', null, U)).j.find(x => x.id === b.j.id);
    ok(rs.s === 200 && after.date === dayAhead(11) + ' 13:00' && after.amount === 101000, 'reschedule tetap jalan dan total tersimpan tidak berubah');
    // ubah paket oleh admin pada booking belum dibayar: dihitung ulang dengan rumus baru (keputusan 30)
    const b2 = (await call('POST', '/bookings', { package_id: 1, studio_id: 1, date: dayAhead(12) + ' 9:00' }, U)).j; ok(b2.amount === 20000 + 45000, 'fixture: booking belum dibayar paket Basic (20.000 + 45.000)');
    const e2 = await call('PATCH', `/admin/bookings/${b2.id}`, { package_id: 2 }, AD); ok(e2.s === 200 && e2.j.amount === 101000 && e2.j.payment.amount === 101000 && e2.j.subtotal === 110000, 'admin ubah paket: total dihitung ulang studio + paket - diskon');
    // 2. API promo dan vibe hilang; properti tanpa harga/vibe/used_count
    for (const m of ['GET', 'POST']) { const r = await call(m, '/admin/promos', m === 'POST' ? { code: 'HEMAT', kind: 'nominal', value: 5000 } : null, AD); ok(r.s === 404 && r.j.error === 'Endpoint tidak ada', `${m} /api/admin/promos sudah tidak ada (404)`); }
    ok((await call('DELETE', '/admin/promos/1', null, AD)).s === 404, 'DELETE /api/admin/promos/:id sudah tidak ada (404)');
    const m = (await call('GET', '/master')).j; ok(!('VIBES' in m) && m.PROP.length > 0 && m.PROP.every(p => !('price' in p) && !('vibe_id' in p) && 'qty' in p && 'category' in p), '/api/master tanpa VIBES; properti tanpa price/vibe_id');
    const np = await call('POST', '/admin/properties', { name: 'Kalung Mutiara', category: 'Kalung', qty: 3, price: 7000 }, AD); ok(np.s === 200 && np.j.id, 'admin menambah properti tanpa harga (field price diabaikan)');
    const ap = (await call('GET', '/admin/properties', null, AD)).j; ok(ap.some(p => p.id === np.j.id && p.qty === 3) && ap.every(p => !('price' in p) && !('used_count' in p) && !('vibe_id' in p)), '/api/admin/properties tanpa price/used_count/vibe_id');
    ok((await call('PATCH', `/admin/properties/${np.j.id}`, { qty: 0 }, AD)).s === 200 && (await call('GET', '/master')).j.PROP.find(p => p.id === np.j.id).qty === 0, 'admin mengubah qty properti (0 = habis)');
    // 5. frontend
    const JS = allJs(), CSS = allCss();
    for (const s of ['Pratinjau Setup', 'togProp', 'setupItems', 'previewHTML', 'Add-on setup', 'add-on', 'applyPromo', 'promoCode', 'Kode promo', 'linear-gradient', 'setup:', 'klik untuk menambahkan']) ok(!JS.includes(s), `frontend tanpa "${s}" (sisi pelanggan)`);
    ok(JS.includes('Background dan aksesori yang tersedia di studio ini.'), 'frontend: subjudul Properti baru');
    for (const s of ['promoAdd', 'promoToggle', 'promoDel', '/admin/promos', 'add_ons', 'Kode promo', 'Harga add-on', 'add-on', 'promo_disc']) ok(!JS.includes(s), `frontend tanpa "${s}" (sisi admin)`);
    for (const s of ['previewHTML', 'setupItems']) ok(!JS.includes(s), `frontend tanpa "${s}" (sesi foto)`);
    ok(JS.includes('Background dan properti tersedia di studio'), 'frontend: kartu Background & Properti sesi foto berisi satu kalimat statis');
    for (const s of ['promoCode', 'VIBES']) ok(!JS.includes(s), `frontend tanpa "${s}" (inti)`); ok(!JS.includes('VIBES'), 'frontend tanpa VIBES (boot)');
    ok(!/kode promo/i.test(JS), 'frontend tanpa sebutan kode promo (landing)');
    for (const s of ['.pchk', '.pv{', '.prop.on']) ok(!CSS.includes(s), `CSS tanpa "${s}"`); }
  await down(srv);
  // 3. skema database baru
  { const t = tables('b'), bc = cols('b', 'booking'), pc = cols('b', 'property');
    ok(!t.includes('promo') && !t.includes('vibe'), 'database baru tanpa tabel promo / vibe');
    ok(!['promo_code', 'promo_disc', 'setup_json'].some(c => bc.includes(c)), 'tabel booking tanpa promo_code / promo_disc / setup_json');
    ok(!['price', 'vibe_id', 'used_count'].some(c => pc.includes(c)) && ['name', 'type', 'category', 'qty', 'img', 'extra'].every(c => pc.includes(c)), 'tabel property tanpa price / vibe_id / used_count, kolom lain tetap'); }

  // 4. migrasi database lama: kembalikan skema lama (tabel promo/vibe, kolom add-on/promo, property dengan FK ke vibe), hapus flag, nyalakan server dua kali
  { const D = new DatabaseSync(DB('b'));
    D.exec(`CREATE TABLE vibe(id INTEGER PRIMARY KEY,name TEXT); INSERT INTO vibe(id,name) VALUES(1,'Classic'),(2,'Retro');
CREATE TABLE promo(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,value INTEGER NOT NULL,active INTEGER DEFAULT 1,max_uses INTEGER DEFAULT 0,used_count INTEGER DEFAULT 0,expires_at INTEGER);
INSERT INTO promo(code,kind,value,used_count) VALUES('HEMAT10','percent',10,1);
CREATE TABLE property_old(id INTEGER PRIMARY KEY,name TEXT,type TEXT,img_url TEXT,vibe_id INTEGER REFERENCES vibe(id),price INTEGER DEFAULT 0,used_count INTEGER DEFAULT 0,extra TEXT,category TEXT,qty INTEGER DEFAULT 1,img TEXT);
INSERT INTO property_old(id,name,type,img_url,vibe_id,price,used_count,extra,category,qty,img) SELECT id,name,type,img_url,1,5000,2,extra,category,qty,img FROM property;
DROP TABLE property; ALTER TABLE property_old RENAME TO property;
ALTER TABLE booking ADD COLUMN setup_json TEXT; ALTER TABLE booking ADD COLUMN promo_disc INTEGER DEFAULT 0; ALTER TABLE booking ADD COLUMN promo_code TEXT;`);
    D.prepare("UPDATE booking SET setup_json='{\"vibe\":1,\"bg\":2,\"acc\":[3]}',promo_code='HEMAT10',promo_disc=10100 WHERE amount=101000").run();
    D.prepare("DELETE FROM setting WHERE key='drop_addons_promo_v1'").run(); D.close(); }
  const before = (() => { const D = new DatabaseSync(DB('b')); const r = { props: D.prepare('SELECT id,name,type,category,qty,img,extra FROM property ORDER BY id').all(), books: D.prepare('SELECT id,amount,subtotal,main_disc,studio_fee FROM booking ORDER BY id').all(), pays: D.prepare('SELECT booking_id,amount,status FROM payment ORDER BY id').all() }; D.close(); return JSON.stringify(r); })();
  ok(tables('b').includes('promo') && cols('b', 'property').includes('vibe_id') && cols('b', 'booking').includes('setup_json'), 'fixture: database lama punya tabel promo/vibe dan kolom add-on/promo');
  for (const round of [1, 2]) {
    srv = start('b'); await up(); await down(srv);
    const t = tables('b'), bc = cols('b', 'booking'), pc = cols('b', 'property'), D = new DatabaseSync(DB('b'));
    ok(!t.includes('promo') && !t.includes('vibe') && !['promo_code', 'promo_disc', 'setup_json'].some(c => bc.includes(c)) && !['price', 'vibe_id', 'used_count'].some(c => pc.includes(c)), `migrasi (start ke-${round}): tabel dan kolom add-on/promo terhapus`);
    ok(D.prepare("SELECT 1 FROM setting WHERE key='drop_addons_promo_v1'").get(), `migrasi (start ke-${round}): flag drop_addons_promo_v1 tercatat`);
    const now = JSON.stringify({ props: D.prepare('SELECT id,name,type,category,qty,img,extra FROM property ORDER BY id').all(), books: D.prepare('SELECT id,amount,subtotal,main_disc,studio_fee FROM booking ORDER BY id').all(), pays: D.prepare('SELECT booking_id,amount,status FROM payment ORDER BY id').all() });
    ok(now === before, `migrasi (start ke-${round}): properti (id sama), total booking, dan pembayaran tidak berubah`);
    ok(D.prepare('PRAGMA foreign_key_check').all().length === 0 && D.prepare("SELECT sql FROM sqlite_master WHERE name='property'").get().sql.indexOf('vibe') < 0, `migrasi (start ke-${round}): tanpa pelanggaran foreign key, property tanpa referensi vibe`);
    D.close();
  }
  srv = start('b'); await up();
  { const U = (await call('POST', '/auth/login', { email: 'bima@x.id', password: 'secret1' })).j.token, bs = (await call('GET', '/bookings', null, U)).j;
    ok(bs.some(x => x.amount === 101000 && x.status === 'Terbayar'), 'setelah migrasi: booking lama tetap terbaca dengan total yang sama');
    ok((await call('POST', '/bookings', { package_id: 1, studio_id: 2, date: dayAhead(13) + ' 15:00' }, U)).s === 200, 'setelah migrasi: booking baru bisa dibuat'); }
  await down(srv);

  // ===== Fase 3: halaman Pilihan Paket + popup Paket Foto Tidak Ditemukan =====
  srv = start('c'); await up();
  { const U = (await call('POST', '/auth/register', { name: 'Citra', email: 'citra@x.id', phone: '0813333333', password: 'secret1' })).j.token;
    const AD = (await call('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' })).j.token; ok(U && AD, 'fixture fase 3: customer dan admin masuk');
    const fav = async () => (await call('GET', '/master')).j.FAV_PKG;
    const book = async (pkg, d, h, pay = true) => { const b = (await call('POST', '/bookings', { package_id: pkg, studio_id: 1, date: dayAhead(d) + ` ${h}:00` }, U)).j; assert(b.id, 'booking gagal: ' + JSON.stringify(b)); if (pay) assert((await call('POST', `/bookings/${b.id}/pay`, { method: 'QRIS' }, U)).s === 200); return b; };
    // 4. FAV_PKG = paket aktif dengan booking terbayar terbanyak; null bila seri atau belum ada (keputusan 32)
    ok('FAV_PKG' in (await call('GET', '/master')).j && await fav() === null, 'FAV_PKG null saat belum ada booking terbayar');
    await book(3, 5, 9, false); ok(await fav() === null, 'FAV_PKG tetap null: booking belum dibayar tidak dihitung');
    await book(3, 5, 10); ok(await fav() === 3, 'FAV_PKG = paket dengan satu-satunya booking terbayar');
    await book(2, 5, 11); ok(await fav() === null, 'FAV_PKG null saat dua paket seri');
    const b2 = await book(2, 5, 12); ok(await fav() === 2, 'FAV_PKG = paket dengan booking terbayar terbanyak');
    ok((await call('POST', `/bookings/${b2.id}/cancel`, { reason: 'Tidak ada waktu' }, U)).s === 200 && await fav() === null, 'booking yang dibatalkan tidak dihitung (kembali seri)');
    await book(2, 6, 9); ok(await fav() === 2, 'fixture: paket 2 kembali terfavorit');
    // 3. paket yang dinonaktifkan/dihapus admin hilang dari PKG (data yang dipakai popup)
    ok((await call('PATCH', '/admin/packages/2', { active: 0 }, AD)).s === 200, 'admin menonaktifkan paket 2');
    const m = (await call('GET', '/master')).j; ok(!m.PKG.some(p => p.id === 2) && m.ALLPKG.some(p => p.id === 2), 'paket nonaktif tidak ada di PKG, tetap ada di ALLPKG');
    ok(m.FAV_PKG === 3, 'FAV_PKG hanya menghitung paket aktif');
    const dl = await call('DELETE', '/admin/packages/4', null, AD); ok(dl.s === 200 && !(await call('GET', '/master')).j.PKG.some(p => p.id === 4), 'paket yang dihapus admin tidak ada di PKG');
    ok((await call('POST', '/quote', { package_id: 2, studio_id: 1 }, U)).j.error === 'Paket tidak valid', 'quote dengan paket nonaktif: "Paket tidak valid" (pemicu popup)');
    // 1–2. frontend
    const JS = allJs();
    // dialog bersama (aria-modal, Escape, fokus awal di tombol aksi): frontend/tests/components/modal.test.js + smoke walk K2 (refactor MVC fase 4)
    // admin.js: konfirmasi admin memakai modal bersama → frontend/tests/controllers/AdminController.test.js "confirm: memakai ui.modal tepat sekali" (fase 8a, test-map.md baris 153)
    for (const s of ['Pilihan Paket', 'Temukan Paket Sesuai Kebutuhanmu', 'Pilih Paket Ini', 'Lihat semua paket', 'Paling Favorit', '/ sesi', 'Paket Foto Tidak Ditemukan', 'Lihat & Pilih Paket Lain', 'Hubungi Customer Service', 'Pilih studio untuk melanjutkan']) ok(JS.includes(s), `frontend memuat "${s}"`);
    // Pilihan Paket (lencana di favouritePackageId, Pilih Paket Ini = package:choose) dan Customer Service di popup paket: frontend/tests/views/packages.test.js, frontend/tests/controllers/PackageController.test.js (refactor MVC fase 5a)
    ok(!uiGradient(JS), 'frontend (JS) tanpa gradient');
    // FAV_PKG → M.favouritePackageId saat boot dan refreshMaster: frontend/tests/models/master.test.js (refactor MVC fase 2, keduanya memakai loadMaster)
    // paket pilihan yang hilang tidak dibuang diam-diam (popup Paket Foto Tidak Ditemukan): frontend/tests/controllers/PackageController.test.js (refactor MVC fase 5a)
  }
  await down(srv);

  // ===== Fase 4: popup galat Create Booking + akses tamu =====
  srv = start('d'); await up();
  { const U = (await call('POST', '/auth/register', { name: 'Dewi', email: 'dewi@x.id', phone: '0814444444', password: 'secret1' })).j.token;
    const U2 = (await call('POST', '/auth/register', { name: 'Eko', email: 'eko@x.id', phone: '0815555555', password: 'secret1' })).j.token;
    const AD = (await call('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' })).j.token; ok(U && U2 && AD, 'fixture fase 4: dua customer dan admin masuk');
    const slot = dayAhead(7) + ' 10:00', B = (o, t = U) => call('POST', '/bookings', { package_id: 1, studio_id: 1, date: slot, ...o }, t);
    // 2. quote publik (keputusan 37), booking tetap wajib login
    const qg = await call('POST', '/quote', { package_id: 1, studio_id: 1 }); ok(qg.s === 200 && qg.j.total > 0, 'POST /api/quote tanpa token: 200 dengan total (tamu melihat harga)');
    const bg = await B({}, null); ok(bg.s === 401 && bg.j.error === 'Belum login', 'POST /api/bookings tanpa token: 401 "Belum login" (pemicu popup Belum Login)');
    // 1. kontrak pesan galat yang dipetakan bookingErr
    ok((await B({ package_id: 999 })).j.error === 'Paket/studio tidak valid', 'booking dengan paket tidak ada: "Paket/studio tidak valid"');
    ok((await call('POST', '/quote', { package_id: 999, studio_id: 1 })).j.error === 'Paket tidak valid', 'quote dengan paket tidak ada: "Paket tidak valid"');
    { const r = await B({ date: '' }); ok(r.s === 400 && r.j.error === 'Format/jam slot tidak valid', 'booking tanpa sesi: 400 "Format/jam slot tidak valid" (Input Tidak Valid)'); }
    { const r = await B({ date: dayAhead(-2) + ' 10:00' }); ok(r.s === 400 && r.j.error === 'Jadwal sudah lewat', 'booking sesi yang sudah lewat: 400 "Jadwal sudah lewat" (Sesi Tidak Tersedia)'); }
    ok((await B({})).s === 200, 'fixture: customer pertama membooking slot');
    { const r = await B({}, U2); ok(r.s === 409 && r.j.error === 'Jadwal sudah tidak tersedia', 'slot yang sudah diambil: 409 "Jadwal sudah tidak tersedia" (Sesi Sudah Dibooking)'); }
    ok((await call('PATCH', '/admin/studios/2', { status: 'UNAVAILABLE' }, AD)).s === 200, 'admin menandai studio 2 tidak tersedia');
    { const r = await B({ studio_id: 2 }, U2); ok(r.s === 400 && r.j.error === 'Studio tidak tersedia', 'booking studio tidak tersedia: "Studio tidak tersedia" (Sesi Tidak Tersedia)'); }
    ok((await call('POST', '/quote', { package_id: 1, studio_id: 2 })).j.error === 'Studio tidak tersedia', 'quote studio tidak tersedia: "Studio tidak tersedia"');
    // 3. guard tamu: frontend/tests/core/router.test.js (tabel guard rute × tamu/customer/admin, refactor MVC fase 3)
    const JS = allJs();
    // navbar: tamu tanpa nama user dengan Masuk (/login) dan Daftar (/register), nama customer di-escape sekali: frontend/tests/components/navbar.test.js (refactor MVC fase 4)
    // masuk dengan draf booking tamu kembali ke Paket & Pembayaran: frontend/tests/controllers/AuthController.test.js (refactor MVC fase 6)
    // 4. pemetaan galat dan lima popup (judul dan pesan dari Figma)
    // satu tabel pemetaan galat → popup (BOOKING_ERRORS di BookingController.handleError): frontend/tests/controllers/BookingController.test.js (refactor MVC fase 5b)
    for (const s of ['Input Tidak Valid', 'Input booking tidak lengkap atau tidak valid. Pilih tanggal dan sesi terlebih dahulu.', 'Sesi Tidak Tersedia', 'tidak lagi tersedia. Silakan pilih sesi lain.',
      'Paket Tidak Ditemukan', 'Paket tidak ditemukan. Silakan pilih paket lain.', 'Maaf, Sesi Sudah Dibooking', 'Sesi ini sudah memiliki booking aktif. Silakan pilih sesi lain.', 'Pilih Sesi Lain',
      'Masuk untuk melanjutkan booking', 'Kamu belum login. Silakan masuk terlebih dahulu untuk membooking sesi.', 'Jadwal sudah tidak tersedia', 'Format/jam slot tidak valid', 'Jadwal sudah lewat', 'Studio tidak tersedia']) ok(JS.includes(s), `frontend memuat "${s}"`);
    // tamu yang menekan Check Out mendapat popup Belum Login sebelum booking dibuat: frontend/tests/controllers/PaymentController.test.js (refactor MVC fase 5b)
    // tombol Lanjut ke Pembayaran tidak pernah disabled: frontend/tests/views/time.test.js; galat langkah booking ke popup, bukan teks merah: frontend/tests/controllers/BookingController.test.js (refactor MVC fase 5b)
    // tautan "Lihat Studio" di landing membuka Browse: frontend/tests/views/landing.test.js (refactor MVC fase 7)
    ok(!uiGradient(JS), 'frontend (JS) tetap tanpa gradient'); }
  await down(srv);

  // ===== Fase 5: admin Ringkasan Studio + dialog Akses Ditolak =====
  srv = start('e'); await up();
  { const U = (await call('POST', '/auth/register', { name: 'Fani', email: 'fani@x.id', phone: '0816666666', password: 'secret1' })).j.token;
    const AD = (await call('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' })).j.token; ok(U && AD, 'fixture fase 5: customer dan admin masuk');
    // 1. kontrak API yang dipakai dialog dan langkah ringkasan
    for (const [m, p] of [['GET', '/admin/studios'], ['POST', '/admin/studios']]) { const r = await call(m, p, m === 'POST' ? { name: 'Studio Tamu' } : null, U); ok(r.s === 403 && r.j.error === 'Hanya admin', `${m} /api/admin/studios dengan token customer: 403 "Hanya admin" (pemicu Akses Ditolak)`); }
    const nm = (await call('GET', '/admin/studios', null, AD)).j[0].name, SB = o => ({ status: 'AVAILABLE', description: '', address: '', price: 0, people_range_id: 1, budget_range_id: 1, ...o }); // isi seperti form admin
    { const r = await call('POST', '/admin/studios', SB({ name: ' ' + nm.toUpperCase() + ' ' }), AD); ok(r.s === 409 && r.j.error === 'Nama studio sudah dipakai', 'tambah studio dengan nama yang sudah ada: 409 "Nama studio sudah dipakai"'); }
    { const r = await call('POST', '/admin/studios', SB({ name: '  ' }), AD); ok(r.s === 400 && r.j.error === 'Nama studio wajib diisi', 'tambah studio tanpa nama: 400 "Nama studio wajib diisi"'); }
    { const r = await call('PATCH', '/admin/account', { current_password: 'salah' }, AD); ok(r.s === 403 && r.j.error === 'Password saat ini salah', '403 lain di admin ("Password saat ini salah") bukan Akses Ditolak'); }
    { const r = await call('POST', '/admin/studios', SB({ name: 'Studio Senja', description: 'Cahaya alami' }), AD); ok(r.s === 200 && r.j.id, 'fixture: admin menambah Studio Senja'); }
    // 2. frontend admin.js: teks Figma
    const JS = allJs();
    for (const s of ['Ringkasan Studio', 'Detail Studio Baru', 'Isi data studio. Nama dan gambar wajib diisi, dan nama tidak boleh sama dengan studio lain.', 'Simpan Studio', 'Ubah',
      'Input studio tidak valid. Periksa field yang ditandai.', 'Nama studio wajib diisi.', 'Gambar studio wajib diunggah.', 'Nama studio sudah digunakan oleh studio lain.', 'Nama studio sudah digunakan. Gunakan nama lain.',
      'Studio berhasil ditambahkan', 'tersedia dan tampil di daftar studio pelanggan.',
      'Akses ditolak', 'Hanya admin yang dapat menambahkan studio.', 'Akun yang sedang masuk adalah akun pelanggan. Masuk dengan akun admin untuk melanjutkan.', 'Kembali ke Beranda', 'Masuk sebagai Admin']) ok(JS.includes(s), `frontend memuat "${s}"`);
    // satu dialog Akses ditolak dipicu 403 "Hanya admin" → AdminController.test.js "handleError: 403 \"Hanya admin\"" (fase 8a, test-map.md baris 217)
    // 403 lain tidak logout diam-diam → AdminController.test.js "handleError: 403 lain" (fase 8a, test-map.md baris 218)
    // muat sesi studio lewat penanganan galat admin → frontend/tests/controllers/StudioController.test.js "admin loadSessions" (fase 8b, test-map.md baris 219); aLoad/aDo → AdminController.test.js "load"/"run" (fase 8a)
    // 403 "Ganti password" → Akun Admin → AdminController.test.js "handleError: 403 \"Ganti password\"" dan "load: 403 Ganti password" (fase 8a, test-map.md baris 220)
    // tambah studio lewat langkah Ringkasan Studio → StudioController.test.js "admin review: isian valid" dan "admin save: tanpa Ringkasan Studio" (fase 8b, test-map.md baris 221)
    // sesi admin dengan token bukan admin memunculkan Akses Ditolak saat dibuka (restoreSession): frontend/tests/controllers/AuthController.test.js (refactor MVC fase 6)
    // unggah gambar studio baru menghapus tanda galat lama → StudioController.test.js "admin uploadImage studio baru" (fase 8b, test-map.md baris 224)
    // nama ganda dari server memuat ulang daftar studio → StudioController.test.js "admin save: 409" (fase 8b, test-map.md baris 225)
    ok(!uiGradient(JS), 'frontend (JS) tanpa gradient (admin)'); }
  await down(srv);

  // ===== Refactor MVC fase 1 (imk/dev/frontend-mvc-plan): global yang di-assign ulang dikumpulkan ke objek bernama, agar fase 2 bisa memakai ES module =====
  // asg(names) = pola penugasan ulang sebuah global (bukan properti: "x.err =" tidak dihitung), termasuk di dalam atribut onclick="…"
  { const JS = allJs(), asg = names => new RegExp(`(^|[;{(,\\s"'\`])(${names})\\s*=[^=]`, 'm');
    ok(!asg('PKG|ALLPKG|FAV_PKG|DISC|PEOPLE|BUDGET|STUDIOS|ALLSTUDIOS|PROP|POSES|POLICY|_mj').test(JS) && !/\(\{\s*PKG/.test(JS), 'frontend: data master hanya di objek M (tanpa global PKG/STUDIOS/… yang di-assign ulang)'); // kode: diganti di fase 9
    ok(!asg('B|Q|editId').test(JS), 'frontend: booking berjalan hanya di objek BK (tanpa B/Q/editId yang di-assign ulang)'); // kode: diganti di fase 9
    ok(!asg('msg|err|AV|CAL|CR|CD|authMode|resetTok|LP|aDenyOpen').test(JS), 'frontend: state runtime hanya di objek R (tanpa msg/err/AV/CAL/CR/CD/authMode/resetTok/LP yang di-assign ulang)'); // kode: diganti di fase 9
    ok(!/S\.(bookings|sessions)\b/.test(JS), 'frontend: booking dan sesi foto user di objek D, tidak lagi di S (state tersimpan)'); // kode: diganti di fase 9
    ok(!asg('drive|curSes|poseI|tick|poseT|stream|gSes|dMode|dSel').test(JS), 'frontend: state sesi foto dan galeri hanya di objek P (tanpa drive/curSes/tick/gSes/dSel/… yang di-assign ulang)'); // kode: diganti di fase 9
    // nama global lama juga tidak lagi dibaca, termasuk setelah spread (...PKG, [...dSel]); err/drive/stream tidak ikut karena juga dipakai sebagai kelas CSS, URL Drive dan kunci objek
    const old = /(?<![.\w$])(PKG|ALLPKG|FAV_PKG|DISC|PEOPLE|BUDGET|STUDIOS|ALLSTUDIOS|PROP|POSES|POLICY|_mj|B|Q|editId|msg|AV|CAL|CR|CD|authMode|resetTok|LP|aDenyOpen|curSes|poseI|tick|poseT|gSes|dMode|dSel)(?![\w$])/.exec(JS.replace(/\.\.\./g, '… '));
    ok(!old, 'frontend: tidak ada lagi rujukan ke nama global lama' + (old ? ` (masih ada "${old[0]}")` : '')); // kode: diganti di fase 9
  }

  // ===== Refactor MVC fase 4: shell tanpa dialog bawaan browser (decisions.md 4, 27, 41) =====
  { const JS = allJs(), core = src('js/legacy/core.js');
    ok(!/\bprompt\(/.test(JS), 'frontend: tanpa prompt() bawaan browser (PIN staf lewat modal)');
    ok(!/\balert\(/.test(core), 'core.js: tanpa alert() bawaan browser (kontak CS lewat modal)'); // kode: diganti di fase 9 (semua berkas tanpa dialog bawaan)
    for (const s of ['Masuk Mode Staf', 'Masukkan PIN staf', 'inputmode="numeric"', 'Hubungi Customer Service', 'Silakan hubungi staf di studio atau kontak Customer Service Anda.']) ok(JS.includes(s), `frontend memuat "${s}"`);
  }

  // ===== Refactor MVC fase 6: sisi pelanggan tanpa confirm() bawaan browser (decisions.md 4, 27, 57) =====
  { const JS = allJs(), rest = fs.readdirSync(path.join(FRONT, 'js'), { recursive: true }).filter(f => f.endsWith('.js') && !/legacy[\\/](session|admin)\.js$/.test(f)).map(f => fs.readFileSync(path.join(FRONT, 'js', f), 'utf8')).join('\n');
    ok(!/\bconfirm\(["'`]/.test(rest), 'frontend (selain sesi foto dan admin): tanpa confirm() bawaan browser'); // kode: diganti di fase 9 (semua berkas)
    for (const s of ['Konfirmasi Pembatalan', 'Yakin membatalkan booking ini?', 'Ya, Batalkan', 'Konfirmasi Pembayaran', 'Bayar sekarang via QRIS (simulasi)?']) ok(JS.includes(s), `frontend memuat "${s}"`);
  }

  // ===== Refactor MVC fase 7: sesi foto dan galeri tanpa confirm()/alert() bawaan browser (decisions.md 4, 27, 63) =====
  { const rest = fs.readdirSync(path.join(FRONT, 'js'), { recursive: true }).filter(f => f.endsWith('.js') && !/legacy[\\/]admin\.js$/.test(f)).map(f => fs.readFileSync(path.join(FRONT, 'js', f), 'utf8')).join('\n'), JS = allJs();
    ok(!/\bconfirm\(["'`]/.test(rest), 'frontend (selain admin): tanpa confirm() bawaan browser'); // kode: diganti di fase 9 (semua berkas)
    ok(!/\balert\(/.test(JS), 'frontend: tanpa alert() bawaan browser');
    ok(!/gradient/i.test(JS), 'frontend (JS): tanpa gradient sama sekali, juga foto simulasi canvas di sesi foto (decisions.md 64)');
    for (const s of ['Konfirmasi Hentikan Sesi', 'Hentikan sesi?', 'Konfirmasi Hapus Foto', 'Hapus foto ini secara permanen?', 'foto terpilih secara permanen? Foto favorit tidak ikut terhapus.', 'Foto Gagal Dihapus']) ok(JS.includes(s), `frontend memuat "${s}"`);
  }
  // ===== Refactor MVC fase 8a–8b: panel admin tanpa confirm() bawaan browser (decisions.md 4, 27) =====
  { const JS = allJs();
    ok(!/confirm\(["'`](Hapus item rekap|Hapus akun|Hapus paket)/.test(JS), 'frontend: hapus item rekap, akun pelanggan dan paket tanpa confirm() bawaan browser');
    ok(!/\bconfirm\(["'`]/.test(JS), 'frontend: tanpa confirm() bawaan browser sama sekali (properti dan pose lewat modal, fase 8b)');
    for (const s of ['Konfirmasi Hapus Item Rekap', 'Hapus item rekap ini?', 'Konfirmasi Hapus Akun', 'beserta SELURUH booking, pembayaran, dan foto miliknya?', 'Tindakan ini tidak dapat dibatalkan.', 'Konfirmasi Hapus Paket', 'Hapus paket ini? (Jika pernah dibeli, paket hanya dinonaktifkan.)', 'Konfirmasi Hapus Properti', 'Hapus properti ini?', 'Ya, Hapus Properti', 'Konfirmasi Hapus Pose', 'Hapus pose ini?', 'Ya, Hapus Pose']) ok(JS.includes(s), `frontend memuat "${s}"`);
  }


  // ===== Fase refactor 3: fallback SPA (rute frontend dengan path history disajikan index.html) =====
  srv = start('spa'); await up();
  { const index = fs.readFileSync(path.join(FRONT, 'index.html'), 'utf8');
    const get = async p => { const r = await fetch(`http://localhost:${PORT}` + p); return { s: r.status, t: r.headers.get('content-type') || '', b: await r.text() }; };
    // path mentah tanpa normalisasi URL di sisi klien (fetch merapikan "/../")
    const raw = p => new Promise((ok, no) => require('http').get({ host: 'localhost', port: PORT, path: p }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => ok({ s: r.statusCode, b })); }).on('error', no));
    for (const p of ['/bookings/12', '/admin/studios', '/book/pay', '/reset-password']) { const r = await get(p); ok(r.s === 200 && r.t.startsWith('text/html') && r.b === index, `GET ${p} → 200 text/html berisi index.html`); }
    { const r = await get('/bookings?tab=history'); ok(r.s === 200 && r.b === index, 'GET /bookings?tab=history → index.html (query diabaikan)'); }
    { const r = await get('/js/missing.js'); ok(r.s === 404 && r.b !== index, 'GET /js/missing.js → 404 (bukan index.html)'); }
    { const r = await get('/css'); ok(r.s === 404, 'GET /css (folder) tetap 404'); }
    { const r = await get('/api/nope'); ok(r.s === 404 && r.t.startsWith('application/json') && JSON.parse(r.b).error === 'Endpoint tidak ada', 'GET /api/nope → 404 JSON'); }
    { const r = await get('/media/nope'); ok(r.s === 404 && r.b !== index, 'GET /media/nope → 404 (bukan index.html)'); }
    for (const p of ['/../backend/.env', '/../backend/server.js', '/..%2Fbackend%2F.env', '/%2e%2e/backend/.env']) { const r = await raw(p); ok(r.s === 404 && !/JWT_SECRET|createServer/.test(r.b), `GET ${p} tidak membocorkan berkas backend (404)`); }
    { const rel = /(src=|href=|url\()\\?["']?(img|css|js)\/|["'](img|css|js)\/[\w.-]+\.(png|jpe?g|webp|svg|css|js)["']/, idx = rel.exec(index), js = rel.exec(allJs()), css = rel.exec(allCss());
      ok(!idx && !js && !css, 'aset frontend memakai URL absolut (/img/…, /css/…, /js/…) agar halaman di path bertingkat tetap memuatnya' + (idx || js || css ? ` (masih "${(idx || js || css)[0]}")` : '')); }
    { const r = await get('/js/main.js'); ok(r.s === 200 && r.t.startsWith('text/javascript'), 'berkas yang ada tetap disajikan apa adanya (/js/main.js)'); }
  }
  await down(srv);

  console.log(`\n${n} tes lulus`); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(async e => { console.error('✘ GAGAL:', e.message); if (srv) await down(srv); process.exit(1); });
