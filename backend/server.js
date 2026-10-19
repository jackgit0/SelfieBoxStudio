// SelfieBox Studio API — Node >=22.5, tanpa dependensi eksternal
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
// Muat backend/.env (jika ada) tanpa dependensi; variabel yang sudah diset di shell tidak ditimpa
try { for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) { const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); if (m && !l.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
const db = require('./db'), { sendMail } = require('./mailer');
const PORT = +process.env.PORT || 3000, SECRET = process.env.JWT_SECRET || 'dev-secret-ubah-di-produksi', STAFF_PIN = process.env.STAFF_PIN || '1234';
// TZ_OFFSET_MIN=420 -> WIB. Akun admin ada di tabel `admin` pada database (bukan di kode).
const TZ = +(process.env.TZ_OFFSET_MIN || 420), BRAND = process.env.BRAND || 'SelfieBox Studio';
const FRONT = path.join(__dirname, '..', 'frontend'), UP = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'); fs.mkdirSync(UP, { recursive: true });
const HRS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], // sesi 50 menit per jam, 08.00-20.50
  MEDIA = process.env.MEDIA_DIR || path.join(__dirname, 'media'), REFUND_H = +(process.env.REFUND_MIN_HOURS || 2), b64 = b => Buffer.from(b).toString('base64url');
// ---------- util: JWT, password, error ----------
const sign = (p, ttl = 86400) => { const d = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({ ...p, iat: Math.floor(Date.now() / 1000), iatms: Date.now(), exp: Math.floor(Date.now() / 1000) + ttl })); return d + '.' + crypto.createHmac('sha256', SECRET).update(d).digest('base64url'); };
const verify = t => { try { const [h, p, s] = t.split('.'), e = crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url'); if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null; const o = JSON.parse(Buffer.from(p, 'base64url')); return o.exp > Date.now() / 1e3 ? o : null; } catch { return null; } };
const hash = pw => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); };
const check = (pw, st) => { const [s, h] = st.split(':'); return crypto.timingSafeEqual(crypto.scryptSync(pw, s, 32), Buffer.from(h, 'hex')); };
class HttpErr extends Error { constructor(c, m) { super(m); this.code = c; } }
const bad = (m, c = 400) => { throw new HttpErr(c, m); };
const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const now = () => Date.now(), q = (s, ...a) => db.prepare(s).all(...a), one = (s, ...a) => db.prepare(s).get(...a), run = (s, ...a) => db.prepare(s).run(...a);
const sha = x => crypto.createHash('sha256').update(String(x)).digest('hex'), eq = (a, b) => crypto.timingSafeEqual(Buffer.from(sha(a)), Buffer.from(sha(b)));
const getSet = k => (one('SELECT value FROM setting WHERE key=?', k) || {}).value;
const rmFiles = rows => rows.forEach(r => { try { fs.unlinkSync(path.join(UP, r.img_url)); } catch {} });
const RATE = +process.env.AUTH_RATE_LIMIT || 10; // maks. percobaan login/daftar/reset per IP per menit
const hits = new Map(); const limited = ip => { const t = now(), a = (hits.get(ip) || []).filter(x => t - x < 60000); a.push(t); hits.set(ip, a); return a.length > RATE; };
// ---------- domain helpers ----------
function expireStale() { // booking belum dibayar & lewat batas waktu -> batal, slot dibebaskan
  q(`SELECT b.id FROM booking b JOIN payment p ON p.booking_id=b.id WHERE b.status='Menunggu Pembayaran' AND p.expire_at<?`, now()).forEach(r => cancel(r.id));
}
const cancel = id => { run(`UPDATE booking SET status='Dibatalkan' WHERE id=?`, id); run(`UPDATE session SET status='Dibatalkan' WHERE booking_id=?`, id); run(`UPDATE payment SET status='batal' WHERE booking_id=? AND status!='paid'`, id); };
function left(s) { if (s.status !== 'Aktif') return 0; const ref = s.paused_at || now(), r = Math.ceil((s.end_time - ref) / 1000);
  if (r <= 0) { run(`UPDATE session SET status='Selesai' WHERE id=?`, s.id); run(`UPDATE booking SET status='Selesai' WHERE id=?`, s.booking_id); s.status = 'Selesai'; return 0; } return r; }
const sessOut = s => { const l = left(s), b = one('SELECT * FROM booking WHERE id=?', s.booking_id);
  return { id: s.id, booking_id: s.booking_id, user_id: b.user_id, pkg: b.package_id, start_time: s.start_time, left: l, paused: !!s.paused_at, status: s.status, confirmed: !!s.confirmed, setup: b.setup_json ? { ...JSON.parse(b.setup_json), ok: true } : null,
    photos: q('SELECT id,taken_at t,fav,sel,drive FROM photo WHERE session_id=? ORDER BY id', s.id).map(p => ({ ...p, fav: !!p.fav, sel: !!p.sel })) }; };
const bookOut = b => { const s = one('SELECT * FROM session WHERE booking_id=?', b.id), p = one('SELECT * FROM payment WHERE booking_id=?', b.id);
  return { id: b.id, user_id: b.user_id, package_id: b.package_id, studio: s.studio_id, date: s.slot, setup: b.setup_json ? { ...JSON.parse(b.setup_json), ok: true } : null, amount: b.amount, subtotal: b.subtotal ?? b.amount, main_disc: b.main_disc || 0, promo_disc: b.promo_disc || 0, promo_code: b.promo_code, status: b.status, expire_at: p.expire_at, session_id: s.id, paid: p.status === 'paid', studio_fee: b.studio_fee || 0, cancel_reason: b.cancel_reason, pay_status: p.status, method: p.method, paid_at: p.paid_at, refunded_at: p.refunded_at }; };
const ownBooking = (id, u) => one('SELECT * FROM booking WHERE id=? AND user_id=?', id, u.sub) || bad('Booking tidak ditemukan', 404);
const ownSession = (id, u) => one('SELECT s.* FROM session s JOIN booking b ON b.id=s.booking_id WHERE s.id=? AND b.user_id=?', id, u.sub) || bad('Sesi tidak ditemukan', 404);
const slotMs = slot => { const m = /^(\d{4}-\d{2}-\d{2}) (\d{1,2}):00$/.exec(slot); return Date.parse(`${m[1]}T${m[2].padStart(2, '0')}:00:00Z`) - TZ * 60000; };
function validSlot(slot) { const m = /^(\d{4}-\d{2}-\d{2}) (\d{1,2}):00$/.exec(slot || ''); if (!m || !HRS.includes(+m[2])) bad('Format/jam slot tidak valid'); if (slotMs(slot) < now() - 3000e3) bad('Jadwal sudah lewat'); }
function priceSetup(st) { if (!st) return { json: null, add: 0 }; const bg = st.bg || null, acc = [...new Set(st.acc || [])]; let add = 0;
  for (const id of [bg, ...acc].filter(Boolean)) { const p = one('SELECT * FROM property WHERE id=?', id); if (!p || p.qty <= 0) bad('Properti tidak tersedia'); add += p.price; if (id === bg && p.type !== 'background') bad('Background tidak valid'); }
  return { json: JSON.stringify({ vibe: st.vibe || null, bg, acc }), add }; }
