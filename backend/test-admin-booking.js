// Tes fitur admin booking: filter, detail, hapus (US-16), ubah paket & status (US-15), email ke customer. Jalankan: node --disable-warning=ExperimentalWarning test-admin-booking.js
const { spawn, execFileSync } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), net = require('net'), fs = require('fs');
const PORT = 3934, PORT2 = 3935, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia-book-')), mails = [];
// SMTP palsu (tanpa TLS) untuk memeriksa email notifikasi ke customer
const smtp = net.createServer(sock => { let data = '', inData = false; sock.write('220 mock\r\n');
  sock.on('data', d => { data += d; let i; while ((i = data.indexOf('\r\n')) >= 0 || (inData && data.includes('\r\n.\r\n'))) {
    if (inData) { const e = data.indexOf('\r\n.\r\n'); if (e < 0) break; const raw = data.slice(0, e); data = data.slice(e + 5); inData = false; mails.push(raw); sock.write('250 queued\r\n'); continue; }
    const line = data.slice(0, i); data = data.slice(i + 2);
    if (/^EHLO/.test(line)) sock.write('250 mock\r\n'); else if (/^MAIL|^RCPT/.test(line)) sock.write('250 ok\r\n'); else if (line === 'DATA') { inData = true; sock.write('354 go\r\n'); } else if (/^QUIT/.test(line)) { sock.end('221 bye\r\n'); } else sock.write('250 ok\r\n'); } }); }).listen(2528);
