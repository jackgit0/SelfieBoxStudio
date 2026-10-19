// Tes fitur desain baru: pembatalan + refund, tarif studio, properti (qty), profil, admin studio/properti/pose/booking/transaksi/media
const { spawn } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), fs = require('fs');
const PORT = 3927, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia3-')), B = `http://localhost:${PORT}`;
const srv = spawn('node', ['--disable-warning=ExperimentalWarning', 'server.js'], { cwd: __dirname, env: { ...process.env, ADMIN_PASS: 'Admin#12345', PORT, DB_FILE: path.join(TMP, 't.db'), UPLOAD_DIR: path.join(TMP, 'up'), MEDIA_DIR: path.join(TMP, 'media'), REFUND_MIN_HOURS: '96' } });
const call = async (m, p, body, tok) => { const r = await fetch(B + '/api' + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const wait = ms => new Promise(r => setTimeout(r, ms)), pad = n => String(n).padStart(2, '0');
(async () => { await wait(1200); let n = 0; const ok = (c, m) => { assert(c, m); console.log('✔', m); n++; };
  const dayOf = k => { const d = new Date(); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const U = (await call('POST', '/auth/register', { name: 'Ana', email: 'a@x.id', phone: '0811111111', password: 'secret1' })).j.token, AD = (await call('POST', '/admin/login', { username: 'adminstudio', password: 'Admin#12345' })).j.token;
  const m = (await call('GET', '/master')).j; ok(m.POLICY.refund_hours === 96 && m.STUDIOS[0].img && m.STUDIOS[0].address && m.PROP.some(p => p.img && p.category === 'Topi'), 'master memuat kebijakan refund, gambar/alamat studio, properti berfoto');
  // profil
  ok((await call('PATCH', '/me', { name: 'Ana B', phone: '0899999999' }, U)).j.name === 'Ana B', 'customer mengubah profil'); ok((await call('PATCH', '/me', { name: '', phone: '1' }, U)).s === 400, 'validasi profil');
  // tarif studio + properti qty
  ok((await call('PATCH', '/admin/studios/1', { price: 20000 }, AD)).s === 200, 'admin mengatur biaya sewa studio');
  const pid = (await call('POST', '/admin/properties', { name: 'Topi Langka', category: 'Topi', price: 3000, qty: 0 }, AD)).j.id;
  ok((await call('POST', '/quote', { package_id: 1, studio_id: 1, setup: { acc: [pid] } }, U)).s === 400, 'properti qty 0 tidak dapat dipesan');
  await call('PATCH', `/admin/properties/${pid}`, { qty: 2 }, AD); const q = (await call('POST', '/quote', { package_id: 1, studio_id: 1, setup: { bg: null, acc: [pid] } }, U)).j; ok(q.studio_fee === 20000 && q.add === 3000 && q.total === 50000 + 20000 + 3000, 'total = paket + biaya studio + add-on');
  ok((await call('POST', '/quote', { package_id: 1, studio_id: 1, setup: { bg: pid } }, U)).s === 400, 'accessory tidak bisa dipakai sebagai background');
  // slot jam 08.00-20.00 valid
  const far = dayOf(6), near = dayOf(3), b1 = (await call('POST', '/bookings', { package_id: 1, studio_id: 1, date: far + ' 8:00', setup: { acc: [pid] } }, U)).j; ok(b1.amount === 73000 && b1.studio_fee === 20000, 'booking jam 08:00 + biaya studio tersimpan');
  ok((await call('POST', '/bookings', { package_id: 1, studio_id: 1, date: far + ' 21:00' }, U)).s === 400, 'jam di luar 08-20 ditolak');
  // pembatalan belum bayar
  ok((await call('POST', `/bookings/${b1.id}/cancel`, { reason: 'Alasan ngawur' }, U)).s === 400, 'alasan pembatalan harus dari daftar'); ok((await call('POST', `/bookings/${b1.id}/cancel`, { reason: 'Pembatalan lainnya' }, U)).s === 400, '"lainnya" wajib diisi keterangan');
  const c0 = (await call('POST', `/bookings/${b1.id}/cancel`, { reason: 'Tidak ada waktu' }, U)).j; ok(c0.refund.state === 'none' && c0.booking.status === 'Dibatalkan', 'batal sebelum bayar: tanpa refund');
  // refund berhasil (jauh dari jadwal)
  const b2 = (await call('POST', '/bookings', { package_id: 2, studio_id: 2, date: far + ' 10:00' }, U)).j; await call('POST', `/bookings/${b2.id}/pay`, { method: 'QRIS' }, U);
  const rv0 = (await call('GET', '/admin/revenue', null, AD)).j.all.total; ok(rv0 === 90000, 'pendapatan memuat pembayaran lunas');
  const c1 = (await call('POST', `/bookings/${b2.id}/cancel`, { reason: 'Pembatalan lainnya', detail: 'Jadwal bentrok' }, U)).j; ok(c1.refund.state === 'refunded' && c1.refund.amount === 90000 && c1.booking.pay_status === 'refunded', 'refund berhasil bila jadwal masih jauh (>= batas jam)');
  ok((await call('GET', '/admin/revenue', null, AD)).j.all.total === 0, 'pendapatan berkurang setelah refund');
  ok((await call('GET', `/bookings/${b2.id}/invoice`, null, U)).s === 409, 'invoice tidak tersedia setelah refund'); ok((await call('POST', `/bookings/${b2.id}/cancel`, { reason: 'Tidak ada waktu' }, U)).s === 409, 'tidak bisa dibatalkan dua kali');
  // refund gagal (jadwal lebih dekat dari batas 96 jam)
  const b3 = (await call('POST', '/bookings', { package_id: 1, studio_id: 3, date: near + ' 14:00' }, U)).j; await call('POST', `/bookings/${b3.id}/pay`, {}, U);
  const c2 = (await call('POST', `/bookings/${b3.id}/cancel`, { reason: 'Tidak ada waktu' }, U)).j; ok(c2.refund.state === 'failed' && c2.booking.pay_status === 'refund_failed', 'refund gagal bila kurang dari batas jam sebelum sesi');
  ok((await call('GET', '/admin/revenue', null, AD)).j.all.total === 50000, 'refund gagal: uang tetap dihitung sebagai pendapatan');
  // admin: studio / properti / pose / booking / transaksi / media
  const sid = (await call('POST', '/admin/studios', { name: 'Studio Baru', description: 'x', address: 'Jl. Baru 1', price: 5000, people_range_id: 1, budget_range_id: 1 }, AD)).j.id; ok(sid, 'admin menambah studio'); ok((await call('GET', '/master')).j.STUDIOS.some(s => s.id === sid && s.img), 'studio baru memakai gambar bawaan');
  ok((await call('PATCH', `/admin/studios/${sid}`, { name: 'Studio Baru 2', img: 'javascript:alert(1)' }, AD)).s === 400, 'URL gambar berbahaya ditolak');
  ok((await call('DELETE', '/admin/studios/1', null, AD)).s === 409, 'studio yang punya riwayat booking tidak bisa dihapus'); ok((await call('DELETE', `/admin/studios/${sid}`, null, AD)).s === 200, 'studio tanpa riwayat dapat dihapus');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', up = (await call('POST', '/admin/media', { data: png }, AD)).j;
  ok(/^\/media\/.+\.png$/.test(up.url) && (await fetch(B + up.url).then(r => r.status)) === 200, 'unggah gambar admin & dapat diakses publik'); ok((await call('POST', '/admin/media', { data: 'data:text/html;base64,PGI+' }, AD)).s === 400, 'unggahan non-gambar ditolak'); ok((await call('POST', '/admin/media', { data: png }, U)).s === 401 || (await call('POST', '/admin/media', { data: png }, U)).s === 403, 'customer tidak bisa mengunggah media');
  ok((await call('PATCH', `/admin/properties/${pid}`, { img: up.url }, AD)).s === 200 && (await call('GET', '/master')).j.PROP.find(p => p.id === pid).img === up.url, 'foto properti diperbarui');
  const po = (await call('POST', '/admin/poses', { nama: 'Pose uji', people_range_id: 2 }, AD)).j.id; ok((await call('GET', '/master')).j.POSES[2].includes('Pose uji'), 'admin menambah pose'); await call('DELETE', `/admin/poses/${po}`, null, AD);
  const bl = (await call('GET', '/admin/bookings?status=Dibatalkan', null, AD)).j; ok(bl.length >= 2 && bl.every(b => b.status === 'Dibatalkan'), 'admin melihat daftar booking dengan filter status');
  const b4 = (await call('POST', '/bookings', { package_id: 1, studio_id: 2, date: far + ' 12:00' }, U)).j; await call('POST', `/bookings/${b4.id}/pay`, {}, U); const ac = (await call('POST', `/admin/bookings/${b4.id}/cancel`, {}, AD)).j; ok(ac.refund.state === 'refunded', 'admin membatalkan booking: otomatis refund');
  const tx = (await call('GET', '/admin/transactions', null, AD)).j; ok(tx.rows.length >= 2 && tx.refunded >= 140000 && tx.rows[0].invoice.startsWith('INV-'), 'admin melihat transaksi + total refund');
  ok((await call('GET', '/admin/transactions', null, U)).s === 403, 'customer tidak bisa melihat transaksi');
  console.log(`\n${n} tes lulus`); srv.kill(); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); srv.kill(); process.exit(1); });
