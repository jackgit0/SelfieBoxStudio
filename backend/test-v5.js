// Tes fitur admin studio, sesi, dan booking (status studio, soft delete + refund, notifikasi email). Jalankan: node --disable-warning=ExperimentalWarning test-v5.js
const { spawn } = require('child_process'), assert = require('assert'), os = require('os'), path = require('path'), net = require('net'), fs = require('fs');
const PORT = 3930, PORT2 = 3931, TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snapia5-')), mails = [];
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

  // --- status studio & nama unik (SR-04-02, SR-04-03, SR-05-03) ---
  const nst = { description: 'Studio uji', price: 10000, people_range_id: 1, budget_range_id: 1 };
  const s1 = await call('POST', '/admin/studios', { ...nst, name: 'Studio Uji', status: 'UNAVAILABLE' }, AD); ok(s1.s === 200 && s1.j.id, 'admin menambah studio berstatus UNAVAILABLE'); const U1 = s1.j.id;
  ok((await call('POST', '/admin/studios', { ...nst, name: 'Studio Rusak', status: 'RUSAK' }, AD)).s === 400, 'status studio tidak valid ditolak');
  const dup = await call('POST', '/admin/studios', { ...nst, name: '  studio MAWAR ' }, AD); ok(dup.s === 409 && /sudah dipakai/.test(dup.j.error), 'nama studio ganda (beda huruf besar/spasi) ditolak saat tambah');
  ok((await call('PATCH', '/admin/studios/2', { name: 'Studio Mawar' }, AD)).s === 409, 'nama studio ganda ditolak saat ubah');
  ok((await call('PATCH', '/admin/studios/1', { name: 'Studio Mawar' }, AD)).s === 200, 'mengubah studio dengan namanya sendiri diterima');
  ok((await call('POST', '/admin/studios', { ...nst, name: 'Studio Default' }, AD)).s === 200 && (await call('GET', '/master')).j.STUDIOS.some(s => s.name === 'Studio Default' && s.status === 'AVAILABLE'), 'status bawaan studio baru AVAILABLE');
  // --- studio tidak tersedia disembunyikan dari customer (SR-05-05, SR-04-04) ---
  let ms = (await call('GET', '/master')).j; ok(!ms.STUDIOS.some(s => s.id === U1) && ms.ALLSTUDIOS.some(s => s.id === U1 && s.status === 'UNAVAILABLE'), 'studio tidak tersedia: tidak ada di STUDIOS, ada di ALLSTUDIOS');
  const av = await call('GET', `/availability?studio_id=${U1}&date=${far}`); ok(av.s === 400 && /tidak tersedia/.test(av.j.error), 'availability studio tidak tersedia ditolak');
  const nb = await call('POST', '/bookings', { package_id: 1, studio_id: U1, date: far + ' 10:00' }, A); ok(nb.s === 400 && /tidak tersedia/.test(nb.j.error), 'booking ke studio tidak tersedia ditolak');
  ok((await call('POST', '/quote', { package_id: 1, studio_id: U1 }, A)).s === 400, 'quote dengan studio tidak tersedia ditolak');
  const eb = await book(call, A, 2, far + ' 10:00'); ok((await call('PATCH', '/admin/studios/2', { status: 'UNAVAILABLE' }, AD)).s === 200, 'admin menonaktifkan studio yang sudah punya booking');
  const mine = (await call('GET', '/bookings', null, A)).j.find(b => b.id === eb.id); ok(mine && mine.status === 'Menunggu Pembayaran' && mine.studio === 2 && mine.date === far + ' 10:00', 'booking lama di studio tidak tersedia tetap utuh');
  ok((await call('PATCH', `/bookings/${eb.id}`, { studio_id: 2, date: far + ' 11:00' }, A)).s === 400, 'reschedule ke studio tidak tersedia ditolak');
  ok((await call('PATCH', '/admin/studios/2', { status: 'AVAILABLE' }, AD)).s === 200 && (await call('GET', '/master')).j.STUDIOS.some(s => s.id === 2) && (await call('GET', `/availability?studio_id=2&date=${far}`)).s === 200, 'studio kembali tersedia dan bisa dipesan');
  // --- daftar studio admin (SR-03-02) ---
  const L = (await call('GET', '/admin/studios', null, AD)).j, r2 = L.find(s => s.id === 2); ok(r2 && r2.status === 'AVAILABLE' && typeof r2.price === 'number' && r2.active_bookings === 1 && r2.sessions === 0, 'daftar studio admin: status, biaya, booking aktif, jumlah sesi');
  ok(L.some(s => s.id === U1 && s.status === 'UNAVAILABLE'), 'daftar studio admin memuat studio tidak tersedia');

  // --- server kedua: REFUND_SIMULATE_FAIL=1 membuat refund paksa (admin) gagal ---
  const C2 = await reg(call2, 'Cici', 'cici@x.id', '0833333333'), AD2 = await admin(call2);
  const f1 = await book(call2, C2, 1, far + ' 9:00'); await pay(call2, C2, f1.id);
  const fc = (await call2('POST', `/admin/bookings/${f1.id}/cancel`, {}, AD2)).j; ok(fc.refund && fc.refund.state === 'failed' && fc.booking.pay_status === 'refund_failed' && fc.booking.status === 'Dibatalkan', 'REFUND_SIMULATE_FAIL=1: pembatalan admin -> refund gagal, booking tetap dibatalkan');

  console.log(`\n${n} tes lulus`); stop(); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); stop(); process.exit(1); });