// harga: paket - diskon utama + add-on - kode promo (satu fungsi untuk pratinjau & pembuatan booking)
function quote(pk, studio, st, code) { const { json, add } = priceSetup(st), fee = studio ? studio.price || 0 : 0; const pct = +getSet('main_discount_pct') || 0, mainDisc = Math.round(pk.price * pct / 100), base = pk.price - mainDisc + add + fee; let promoDisc = 0, promo = null;
  if (code) { promo = one('SELECT * FROM promo WHERE code=?', String(code).trim().toUpperCase()); if (!promo || !promo.active) bad('Kode promo tidak valid'); if (promo.expires_at && promo.expires_at < now()) bad('Kode promo sudah kedaluwarsa'); if (promo.max_uses && promo.used_count >= promo.max_uses) bad('Kuota kode promo sudah habis');
    promoDisc = promo.kind === 'percent' ? Math.round(base * promo.value / 100) : Math.min(promo.value, base); }
  return { json, add, studio_fee: fee, subtotal: pk.price + add + fee, mainDisc, promoDisc, total: Math.max(0, base - promoDisc), promo_code: promo ? promo.code : null, pct }; }
const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), idr = n => 'Rp' + Number(n).toLocaleString('id-ID');
const invNo = b => 'INV-' + new Date(b.created_at).toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(b.id).padStart(4, '0');
function invoice(bid) { const b = one('SELECT * FROM booking WHERE id=?', bid), u = one('SELECT name,email,phone FROM user WHERE id=?', b.user_id), pk = one('SELECT name FROM package WHERE id=?', b.package_id),
    s = one('SELECT * FROM session WHERE booking_id=?', b.id), st = one('SELECT name FROM studio WHERE id=?', s.studio_id), p = one('SELECT * FROM payment WHERE booking_id=?', b.id);
  let add = 0; if (b.setup_json) { const x = JSON.parse(b.setup_json); [x.bg, ...x.acc].filter(Boolean).forEach(i => { add += (one('SELECT price FROM property WHERE id=?', i) || {}).price || 0; }); }
  const sub = b.subtotal ?? b.amount, no = invNo(b), row = (l, v, c = '') => `<tr class="${c}"><td>${l}</td><td style="text-align:right">${v}</td></tr>`;
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${no}</title><style>body{font:15px system-ui,sans-serif;max-width:640px;margin:30px auto;padding:0 16px;color:#222}h1{margin:0;color:#e4572e}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:7px 4px;border-bottom:1px solid #eee}.t td{font-weight:700;border-top:2px solid #222}.d td{color:#2e9e6a}small{color:#666}@media print{body{margin:0}}</style></head><body>
<h1>${esc(BRAND)}</h1><p><b>INVOICE ${no}</b><br><small>Tanggal bayar: ${new Date(p.paid_at || b.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB · Metode: ${esc(p.method || '-')}</small></p>
<p><b>${esc(u.name)}</b><br><small>${esc(u.email)} · ${esc(u.phone)}</small></p><p>Studio: <b>${esc(st.name)}</b><br>Jadwal: <b>${esc(s.slot)}</b></p>
<table>${(b.studio_fee ? row('Biaya studio', idr(b.studio_fee)) : '') + row('Paket ' + esc(pk.name), idr(sub - add - (b.studio_fee || 0)))}${add ? row('Add-on setup', idr(add)) : ''}${b.main_disc ? row('Diskon utama', '-' + idr(b.main_disc), 'd') : ''}${b.promo_disc ? row('Kode promo ' + esc(b.promo_code), '-' + idr(b.promo_disc), 'd') : ''}${row('TOTAL', idr(b.amount), 't')}</table>
<p><small>Status pembayaran: ${p.status === 'paid' ? 'LUNAS' : esc(p.status)}. Terima kasih telah memilih ${esc(BRAND)}.</small></p></body></html>`; return { html, no, email: u.email, name: u.name }; }
async function sendInvoice(bid) { const v = invoice(bid); return sendMail({ to: v.email, subject: `Invoice ${v.no} - ${BRAND}`, html: `<p>Halo ${esc(v.name)},</p><p>Terima kasih. Invoice <b>${v.no}</b> terlampir pada email ini.</p>`, attachments: [{ name: v.no + '.html', type: 'text/html; charset=UTF-8', content: v.html }] }); }
// ---- akun admin: dibuat sekali saat tabel masih kosong (ADMIN_USER/ADMIN_PASS hanya untuk nilai awal), disimpan sebagai hash scrypt ----
if (!one('SELECT 1 FROM admin')) { const u = (process.env.ADMIN_USER || 'adminstudio').trim(), p = process.env.ADMIN_PASS || 'admin123', weak = !process.env.ADMIN_PASS || p === 'admin123' || p.length < 8;
  run('INSERT INTO admin(username,password,must_change,created_at) VALUES(?,?,?,?)', u, hash(p), weak ? 1 : 0, Date.now());
  console.warn(weak ? `[admin] Akun admin awal dibuat: "${u}" dengan password bawaan. SEGERA ganti lewat menu Akun Admin.` : `[admin] Akun admin awal dibuat: "${u}".`); }
const DUMMY_HASH = hash('dummy-untuk-menyamakan-waktu-respons');
// ---------- routes ----------
const R = [], route = (m, p, auth, fn) => R.push({ m, re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), auth, fn });
route('POST', '/api/auth/register', 0, ({ body, ip }) => { if (limited(ip)) bad('Terlalu banyak percobaan', 429);
  const { name, email, phone, password } = body; if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || !/^\d{8,15}$/.test(phone || '') || (password || '').length < 6) bad('Data tidak valid');
  if (one('SELECT 1 FROM user WHERE email=? OR phone=?', email.toLowerCase(), phone)) bad('Email/telepon sudah terdaftar', 409);
  const id = run('INSERT INTO user(name,email,password,phone) VALUES(?,?,?,?)', name.trim(), email.toLowerCase(), hash(password), phone).lastInsertRowid; return { token: sign({ sub: +id, role: 'customer' }), user: { id: +id, name: name.trim(), email: email.toLowerCase(), phone } }; });
route('POST', '/api/auth/login', 0, ({ body, ip }) => { if (limited(ip)) bad('Terlalu banyak percobaan', 429);
  const u = one('SELECT * FROM user WHERE email=?', (body.email || '').toLowerCase()); if (!u || !check(body.password || '', u.password)) bad('Email atau password salah', 401);
  return { token: sign({ sub: u.id, role: 'customer' }), user: { id: u.id, name: u.name, email: u.email, phone: u.phone } }; });
route('GET', '/api/master', 0, () => ({ PKG: q('SELECT * FROM package WHERE active!=0 ORDER BY price,id'), ALLPKG: q('SELECT * FROM package'), DISC: { pct: +getSet('main_discount_pct') || 0, label: getSet('main_discount_label') || '' }, POLICY: { refund_hours: REFUND_H }, PEOPLE: q('SELECT * FROM people_range'), BUDGET: q('SELECT * FROM budget_range'), STUDIOS: q('SELECT * FROM studio'), VIBES: q('SELECT * FROM vibe'),
  PROP: q('SELECT * FROM property ORDER BY img IS NULL,id').map(p => ({ id: p.id, vibe_id: p.vibe_id, type: p.type, name: p.name, price: p.price, category: p.category, qty: p.qty, img: p.img, [p.type === 'background' ? 'bg' : 'e']: p.extra })),
  POSES: q('SELECT * FROM pose').reduce((a, p) => ((a[p.people_range_id] = a[p.people_range_id] || []).push(p.nama), a), {}) }));
route('GET', '/api/preferences', 1, ({ user }) => ({ schedule: one('SELECT people,budget,schedule FROM schedule_preference WHERE user_id=? ORDER BY id DESC', user.sub) || null, setup: one('SELECT vibe,property FROM setup_preference WHERE user_id=?', user.sub) || null }));
route('PUT', '/api/preferences', 1, ({ body, user }) => { const { people, budget, vibe } = body; if (!one('SELECT 1 FROM people_range WHERE id=?', people) || !(budget > 0) || !one('SELECT 1 FROM vibe WHERE id=?', vibe)) bad('Preferensi tidak valid');
  run('INSERT INTO schedule_preference(user_id,people,budget) VALUES(?,?,?)', user.sub, people, budget); run('INSERT INTO setup_preference(user_id,vibe) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET vibe=excluded.vibe', user.sub, vibe); return { ok: true }; });
route('GET', '/api/availability', 0, ({ query }) => { expireStale(); const { studio_id, date } = query; if (!one('SELECT 1 FROM studio WHERE id=?', studio_id) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) bad('Parameter tidak valid');
  const used = q(`SELECT slot FROM session WHERE studio_id=? AND slot LIKE ? AND status!='Dibatalkan'`, studio_id, date + ' %').map(r => r.slot);
  return { free: HRS.filter(h => !used.includes(`${date} ${h}:00`) && slotMs(`${date} ${h}:00`) > now()) }; });
route('GET', '/api/bookings', 1, ({ user }) => { expireStale(); return q('SELECT * FROM booking WHERE user_id=? ORDER BY id DESC', user.sub).map(bookOut); });
route('POST', '/api/quote', 1, ({ body }) => { const pk = one('SELECT * FROM package WHERE id=? AND active!=0', body.package_id) || bad('Paket tidak valid'); const x = quote(pk, body.studio_id ? one('SELECT * FROM studio WHERE id=?', body.studio_id) : null, body.setup, body.code); delete x.json; return x; });
route('POST', '/api/bookings', 1, ({ body, user }) => { const pk = one('SELECT * FROM package WHERE id=? AND active!=0', body.package_id), st = one('SELECT * FROM studio WHERE id=?', body.studio_id);
  if (!pk || !st) bad('Paket/studio tidak valid'); validSlot(body.date); expireStale(); const x = quote(pk, st, body.setup, body.code);
  return tx(() => { let id; try { id = run('INSERT INTO booking(user_id,package_id,status,setup_json,amount,created_at,subtotal,main_disc,promo_disc,promo_code,studio_fee) VALUES(?,?,?,?,?,?,?,?,?,?,?)', user.sub, pk.id, 'Menunggu Pembayaran', x.json, x.total, now(), x.subtotal, x.mainDisc, x.promoDisc, x.promo_code, x.studio_fee).lastInsertRowid;
    run('INSERT INTO session(booking_id,studio_id,slot,status) VALUES(?,?,?,?)', id, st.id, body.date, 'Terjadwal'); } catch (e) { if (/UNIQUE/.test(e.message)) bad('Jadwal sudah tidak tersedia', 409); throw e; }
    run('INSERT INTO payment(booking_id,amount,status,expire_at) VALUES(?,?,?,?)', id, x.total, 'pending', now() + 15 * 60e3); return bookOut(one('SELECT * FROM booking WHERE id=?', id)); }); });
route('POST', '/api/bookings/:id/pay', 1, ({ params, body, user }) => { expireStale(); const b = ownBooking(params.id, user); if (b.status !== 'Menunggu Pembayaran') bad('Booking tidak dapat dibayar (kedaluwarsa/sudah dibayar)', 409);
  // Integrasi gateway nyata (Midtrans/Xendit) dipasang di sini; saat ini simulasi.
  const out = tx(() => { if (b.promo_code) { const pr = one('SELECT * FROM promo WHERE code=?', b.promo_code); if (!pr || !pr.active || (pr.expires_at && pr.expires_at < now()) || (pr.max_uses && pr.used_count >= pr.max_uses)) bad('Kode promo sudah tidak berlaku — buat booking ulang tanpa/dengan kode lain', 409); run('UPDATE promo SET used_count=used_count+1 WHERE id=?', pr.id); }
    run(`UPDATE payment SET status='paid',method=?,paid_at=? WHERE booking_id=?`, ['QRIS', 'Transfer Bank'].includes(body.method) ? body.method : 'QRIS', now(), b.id); run(`UPDATE booking SET status='Terbayar' WHERE id=?`, b.id);
    if (b.setup_json) { const s = JSON.parse(b.setup_json); [s.bg, ...s.acc].filter(Boolean).forEach(i => run('UPDATE property SET used_count=used_count+1 WHERE id=?', i)); } return bookOut(one('SELECT * FROM booking WHERE id=?', b.id)); });
  sendInvoice(b.id).catch(e => console.error('Gagal kirim invoice:', e.message)); return out; }); // invoice otomatis ke email customer
route('GET', '/api/bookings/:id/invoice', 1, ({ params, query, user, res }) => { const b = ownBooking(params.id, user), p = one('SELECT status FROM payment WHERE booking_id=?', b.id); if (p.status !== 'paid' || b.status === 'Dibatalkan') bad('Invoice tersedia setelah pembayaran', 409);
  const v = invoice(b.id); res.setHeader('Content-Type', 'text/html; charset=utf-8'); if (query.dl) res.setHeader('Content-Disposition', `attachment; filename="${v.no}.html"`); return { raw: Buffer.from(v.html) }; });
route('POST', '/api/bookings/:id/invoice/email', 1, async ({ params, user }) => { const b = ownBooking(params.id, user), p = one('SELECT status FROM payment WHERE booking_id=?', b.id); if (p.status !== 'paid' || b.status === 'Dibatalkan') bad('Invoice tersedia setelah pembayaran', 409);
  try { const r = await sendInvoice(b.id); return { ok: true, dev: !!r.dev }; } catch (e) { console.error('Gagal kirim invoice:', e.message); bad('Email gagal dikirim, coba lagi atau unduh invoice', 502); } });
route('PATCH', '/api/bookings/:id', 1, ({ params, body, user }) => { expireStale(); const b = ownBooking(params.id, user); if (!['Menunggu Pembayaran', 'Terbayar'].includes(b.status)) bad('Booking tidak dapat diubah', 409);
  if (!one('SELECT 1 FROM studio WHERE id=?', body.studio_id)) bad('Studio tidak valid'); validSlot(body.date);
  try { run('UPDATE session SET studio_id=?,slot=? WHERE booking_id=?', body.studio_id, body.date, b.id); } catch (e) { if (/UNIQUE/.test(e.message)) bad('Jadwal baru tidak tersedia', 409); throw e; } return bookOut(b); });
route('DELETE', '/api/bookings/:id', 1, ({ params, user }) => { const b = ownBooking(params.id, user); if (!['Menunggu Pembayaran', 'Terbayar'].includes(b.status)) bad('Booking tidak dapat dihapus', 409); cancel(b.id); return { ok: true }; });
// pembatalan + refund (simulasi): refund berhasil bila sesi masih >= REFUND_MIN_HOURS jam lagi, selain itu refund gagal
const REASONS = ['Tidak ada waktu', 'Penggunaan dana lain', 'Pemesanan ganda', 'Pembatalan lainnya'];
function cancelWithRefund(b, reason, detail, force) { const p = one('SELECT * FROM payment WHERE booking_id=?', b.id), s = one('SELECT * FROM session WHERE booking_id=?', b.id); let state = 'none';
  tx(() => { cancel(b.id); run('UPDATE booking SET cancel_reason=?,cancel_detail=?,cancelled_at=? WHERE id=?', reason, detail, now(), b.id);
    if (p.status === 'paid') { const ok = force || slotMs(s.slot) - now() >= REFUND_H * 3600e3; state = ok ? 'refunded' : 'failed'; run('UPDATE payment SET status=?,refunded_at=? WHERE id=?', ok ? 'refunded' : 'refund_failed', ok ? now() : null, p.id); } });
  return { ok: true, refund: { state, amount: state === 'none' ? 0 : p.amount, at: state === 'refunded' ? now() : null, min_hours: REFUND_H }, booking: bookOut(one('SELECT * FROM booking WHERE id=?', b.id)) }; }
route('POST', '/api/bookings/:id/cancel', 1, ({ params, body, user }) => { expireStale(); const b = ownBooking(params.id, user); if (!['Menunggu Pembayaran', 'Terbayar'].includes(b.status)) bad('Booking tidak dapat dibatalkan', 409);
  const reason = String(body.reason || ''), detail = String(body.detail || '').trim().slice(0, 300); if (!REASONS.includes(reason)) bad('Pilih alasan pembatalan'); if (reason === 'Pembatalan lainnya' && !detail) bad('Tuliskan alasan pembatalan Anda'); return cancelWithRefund(b, reason, detail, false); });
route('GET', '/api/me', 1, ({ user }) => one('SELECT id,name,email,phone FROM user WHERE id=?', user.sub));
route('PATCH', '/api/me', 1, ({ body, user }) => { const name = String(body.name || '').trim(), phone = String(body.phone || '').trim(); if (!name || !/^\d{8,15}$/.test(phone)) bad('Nama wajib diisi dan telepon 8-15 digit');
  try { run('UPDATE user SET name=?,phone=? WHERE id=?', name, phone, user.sub); } catch (e) { if (/UNIQUE/.test(e.message)) bad('Nomor telepon sudah dipakai', 409); throw e; } return one('SELECT id,name,email,phone FROM user WHERE id=?', user.sub); });
route('POST', '/api/bookings/:id/start', 1, ({ params, user }) => { const b = ownBooking(params.id, user); if (b.status !== 'Terbayar') bad('Booking belum terbayar', 409);
  const pk = one('SELECT * FROM package WHERE id=?', b.package_id), t = now(); run(`UPDATE session SET status='Aktif',start_time=?,end_time=?,paused_at=NULL WHERE booking_id=?`, t, t + pk.dur * 60e3, b.id); run(`UPDATE booking SET status='Sesi Berjalan' WHERE id=?`, b.id);
  return sessOut(one('SELECT * FROM session WHERE booking_id=?', b.id)); });
route('GET', '/api/sessions', 1, ({ user }) => q('SELECT s.* FROM session s JOIN booking b ON b.id=s.booking_id WHERE b.user_id=? AND s.status IN (\'Aktif\',\'Selesai\') ORDER BY s.id', user.sub).map(sessOut));
route('GET', '/api/sessions/:id', 1, ({ params, user }) => sessOut(ownSession(params.id, user)));
route('POST', '/api/sessions/:id/photos', 1, ({ params, body, user }) => { const s = ownSession(params.id, user), o = sessOut(s); if (o.status !== 'Aktif' || o.paused) bad('Sesi tidak aktif — pengambilan foto ditolak', 409);
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.img || ''); if (!m) bad('Format foto harus JPEG data-URL'); const buf = Buffer.from(m[1], 'base64'); if (buf.length > 4e6) bad('Foto terlalu besar', 413);
  const pk = one('SELECT p.photo_count FROM package p JOIN booking b ON b.package_id=p.id WHERE b.id=?', s.booking_id); if (o.photos.length >= pk.photo_count * 2) bad('Kuota pengambilan foto habis', 409);
  const f = `${s.id}-${now()}-${crypto.randomBytes(4).toString('hex')}.jpg`; fs.writeFileSync(path.join(UP, f), buf);
  const id = run('INSERT INTO photo(session_id,img_url,expire_at,taken_at) VALUES(?,?,?,?)', s.id, f, now() + 30 * 864e5, now()).lastInsertRowid; return { id: +id, t: now(), fav: false, sel: false, drive: 'lokal' }; });
const ownPhoto = (id, u) => one('SELECT p.*,s.confirmed,s.booking_id FROM photo p JOIN session s ON s.id=p.session_id JOIN booking b ON b.id=s.booking_id WHERE p.id=? AND b.user_id=?', id, u.sub) || bad('Foto tidak ditemukan', 404);
route('PATCH', '/api/photos/:id', 1, ({ params, body, user }) => { const p = ownPhoto(params.id, user);
  if ('fav' in body) run('UPDATE photo SET fav=? WHERE id=?', body.fav ? 1 : 0, p.id); if (['lokal', 'drive', 'gagal'].includes(body.drive)) run('UPDATE photo SET drive=? WHERE id=?', body.drive, p.id);
  if ('sel' in body) { run('UPDATE photo SET sel=? WHERE id=?', body.sel ? 1 : 0, p.id); run('UPDATE session SET confirmed=0 WHERE id=?', p.session_id); } return { ok: true }; });
route('DELETE', '/api/photos/:id', 1, ({ params, user }) => { const p = ownPhoto(params.id, user); run('DELETE FROM photo WHERE id=?', p.id); rmFiles([p]);
  if (p.sel) run('UPDATE session SET confirmed=0 WHERE id=?', p.session_id); return { ok: true }; });
// hapus massal: foto favorit selalu dilewati (dijaga di server)
route('POST', '/api/photos/bulk-delete', 1, ({ body, user }) => { const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number))].filter(Number.isInteger); if (!ids.length || ids.length > 500) bad('Pilih foto yang akan dihapus'); let del = 0, skip = 0; const touched = new Set();
  for (const id of ids) { const p = one('SELECT p.id,p.img_url,p.fav,p.sel,p.session_id FROM photo p JOIN session s ON s.id=p.session_id JOIN booking b ON b.id=s.booking_id WHERE p.id=? AND b.user_id=?', id, user.sub); if (!p) continue; if (p.fav) { skip++; continue; } run('DELETE FROM photo WHERE id=?', id); rmFiles([p]); del++; if (p.sel) touched.add(p.session_id); }
  touched.forEach(sid => run('UPDATE session SET confirmed=0 WHERE id=?', sid)); return { deleted: del, skipped_favorites: skip }; });
route('POST', '/api/sessions/:id/confirm', 1, ({ params, user }) => { const s = ownSession(params.id, user), n = one('SELECT COUNT(*) c FROM photo WHERE session_id=? AND sel=1', s.id).c, pk = one('SELECT p.photo_count FROM package p JOIN booking b ON b.package_id=p.id WHERE b.id=?', s.booking_id);
  if (!n) bad('Pilih minimal satu foto'); if (n > pk.photo_count) bad('Pilihan melebihi kuota paket', 422); run('UPDATE session SET confirmed=1 WHERE id=?', s.id); return { ok: true }; });
route('GET', '/api/photos/:id/image', 1, ({ params, query, user, res }) => { const p = ownPhoto(params.id, user); if (p.expire_at < now()) bad('Foto kedaluwarsa', 410);
  if (query.dl) { if (!p.sel || !p.confirmed) bad('Unduhan hanya untuk foto terpilih yang sudah dikonfirmasi', 403); res.setHeader('Content-Disposition', `attachment; filename="snapia-${p.id}.jpg"`); }
  res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'private, max-age=3600'); return { raw: fs.readFileSync(path.join(UP, p.img_url)) }; });
// ---- staf ----
route('POST', '/api/staff/login', 1, ({ body, user }) => { if (limited('pin' + user.sub)) bad('Terlalu banyak percobaan', 429); if (body.pin !== STAFF_PIN) bad('PIN staf salah', 401); return { token: sign({ sub: user.sub, role: 'staff' }, 8 * 3600) }; });
route('POST', '/api/sessions/:id/control', 1, ({ params, body, user, req }) => { const st = verify(req.headers['x-staff-token'] || ''); if (!st || st.role !== 'staff') bad('Hanya staf berwenang', 403);
  const s = one('SELECT * FROM session WHERE id=?', params.id) || bad('Sesi tidak ditemukan', 404); if (left(s) <= 0 && s.status !== 'Aktif') bad('Sesi sudah berakhir', 409); const a = body.action, t = now();
  if (a === 'pause' && !s.paused_at) run('UPDATE session SET paused_at=? WHERE id=?', t, s.id);
  else if (a === 'resume' && s.paused_at) run('UPDATE session SET end_time=end_time+?,paused_at=NULL WHERE id=?', t - s.paused_at, s.id);
  else if (a === 'stop') { run(`UPDATE session SET status='Selesai' WHERE id=?`, s.id); run(`UPDATE booking SET status='Selesai' WHERE id=?`, s.booking_id); } else if (!['pause', 'resume'].includes(a)) bad('Aksi tidak dikenal');
  run('INSERT INTO staff_log(session_id,action,at) VALUES(?,?,?)', s.id, a, t); return sessOut(one('SELECT * FROM session WHERE id=?', s.id)); });
// ---- lupa sandi (tautan dikirim lewat email; token acak sekali pakai, berlaku 30 menit, hanya hash yang disimpan) ----
route('POST', '/api/auth/forgot', 0, async ({ body, ip, req }) => { if (limited('fg' + ip)) bad('Terlalu banyak percobaan', 429);
  const u = one('SELECT * FROM user WHERE email=?', String(body.email || '').trim().toLowerCase());
  if (u) { const tok = crypto.randomBytes(32).toString('hex'); run('UPDATE password_reset SET used=1 WHERE user_id=? AND used=0', u.id); run('INSERT INTO password_reset(user_id,token_hash,expires_at) VALUES(?,?,?)', u.id, sha(tok), now() + 30 * 60e3);
    const link = `${process.env.BASE_URL || 'http://' + req.headers.host}/#reset=${tok}`;
    try { await sendMail({ to: u.email, subject: 'Atur ulang kata sandi ' + BRAND, html: `<p>Halo ${esc(u.name)},</p><p>Klik tautan berikut untuk membuat kata sandi baru (berlaku 30 menit):</p><p><a href="${link}">${link}</a></p><p>Abaikan email ini jika Anda tidak memintanya.</p>` }); } catch (e) { console.error('Gagal kirim email reset:', e.message); } }
  return { ok: true, message: 'Jika email terdaftar, tautan pengaturan ulang sandi telah dikirim.' }; }); // respons sama baik email ada/tidak (anti enumerasi)
route('POST', '/api/auth/reset', 0, ({ body, ip }) => { if (limited('rs' + ip)) bad('Terlalu banyak percobaan', 429); if (String(body.password || '').length < 6) bad('Password minimal 6 karakter');
  const r = one('SELECT * FROM password_reset WHERE token_hash=?', sha(body.token || '')); if (!r || r.used || r.expires_at < now()) bad('Tautan tidak valid atau sudah kedaluwarsa');
  run('UPDATE user SET password=?,pw_changed_at=? WHERE id=?', hash(body.password), now(), r.user_id); run('UPDATE password_reset SET used=1 WHERE user_id=?', r.user_id); return { ok: true }; }); // sesi lama otomatis tidak berlaku
// ---- formulir Contact Us (landing page): dikirim ke email admin (CONTACT_EMAIL / MAIL_FROM / SMTP_USER) ----
route('POST', '/api/contact', 0, async ({ body, ip }) => { if (limited('ct' + ip) || (hits.get('ct' + ip) || []).length > 5) bad('Terlalu banyak pesan, coba lagi sebentar lagi', 429);
  const name = String(body.name || '').trim(), email = String(body.email || '').trim(), text = String(body.message || '').trim();
  if (!name || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 120 || text.length < 5 || text.length > 1000) bad('Lengkapi nama, email yang valid, dan pesan (5-1000 karakter)');
  const to = process.env.CONTACT_EMAIL || process.env.MAIL_FROM || process.env.SMTP_USER || 'admin@localhost';
  try { await sendMail({ to, replyTo: email, subject: `Pesan baru dari ${name.replace(/[\r\n]/g, ' ')} - ${BRAND}`, html: `<p><b>${esc(name)}</b> &lt;${esc(email)}&gt; mengirim pesan melalui website:</p><blockquote style="white-space:pre-wrap">${esc(text)}</blockquote>` }); }
  catch (e) { console.error('Gagal kirim pesan kontak:', e.message); bad('Pesan gagal dikirim, coba lagi atau hubungi kami lewat WhatsApp', 502); }
  return { ok: true, message: 'Terima kasih! Pesan Anda sudah kami terima dan akan segera dibalas.' }; });
// ---- admin ----
route('POST', '/api/admin/login', 0, ({ body, ip }) => { if (limited('ad' + ip)) bad('Terlalu banyak percobaan', 429);
  const a = one('SELECT * FROM admin WHERE username=?', String(body.username || '').trim());
  if (a && a.locked_until && a.locked_until > now()) bad(`Akun admin terkunci sementara. Coba lagi dalam ${Math.ceil((a.locked_until - now()) / 60000)} menit.`, 429);
  const good = check(String(body.password || ''), a ? a.password : DUMMY_HASH) && !!a; // tetap hitung hash saat username salah (anti pembeda waktu)
  if (!good) { if (a) { const f = (a.failed || 0) + 1; if (f >= 5) run('UPDATE admin SET failed=0,locked_until=? WHERE id=?', now() + 15 * 60e3, a.id); else run('UPDATE admin SET failed=? WHERE id=?', f, a.id); } bad('Username atau password admin salah', 401); }
  run('UPDATE admin SET failed=0,locked_until=NULL WHERE id=?', a.id); return { token: sign({ sub: a.id, role: 'admin' }, 8 * 3600), admin: { username: a.username, must_change: !!a.must_change } }; }); // 5x salah -> terkunci 15 menit
route('GET', '/api/admin/me', 2, ({ user }) => { const a = one('SELECT username,must_change FROM admin WHERE id=?', user.sub); return { username: a.username, must_change: !!a.must_change }; });
route('PATCH', '/api/admin/account', 2, ({ body, user, ip }) => { if (limited('ac' + ip)) bad('Terlalu banyak percobaan', 429); const a = one('SELECT * FROM admin WHERE id=?', user.sub);
  if (!check(String(body.current_password || ''), a.password)) bad('Password saat ini salah', 403);
  const nu = body.username !== undefined && String(body.username).trim() !== '' ? String(body.username).trim() : a.username; if (!/^[A-Za-z0-9_.-]{3,30}$/.test(nu)) bad('Username 3-30 karakter (huruf, angka, _ . -)');
  let pw = a.password, must = a.must_change, ch = a.pw_changed_at; const np = body.new_password;
  if (np !== undefined && np !== '') { const t = String(np); if (t.length < 8 || !/[A-Za-z]/.test(t) || !/\d/.test(t)) bad('Password baru minimal 8 karakter dan mengandung huruf serta angka'); if (['admin123', 'password1', '12345678', 'adminstudio1'].includes(t.toLowerCase())) bad('Password terlalu mudah ditebak'); pw = hash(t); must = 0; ch = now(); }
  try { run('UPDATE admin SET username=?,password=?,must_change=?,pw_changed_at=? WHERE id=?', nu, pw, must, ch, a.id); } catch (e) { if (/UNIQUE/.test(e.message)) bad('Username sudah dipakai', 409); throw e; }
  return { ok: true, username: nu, token: sign({ sub: a.id, role: 'admin' }, 8 * 3600) }; }); // ganti password mencabut semua sesi admin lama
const dayStart = t => Math.floor((t + TZ * 60000) / 864e5) * 864e5 - TZ * 60000, ymd = t => new Date(t + TZ * 60000).toISOString().slice(0, 10);
// pendapatan = pembayaran lunas; yang sudah di-refund tidak dihitung, refund gagal (uang tidak kembali) tetap dihitung
const revenue = (from, to = 9e15) => one(`SELECT COALESCE(SUM(p.amount),0) total,COUNT(*) n FROM payment p JOIN booking b ON b.id=p.booking_id WHERE p.status IN ('paid','refund_failed') AND COALESCE(p.paid_at,b.created_at)>=? AND COALESCE(p.paid_at,b.created_at)<?`, from, to);
const periodStart = p => { const t = dayStart(now()); return { day: t, week: t - 6 * 864e5, month: t - 29 * 864e5, all: 0 }[p]; };
route('GET', '/api/admin/revenue', 2, () => { const t = dayStart(now()), first = one('SELECT MIN(created_at) m FROM booking').m;
  return { today: revenue(t), week: revenue(t - 6 * 864e5), month: revenue(t - 29 * 864e5), all: revenue(0), first_booking: first, first_date: first ? ymd(first) : null,
    daily: [6, 5, 4, 3, 2, 1, 0].map(i => ({ date: ymd(t - i * 864e5), ...revenue(t - i * 864e5, t - (i - 1) * 864e5) })) }; });
route('GET', '/api/admin/customers', 2, () => q(`SELECT u.id,u.name,u.email,u.phone,(SELECT COUNT(*) FROM booking b WHERE b.user_id=u.id) bookings,
  (SELECT COALESCE(SUM(p.amount),0) FROM payment p JOIN booking b ON b.id=p.booking_id WHERE b.user_id=u.id AND p.status IN ('paid','refund_failed')) spent,
  (SELECT COUNT(*) FROM photo ph JOIN session s ON s.id=ph.session_id JOIN booking b ON b.id=s.booking_id WHERE b.user_id=u.id) photos FROM user u ORDER BY u.id DESC`));
const custOr404 = id => one('SELECT id,name,email,phone FROM user WHERE id=?', id) || bad('Customer tidak ditemukan', 404);
route('GET', '/api/admin/customers/:id/bookings', 2, ({ params }) => { const u = custOr404(params.id);
  return { customer: u, bookings: q(`SELECT b.id,b.status,b.amount,b.subtotal,b.main_disc,b.promo_disc,b.promo_code,b.created_at,pk.name package,st.name studio,s.slot,p.status pay_status,p.method,p.paid_at
    FROM booking b JOIN package pk ON pk.id=b.package_id JOIN session s ON s.booking_id=b.id JOIN studio st ON st.id=s.studio_id LEFT JOIN payment p ON p.booking_id=b.id WHERE b.user_id=? ORDER BY b.id DESC`, u.id) }; });
route('GET', '/api/admin/customers/:id/photos', 2, ({ params }) => { const u = custOr404(params.id);
  return { customer: u, photos: q('SELECT ph.id,ph.taken_at,ph.fav,ph.sel,ph.session_id FROM photo ph JOIN session s ON s.id=ph.session_id JOIN booking b ON b.id=s.booking_id WHERE b.user_id=? ORDER BY ph.id DESC LIMIT 500', u.id) }; });
route('GET', '/api/admin/photos/:id/image', 2, ({ params, res }) => { const p = one('SELECT img_url FROM photo WHERE id=?', params.id) || bad('Foto tidak ditemukan', 404);
  res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'private, max-age=600'); return { raw: fs.readFileSync(path.join(UP, p.img_url)) }; });
