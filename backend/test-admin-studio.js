// Tes fitur admin studio: status turunan dari slot kosong, nama unik, disembunyikan dari customer, soft delete + pembatalan/refund + email (US-03 s.d. US-06). Jalankan: node --disable-warning=ExperimentalWarning test-admin-studio.js
const { spawn, execFileSync } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), net = require('net'), fs = require('fs');
const PORT = 3930, PORT2 = 3931, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia-studio-')), mails = [];
// SMTP palsu (tanpa TLS) untuk memeriksa email notifikasi ke customer
const smtp = net.createServer(sock => { let data = '', inData = false; sock.write('220 mock\r\n');
  sock.on('data', d => { data += d; let i; while ((i = data.indexOf('\r\n')) >= 0 || (inData && data.includes('\r\n.\r\n'))) {
    if (inData) { const e = data.indexOf('\r\n.\r\n'); if (e < 0) break; const raw = data.slice(0, e); data = data.slice(e + 5); inData = false; mails.push(raw); sock.write('250 queued\r\n'); continue; }
    const line = data.slice(0, i); data = data.slice(i + 2);
    if (/^EHLO/.test(line)) sock.write('250 mock\r\n'); else if (/^MAIL|^RCPT/.test(line)) sock.write('250 ok\r\n'); else if (line === 'DATA') { inData = true; sock.write('354 go\r\n'); } else if (/^QUIT/.test(line)) { sock.end('221 bye\r\n'); } else sock.write('250 ok\r\n'); } }); }).listen(2526);
