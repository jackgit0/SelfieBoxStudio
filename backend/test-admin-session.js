// Tes fitur admin sesi studio: ringkasan, tambah (berulang), ubah, hapus + konfirmasi/refund/email, integrasi studio, seeder demo (US-08 s.d. US-11). Jalankan: node --disable-warning=ExperimentalWarning test-admin-session.js
const { spawn, execFileSync } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), net = require('net'), fs = require('fs');
const PORT = 3932, PORT2 = 3933, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia-sess-')), mails = [];
// SMTP palsu (tanpa TLS) untuk memeriksa email notifikasi ke customer
const smtp = net.createServer(sock => { let data = '', inData = false; sock.write('220 mock\r\n');
  sock.on('data', d => { data += d; let i; while ((i = data.indexOf('\r\n')) >= 0 || (inData && data.includes('\r\n.\r\n'))) {
    if (inData) { const e = data.indexOf('\r\n.\r\n'); if (e < 0) break; const raw = data.slice(0, e); data = data.slice(e + 5); inData = false; mails.push(raw); sock.write('250 queued\r\n'); continue; }
    const line = data.slice(0, i); data = data.slice(i + 2);
    if (/^EHLO/.test(line)) sock.write('250 mock\r\n'); else if (/^MAIL|^RCPT/.test(line)) sock.write('250 ok\r\n'); else if (line === 'DATA') { inData = true; sock.write('354 go\r\n'); } else if (/^QUIT/.test(line)) { sock.end('221 bye\r\n'); } else sock.write('250 ok\r\n'); } }); }).listen(2527);