route('DELETE', '/api/admin/customers/:id', 2, ({ params }) => { const u = custOr404(params.id), sub = '(SELECT s.id FROM session s JOIN booking b ON b.id=s.booking_id WHERE b.user_id=?)';
  const files = q(`SELECT img_url FROM photo WHERE session_id IN ${sub}`, u.id);
  tx(() => { run(`DELETE FROM photo WHERE session_id IN ${sub}`, u.id); run(`DELETE FROM staff_log WHERE session_id IN ${sub}`, u.id); run('DELETE FROM session WHERE booking_id IN (SELECT id FROM booking WHERE user_id=?)', u.id);
    run('DELETE FROM payment WHERE booking_id IN (SELECT id FROM booking WHERE user_id=?)', u.id); run('DELETE FROM booking WHERE user_id=?', u.id);
    ['schedule_preference', 'setup_preference', 'password_reset'].forEach(t => run(`DELETE FROM ${t} WHERE user_id=?`, u.id)); run('DELETE FROM user WHERE id=?', u.id); });
  rmFiles(files); return { ok: true, photos_deleted: files.length }; });
// rekapitulasi operasional: omset kotor (pendapatan booking + pemasukan lain) dikurangi biaya = omset bersih
const opsBody = b => { const label = String(b.label || '').trim(), amount = +b.amount; if (!label || !['biaya', 'pemasukan'].includes(b.kind) || !Number.isInteger(amount) || amount < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) bad('Data rekap tidak valid (tanggal, nama, jenis, nominal)'); return { label, amount, kind: b.kind, date: b.date, note: String(b.note || '').slice(0, 200) }; };
route('GET', '/api/admin/ops', 2, ({ query }) => { const per = ['day', 'week', 'month', 'all'].includes(query.period) ? query.period : 'month', from = periodStart(per), fd = from ? ymd(from) : '0000-00-00';
  const items = q('SELECT * FROM ops_item WHERE date>=? ORDER BY date DESC,id DESC', fd), sum = k => items.filter(i => i.kind === k).reduce((a, i) => a + i.amount, 0), rev = revenue(from).total, other = sum('pemasukan'), cost = sum('biaya');
  return { period: per, from: fd, items, booking_revenue: rev, other_income: other, gross: rev + other, costs: cost, net: rev + other - cost }; });
