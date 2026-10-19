// Tes integrasi fitur baru (reset sandi, invoice email, admin, promo, hapus massal). Jalankan: npm run test:admin
const { spawn } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), net = require('net'), fs = require('fs');
const PORT = 3925, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia-')), B = `http://localhost:${PORT}/api`, mails = [];
// SMTP palsu (tanpa TLS) untuk memverifikasi klien SMTP + isi email
const smtp = net.createServer(sock => { let data = '', inData = false, st = 0; sock.write('220 mock\r\n');
  sock.on('data', d => { data += d; let i; while ((i = data.indexOf('\r\n')) >= 0 || (inData && data.includes('\r\n.\r\n'))) {
    if (inData) { const e = data.indexOf('\r\n.\r\n'); if (e < 0) break; const raw = data.slice(0, e); data = data.slice(e + 5); inData = false; mails.push(raw); sock.write('250 queued\r\n'); continue; }
    const line = data.slice(0, i); data = data.slice(i + 2);
    if (/^EHLO/.test(line)) sock.write('250 mock\r\n'); else if (/^MAIL|^RCPT/.test(line)) sock.write('250 ok\r\n'); else if (line === 'DATA') { inData = true; sock.write('354 go\r\n'); } else if (/^QUIT/.test(line)) { sock.end('221 bye\r\n'); } else sock.write('250 ok\r\n'); } }); }).listen(2525);
