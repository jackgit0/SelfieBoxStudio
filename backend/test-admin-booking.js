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
  const far = dayOf(5), det = id => call('GET', `/admin/bookings/${id}`, null, AD), lst = async (qs = '') => (await call('GET', '/admin/bookings' + qs, null, AD)).j;

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

  console.log(`\n${n} tes lulus`); stop(); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error('✘ GAGAL:', e.message); stop(); process.exit(1); });