route('POST', '/api/admin/ops', 2, ({ body }) => { const o = opsBody(body); return { id: +run('INSERT INTO ops_item(date,label,kind,amount,note) VALUES(?,?,?,?,?)', o.date, o.label, o.kind, o.amount, o.note).lastInsertRowid }; });
route('PATCH', '/api/admin/ops/:id', 2, ({ params, body }) => { one('SELECT 1 FROM ops_item WHERE id=?', params.id) || bad('Item tidak ditemukan', 404); const o = opsBody(body); run('UPDATE ops_item SET date=?,label=?,kind=?,amount=?,note=? WHERE id=?', o.date, o.label, o.kind, o.amount, o.note, params.id); return { ok: true }; });
route('DELETE', '/api/admin/ops/:id', 2, ({ params }) => { run('DELETE FROM ops_item WHERE id=?', params.id); return { ok: true }; });
// paket
const pkgBody = b => { const name = String(b.name || '').trim(), price = +b.price, pc = +b.photo_count, dur = +b.dur; if (!name || !Number.isInteger(price) || price < 0 || !Number.isInteger(pc) || pc < 1 || !Number.isInteger(dur) || dur < 1) bad('Data paket tidak valid (nama, harga, jumlah foto, durasi)'); return { name, price, pc, dur, ss: String(b.strip_size || '').trim(), sm: String(b.strip_material || '').trim() }; };
const uniq = (fn) => { try { return fn(); } catch (e) { if (/UNIQUE/.test(e.message)) bad('Nama sudah dipakai', 409); throw e; } };
route('GET', '/api/admin/packages', 2, () => q('SELECT * FROM package ORDER BY active DESC,price,id'));
route('POST', '/api/admin/packages', 2, ({ body }) => { const p = pkgBody(body); return uniq(() => ({ id: +run('INSERT INTO package(name,price,photo_count,strip_size,strip_material,dur,active) VALUES(?,?,?,?,?,?,1)', p.name, p.price, p.pc, p.ss, p.sm, p.dur).lastInsertRowid })); });
route('PATCH', '/api/admin/packages/:id', 2, ({ params, body }) => { const cur = one('SELECT * FROM package WHERE id=?', params.id) || bad('Paket tidak ditemukan', 404); const p = pkgBody({ ...cur, ...body });
  const act = 'active' in body ? (body.active ? 1 : 0) : cur.active; if (!act && cur.active && one('SELECT COUNT(*) c FROM package WHERE active!=0').c <= 1) bad('Minimal satu paket harus aktif', 409);
  uniq(() => run('UPDATE package SET name=?,price=?,photo_count=?,strip_size=?,strip_material=?,dur=?,active=? WHERE id=?', p.name, p.price, p.pc, p.ss, p.sm, p.dur, act, cur.id)); return { ok: true }; }); // harga baru hanya berlaku untuk booking berikutnya