const decode = raw => { const parts = [...raw.matchAll(/base64\r\n\r\n([\s\S]*?)\r\n--/g)].map(m => Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString()); return { raw, text: parts.join('\n'), to: (/To: (.*)/.exec(raw) || [])[1], subject: Buffer.from((/Subject: =\?UTF-8\?B\?(.*)\?=/.exec(raw) || [])[1] || '', 'base64').toString() }; };
// server utama + server kedua dengan REFUND_SIMULATE_FAIL=1 (refund paksa selalu gagal), masing-masing dengan database sementara sendiri
const DB = k => path.join(TMP, k + '.db');
const start = (port, k, extra = {}) => spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: __dirname, env: { ...process.env, PORT: port, DB_FILE: DB(k), UPLOAD_DIR: path.join(TMP, k + '-up'), MEDIA_DIR: path.join(TMP, k + '-media'), ADMIN_PASS: 'Admin#12345', AUTH_RATE_LIMIT: '1000', SMTP_HOST: '127.0.0.1', SMTP_PORT: '2527', SMTP_SECURE: 'none', MAIL_FROM: 'toko@example.com', REFUND_SIMULATE_FAIL: '', ...extra } });
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
  // studio 3 dihapus (untuk kasus 404) dan studio baru 'Studio Anggrek' dibuat, seperti keadaan akhir tes studio
  const { DatabaseSync } = require('node:sqlite'); assert((await call('DELETE', '/admin/studios/3', null, AD)).s === 200, 'setup: hapus studio 3');
  assert((await call('POST', '/admin/studios', { name: 'Studio Anggrek', description: 'Studio uji', price: 10000, people_range_id: 1, budget_range_id: 1 }, AD)).s === 200, 'setup: studio baru');

  // --- sesi studio dibuat admin (US-08 s.d. US-11) ---
  const sql = (k, q, ...a) => { const d = new DatabaseSync(DB(k)); try { return /^\s*SELECT/i.test(q) ? d.prepare(q).all(...a) : d.prepare(q).run(...a); } finally { d.close(); } }; // hanya untuk menyiapkan keadaan
  const S2 = 2, AG = (await call('GET', '/admin/studios', null, AD)).j.find(s => s.name === 'Studio Anggrek').id, day1 = dayOf(3), day2 = dayOf(4);
  const sp = (sid, b, tok = AD) => call('POST', `/admin/studios/${sid}/sessions`, b, tok), ls = async (sid, qs = '') => (await call('GET', `/admin/studios/${sid}/sessions${qs}`, null, AD)).j;
  const sx = (id, b, qs = '') => call('PATCH', `/admin/sessions/${id}${qs}`, b, AD), sd = (id, qs = '') => call('DELETE', `/admin/sessions/${id}${qs}`, null, AD);
  const a1 = await sp(S2, { date: day1, start: '09:00', end: '09:50' }), c1 = (a1.j.created || [])[0] || {};
  ok(a1.s === 200 && a1.j.created.length === 1 && c1.status === 'AVAILABLE' && c1.date === day1 && c1.start === '09:00' && c1.end === '09:50' && c1.past === false && c1.booking === null, 'admin menambah sesi: tersimpan dengan status AVAILABLE');
  ok((await ls(S2, '?date=' + day1)).some(x => x.id === c1.id) && (await ls(S2, '?date=' + day2)).length === 0, 'ringkasan sesi studio difilter per tanggal');
  ok((await sp(S2, { date: day1, start: '11:00', end: '11:50' }, A)).s === 403 && (await call('GET', `/admin/studios/${S2}/sessions`, null, A)).s === 403 && (await call('PATCH', `/admin/sessions/${c1.id}`, { start: '09:00' }, A)).s === 403 && (await call('DELETE', `/admin/sessions/${c1.id}`, null, A)).s === 403, 'customer tidak bisa melihat/mengelola sesi (403)');
  ok((await sp(9999, { date: day1, start: '09:00', end: '09:50' })).s === 404 && (await sp(3, { date: day1, start: '09:00', end: '09:50' })).s === 404 && (await call('GET', '/admin/studios/3/sessions', null, AD)).s === 404, 'tambah/lihat sesi pada studio yang tidak ada atau sudah dihapus -> 404');
  const pastAdd = await sp(S2, { date: dayOf(-1), start: '10:00', end: '10:50' }); ok(pastAdd.s === 400 && /sudah lewat/.test(pastAdd.j.error), 'sesi dengan waktu mulai yang sudah lewat ditolak');
  const eqAdd = await sp(S2, { date: day1, start: '10:00', end: '10:00' }); ok(eqAdd.s === 400 && /lebih awal/.test(eqAdd.j.error) && (await sp(S2, { date: day1, start: '11:00', end: '10:00' })).s === 400, 'waktu mulai yang tidak lebih awal dari waktu selesai ditolak');
  ok((await sp(S2, { date: day1, start: '25:00', end: '25:50' })).s === 400 && (await sp(S2, { date: '2030-02-30', start: '09:00', end: '09:50' })).s === 400 && (await sp(S2, { date: day1, start: '9:00', end: '09:50' })).s === 400, 'format tanggal/jam sesi tidak valid ditolak');
  const ov = await sp(S2, { date: day1, start: '09:30', end: '10:20' }); ok(ov.s === 409 && /bertabrakan/.test(ov.j.error) && (await sp(S2, { date: day1, start: '08:00', end: '11:00' })).s === 409 && (await sp(S2, { date: day1, start: '09:10', end: '09:40' })).s === 409, 'sesi tumpang tindih (sebagian, mencakup, di dalam) pada studio yang sama ditolak');
  ok((await sp(S2, { date: day1, start: '09:50', end: '10:40' })).s === 200 && (await sp(AG, { date: day1, start: '09:00', end: '09:50' })).s === 200, 'sesi bersambung (09:50) dan jam sama di studio lain diterima');
  const pastId = +sql('a', 'INSERT INTO studio_session(studio_id,start_time,end_time,status) VALUES(?,?,?,?)', S2, Date.now() - 2 * 3600e3, Date.now() - 3600e3, 'AVAILABLE').lastInsertRowid;
  const allS2 = await ls(S2); ok(allS2.some(x => x.id === pastId && x.past === true) && allS2.every((x, i) => !i || allS2[i - 1].start_time <= x.start_time), 'ringkasan memuat sesi yang sudah lewat (past) dan urut waktu');
  // ubah sesi (US-10)
  const e3 = (await sp(S2, { date: day1, start: '13:00', end: '13:50' })).j.created[0];
  ok((await sx(e3.id, { start: '09:20', end: '10:00' })).s === 409, 'ubah sesi menjadi tumpang tindih ditolak');
  const pe = await sx(pastId, { start: '23:00', end: '23:30' }); ok(pe.s === 400 && /sudah lewat/.test(pe.j.error), 'sesi yang sudah lewat tidak dapat diubah');
  ok((await sx(e3.id, { start: '13:30', end: '13:00' })).s === 400 && (await sx(e3.id, { date: dayOf(-1) })).s === 400, 'ubah sesi memakai validasi yang sama (urutan jam, waktu lewat)');
  ok((await sx(9999, { start: '10:00' })).s === 404 && (await sd(9999)).s === 404, 'ubah/hapus sesi yang tidak ada -> 404');
  const e3b = await sx(e3.id, { start: '14:00', end: '14:50' }); ok(e3b.s === 200 && e3b.j.start === '14:00' && (await ls(S2, '?date=' + day1)).some(x => x.id === e3.id && x.start === '14:00' && x.end === '14:50'), 'ubah sesi tanpa booking langsung tersimpan');
  // sesi dengan booking aktif: peringatan + konfirmasi + email (SR-10-04, SR-10-06)
  const s4 = (await sp(S2, { date: day2, start: '15:00', end: '15:50' })).j.created[0], pb = await book(call, A, 2, day2 + ' 15:00'); await pay(call, A, pb.id); sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', s4.id, pb.id);
  const l4 = (await ls(S2, '?date=' + day2)).find(x => x.id === s4.id); ok(l4.status === 'UNAVAILABLE' && l4.booking && l4.booking.id === pb.id && l4.booking.customer === 'Ana' && l4.impact.active_bookings === 1, 'sesi berbooking aktif tampil UNAVAILABLE beserta bookingnya');
  const k0 = await sx(s4.id, { start: '16:00', end: '16:50' }); ok(k0.s === 409 && k0.j.needs_confirm === true && k0.j.impact.active_bookings === 1 && k0.j.impact.customers.includes('Ana') && (await ls(S2, '?date=' + day2)).find(x => x.id === s4.id).start === '15:00', 'ubah sesi berbooking aktif tanpa konfirmasi -> 409 + daftar customer, belum tersimpan');
  await wait(400); mails.length = 0; const k1 = await sx(s4.id, { start: '16:00', end: '16:50' }, '?confirm=1'); ok(k1.s === 200 && k1.j.start === '16:00' && k1.j.status === 'UNAVAILABLE', 'dengan konfirmasi perubahan sesi tersimpan');
  await wait(500); const em = mails.map(decode).filter(m => /diubah/.test(m.subject)); ok(em.length === 1 && em[0].to.includes('ana@x.id') && em[0].text.includes('16:00') && em[0].text.includes(day2), 'customer berbooking aktif menerima email jadwal baru');
  // hapus sesi (US-11)
  const s5 = (await sp(S2, { date: day2, start: '17:00', end: '17:50' })).j.created[0], u5 = await book(call, Bt, 2, day2 + ' 17:00'), p5 = await book(call, A, 2, day2 + ' 18:00'); await pay(call, A, p5.id);
  sql('a', 'UPDATE booking SET studio_session_id=? WHERE id IN (?,?)', s5.id, u5.id, p5.id);
  const dl0 = await sd(s5.id), di = dl0.j.impact || {}; ok(dl0.s === 409 && dl0.j.needs_confirm && di.active_bookings === 2 && di.paid_bookings === 1 && di.refund_total === p5.amount && (await ls(S2, '?date=' + day2)).some(x => x.id === s5.id), 'hapus sesi berbooking aktif tanpa konfirmasi -> 409 + dampak, sesi belum dihapus');
  await wait(400); mails.length = 0; const dl1 = await sd(s5.id, '?confirm=1'); ok(dl1.s === 200 && dl1.j.cancelled === 2 && dl1.j.refunded === 1 && dl1.j.refund_failed === 0, 'dengan konfirmasi: booking dibatalkan, yang terbayar di-refund');
  const bu = (await call('GET', '/bookings', null, Bt)).j.find(b => b.id === u5.id), bp = (await call('GET', '/bookings', null, A)).j.find(b => b.id === p5.id);
  ok(bu.status === 'Dibatalkan' && bu.cancel_reason === 'Sesi dihapus admin' && bp.status === 'Dibatalkan' && bp.pay_status === 'refunded' && !(await ls(S2, '?date=' + day2)).some(x => x.id === s5.id), 'booking terdampak dibatalkan (alasan tercatat), refund 100%, sesi hilang dari ringkasan');
  await wait(500); const dm2 = mails.map(decode).filter(m => /dibatalkan/.test(m.subject)); ok(dm2.length === 2 && dm2.some(m => m.to.includes('ana@x.id') && m.text.includes('dihapus')) && dm2.some(m => m.to.includes('budi@x.id')), 'email pembatalan ke customer yang bookingnya terdampak');
  ok((await sx(s5.id, { start: '17:00' })).s === 404 && (await sd(s5.id)).s === 404, 'sesi terhapus: ubah/hapus -> 404');
  const s6 = (await sp(S2, { date: day2, start: '19:00', end: '19:50' })).j.created[0], r6 = await book(call, A, 2, day2 + ' 19:00'); await pay(call, A, r6.id); sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', s6.id, r6.id); await call('POST', `/bookings/${r6.id}/start`, {}, A);
  const b6 = await sd(s6.id, '?confirm=1'); ok(b6.s === 409 && /sedang berlangsung/.test(b6.j.error), 'sesi dengan booking yang sedang berlangsung tidak bisa dihapus');
  sql('a', 'UPDATE session SET end_time=? WHERE booking_id=?', Date.now() - 1000, r6.id);
  ok((await sd(s6.id)).s === 200 && (await call('GET', '/bookings', null, A)).j.find(b => b.id === r6.id).status === 'Selesai', 'sesi foto yang waktunya habis tidak lagi memblokir penghapusan sesi');
  const d3 = await sd(e3.id); ok(d3.s === 200 && d3.j.cancelled === 0, 'sesi tanpa booking langsung dihapus tanpa konfirmasi');
  ok((await sd(pastId)).s === 200 && !(await ls(S2)).some(x => x.id === pastId), 'sesi yang sudah lewat boleh dihapus');
  // perbaikan audit: status kembali AVAILABLE, booking berjalan, tanggal tidak valid, batas hari/bulan WIB, jumlah email
  { const s8 = (await sp(S2, { date: day2, start: '20:00', end: '20:30' })).j.created[0], b8 = await book(call, Bt, 2, day2 + ' 20:00'); sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', s8.id, b8.id);
    ok((await ls(S2, '?date=' + day2)).find(x => x.id === s8.id).status === 'UNAVAILABLE', 'sesi tertaut booking belum dibayar: UNAVAILABLE');
    await call('POST', `/admin/bookings/${b8.id}/cancel`, {}, AD); const a8 = (await ls(S2, '?date=' + day2)).find(x => x.id === s8.id); ok(a8.status === 'AVAILABLE' && a8.booking === null && a8.impact.active_bookings === 0, 'booking tertaut dibatalkan -> sesi kembali AVAILABLE tanpa booking');
    const s9 = (await sp(S2, { date: day2, start: '21:00', end: '21:30' })).j.created[0], b9 = await book(call, A, 2, day1 + ' 20:00'); await pay(call, A, b9.id); sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', s9.id, b9.id); await call('POST', `/bookings/${b9.id}/start`, {}, A);
    const g9 = (await ls(S2, '?date=' + day2)).find(x => x.id === s9.id), p9 = await sx(s9.id, { start: '21:30', end: '22:00' }, '?confirm=1');
    ok(g9.status === 'UNAVAILABLE' && g9.booking.status === 'Sesi Berjalan' && p9.s === 409 && /sedang berlangsung/.test(p9.j.error), 'sesi dengan booking yang sedang berlangsung: UNAVAILABLE dan tidak bisa diubah');
    sql('a', 'UPDATE session SET end_time=? WHERE booking_id=?', Date.now() - 1000, b9.id); const t9 = (await ls(S2, '?date=' + day2)).find(x => x.id === s9.id);
    ok(t9.status === 'AVAILABLE' && t9.booking.status === 'Selesai' && (await sx(s9.id, { start: '21:30', end: '22:00' })).s === 200, 'sesi foto yang waktunya habis: ringkasan langsung AVAILABLE dan sesi bisa diubah lagi');
    ok((await call('GET', `/admin/studios/${S2}/sessions?date=2030-02-30`, null, AD)).s === 400, 'filter tanggal yang tidak ada ditolak');
    const fm = new Date(); fm.setDate(1); fm.setMonth(fm.getMonth() + 2); const M2 = `${fm.getFullYear()}-${pad(fm.getMonth() + 1)}`, first = M2 + '-01', pv = new Date(fm.getFullYear(), fm.getMonth(), 0), last = `${pv.getFullYear()}-${pad(pv.getMonth() + 1)}-${pad(pv.getDate())}`;
    const n1 = (await sp(S2, { date: first, start: '00:30', end: '01:00' })).j.created[0], n2 = (await sp(S2, { date: last, start: '23:30', end: '23:59' })).j.created[0];
    const lmA = await ls(S2, '?month=' + M2), lmB = await ls(S2, '?month=' + last.slice(0, 7)), ldA = await ls(S2, '?date=' + first), ldB = await ls(S2, '?date=' + last);
    ok(lmA.some(x => x.id === n1.id) && !lmA.some(x => x.id === n2.id) && lmB.some(x => x.id === n2.id) && !lmB.some(x => x.id === n1.id) && ldA.map(x => x.id).join() === String(n1.id) && ldB.map(x => x.id).join() === String(n2.id), 'batas hari dan bulan mengikuti WIB (00:30 dan 23:30)');
    const n3 = (await sp(S2, { date: first, start: '09:00', end: '09:50' })).j.created[0], b3 = await book(call, A, 2, first + ' 9:00'); await pay(call, A, b3.id); sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', n3.id, b3.id);
    const u3 = await sx(n3.id, { start: '09:00', end: '09:50' }), c3 = await sx(n3.id, { start: '10:00', end: '10:50' }, '?confirm=1'), n4 = (await sp(S2, { date: first, start: '12:00', end: '12:50' })).j.created[0], f3 = await sx(n4.id, { start: '12:10', end: '12:50' });
    ok(u3.s === 200 && u3.j.notified === 0 && c3.s === 200 && c3.j.notified === 1 && f3.s === 200 && f3.j.notified === 0, 'respons ubah sesi melaporkan jumlah customer yang diberi tahu'); }
  // tambah berulang (Berulang) dan filter bulan
  const r7 = dayOf(7); await sp(AG, { date: r7, start: '10:00', end: '10:50' });
  const rp = await sp(AG, { date: dayOf(6), start: '10:00', end: '10:50', repeat: 3 }); ok(rp.s === 200 && rp.j.created.length === 2 && rp.j.skipped.length === 1 && rp.j.skipped[0] === r7 && rp.j.created.map(x => x.date).join() === [dayOf(6), dayOf(8)].join(), 'tambah berulang 3 hari: hari yang bertabrakan dilewati dan dilaporkan');
  ok((await sp(AG, { date: dayOf(9), start: '10:00', end: '10:50', repeat: 31 })).s === 400 && (await sp(AG, { date: dayOf(9), start: '10:00', end: '10:50', repeat: 0 })).s === 400, 'jumlah hari berulang di luar 1-30 ditolak');
  ok((await sp(AG, { date: dayOf(6), start: '10:00', end: '10:50', repeat: 2 })).s === 409, 'tambah berulang yang seluruhnya bertabrakan ditolak');
  const mo = dayOf(6).slice(0, 7), lm = await ls(AG, '?month=' + mo); ok(lm.length && lm.every(x => x.date.startsWith(mo)) && rp.j.created.filter(x => x.date.startsWith(mo)).every(c => lm.some(x => x.id === c.id)) && (await call('GET', `/admin/studios/${AG}/sessions?month=2026-13`, null, AD)).s === 400, 'ringkasan sesi per bulan untuk kalender');
  // integrasi studio: jumlah sesi, dampak, kaskade (SR-03-02, US-06)
  const nAG = (await ls(AG)).length; ok((await call('GET', '/admin/studios', null, AD)).j.find(s => s.id === AG).sessions === nAG&& nAG === 4, 'daftar studio admin menghitung sesi yang belum dihapus');
  const g1 = await book(call, Bt, AG, far + ' 12:00'), g2 = await book(call, A, 2, dayOf(6) + ' 9:00'); await pay(call, A, g2.id); const agS = await ls(AG);
  sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', agS[0].id, g2.id); sql('a', 'UPDATE booking SET studio_session_id=? WHERE id=?', agS[1].id, g1.id);
  const gd0 = await call('DELETE', `/admin/studios/${AG}`, null, AD), gi = gd0.j.impact || {}; ok(gd0.s === 409 && gi.sessions === nAG && gi.active_bookings === 2 && gi.paid_bookings === 1, 'hapus studio: dampak memuat jumlah sesi dan booking lewat sesi (tanpa duplikat)');
  const gd1 = await call('DELETE', `/admin/studios/${AG}?confirm=1`, null, AD), gb = (await call('GET', '/bookings', null, A)).j.find(b => b.id === g2.id);
  ok(gd1.s === 200 && gd1.j.cancelled === 2 && gb.status === 'Dibatalkan' && gb.cancel_reason === 'Studio dihapus admin' && sql('a', 'SELECT COUNT(*) n FROM studio_session WHERE studio_id=? AND deleted_at IS NULL', AG)[0].n === 0, 'hapus studio membatalkan booking yang tertaut ke sesinya dan ikut menghapus sesinya');

  // --- server kedua: REFUND_SIMULATE_FAIL=1 membuat refund paksa (admin) gagal ---
  const C2 = await reg(call2, 'Cici', 'cici@x.id', '0833333333'), AD2 = await admin(call2);
  { const t = dayOf(3), z = (await call2('POST', '/admin/studios/1/sessions', { date: t, start: '11:00', end: '11:50' }, AD2)).j.created[0], zb = await book(call2, C2, 1, t + ' 11:00'); await pay(call2, C2, zb.id);
    const d = new DatabaseSync(DB('b')); d.prepare('UPDATE booking SET studio_session_id=? WHERE id=?').run(z.id, zb.id); d.close();
    const zr = (await call2('DELETE', `/admin/sessions/${z.id}?confirm=1`, null, AD2)).j, zz = (await call2('GET', '/bookings', null, C2)).j.find(b => b.id === zb.id);
    ok(zr.cancelled === 1 && zr.refund_failed === 1 && zz.status === 'Dibatalkan' && zz.pay_status === 'refund_failed', 'hapus sesi saat refund gagal: pembayaran ditandai refund gagal'); }

  // --- seeder demo: sesi contoh idempoten + booking demo ditautkan ke sesinya ---
  { const env = path.join(TMP, 'demo.env'), sdb = DB('seed'); fs.writeFileSync(env, 'DEMO_ADMIN_USER=demoadmin\nDEMO_ADMIN_PASS=Demo12345\nDEMO_CUSTOMER_NAME=Demo\nDEMO_CUSTOMER_EMAIL=demo@x.id\nDEMO_CUSTOMER_PHONE=0899999999\nDEMO_CUSTOMER_PASS=demo123\n');
    const seed = () => execFileSync('node', ['--disable-warning=ExperimentalWarning', 'seed-demo.js', env], { cwd: __dirname, env: { ...process.env, DB_FILE: sdb, DEMO_DATA: '1' } }).toString(), num = o => (/Sesi\s*: (\d+) ditambahkan, (\d+) booking ditautkan/.exec(o) || []).slice(1).map(Number);
    const [add1, link1] = num(seed()), [add2, link2] = num(seed()), d = new DatabaseSync(sdb);
    const dup = d.prepare('SELECT COUNT(*) n FROM (SELECT studio_id,start_time FROM studio_session WHERE deleted_at IS NULL GROUP BY 1,2 HAVING COUNT(*)>1)').get().n, una = d.prepare(`SELECT COUNT(*) n FROM studio_session WHERE status='UNAVAILABLE'`).get().n;
    const lk = d.prepare(`SELECT COUNT(*) n FROM booking b JOIN session x ON x.booking_id=b.id JOIN studio_session s ON s.id=b.studio_session_id WHERE b.status IN ('Menunggu Pembayaran','Terbayar') AND s.studio_id=x.studio_id`).get().n; d.close();
    ok(add1 > 0 && add2 === 0 && dup === 0, 'seeder demo: sesi contoh dibuat sekali, dijalankan ulang tidak menduplikasi');
    ok(link1 > 0 && link2 === link1 && lk === link2 && una === link2, 'seeder demo: booking aktif ditautkan ke sesi yang cocok dan sesinya UNAVAILABLE'); }

  console.log(`\n${n} tes lulus`); stop(); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); stop(); process.exit(1); });