const decode = raw => { const parts = [...raw.matchAll(/base64\r\n\r\n([\s\S]*?)\r\n--/g)].map(m => Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString()); return { raw, text: parts.join('\n'), to: (/To: (.*)/.exec(raw) || [])[1], subject: Buffer.from((/Subject: =\?UTF-8\?B\?(.*)\?=/.exec(raw) || [])[1] || '', 'base64').toString() }; };
// server utama + server kedua dengan REFUND_SIMULATE_FAIL=1 (refund paksa selalu gagal), masing-masing dengan database sementara sendiri
const DB = k => path.join(TMP, k + '.db');
const start = (port, k, extra = {}) => spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: __dirname, env: { ...process.env, PORT: port, DB_FILE: DB(k), UPLOAD_DIR: path.join(TMP, k + '-up'), MEDIA_DIR: path.join(TMP, k + '-media'), ADMIN_PASS: 'Admin#12345', AUTH_RATE_LIMIT: '1000', SMTP_HOST: '127.0.0.1', SMTP_PORT: '2526', SMTP_SECURE: 'none', MAIL_FROM: 'toko@example.com', REFUND_SIMULATE_FAIL: '', ...extra } });
const srv = start(PORT, 'a'), srv2 = start(PORT2, 'b', { REFUND_SIMULATE_FAIL: '1' });
const api = port => async (m, p, body, tok) => { const r = await fetch(`http://localhost:${port}/api` + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const call = api(PORT), call2 = api(PORT2), wait = ms => new Promise(r => setTimeout(r, ms)), pad = n => String(n).padStart(2, '0');
const dayOf = k => { const d = new Date(); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const stop = () => { srv.kill(); srv2.kill(); smtp.close(); };
(async () => { await wait(1200); let n = 0; const ok = (c, m) => { assert(c, m); console.log('✔', m); n++; };
  // --- fixture: customer, admin, booking pada slot tetap ---
  const reg = async (c, name, email, phone) => (await c('POST', '/auth/register', { name, email, phone, password: 'secret1' })).j.token;
  const admin = async c => (await c('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' })).j.token;
  const book = async (c, tok, studio_id, date, package_id = 1) => (await c('POST', '/bookings', { package_id, studio_id, date }, tok)).j;
  const pay = async (c, tok, id) => (await c('POST', `/bookings/${id}/pay`, { method: 'QRIS' }, tok)).j;
  const A = await reg(call, 'Ana', 'ana@x.id', '0811111111'), Bt = await reg(call, 'Budi', 'budi@x.id', '0822222222'), AD = await admin(call);
  ok(A && Bt && AD, 'fixture: dua customer dan admin login');
  const far = dayOf(5);

  // --- status studio diturunkan dari slot kosong 14 hari (imk/dev/studio-fix-plan.md bagian 3) & nama unik (SR-04-03) ---
  const nst = { description: 'Studio uji', price: 10000, people_range_id: 1, budget_range_id: 1 };
  const s1 = await call('POST', '/admin/studios', { ...nst, name: 'Studio Uji', status: 'UNAVAILABLE' }, AD); ok(s1.s === 200 && s1.j.id, 'admin menambah studio (status dari klien lama diabaikan)'); const U1 = s1.j.id;
  const rowOf = async id => (await call('GET', '/admin/studios', null, AD)).j.find(s => s.id === id);
  { const r = await rowOf(U1); ok(r.status === 'AVAILABLE' && r.free_slots > 0 && r.free_slots <= 14 * 13, 'studio baru tanpa booking: AVAILABLE, free_slots = slot kosong 14 hari'); }
  const dup = await call('POST', '/admin/studios', { ...nst, name: '  studio MAWAR ' }, AD); ok(dup.s === 409 && /sudah dipakai/.test(dup.j.error), 'nama studio ganda (beda huruf besar/spasi) ditolak saat tambah');
  ok((await call('PATCH', '/admin/studios/2', { name: ' studio mawar' }, AD)).s === 409, 'nama studio ganda (beda huruf besar/spasi) ditolak saat ubah');
  ok((await call('PATCH', '/admin/studios/1', { name: 'Studio Mawar' }, AD)).s === 200, 'mengubah studio dengan namanya sendiri diterima');
  ok((await call('PATCH', `/admin/studios/${U1}`, { status: 'UNAVAILABLE', description: 'ubah deskripsi' }, AD)).s === 200 && (await rowOf(U1)).status === 'AVAILABLE', 'admin tidak bisa mengubah status (diabaikan, tetap dari slot)');
  { const { DatabaseSync } = require('node:sqlite'), D = new DatabaseSync(DB('a')), ins = D.prepare("INSERT INTO studio(name,description,people_range_id,budget_range_id) VALUES('Studio Kembar','x',1,1)"); ins.run(); const k2 = +ins.run().lastInsertRowid; D.close();
    ok((await call('PATCH', `/admin/studios/${k2}`, { description: 'y' }, AD)).s === 200, 'data lama dengan nama kembar: ubah selain nama tetap bisa'); }
  ok((await call('POST', '/admin/studios', { ...nst, name: 'Studio Default' }, AD)).s === 200 && (await call('GET', '/master')).j.STUDIOS.some(s => s.name === 'Studio Default' && s.status === 'AVAILABLE'), 'studio baru langsung tampil untuk customer (AVAILABLE)');
  { const D = new (require('node:sqlite').DatabaseSync)(DB('a')); ok(!D.prepare('PRAGMA table_info(studio)').all().some(c => c.name === 'status'), 'tabel studio tanpa kolom status'); D.close(); }
  // --- studio tanpa slot kosong = tidak tersedia, disembunyikan dari customer (SR-05-05) ---
  const wib = k => new Date(Date.now() + 420 * 60000 + k * 864e5).toISOString().slice(0, 10), HRS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  { const D = new (require('node:sqlite').DatabaseSync)(DB('a')); D.exec('PRAGMA foreign_keys=OFF'); const ins = D.prepare("INSERT INTO session(booking_id,studio_id,slot,status) VALUES(0,?,?,'Terjadwal')");
    for (let k = 0; k < 14; k++) for (const h of HRS) ins.run(U1, `${wib(k)} ${h}:00`); D.close(); }
  { const r = await rowOf(U1); ok(r.status === 'UNAVAILABLE' && r.free_slots === 0, 'semua slot 14 hari terisi: UNAVAILABLE, free_slots 0'); }
  let ms = (await call('GET', '/master')).j; ok(!ms.STUDIOS.some(s => s.id === U1) && ms.ALLSTUDIOS.some(s => s.id === U1 && s.status === 'UNAVAILABLE'), 'studio tidak tersedia: tidak ada di STUDIOS, ada di ALLSTUDIOS');
  { const av = await call('GET', `/availability?studio_id=${U1}&date=${far}`); ok(av.s === 200 && av.j.free.length === 0, 'availability studio penuh: 200 tanpa slot kosong (hanya studio terhapus yang ditolak)'); }
  { const D = new (require('node:sqlite').DatabaseSync)(DB('a')); D.prepare("UPDATE session SET status='Dibatalkan' WHERE studio_id=? AND slot=?").run(U1, `${far} 10:00`); D.close(); }
  { const r = await rowOf(U1); ok(r.status === 'AVAILABLE' && r.free_slots === 1, 'satu slot dibebaskan: kembali AVAILABLE, free_slots 1'); }
  ok((await call('GET', '/master')).j.STUDIOS.some(s => s.id === U1 && s.status === 'AVAILABLE') && (await call('GET', `/availability?studio_id=${U1}&date=${far}`)).j.free.includes(10), 'studio kembali tampil untuk customer dan slot 10:00 bisa dipilih');
  const eb = await book(call, A, 2, far + ' 10:00'); ok(eb.id, 'booking di studio 2'); ok((await call('POST', '/bookings', { package_id: 1, studio_id: 2, date: far + ' 11:00' }, Bt)).s === 200, 'booking kedua di studio 2');
  // --- daftar studio admin (SR-03-02) ---
  const L = (await call('GET', '/admin/studios', null, AD)).j, r2 = L.find(s => s.id === 2); ok(r2 && r2.status === 'AVAILABLE' && typeof r2.price === 'number' && r2.active_bookings === 2 && r2.bookings === 2 && r2.sessions === 0, 'daftar studio admin: status, biaya, booking aktif, jumlah sesi');
  ok(L.every(s => ['AVAILABLE', 'UNAVAILABLE'].includes(s.status) && Number.isInteger(s.free_slots)), 'daftar studio admin: setiap studio punya status turunan dan free_slots');

  // --- hapus studio: soft delete + batalkan & refund booking aktif + email (US-06) ---
  const d1 = await book(call, A, 3, far + ' 13:00'), d2 = await book(call, Bt, 3, far + ' 14:00', 2); await pay(call, Bt, d2.id);
  const del0 = await call('DELETE', '/admin/studios/3', null, AD), im = del0.j.impact || {}; ok(del0.s === 409 && del0.j.needs_confirm === true && im.active_bookings === 2 && im.paid_bookings === 1 && im.refund_total === d2.amount && im.sessions === 0, 'hapus studio berbooking aktif tanpa konfirmasi -> 409 + dampak (booking aktif, terbayar, total refund)');
  ok((await call('GET', '/master')).j.STUDIOS.some(s => s.id === 3) && (await call('GET', '/admin/studios', null, AD)).j.find(s => s.id === 3).impact.refund_total === d2.amount, 'tanpa konfirmasi studio belum dihapus; dampak juga ada di daftar admin');
  await wait(400); mails.length = 0; const del1 = await call('DELETE', '/admin/studios/3?confirm=1', null, AD); ok(del1.s === 200 && del1.j.cancelled === 2 && del1.j.refunded === 1 && del1.j.refund_failed === 0, 'dengan konfirmasi: 2 booking dibatalkan, 1 refund');
  const ba = (await call('GET', '/bookings', null, A)).j.find(b => b.id === d1.id), bb = (await call('GET', '/bookings', null, Bt)).j.find(b => b.id === d2.id);
  ok(ba.status === 'Dibatalkan' && ba.cancel_reason === 'Studio dihapus admin' && ba.studio === 3 && bb.status === 'Dibatalkan' && bb.pay_status === 'refunded', 'booking terdampak dibatalkan (alasan tercatat); yang terbayar di-refund 100%');
  ms = (await call('GET', '/master')).j; ok(!ms.STUDIOS.some(s => s.id === 3) && ms.ALLSTUDIOS.some(s => s.id === 3 && s.deleted_at && s.status === 'UNAVAILABLE') && !(await call('GET', '/admin/studios', null, AD)).j.some(s => s.id === 3), 'studio terhapus hilang dari customer & daftar admin, tetap ada di ALLSTUDIOS untuk riwayat');
  await wait(500); const dm = mails.map(decode).filter(m => /dibatalkan/.test(m.subject)), mb = dm.find(m => m.to.includes('budi@x.id'));
  ok(dm.length === 2 && dm.some(m => m.to.includes('ana@x.id')) && mb && dm.every(m => /dibatalkan/.test(m.subject)), 'email pembatalan ke setiap customer terdampak');
  ok(mb.text.includes('Studio Anggrek') && mb.text.includes(far + ' 14:00') && mb.text.includes('Rp' + d2.amount.toLocaleString('id-ID')), 'email memuat studio, jadwal, dan nominal refund');
  ok((await call('PATCH', '/admin/studios/3', { name: 'X' }, AD)).s === 404 && (await call('DELETE', '/admin/studios/3', null, AD)).s === 404, 'studio terhapus: ubah/hapus -> 404');
  ok((await call('POST', '/bookings', { package_id: 1, studio_id: 3, date: far + ' 15:00' }, A)).s === 400 && (await call('GET', `/availability?studio_id=3&date=${far}`)).s === 400 && (await call('POST', '/quote', { package_id: 1, studio_id: 3 }, A)).s === 400, 'studio terhapus tidak bisa dipesan (booking, availability, quote)');
  ok((await call('POST', '/admin/studios', { ...nst, name: 'Studio Anggrek' }, AD)).s === 200, 'nama studio yang sudah dihapus boleh dipakai lagi');
  // booking kedaluwarsa tidak ikut dihitung/dibatalkan sebagai "Studio dihapus admin"
  const SD = (await call('GET', '/admin/studios', null, AD)).j.find(s => s.name === 'Studio Default').id, x1 = await book(call, A, SD, far + ' 9:00');
  const { DatabaseSync } = require('node:sqlite'), D = new DatabaseSync(DB('a')); D.prepare('UPDATE payment SET expire_at=? WHERE booking_id=?').run(Date.now() - 1000, x1.id); D.close();
  const dx = await call('DELETE', `/admin/studios/${SD}`, null, AD), bx = (await call('GET', '/bookings', null, A)).j.find(b => b.id === x1.id);
  ok(dx.s === 200 && dx.j.cancelled === 0 && bx.status === 'Dibatalkan' && !bx.cancel_reason, 'studio tanpa booking aktif langsung dihapus; booking kedaluwarsa tidak dihitung sebagai dibatalkan admin');
  // sesi berjalan memblokir penghapusan
  const e1 = await book(call, A, 1, far + ' 15:00'); await pay(call, A, e1.id); await call('PATCH', `/admin/bookings/${e1.id}`, { status: 'Sesi Berjalan' }, AD);
  const bl = await call('DELETE', '/admin/studios/1?confirm=1', null, AD); ok(bl.s === 409 && /sedang berlangsung/.test(bl.j.error) && (await call('GET', '/master')).j.STUDIOS.some(s => s.id === 1), 'studio dengan sesi berjalan tidak bisa dihapus');
  { const { DatabaseSync } = require('node:sqlite'), D = new DatabaseSync(DB('a')); D.prepare('UPDATE session SET end_time=? WHERE booking_id=?').run(Date.now() - 1000, e1.id); D.close(); } // waktu sesi habis tanpa customer membuka halaman sesi
  const tl = await call('DELETE', '/admin/studios/1', null, AD); ok(tl.s === 200 && (await call('GET', '/bookings', null, A)).j.find(b => b.id === e1.id).status === 'Selesai', 'sesi yang waktunya sudah habis tidak lagi memblokir penghapusan (booking jadi Selesai)');

  // --- server kedua: REFUND_SIMULATE_FAIL=1 membuat refund paksa (admin) gagal ---
  const C2 = await reg(call2, 'Cici', 'cici@x.id', '0833333333'), AD2 = await admin(call2);
  const f1 = await book(call2, C2, 1, far + ' 9:00'); await pay(call2, C2, f1.id);
  const fc = (await call2('POST', `/admin/bookings/${f1.id}/cancel`, {}, AD2)).j; ok(fc.refund && fc.refund.state === 'failed' && fc.booking.pay_status === 'refund_failed' && fc.booking.status === 'Dibatalkan', 'REFUND_SIMULATE_FAIL=1: pembatalan admin -> refund gagal, booking tetap dibatalkan');
  const f2 = await book(call2, C2, 2, far + ' 10:00'); await pay(call2, C2, f2.id); await wait(400); mails.length = 0;
  const fd = (await call2('DELETE', '/admin/studios/2?confirm=1', null, AD2)).j, fb = (await call2('GET', '/bookings', null, C2)).j.find(b => b.id === f2.id);
  ok(fd.cancelled === 1 && fd.refund_failed === 1 && fd.refunded === 0 && fb.status === 'Dibatalkan' && fb.pay_status === 'refund_failed', 'hapus studio saat refund gagal: booking dibatalkan, pembayaran ditandai refund gagal');
  await wait(500); ok(mails.map(decode).some(m => m.to.includes('cici@x.id') && /dibatalkan/.test(m.subject) && /gagal/.test(m.text)), 'email ke customer menyebut refund gagal dan tindak lanjut admin');
  ok((await call2('DELETE', '/admin/studios/3', null, AD2)).s === 200, 'studio lain tanpa booking aktif dihapus');
  const last = await call2('DELETE', '/admin/studios/1', null, AD2); ok(last.s === 409 && /Minimal satu studio/.test(last.j.error), 'studio terakhir tidak bisa dihapus');

  console.log(`\n${n} tes lulus`); stop(); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); stop(); process.exit(1); });