route('DELETE', '/api/admin/packages/:id', 2, ({ params }) => { const cur = one('SELECT * FROM package WHERE id=?', params.id) || bad('Paket tidak ditemukan', 404);
  if (cur.active && one('SELECT COUNT(*) c FROM package WHERE active!=0').c <= 1) bad('Minimal satu paket harus aktif', 409);
  if (one('SELECT 1 FROM booking WHERE package_id=?', cur.id)) { run('UPDATE package SET active=0 WHERE id=?', cur.id); return { ok: true, deactivated: true }; } run('DELETE FROM package WHERE id=?', cur.id); return { ok: true, deactivated: false }; });
// diskon utama (persen untuk semua paket) & kode promo
route('GET', '/api/admin/discount', 2, () => ({ pct: +getSet('main_discount_pct') || 0, label: getSet('main_discount_label') || '' }));
route('PUT', '/api/admin/discount', 2, ({ body }) => { const pct = +body.pct; if (!Number.isInteger(pct) || pct < 0 || pct > 100) bad('Diskon utama harus 0-100%'); run('UPDATE setting SET value=? WHERE key=?', String(pct), 'main_discount_pct'); run('UPDATE setting SET value=? WHERE key=?', String(body.label || '').slice(0, 60), 'main_discount_label'); return { ok: true }; });
const promoBody = b => { const code = String(b.code || '').trim().toUpperCase(), value = +b.value; if (!/^[A-Z0-9_-]{3,20}$/.test(code)) bad('Kode 3-20 karakter (huruf/angka/_/-)'); if (!['percent', 'nominal'].includes(b.kind) || !Number.isInteger(value) || value <= 0 || (b.kind === 'percent' && value > 100)) bad('Nilai diskon tidak valid');
  const exp = b.expires ? Date.parse(b.expires + 'T23:59:59Z') - TZ * 60000 : null; if (b.expires && isNaN(exp)) bad('Tanggal kedaluwarsa tidak valid'); return { code, kind: b.kind, value, max: Math.max(0, Math.floor(+b.max_uses) || 0), exp, active: b.active === false ? 0 : 1 }; };