const decode = raw => { const parts = [...raw.matchAll(/base64\r\n\r\n([\s\S]*?)\r\n--/g)].map(m => Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString()); return { raw, text: parts.join('\n'), to: (/To: (.*)/.exec(raw) || [])[1], subject: Buffer.from((/Subject: =\?UTF-8\?B\?(.*)\?=/.exec(raw) || [])[1] || '', 'base64').toString() }; };
// server utama + server kedua dengan REFUND_SIMULATE_FAIL=1 (refund paksa selalu gagal), masing-masing dengan database sementara sendiri
const DB = k => path.join(TMP, k + '.db');
const start = (port, k, extra = {}) => spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: __dirname, env: { ...process.env, PORT: port, DB_FILE: DB(k), UPLOAD_DIR: path.join(TMP, k + '-up'), MEDIA_DIR: path.join(TMP, k + '-media'), ADMIN_PASS: 'Admin#12345', AUTH_RATE_LIMIT: '1000', SMTP_HOST: '127.0.0.1', SMTP_PORT: '2528', SMTP_SECURE: 'none', MAIL_FROM: 'toko@example.com', REFUND_SIMULATE_FAIL: '', ...extra } });
const srv = start(PORT, 'a'), srv2 = start(PORT2, 'b', { REFUND_SIMULATE_FAIL: '1' });
const api = port => async (m, p, body, tok) => { const r = await fetch(`http://localhost:${port}/api` + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const call = api(PORT), call2 = api(PORT2), wait = ms => new Promise(r => setTimeout(r, ms)), pad = n => String(n).padStart(2, '0');
const dayOf = k => { const d = new Date(); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const stop = () => { srv.kill(); srv2.kill(); smtp.close(); };
(async () => { await wait(1200); let n = 0; const ok = (c, m) => { assert(c, m); console.log('✔', m); n++; };
const { DatabaseSync } = require('node:sqlite');
  // --- fixture: customer, admin, booking pada slot tetap ---
  const reg = async (c, name, email, phone) => (await c('POST', '/auth/register', { name, email, phone, password: 'secret1' })).j.token;
  const admin = async c => (await c('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' })).j.token;
  const book = async (c, tok, studio_id, date, package_id = 1, code) => (await c('POST', '/bookings', { package_id, studio_id, date, code }, tok)).j;
  const pay = async (c, tok, id) => (await c('POST', `/bookings/${id}/pay`, { method: 'QRIS' }, tok)).j;
  const sql = (k, q, ...a) => { const d = new DatabaseSync(DB(k)); try { return /^\s*SELECT/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } }; // hanya untuk menyiapkan keadaan
  const A = await reg(call, 'Ana', 'ana@x.id', '0811111111'), Bt = await reg(call, 'Budi', 'budi@x.id', '0822222222'), AD = await admin(call);
  ok(A && Bt && AD, 'fixture: dua customer dan admin login');
  const far = dayOf(5), det2 = id => call2('GET', `/admin/bookings/${id}`, null, AD2), det = id => call('GET', `/admin/bookings/${id}`, null, AD), lst = async (qs = '') => (await call('GET', '/admin/bookings' + qs, null, AD)).j;

  // --- filter status (SR-14-03) ---
  const k1 = await book(call, A, 1, far + ' 9:00'), k2 = await book(call, Bt, 2, far + ' 9:00', 2); await pay(call, Bt, k2.id); await wait(400);
  const fp = await lst('?status=Terbayar'), fa = await lst('?status=');
  ok(fp.length && fp.every(b => b.status === 'Terbayar') && fp.some(b => b.id === k2.id) && !fp.some(b => b.id === k1.id) && fa.some(b => b.id === k1.id) && fa.some(b => b.id === k2.id), 'daftar booking admin difilter per status; status kosong = semua');

  // --- detail booking (SR-14-04) ---
  ok((await det(9999)).s === 404 && (await call('GET', `/admin/bookings/${k1.id}`, null, A)).s === 403, 'detail booking: tidak ada -> 404, customer -> 403');
  const dt = (await det(k2.id)).j;
  ok(dt.id === k2.id && dt.customer.name === 'Budi' && dt.customer.email === 'budi@x.id' && dt.customer.phone === '0822222222' && dt.studio_name && dt.package_name && dt.slot === far + ' 9:00', 'detail booking memuat customer, studio, paket, dan jadwal');
  ok(dt.payment.status === 'paid' && dt.payment.method === 'QRIS' && dt.payment.amount === k2.amount && dt.payment.paid_at > 0 && /^INV-\d{8}-\d{4}$/.test(dt.invoice), 'detail booking memuat status pembayaran dan nomor invoice');
  ok(dt.subtotal === k2.subtotal && dt.studio_fee === k2.studio_fee && dt.package_price + dt.add_on + dt.studio_fee === dt.subtotal && dt.amount === k2.amount, 'detail booking memuat rincian biaya');
  ok(JSON.stringify(dt.allowed) === JSON.stringify(['Sesi Berjalan', 'Selesai', 'Dibatalkan']) && JSON.stringify((await det(k1.id)).j.allowed) === JSON.stringify(['Dibatalkan']) && dt.impact.paid === true && dt.impact.refund_amount === k2.amount, 'detail booking memuat status tujuan yang diizinkan dan dampak hapus');

  // --- hapus booking (US-16) ---
  const bd = (id, qs = '', c = call, tok = AD) => c('DELETE', `/admin/bookings/${id}${qs}`, null, tok), mine = async (tok, id, c = call) => (await c('GET', '/bookings', null, tok)).j.find(b => b.id === id);
  ok((await bd(9999)).s === 404 && (await bd(k1.id, '', call, A)).s === 403, 'hapus booking: tidak ada -> 404, customer -> 403');
  const h0 = await bd(k1.id); ok(h0.s === 409 && h0.j.needs_confirm === true && h0.j.impact.status === 'Menunggu Pembayaran' && h0.j.impact.paid === false && h0.j.impact.refund_amount === 0 && await mine(A, k1.id), 'hapus booking tanpa konfirmasi -> 409 + status dan dana refund, booking belum dihapus');
  mails.length = 0; const h1 = await bd(k1.id, '?confirm=1'), fr = (await call('GET', `/availability?studio_id=1&date=${far}`)).j.free;
  ok(h1.s === 200 && h1.j.ok === true && h1.j.deleted === true && h1.j.refund === 'none' && !(await lst()).some(b => b.id === k1.id) && !(await mine(A, k1.id)) && fr.includes(9) && (await det(k1.id)).s === 404, 'booking belum dibayar dihapus: hilang dari daftar admin & customer, slot kembali tersedia');
  await wait(500); const hm1 = mails.map(decode).filter(m => /dihapus/.test(m.subject)); ok(hm1.length === 1 && hm1[0].to.includes('ana@x.id') && hm1[0].text.includes(far + ' 9:00'), 'customer booking aktif yang dihapus menerima email');
  await wait(100); mails.length = 0; const h2 = await bd(k2.id, '?confirm=1'); await wait(500);
  ok(h2.s === 200 && h2.j.deleted === true && h2.j.refund === 'refunded' && h2.j.refund_amount === k2.amount && !(await mine(Bt, k2.id)) && !(await call('GET', '/admin/transactions', null, AD)).j.rows.some(r => r.booking_id === k2.id), 'booking terbayar: refund 100% lalu dihapus beserta pembayarannya');
  const hm2 = mails.map(decode).filter(m => /dihapus/.test(m.subject)); ok(hm2.length === 1 && hm2[0].to.includes('budi@x.id') && hm2[0].text.includes('Rp' + k2.amount.toLocaleString('id-ID')), 'email hapus booking terbayar menyebut dana yang dikembalikan');
  const k3 = await book(call, A, 1, far + ' 10:00'); await call('POST', `/bookings/${k3.id}/cancel`, { reason: 'Tidak ada waktu' }, A); await wait(100); mails.length = 0;
  const h3a = await bd(k3.id); ok(h3a.s === 409 && h3a.j.needs_confirm && h3a.j.impact.status === 'Dibatalkan', 'hapus booking dibatalkan tetap meminta konfirmasi');
  const h3 = await bd(k3.id, '?confirm=1'); await wait(400); ok(h3.s === 200 && h3.j.deleted === true && !(await mine(A, k3.id)) && !mails.map(decode).some(m => /dihapus/.test(m.subject)), 'booking dibatalkan dihapus tanpa email ke customer');
  const k4 = await book(call, A, 1, far + ' 11:00'), k5 = await book(call, Bt, 1, far + ' 12:00'); await pay(call, A, k4.id); await pay(call, Bt, k5.id); await call('POST', `/bookings/${k4.id}/start`, {}, A); await call('POST', `/bookings/${k5.id}/start`, {}, Bt);
  sql('a', `UPDATE session SET status='Selesai' WHERE booking_id=?`, k5.id); sql('a', `UPDATE booking SET status='Selesai' WHERE id=?`, k5.id);
  const h4 = await bd(k4.id, '?confirm=1'), h5 = await bd(k5.id, '?confirm=1'); ok(h4.s === 409 && /berlangsung/.test(h4.j.error) && h5.s === 409 && (await mine(A, k4.id)).status === 'Sesi Berjalan' && (await det(k5.id)).j.delete_block, 'booking Sesi Berjalan dan Selesai tidak dapat dihapus');
  // booking tertaut sesi studio: sesi kembali AVAILABLE setelah booking dihapus (SR-16-04)
  const z1 = (await call('POST', '/admin/studios/2/sessions', { date: far, start: '13:00', end: '13:50' }, AD)).j.created[0], k6 = await book(call, A, 2, far + ' 13:00'); sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', z1.id, k6.id);
  const st = async () => (await call('GET', `/admin/studios/2/sessions?date=${far}`, null, AD)).j.find(x => x.id === z1.id);
  ok((await st()).status === 'UNAVAILABLE' && (await det(k6.id)).j.studio_session.id === z1.id, 'detail booking menampilkan sesi studio yang tertaut');
  await bd(k6.id, '?confirm=1'); const z1b = await st(); ok(z1b.status === 'AVAILABLE' && z1b.booking === null, 'booking tertaut dihapus -> sesi studio kembali AVAILABLE');

  // --- ubah booking: paket (SR-15-04) ---
  const be = (id, b, tok = AD, c = call) => c('PATCH', `/admin/bookings/${id}`, b, tok), qt = async (package_id, studio_id, code) => (await call('POST', '/quote', { package_id, studio_id, code }, A)).j;
  const m1 = await book(call, A, 3, far + ' 9:00');
  ok((await be(9999, { status: 'Dibatalkan' })).s === 404 && (await be(m1.id, { package_id: 2 }, A)).s === 403 && (await be(m1.id, {})).s === 400, 'ubah booking: tidak ada -> 404, customer -> 403, tanpa perubahan -> 400');
  await wait(100); mails.length = 0; const e1 = await be(m1.id, { package_id: 3 }), q3 = await qt(3, 3), d1 = (await det(m1.id)).j;
  ok(e1.s === 200 && e1.j.package_id === 3 && e1.j.amount === q3.total && d1.payment.amount === q3.total && d1.subtotal === q3.subtotal && d1.package_name === 'Premium' && e1.j.status === 'Menunggu Pembayaran', 'ubah paket booking belum dibayar: total dihitung ulang seperti quote dan pembayaran ikut diperbarui');
  await wait(500); const um = mails.map(decode).filter(m => /diperbarui/.test(m.subject)); ok(um.length === 1 && um[0].to.includes('ana@x.id') && um[0].text.includes('Premium') && um[0].text.includes('Rp' + q3.total.toLocaleString('id-ID')), 'customer menerima email perubahan paket dengan total baru');
  ok((await be(m1.id, { package_id: 999 })).s === 400, 'paket yang tidak ada ditolak');
  sql('a', 'UPDATE package SET active=0 WHERE id=4'); ok((await be(m1.id, { package_id: 4 })).s === 400, 'paket nonaktif ditolak'); sql('a', 'UPDATE package SET active=1 WHERE id=4');
  const m2 = await book(call, Bt, 3, far + ' 10:00'); await pay(call, Bt, m2.id); ok((await be(m2.id, { package_id: 2 })).s === 409, 'ubah paket booking yang sudah dibayar ditolak');
  sql('a', `INSERT INTO promo(code,kind,value,active) VALUES('HEMAT10','percent',10,1)`);
  const m3 = await book(call, A, 3, far + ' 11:00', 1, 'HEMAT10'), e3 = await be(m3.id, { package_id: 2 }), q2p = await qt(2, 3, 'HEMAT10'); ok(m3.promo_code === 'HEMAT10' && e3.s === 200 && e3.j.promo_code === 'HEMAT10' && e3.j.amount === q2p.total, 'kode promo yang masih berlaku dipertahankan saat paket diubah');
  sql('a', `UPDATE promo SET active=0 WHERE code='HEMAT10'`); const e3b = await be(m3.id, { package_id: 3 }), q3n = await qt(3, 3);
  ok(e3b.s === 200 && e3b.j.promo_code === null && e3b.j.promo_disc === 0 && e3b.j.amount === q3n.total, 'kode promo yang tidak berlaku lagi dilepas dan total dihitung tanpa promo');

  // --- ubah booking: status (SR-15-05, SR-15-06) ---
  ok((await be(m1.id, { status: 'Terbayar' })).s === 409 && (await be(m1.id, { status: 'Selesai' })).s === 409 && (await be(m1.id, { status: 'Sesi Berjalan' })).s === 409, 'status lunas pada booking belum dibayar ditolak');
  ok((await be(m2.id, { status: 'Menunggu Pembayaran' })).s === 409 && (await be(m2.id, { status: 'Hangus' })).s === 400, 'kembali ke Menunggu Pembayaran ditolak; status tidak dikenal -> 400');
  await wait(100); mails.length = 0; const c1 = await be(m1.id, { status: 'Dibatalkan' }), c1b = await mine(A, m1.id);
  ok(c1.s === 200 && c1b.status === 'Dibatalkan' && c1b.cancel_reason === 'Dibatalkan admin' && c1b.pay_status === 'batal' && (await call('GET', `/availability?studio_id=3&date=${far}`)).j.free.includes(9), 'Menunggu Pembayaran -> Dibatalkan: dibatalkan tanpa refund, slot dibuka kembali');
  await wait(500); ok(mails.map(decode).filter(m => /dibatalkan/.test(m.subject) && m.to.includes('ana@x.id')).length === 1 && !mails.map(decode).some(m => /diperbarui/.test(m.subject)), 'pembatalan oleh admin memakai email pembatalan');
  ok((await be(m1.id, { status: 'Terbayar' })).s === 409 && (await be(m1.id, { package_id: 2 })).s === 409, 'booking Dibatalkan tidak dapat diubah lagi');
  const z2 = (await call('POST', '/admin/studios/3/sessions', { date: far, start: '10:00', end: '10:50' }, AD)).j.created[0]; sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', z2.id, m2.id);
  const c2 = await be(m2.id, { status: 'Dibatalkan' }), c2b = await mine(Bt, m2.id), z2b = (await call('GET', `/admin/studios/3/sessions?date=${far}`, null, AD)).j.find(x => x.id === z2.id);
  ok(c2.s === 200 && c2b.status === 'Dibatalkan' && c2b.pay_status === 'refunded' && c2.j.payment.status === 'refunded' && z2b.status === 'AVAILABLE', 'Terbayar -> Dibatalkan: refund 100% dan sesi studio dibuka kembali');
  const m4 = await book(call, A, 3, far + ' 12:00'); await pay(call, A, m4.id); const s4 = await be(m4.id, { status: 'Sesi Berjalan' }), rs = (await call('GET', '/sessions', null, A)).j.find(x => x.booking_id === m4.id);
  ok(s4.s === 200 && s4.j.status === 'Sesi Berjalan' && rs && rs.status === 'Aktif' && rs.left > 0, 'Terbayar -> Sesi Berjalan: sesi foto dimulai');
  ok((await be(m4.id, { status: 'Terbayar' })).s === 409 && (await be(m4.id, { status: 'Dibatalkan' })).s === 409, 'Sesi Berjalan tidak dapat kembali ke Terbayar atau dibatalkan');
  const f4 = await be(m4.id, { status: 'Selesai' }), rf = (await call('GET', '/sessions', null, A)).j.find(x => x.booking_id === m4.id); ok(f4.s === 200 && f4.j.status === 'Selesai' && rf.status === 'Selesai' && JSON.stringify(f4.j.allowed) === '[]', 'Sesi Berjalan -> Selesai: sesi foto diakhiri');
  ok((await be(m4.id, { status: 'Sesi Berjalan' })).s === 409 && (await be(m4.id, { status: 'Terbayar' })).s === 409, 'Selesai tidak dapat diubah kembali');
  const m5 = await book(call, Bt, 3, far + ' 13:00'); await pay(call, Bt, m5.id); await wait(400); mails.length = 0; const f5 = await be(m5.id, { status: 'Selesai' });
  await wait(500); ok(f5.s === 200 && f5.j.status === 'Selesai' && mails.map(decode).some(m => /diperbarui/.test(m.subject) && m.to.includes('budi@x.id') && m.text.includes('Selesai')), 'Terbayar -> Selesai, customer menerima email perubahan status');
  const m6 = await book(call, A, 3, far + ' 14:00'), b6 = await be(m6.id, { package_id: 2, status: 'Dibatalkan' }), b6b = await mine(A, m6.id); ok(b6.s === 200 && b6b.package_id === 2 && b6b.amount === (await qt(2, 3)).total && b6b.status === 'Dibatalkan', 'paket dan status dalam satu permintaan: paket dulu, lalu status');
  const m7 = await book(call, A, 3, far + ' 15:00'), b7 = await be(m7.id, { package_id: 2, status: 'Selesai' }); ok(b7.s === 409 && (await mine(A, m7.id)).package_id === 1, 'permintaan dengan status tidak sah tidak mengubah paket');
  const b8 = await be(m7.id, { package_id: 1, status: 'Menunggu Pembayaran' }); ok(b8.s === 200 && b8.j.notified === false, 'nilai yang sama dengan sekarang: tidak ada perubahan dan tidak ada email');

  // --- server kedua: REFUND_SIMULATE_FAIL=1 ---
  const C2 = await reg(call2, 'Cici', 'cici@x.id', '0833333333'), AD2 = await admin(call2), f1 = await book(call2, C2, 1, far + ' 9:00'); await pay(call2, C2, f1.id); await wait(400); mails.length = 0;
  const g1 = await bd(f1.id, '?confirm=1', call2, AD2), gb = await mine(C2, f1.id, call2); ok(g1.s === 200 && g1.j.ok === false && g1.j.kept === true && g1.j.refund === 'failed' && gb.status === 'Dibatalkan' && gb.pay_status === 'refund_failed' && gb.cancel_reason === 'Dihapus admin', 'refund gagal: booking dipertahankan sebagai Dibatalkan dengan refund gagal');
  await wait(500); ok(mails.map(decode).some(m => m.to.includes('cici@x.id') && /gagal/.test(m.text)), 'email ke customer menyebut refund gagal');
  const g2 = await bd(f1.id, '?confirm=1', call2, AD2); ok(g2.s === 409 && /Refund gagal/.test(g2.j.error) && (await det2(f1.id)).j.delete_block, 'booking dengan refund gagal tidak dapat dihapus sebelum ditindaklanjuti');

  const f2 = await book(call2, C2, 2, far + ' 10:00'); await pay(call2, C2, f2.id); const g3 = await be(f2.id, { status: 'Dibatalkan' }, AD2, call2);
  ok(g3.s === 200 && g3.j.status === 'Dibatalkan' && g3.j.payment.status === 'refund_failed' && g3.j.refund.state === 'failed', 'Terbayar -> Dibatalkan saat refund gagal: booking dibatalkan, refund ditandai gagal');

  console.log(`\n${n} tes lulus`); stop(); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); stop(); process.exit(1); });
