// Tes sesi foto di tablet studio: check-in oleh admin (Admin → Booking), Mulai Sesi dari slot, timer dibatasi akhir slot,
// foto diambil lewat rute admin, Akhiri Sesi / Keluar dengan password admin, Mode Staf dan rute mulai/foto customer sudah dihapus.
// Jam server digeser (TEST_CLOCK_OFFSET_MS) ke besok pukul 10.20 WIB agar aturan jam dapat diuji kapan saja.
// Jalankan: node --disable-warning=ExperimentalWarning test-kiosk.js
const { spawn } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), fs = require('fs');
const PORT = 3971, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia-kiosk-')), B = `http://localhost:${PORT}/api`, TZ = 420;
const ymdWib = t => new Date(t + TZ * 60000).toISOString().slice(0, 10);
const D = ymdWib(Date.now() + 864e5), D2 = ymdWib(Date.now() + 2 * 864e5); // hari sesi (besok) dan lusa
const target = Date.parse(`${D}T10:20:00Z`) - TZ * 60000, OFFSET = target - Date.now();
const srv = spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: __dirname, env: { ...process.env, PORT, DB_FILE: path.join(TMP, 't.db'), UPLOAD_DIR: path.join(TMP, 'up'), MEDIA_DIR: path.join(TMP, 'media'), ADMIN_PASS: 'Admin#12345', AUTH_RATE_LIMIT: '100', TEST_CLOCK_OFFSET_MS: String(OFFSET) } });
srv.stderr.on('data', d => process.stderr.write(d));
const call = async (m, p, body, tok) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
(async () => {
  for (let i = 0; i < 60; i++) { try { await fetch(B + '/master'); break; } catch { await wait(100); } }
  let n = 0; const ok = (c, m) => { assert(c, m); console.log('✔', m); n++; };
  const A = (await call('POST', '/auth/register', { name: 'Ana Putri', email: 'ana@x.id', phone: '0811111111', password: 'secret1' })).j.token;
  const AD = (await call('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' })).j.token; ok(A && AD, 'fixture: customer dan admin masuk');
  const book = async (date, pkg = 2) => (await call('POST', '/bookings', { package_id: pkg, studio_id: 1, date }, A)).j;
  const pay = id => call('POST', `/bookings/${id}/pay`, { method: 'QRIS' }, A);
  const b10 = await book(`${D} 10:00`), b11 = await book(`${D} 11:00`, 3), b12 = await book(`${D} 12:00`), bD2 = await book(`${D2} 10:00`);
  for (const b of [b10, b11, bD2]) await pay(b.id);
  ok(b10.id && b11.id && b12.id && bD2.id, 'fixture: booking 10.00 (sedang berjalan menurut jam server), 11.00, 12.00 belum bayar, lusa 10.00');

  // ----- rute lama sudah dihapus -----
  for (const [m, p] of [['POST', '/staff/login'], ['POST', `/bookings/${b10.id}/start`], ['POST', `/sessions/${b10.session_id}/photos`], ['POST', `/sessions/${b10.session_id}/control`]]) {
    const r = await call(m, p, { pin: '1234', img: JPG, action: 'pause' }, A); ok(r.s === 404 && r.j.error === 'Endpoint tidak ada', `${m} /api${p.replace(/\d+/, ':id')} sudah tidak ada (Mode Staf / mulai dan foto oleh customer dihapus)`); }

  // ----- check-in -----
  const ci = id => call('POST', `/admin/bookings/${id}/checkin`, {}, AD), det = async id => (await call('GET', `/admin/bookings/${id}`, null, AD)).j;
  ok((await call('POST', `/admin/bookings/${b10.id}/checkin`, {}, A)).s === 403, 'customer tidak dapat memanggil check-in admin');
  { const r = await ci(b12.id); ok(r.s === 409 && r.j.error === 'Hanya booking terbayar yang dapat check-in', 'check-in booking belum dibayar ditolak'); }
  { const r = await ci(bD2.id); ok(r.s === 409 && r.j.error === 'Check-in hanya dapat dilakukan pada hari sesi', 'check-in booking hari lain ditolak'); }
  ok((await det(b10.id)).checkin_block === null && (await det(bD2.id)).checkin_block === 'Check-in hanya dapat dilakukan pada hari sesi', 'detail booking admin: checkin_block (null = tombol Check-in aktif)');
  { const live = (await call('GET', '/admin/studios/1/live', null, AD)).j; ok(live.state === 'idle' && live.studio.name && live.next.booking_id === b10.id && live.next.customer === 'Ana' && !live.next.checked_in && live.booking === null, 'tablet sebelum check-in: menunggu check-in, booking berikutnya hari ini (nama depan saja)'); }
  { const r = await ci(b10.id); ok(r.s === 200 && r.j.checked_in_at && r.j.status === 'Terbayar' && r.j.checkin_block === 'Booking sudah check-in', 'check-in: checked_in_at terisi, status tetap Terbayar'); }
  ok((await ci(b10.id)).s === 409, 'check-in dua kali ditolak');
  { const list = (await call('GET', '/admin/bookings', null, AD)).j, mine = (await call('GET', '/bookings', null, A)).j; ok(list.find(b => b.id === b10.id).checked_in_at && mine.find(b => b.id === b10.id).checked_in_at, 'checked_in_at ada di daftar booking admin dan Booking Saya'); }
  { const c = await call('POST', `/bookings/${b10.id}/cancel`, { reason: 'Tidak ada waktu' }, A), r = await call('PATCH', `/bookings/${b10.id}`, { studio_id: 1, date: `${D2} 15:00` }, A), d = await call('DELETE', `/bookings/${b10.id}`, null, A);
    ok([c, r, d].every(x => x.s === 409 && /sudah check-in/.test(x.j.error)), 'setelah check-in customer tidak dapat membatalkan, menjadwal ulang, atau menghapus booking'); }

  // ----- Mulai Sesi di tablet -----
  { const live = (await call('GET', '/admin/studios/1/live', null, AD)).j; ok(live.state === 'ready' && live.booking.booking_id === b10.id && live.booking.can_start && live.booking.time === '10:00', 'tablet: booking yang sudah check-in siap dimulai'); }
  ok((await ci(b11.id)).s === 200, 'check-in lebih awal pada hari yang sama diperbolehkan (11.00)');
  { const r = await call('POST', `/admin/bookings/${b11.id}/start`, {}, AD); ok(r.s === 409 && r.j.error === 'Sesi baru dapat dimulai pukul 11:00', 'Mulai Sesi sebelum jam slot ditolak'); }
  { const r = await call('POST', `/admin/bookings/${bD2.id}/start`, {}, AD); ok(r.s === 409 && r.j.error === 'Booking belum check-in', 'Mulai Sesi tanpa check-in ditolak'); }
  const se = (await call('POST', `/admin/bookings/${b10.id}/start`, {}, AD)).j;
  ok(se.status === 'Aktif' && se.left > 14 * 60 && se.left <= 15 * 60 && se.customer === 'Ana' && se.package.photo_count === 8 && se.studio_name, 'Mulai Sesi: timer = durasi paket (15 menit, masih di dalam slot)');
  ok((await call('GET', '/admin/bookings', null, AD)).j.find(b => b.id === b10.id).status === 'Sesi Berjalan', 'booking menjadi Sesi Berjalan');
  { const live = (await call('GET', '/admin/studios/1/live', null, AD)).j; ok(live.state === 'running' && live.session.id === se.id, 'tablet: sesi berjalan dipulihkan dari server (muat ulang tablet)'); }
  { const r = await call('POST', `/admin/bookings/${b11.id}/start`, {}, AD); ok(r.s === 409, 'booking lain tidak dapat dimulai selama sesi berjalan'); }

  // ----- foto -----
  const ph = await call('POST', `/admin/photo-sessions/${se.id}/photos`, { img: JPG }, AD); ok(ph.s === 200 && ph.j.id, 'tablet mengambil foto lewat rute admin');
  ok((await call('POST', `/admin/photo-sessions/${se.id}/photos`, { img: 'x' }, AD)).s === 400, 'format foto tidak valid ditolak');
  ok((await call('POST', `/admin/photo-sessions/${se.id}/photos`, { img: JPG }, A)).s === 403, 'customer tidak dapat memakai rute foto tablet');
  const ph2 = (await call('POST', `/admin/photo-sessions/${se.id}/photos`, { img: JPG }, AD)).j; ok((await call('DELETE', `/admin/photos/${ph2.id}`, null, AD)).s === 200, 'foto di strip dapat dihapus selama sesi berjalan');
  { const s = (await call('GET', `/admin/photo-sessions/${se.id}`, null, AD)).j; ok(s.photos.length === 1 && s.photos[0].id === ph.j.id, 'sinkron sesi tablet: satu foto tersisa'); }
  { const mine = (await call('GET', '/sessions', null, A)).j; ok(mine.length === 1 && mine[0].status === 'Aktif' && mine[0].photos.length === 1, 'customer melihat sesi berjalan dan fotonya (status di Booking Detail, lalu Galeri)'); }

  // ----- password admin: Keluar dan Akhiri Sesi -----
  ok((await call('POST', '/admin/verify-password', { password: 'salah' }, AD)).s === 403 && (await call('POST', '/admin/verify-password', { password: 'Admin#12345' }, AD)).j.ok, 'Keluar: password admin dicek di server');
  { const r = await call('POST', `/admin/photo-sessions/${se.id}/end`, { password: 'salah' }, AD); ok(r.s === 403 && r.j.error === 'Password admin salah', 'Akhiri Sesi dengan password salah ditolak'); }
  { const r = await call('POST', `/admin/photo-sessions/${se.id}/end`, { password: 'Admin#12345' }, AD); ok(r.s === 200 && r.j.status === 'Selesai', 'Akhiri Sesi: sesi Selesai'); }
  ok((await call('GET', '/admin/bookings', null, AD)).j.find(b => b.id === b10.id).status === 'Selesai', 'booking menjadi Selesai');
  ok((await call('POST', `/admin/photo-sessions/${se.id}/photos`, { img: JPG }, AD)).s === 409 && (await call('DELETE', `/admin/photos/${ph.j.id}`, null, AD)).s === 409, 'setelah berakhir: foto tidak dapat diambil atau dihapus dari tablet');
  { const live = (await call('GET', '/admin/studios/1/live', null, AD)).j; ok(live.state === 'ready' && live.booking.booking_id === b11.id && !live.booking.can_start, 'tablet kembali menunggu: booking 11.00 sudah check-in, belum bisa dimulai'); }

  // ----- timer dibatasi akhir slot (status admin → Sesi Berjalan memakai aturan yang sama) -----
  { const r = await call('PATCH', `/admin/bookings/${b11.id}`, { status: 'Sesi Berjalan' }, AD); ok(r.s === 200, 'admin mengubah status menjadi Sesi Berjalan (tanpa syarat jam)');
    const s = (await call('GET', `/admin/photo-sessions/${r.j.session_id}`, null, AD)).j; ok(s.status === 'Aktif' && s.left > 20 * 60 - 5 && s.left <= 20 * 60, 'slot belum mulai: timer tetap durasi paket (20 menit)'); }
  { const b = await book(`${D} 13:00`, 4); await pay(b.id); const { DatabaseSync } = require('node:sqlite'), X = new DatabaseSync(path.join(TMP, 't.db')); X.prepare('UPDATE session SET slot=? WHERE booking_id=?').run(`${D} 9:00`, b.id); X.close(); // slot 09.00-09.50 sudah berakhir pada jam server 10.20
    ok((await ci(b.id)).j.error === 'Waktu sesi sudah lewat', 'check-in setelah slot berakhir ditolak'); }
  { const b = await book(`${D2} 9:00`, 4); await pay(b.id); const { DatabaseSync } = require('node:sqlite'), X = new DatabaseSync(path.join(TMP, 't.db'));
    X.prepare('UPDATE session SET slot=?,studio_id=2 WHERE booking_id=?').run(`${D} 10:00`, b.id); X.prepare('UPDATE booking SET checked_in_at=? WHERE id=?').run(Date.now(), b.id); X.close(); // Group 25 menit, slot berakhir 10.50: sisa 30 menit
    const s = (await call('POST', `/admin/bookings/${b.id}/start`, {}, AD)).j; ok(s.status === 'Aktif' && s.left > 24 * 60, 'paket 25 menit pada 10.20: timer 25 menit (akhir slot 10.50 belum tercapai)');
    const X2 = new DatabaseSync(path.join(TMP, 't.db')); X2.prepare(`UPDATE session SET status='Terjadwal' WHERE booking_id=?`).run(b.id); X2.prepare(`UPDATE booking SET status='Terbayar' WHERE id=?`).run(b.id); X2.prepare('UPDATE package SET dur=60 WHERE id=4').run(); X2.close();
    const s2 = (await call('POST', `/admin/bookings/${b.id}/start`, {}, AD)).j; ok(s2.left > 29 * 60 - 5 && s2.left <= 30 * 60, 'paket 60 menit pada 10.20: timer dibatasi akhir slot 10.50 (30 menit)'); }

  console.log(`\n${n} tes lulus`); srv.kill(); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); srv.kill(); process.exit(1); });