route('GET', '/api/admin/promos', 2, () => q('SELECT * FROM promo ORDER BY id DESC'));
route('POST', '/api/admin/promos', 2, ({ body }) => { const p = promoBody(body); return uniq(() => ({ id: +run('INSERT INTO promo(code,kind,value,active,max_uses,expires_at) VALUES(?,?,?,?,?,?)', p.code, p.kind, p.value, p.active, p.max, p.exp).lastInsertRowid })); });
route('PATCH', '/api/admin/promos/:id', 2, ({ params, body }) => { one('SELECT 1 FROM promo WHERE id=?', params.id) || bad('Promo tidak ditemukan', 404); const p = promoBody(body); uniq(() => run('UPDATE promo SET code=?,kind=?,value=?,active=?,max_uses=?,expires_at=? WHERE id=?', p.code, p.kind, p.value, p.active, p.max, p.exp, params.id)); return { ok: true }; });
route('DELETE', '/api/admin/promos/:id', 2, ({ params }) => { run('DELETE FROM promo WHERE id=?', params.id); return { ok: true }; });
// ---- admin: studio, properti, pose, booking, transaksi, media ----
const int = (v, min = 0) => { const n = +v; if (!Number.isInteger(n) || n < min) bad('Angka tidak valid'); return n; };
const mediaUrl = v => { v = String(v || '').trim(); if (v && !/^(\/(img|media)\/[\w.\-]+|https?:\/\/[^\s'"()<>\\]+)$/.test(v)) bad('URL gambar tidak valid'); return v || null; };
route('POST', '/api/admin/media', 2, ({ body }) => { const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.data || ''); if (!m) bad('Gambar harus JPEG/PNG/WebP'); const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3e6) bad('Gambar maksimal 3 MB', 413);
  fs.mkdirSync(MEDIA, { recursive: true }); const f = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`; fs.writeFileSync(path.join(MEDIA, f), buf); return { url: '/media/' + f }; });
const studioBody = b => { const name = String(b.name || '').trim(); if (!name) bad('Nama studio wajib diisi'); return { name, description: String(b.description || '').slice(0, 500), address: String(b.address || '').slice(0, 200), price: int(b.price || 0), pr: int(b.people_range_id, 1), br: int(b.budget_range_id, 1), img: mediaUrl(b.img) }; };
route('GET', '/api/admin/studios', 2, () => q('SELECT s.*,(SELECT COUNT(*) FROM session x WHERE x.studio_id=s.id AND x.status!=\'Dibatalkan\') bookings FROM studio s ORDER BY s.id'));
route('POST', '/api/admin/studios', 2, ({ body }) => { const s = studioBody(body); if (!one('SELECT 1 FROM people_range WHERE id=?', s.pr) || !one('SELECT 1 FROM budget_range WHERE id=?', s.br)) bad('Rentang tidak valid');
  return { id: +run('INSERT INTO studio(name,description,address,price,people_range_id,budget_range_id,img) VALUES(?,?,?,?,?,?,?)', s.name, s.description, s.address, s.price, s.pr, s.br, s.img || '/img/studio-2.jpg').lastInsertRowid }; });
route('PATCH', '/api/admin/studios/:id', 2, ({ params, body }) => { const cur = one('SELECT * FROM studio WHERE id=?', params.id) || bad('Studio tidak ditemukan', 404); const s = studioBody({ ...cur, ...body });
  run('UPDATE studio SET name=?,description=?,address=?,price=?,people_range_id=?,budget_range_id=?,img=? WHERE id=?', s.name, s.description, s.address, s.price, s.pr, s.br, s.img || cur.img, cur.id); return { ok: true }; });
route('DELETE', '/api/admin/studios/:id', 2, ({ params }) => { one('SELECT 1 FROM studio WHERE id=?', params.id) || bad('Studio tidak ditemukan', 404); if (one('SELECT 1 FROM session WHERE studio_id=?', params.id)) bad('Studio sudah punya riwayat booking dan tidak dapat dihapus', 409);
  if (one('SELECT COUNT(*) c FROM studio').c <= 1) bad('Minimal satu studio harus ada', 409); run('DELETE FROM studio WHERE id=?', params.id); return { ok: true }; });
const CATS = ['Background', 'Topi', 'Rompi', 'Kalung', 'Kacamata', 'Lainnya'];
const propBody = b => { const name = String(b.name || '').trim(); if (!name || !CATS.includes(b.category)) bad('Nama dan kategori wajib diisi'); return { name, category: b.category, type: b.category === 'Background' ? 'background' : 'accessory', price: int(b.price || 0), qty: int(b.qty ?? 1), img: mediaUrl(b.img) }; };
route('GET', '/api/admin/properties', 2, () => q('SELECT id,name,type,category,price,qty,img,used_count FROM property ORDER BY img IS NULL,id'));
route('POST', '/api/admin/properties', 2, ({ body }) => { const p = propBody(body); return { id: +run('INSERT INTO property(name,type,vibe_id,price,qty,category,img) VALUES(?,?,?,?,?,?,?)', p.name, p.type, 1, p.price, p.qty, p.category, p.img).lastInsertRowid }; });
route('PATCH', '/api/admin/properties/:id', 2, ({ params, body }) => { const cur = one('SELECT * FROM property WHERE id=?', params.id) || bad('Properti tidak ditemukan', 404); const p = propBody({ ...cur, ...body });
  run('UPDATE property SET name=?,type=?,price=?,qty=?,category=?,img=? WHERE id=?', p.name, p.type, p.price, p.qty, p.category, 'img' in body ? p.img : cur.img, cur.id); return { ok: true }; });
route('DELETE', '/api/admin/properties/:id', 2, ({ params }) => { run('DELETE FROM property WHERE id=?', params.id); return { ok: true }; });
const poseBody = b => { const nama = String(b.nama || '').trim(); if (!nama || !one('SELECT 1 FROM people_range WHERE id=?', b.people_range_id)) bad('Nama pose dan jumlah orang wajib diisi'); return { nama, pr: int(b.people_range_id, 1) }; };
route('GET', '/api/admin/poses', 2, () => q('SELECT * FROM pose ORDER BY people_range_id,id'));
route('POST', '/api/admin/poses', 2, ({ body }) => { const p = poseBody(body); return { id: +run('INSERT INTO pose(nama,people_range_id) VALUES(?,?)', p.nama, p.pr).lastInsertRowid }; });
route('PATCH', '/api/admin/poses/:id', 2, ({ params, body }) => { one('SELECT 1 FROM pose WHERE id=?', params.id) || bad('Pose tidak ditemukan', 404); const p = poseBody(body); run('UPDATE pose SET nama=?,people_range_id=? WHERE id=?', p.nama, p.pr, params.id); return { ok: true }; });
route('DELETE', '/api/admin/poses/:id', 2, ({ params }) => { run('DELETE FROM pose WHERE id=?', params.id); return { ok: true }; });
route('GET', '/api/admin/bookings', 2, ({ query }) => { expireStale(); const st = query.status || '', term = '%' + String(query.q || '').toLowerCase() + '%';
  return q(`SELECT b.id,b.status,b.amount,b.created_at,b.cancel_reason,u.name customer,u.email,pk.name package,st.name studio,s.slot,p.status pay_status,p.method FROM booking b JOIN user u ON u.id=b.user_id JOIN package pk ON pk.id=b.package_id JOIN session s ON s.booking_id=b.id
    JOIN studio st ON st.id=s.studio_id LEFT JOIN payment p ON p.booking_id=b.id WHERE (?='' OR b.status=?) AND (lower(u.name) LIKE ? OR lower(u.email) LIKE ? OR lower(st.name) LIKE ?) ORDER BY b.id DESC LIMIT 500`, st, st, term, term, term); });
route('POST', '/api/admin/bookings/:id/cancel', 2, ({ params, body }) => { const b = one('SELECT * FROM booking WHERE id=?', params.id) || bad('Booking tidak ditemukan', 404); if (!['Menunggu Pembayaran', 'Terbayar'].includes(b.status)) bad('Booking tidak dapat dibatalkan', 409);
  return cancelWithRefund(b, 'Dibatalkan admin', String(body.detail || '').slice(0, 300), true); }); // admin selalu me-refund
route('GET', '/api/admin/transactions', 2, () => { const rows = q(`SELECT p.id,p.booking_id,p.amount,p.status,p.method,p.paid_at,p.refunded_at,b.created_at,u.name customer,u.email FROM payment p JOIN booking b ON b.id=p.booking_id JOIN user u ON u.id=b.user_id WHERE p.status!='pending' AND p.status!='batal' ORDER BY COALESCE(p.paid_at,b.created_at) DESC LIMIT 500`).map(r => ({ ...r, invoice: invNo({ id: r.booking_id, created_at: r.created_at }) }));
  const sum = st => rows.filter(r => st.includes(r.status)).reduce((a, r) => a + r.amount, 0); return { rows, paid: sum(['paid', 'refund_failed']), refunded: sum(['refunded']) }; });
// ---------- HTTP server ----------
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const readBody = req => new Promise((ok, no) => { let n = 0; const c = []; req.on('data', d => { n += d.length; if (n > 8e6) { no(new HttpErr(413, 'Payload terlalu besar')); req.destroy(); } else c.push(d); }); req.on('end', () => { try { ok(c.length ? JSON.parse(Buffer.concat(c)) : {}); } catch { no(new HttpErr(400, 'JSON tidak valid')); } }); });
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), send = (c, o) => { if (o && o.raw) { res.writeHead(c); return res.end(o.raw); } res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*'); res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Staff-Token'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (!u.pathname.startsWith('/api/')) { // file statis frontend (+ /media = gambar unggahan admin)
    const isM = u.pathname.startsWith('/media/'), root = isM ? MEDIA : FRONT, f = path.join(root, isM ? path.normalize(u.pathname.slice(7)) : u.pathname === '/' ? 'index.html' : path.normalize(u.pathname)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(res); }
  try { const r = R.find(r => r.m === req.method && r.re.test(u.pathname)); if (!r) throw new HttpErr(404, 'Endpoint tidak ada');
    const ctx = { req, res, ip: req.socket.remoteAddress, params: r.re.exec(u.pathname).groups || {}, query: Object.fromEntries(u.searchParams), body: ['GET', 'DELETE'].includes(req.method) ? {} : await readBody(req) };
    if (r.auth) { const t = (req.headers.authorization || '').replace('Bearer ', '') || ctx.query.t; ctx.user = verify(t || ''); if (!ctx.user) throw new HttpErr(401, 'Belum login');
      if (r.auth === 2) { if (ctx.user.role !== 'admin') throw new HttpErr(403, 'Hanya admin'); const a = one('SELECT pw_changed_at,must_change FROM admin WHERE id=?', ctx.user.sub); if (!a || (a.pw_changed_at && (ctx.user.iatms ?? ctx.user.iat * 1000) < a.pw_changed_at)) throw new HttpErr(401, 'Sesi admin tidak berlaku');
        if (a.must_change && !['/api/admin/me', '/api/admin/account'].includes(u.pathname)) throw new HttpErr(403, 'Ganti password bawaan terlebih dahulu (menu Akun Admin)'); } // password bawaan memblokir seluruh fitur admin
      else { const u = ctx.user.role === 'customer' && one('SELECT pw_changed_at FROM user WHERE id=?', ctx.user.sub); if (!u || (u.pw_changed_at && (ctx.user.iatms ?? ctx.user.iat * 1000) < u.pw_changed_at)) throw new HttpErr(401, 'Belum login'); } }
    send(200, await r.fn(ctx)); } catch (e) { if (!(e instanceof HttpErr)) console.error(e); send(e.code || 500, { error: e instanceof HttpErr ? e.message : 'Kesalahan server' }); }
}).listen(PORT, () => console.log(`Snapia berjalan di http://localhost:${PORT}`));