const decode = raw => { const parts = [...raw.matchAll(/base64\r\n\r\n([\s\S]*?)\r\n--/g)].map(m => Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString()); return { raw, text: parts.join('\n'), to: (/To: (.*)/.exec(raw) || [])[1], subject: Buffer.from((/Subject: =\?UTF-8\?B\?(.*)\?=/.exec(raw) || [])[1] || '', 'base64').toString() }; };
const srv = spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: __dirname, env: { ...process.env, ADMIN_PASS: 'Admin#12345', PORT, DB_FILE: path.join(TMP, 't.db'), UPLOAD_DIR: path.join(TMP, 'up'), SMTP_HOST: '127.0.0.1', SMTP_PORT: '2525', SMTP_SECURE: 'none', MAIL_FROM: 'toko@example.com', BASE_URL: 'https://studio.example', STAFF_PIN: '4321' } });
const call = async (m, p, body, tok) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; const ct = r.headers.get('content-type') || ''; try { j = ct.includes('json') ? await r.json() : { text: await r.text() }; } catch {} return { s: r.status, j }; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
(async () => { await wait(1200); let n = 0; const ok = (c, m) => { assert(c, m); console.log('✔', m); n++; };
  const d = new Date(); d.setDate(d.getDate() + 2); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // --- akun & lupa sandi ---
  const A = (await call('POST', '/auth/register', { name: 'Ana', email: 'ana@x.id', phone: '0811111111', password: 'lama123' })).j;
  ok((await call('POST', '/auth/login', { email: 'ana@x.id', password: 'lama123' })).s === 200, 'login customer hanya dengan email + password');
  ok((await call('POST', '/auth/forgot', { email: 'tidak@ada.id' })).j.ok && !mails.length, 'lupa sandi email tak terdaftar: respons sama, tidak ada email');
  ok((await call('POST', '/auth/forgot', { email: 'ana@x.id' })).j.ok, 'lupa sandi diminta'); await wait(400); ok(mails.length === 1, 'email reset dikirim lewat SMTP');
  const m1 = decode(mails[0]), tok = (/#reset=([a-f0-9]{64})/.exec(m1.text) || [])[1]; ok(tok && m1.to.includes('ana@x.id') && m1.text.includes('https://studio.example/#reset='), 'email berisi tautan reset ke BASE_URL');
  ok((await call('POST', '/auth/reset', { token: tok, password: '123' })).s === 400, 'sandi baru terlalu pendek ditolak'); await wait(1100);
  ok((await call('POST', '/auth/reset', { token: tok, password: 'baru1234' })).s === 200, 'sandi berhasil diubah lewat tautan');
  ok((await call('POST', '/auth/reset', { token: tok, password: 'lainlagi1' })).s === 400, 'tautan hanya bisa dipakai sekali');
  ok((await call('POST', '/auth/login', { email: 'ana@x.id', password: 'lama123' })).s === 401, 'sandi lama tidak berlaku'); ok((await call('GET', '/bookings', null, A.token)).s === 401, 'sesi login lama dicabut setelah ganti sandi');
  const A2 = (await call('POST', '/auth/login', { email: 'ana@x.id', password: 'baru1234' })).j; ok(A2.token, 'login dengan sandi baru');
  const Bb = (await call('POST', '/auth/register', { name: 'Budi', email: 'b@x.id', phone: '0822222222', password: 'secret2' })).j;
  // --- diskon, promo, booking, invoice ---
  ok((await call('GET', '/master')).j.DISC.pct === 0, 'master memuat diskon utama');
  const adm = await call('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' }); ok(adm.s === 200 && adm.j.token, 'login admin (adminstudio/admin123)'); const AD = adm.j.token;
  ok((await call('POST', '/admin/login', { username: 'adminstudio', password: 'salah' })).s === 401, 'admin password salah ditolak');
  ok((await call('GET', '/admin/customers', null, A2.token)).s === 403, 'customer tidak bisa membuka endpoint admin'); ok((await call('GET', '/bookings', null, AD)).s === 401, 'token admin bukan token customer');
  ok((await call('PUT', '/admin/discount', { pct: 10, label: 'Promo Oktober' }, AD)).s === 200, 'admin mengatur diskon utama 10%');
  ok((await call('POST', '/admin/promos', { code: 'hemat5k', kind: 'nominal', value: 5000, max_uses: 1 }, AD)).s === 200, 'admin membuat kode promo (nominal, kuota 1)');
  ok((await call('POST', '/admin/promos', { code: 'HEMAT5K', kind: 'nominal', value: 5000 }, AD)).s === 409, 'kode promo ganda ditolak');
  const setup = { vibe: 1, bg: 2, acc: [3] }; // add-on 15000
  const qt = (await call('POST', '/quote', { package_id: 2, setup, code: 'hemat5k' }, A2.token)).j; ok(qt.subtotal === 105000 && qt.mainDisc === 9000 && qt.promoDisc === 5000 && qt.total === 91000, 'perhitungan: 90.000 -10% + add-on 15.000 - promo 5.000 = 91.000');
  ok((await call('POST', '/quote', { package_id: 2, code: 'NGAWUR' }, A2.token)).s === 400, 'kode promo tidak valid ditolak');
  const bk = (await call('POST', '/bookings', { package_id: 2, studio_id: 1, date: day + ' 11:00', setup, code: 'HEMAT5K' }, A2.token)).j; ok(bk.amount === 91000 && bk.promo_code === 'HEMAT5K', 'booking memakai harga setelah diskon & promo');
  ok((await call('GET', `/bookings/${bk.id}/invoice`, null, A2.token)).s === 409, 'invoice belum tersedia sebelum bayar'); mails.length = 0;
  ok((await call('POST', `/bookings/${bk.id}/pay`, { method: 'QRIS' }, A2.token)).j.status === 'Terbayar', 'pembayaran berhasil'); await wait(500);
  const inv = mails.map(decode).find(m => /Invoice INV-/.test(m.subject)); ok(inv && inv.to.includes('ana@x.id') && inv.text.includes('Rp91.000'), 'invoice otomatis terkirim ke email customer (lampiran + total)');
  const iv = await call('GET', `/bookings/${bk.id}/invoice?dl=1`, null, A2.token); ok(iv.s === 200 && iv.j.text.includes('TOTAL') && iv.j.text.includes('Diskon utama') && iv.j.text.includes('HEMAT5K'), 'invoice dapat diunduh dari Booking Saya (rincian diskon)');
  ok((await call('GET', `/bookings/${bk.id}/invoice`, null, Bb.token)).s === 404, 'invoice customer lain tidak bisa dibuka');
  mails.length = 0; ok((await call('POST', `/bookings/${bk.id}/invoice/email`, {}, A2.token)).j.ok, 'kirim ulang invoice ke email'); ok(mails.length === 1, 'email kirim-ulang diterima');
  ok((await call('POST', '/quote', { package_id: 2, code: 'HEMAT5K' }, Bb.token)).s === 400, 'kuota promo habis setelah dipakai');
  // --- foto: favorit tanpa batas & hapus massal ---
  const se = (await call('POST', `/bookings/${bk.id}/start`, {}, A2.token)).j, ids = []; for (let i = 0; i < 5; i++) ids.push((await call('POST', `/sessions/${se.id}/photos`, { img: JPG }, A2.token)).j.id);
  for (const id of ids) await call('PATCH', `/photos/${id}`, { fav: true }, A2.token); ok((await call('GET', `/sessions/${se.id}`, null, A2.token)).j.photos.every(p => p.fav), 'semua foto dapat difavoritkan (tanpa batas)');
  await call('PATCH', `/photos/${ids[0]}`, { fav: false }, A2.token); await call('PATCH', `/photos/${ids[1]}`, { fav: false }, A2.token);
  const bd = await call('POST', '/photos/bulk-delete', { ids: ids.slice(0, 4) }, A2.token); ok(bd.j.deleted === 2 && bd.j.skipped_favorites === 2, 'hapus massal: 2 terhapus, 2 favorit dilewati');
  ok((await call('GET', `/sessions/${se.id}`, null, A2.token)).j.photos.length === 3, 'sisa 3 foto (semua favorit tetap ada)'); ok((await call('POST', '/photos/bulk-delete', { ids: [ids[4]] }, Bb.token)).j.deleted === 0, 'hapus massal tidak menyentuh foto customer lain');
  // --- admin: pelanggan, riwayat, foto ---
  const cl = (await call('GET', '/admin/customers', null, AD)).j; const ana = cl.find(c => c.email === 'ana@x.id'); ok(cl.length === 2 && ana.bookings === 1 && ana.spent === 91000 && ana.photos === 3, 'admin melihat akun customer + ringkasan');
  const hist = (await call('GET', `/admin/customers/${ana.id}/bookings`, null, AD)).j.bookings; ok(hist[0].package === 'Standard' && hist[0].amount === 91000 && hist[0].promo_code === 'HEMAT5K' && hist[0].method === 'QRIS', 'admin melihat riwayat pembelian customer');
  const ph = (await call('GET', `/admin/customers/${ana.id}/photos`, null, AD)).j.photos; ok(ph.length === 3, 'admin melihat daftar foto customer'); ok((await fetch(`${B}/admin/photos/${ph[0].id}/image?t=${AD}`).then(r => r.status)) === 200, 'admin dapat membuka foto customer'); ok((await fetch(`${B}/admin/photos/${ph[0].id}/image?t=${A2.token}`).then(r => r.status)) === 403, 'customer tidak bisa lewat rute foto admin');
  // --- pendapatan ---
  const rv = (await call('GET', '/admin/revenue', null, AD)).j; ok(rv.today.total === 91000 && rv.week.total === 91000 && rv.month.total === 91000 && rv.all.total === 91000 && rv.first_date && rv.daily.length === 7, 'pendapatan harian/mingguan/bulanan/semua waktu');
  // --- rekap operasional ---
  const today = rv.daily[6].date, o1 = (await call('POST', '/admin/ops', { date: today, label: 'Sewa studio', kind: 'biaya', amount: 30000 }, AD)).j.id, o2 = (await call('POST', '/admin/ops', { date: today, label: 'Jual merchandise', kind: 'pemasukan', amount: 10000 }, AD)).j.id;
  let ops = (await call('GET', '/admin/ops?period=day', null, AD)).j; ok(ops.gross === 101000 && ops.costs === 30000 && ops.net === 71000, 'omset kotor 101.000, biaya 30.000, omset bersih 71.000');
  await call('PATCH', `/admin/ops/${o1}`, { date: today, label: 'Sewa studio', kind: 'biaya', amount: 45000, note: 'naik' }, AD); await call('DELETE', `/admin/ops/${o2}`, null, AD);
  ops = (await call('GET', '/admin/ops?period=all', null, AD)).j; ok(ops.items.length === 1 && ops.net === 91000 - 45000, 'rekap dapat diubah & dikurangi; omset bersih ikut berubah');
  ok((await call('POST', '/admin/ops', { date: 'x', label: '', kind: 'biaya', amount: -1 }, AD)).s === 400, 'validasi item rekap');
  // --- paket ---
  const np = (await call('POST', '/admin/packages', { name: 'Mini', price: 30000, photo_count: 2, dur: 5, strip_size: '2x6', strip_material: 'Glossy' }, AD)).j.id; ok(np, 'admin menambah paket baru');
  ok((await call('PATCH', `/admin/packages/${np}`, { price: 35000 }, AD)).s === 200, 'admin mengubah harga paket'); let ms = (await call('GET', '/master')).j; ok(ms.PKG.find(p => p.id === np).price === 35000 && ms.DISC.pct === 10, 'master menampilkan paket & diskon terbaru');
  ok((await call('DELETE', `/admin/packages/${np}`, null, AD)).j.deactivated === false, 'paket tanpa riwayat dihapus permanen');
  ok((await call('DELETE', '/admin/packages/2', null, AD)).j.deactivated === true && !(await call('GET', '/master')).j.PKG.some(p => p.id === 2) && (await call('GET', '/master')).j.ALLPKG.some(p => p.id === 2), 'paket yang pernah dibeli dinonaktifkan (riwayat tetap utuh)');
  ok((await call('POST', '/bookings', { package_id: 2, studio_id: 2, date: day + ' 12:00' }, Bb.token)).s === 400, 'paket nonaktif tidak bisa dipesan');
  // --- hapus akun ---
  const files = () => fs.readdirSync(path.join(TMP, 'up')).length; const before = files();
  ok((await call('DELETE', `/admin/customers/${ana.id}`, null, AD)).j.photos_deleted === 3 && files() === before - 3, 'admin menghapus akun customer beserta data & file fotonya');
  ok((await call('POST', '/auth/login', { email: 'ana@x.id', password: 'baru1234' })).s === 401 && (await call('GET', '/bookings', null, A2.token)).s === 401, 'akun terhapus tidak bisa login / memakai token lama');
  console.log(`\n${n} tes lulus`); srv.kill(); smtp.close(); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); srv.kill(); smtp.close(); process.exit(1); });
