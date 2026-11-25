// Isi akun demo (admin + customer) dari backend/.env.demo ke database yang sama dengan server.
// Pakai:  npm run seed:demo            (atau: node seed-demo.js [berkas-env])
// Aman dijalankan berulang: akun yang sudah ada diperbarui, bukan diduplikasi.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { parseEnv } = require('util');

// Variabel shell menang, lalu .env.demo, lalu .env (agar DB_FILE sama dengan server)
const load = (f, required) => {
  if (!fs.existsSync(f)) { if (!required) return; console.error(`Berkas ${path.basename(f)} tidak ada. Salin dulu: cp .env.demo.example .env.demo`); process.exit(1); }
  for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(f, 'utf8')))) if (!(k in process.env)) process.env[k] = v;
};
load(path.resolve(__dirname, process.argv[2] || '.env.demo'), true);
load(path.join(__dirname, '.env'), false);
if (process.env.DB_FILE && !path.isAbsolute(process.env.DB_FILE)) process.env.DB_FILE = path.join(__dirname, process.env.DB_FILE);

const e = k => (process.env[k] || '').trim(), errs = [];
const admin = { user: e('DEMO_ADMIN_USER'), pass: e('DEMO_ADMIN_PASS') };
const cust = { name: e('DEMO_CUSTOMER_NAME'), email: e('DEMO_CUSTOMER_EMAIL').toLowerCase(), phone: e('DEMO_CUSTOMER_PHONE'), pass: e('DEMO_CUSTOMER_PASS') };
const wantCust = Object.values(cust).some(Boolean);
if (!/^[A-Za-z0-9_.-]{3,30}$/.test(admin.user)) errs.push('DEMO_ADMIN_USER wajib diisi: 3-30 karakter (huruf, angka, _ . -), tanpa "@" karena form masuk membedakan admin dari email customer');
if (!(admin.pass.length >= 8 && /[a-z]/i.test(admin.pass) && /\d/.test(admin.pass))) errs.push('DEMO_ADMIN_PASS minimal 8 karakter, berisi huruf dan angka');
if (wantCust) { // aturan sama dengan /api/auth/register
  if (!cust.name) errs.push('DEMO_CUSTOMER_NAME wajib diisi');
  if (!/^\S+@\S+\.\S+$/.test(cust.email)) errs.push('DEMO_CUSTOMER_EMAIL tidak valid');
  if (!/^\d{8,15}$/.test(cust.phone)) errs.push('DEMO_CUSTOMER_PHONE harus 8-15 digit');
  if (cust.pass.length < 6) errs.push('DEMO_CUSTOMER_PASS minimal 6 karakter');
}
if (errs.length) { console.error('Isi .env.demo belum benar:\n- ' + errs.join('\n- ')); process.exit(1); }

const db = require('./db'), now = Date.now(); // membuat skema + data awal bila database masih baru
const hash = pw => { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(pw, s, 32).toString('hex'); };

// ---- data demo (DEMO_DATA=1): customer contoh, booking di setiap status, biaya operasional ----
// Booking milik customer demo dihapus lalu dibuat ulang setiap kali dijalankan, tanggalnya relatif ke hari ini.
const wantData = /^(1|true|ya|yes)$/i.test(e('DEMO_DATA'));
const TZ = +(process.env.TZ_OFFSET_MIN || 420), D = 864e5, M = 60e3, MARK = 'Data demo', HRS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const day = off => new Date(now + TZ * M + off * D).toISOString().slice(0, 10); // tanggal WIB, off hari dari hari ini
const slotMs = slot => { const [d, h] = slot.split(' '); return Date.parse(`${d}T${h.padStart(5, '0')}:00Z`) - TZ * M; }; // sama dengan server.js
const EXTRA = [['Rina Lestari', 'rina@selfiebox.test', '081299990001'], ['Budi Santoso', 'budi@selfiebox.test', '081299990002'],
  ['Sari Wulandari', 'sari@selfiebox.test', '081299990003'], ['Dimas Pratama', 'dimas@selfiebox.test', '081299990004']];
// [pemilik (0 = customer demo, 1-4 = EXTRA), hari dari hari ini, jam, studio ke-, paket ke-, keadaan]
const PLAN = [
  [0, 2, 10, 1, 2, 'upcoming'], [0, 6, 15, 2, 3, 'upcoming'],  // Terbayar: bisa reschedule / batal
  [0, 3, 13, 3, 1, 'pending'],                                 // Menunggu Pembayaran (kedaluwarsa 15 menit)
  [0, -4, 11, 1, 2, 'done'], [0, -10, 16, 2, 4, 'done'],       // Selesai
  [0, 4, 9, 2, 2, 'refunded'],                                 // Dibatalkan, refund berhasil
  [0, -2, 14, 3, 1, 'refund_failed'],                          // Dibatalkan < REFUND_MIN_HOURS, refund gagal
  [0, -6, 12, 1, 1, 'expired'],                                // tidak dibayar sampai batas waktu
  [1, 1, 10, 1, 1, 'upcoming'], [1, -20, 13, 2, 2, 'done'],
  [2, 2, 14, 2, 4, 'upcoming'], [2, -1, 10, 3, 3, 'done'], [2, -15, 17, 1, 2, 'done'],
  [3, 5, 11, 3, 2, 'upcoming'], [3, -7, 19, 2, 1, 'done'], [3, 3, 16, 1, 3, 'admin_cancel'],
  [4, 1, 18, 3, 4, 'upcoming'], [4, 2, 12, 1, 2, 'pending'], [4, -27, 9, 3, 3, 'done'], [4, -12, 20, 1, 2, 'done']];
const STATE = { // keadaan -> status booking, pembayaran, sesi (sama dengan yang ditulis server.js)
  upcoming: ['Terbayar', 'paid', 'Terjadwal'], pending: ['Menunggu Pembayaran', 'pending', 'Terjadwal'], done: ['Selesai', 'paid', 'Selesai'],
  refunded: ['Dibatalkan', 'refunded', 'Dibatalkan'], refund_failed: ['Dibatalkan', 'refund_failed', 'Dibatalkan'], expired: ['Dibatalkan', 'batal', 'Dibatalkan'], admin_cancel: ['Dibatalkan', 'refunded', 'Dibatalkan'] };
const CANCEL = { refunded: ['Tidak ada waktu', '', D], refund_failed: ['Pemesanan ganda', '', null], admin_cancel: ['Dibatalkan admin', 'Studio dalam perawatan', D] };

function seedData() {
  const run = (s, ...a) => db.prepare(s).run(...a), get = (s, ...a) => db.prepare(s).get(...a), all = (s, ...a) => db.prepare(s).all(...a);
  const pw = hash(wantCust ? cust.pass : crypto.randomBytes(12).toString('hex')); // tanpa customer demo: akun contoh tidak bisa dipakai login
  const owners = [wantCust ? get('SELECT id FROM user WHERE email=?', cust.email).id : null];
  for (const [name, email, phone] of EXTRA) {
    if (get('SELECT 1 FROM user WHERE phone=? AND email!=?', phone, email)) throw new Error(`Nomor ${phone} sudah dipakai akun lain`);
    const u = get('SELECT id FROM user WHERE email=?', email);
    if (u) run('UPDATE user SET name=?,phone=?,password=?,pw_changed_at=? WHERE id=?', name, phone, pw, now, u.id); else run('INSERT INTO user(name,email,password,phone) VALUES(?,?,?,?)', name, email, pw, phone);
    owners.push(get('SELECT id FROM user WHERE email=?', email).id);
  }
  // hapus booking lama milik customer demo (urutan mengikuti foreign key)
  const ids = owners.filter(Boolean), inn = `(${ids.map(() => '?').join(',')})`, bk = `SELECT id FROM booking WHERE user_id IN ${inn}`, ss = `SELECT id FROM session WHERE booking_id IN (${bk})`;
  const old = get(`SELECT COUNT(*) n FROM booking WHERE user_id IN ${inn}`, ...ids).n;
  run(`DELETE FROM photo WHERE session_id IN (${ss})`, ...ids); run(`DELETE FROM staff_log WHERE session_id IN (${ss})`, ...ids);
  ['session', 'payment'].forEach(t => run(`DELETE FROM ${t} WHERE booking_id IN (${bk})`, ...ids)); run(`DELETE FROM booking WHERE user_id IN ${inn}`, ...ids);

  const studios = all('SELECT * FROM studio WHERE deleted_at IS NULL ORDER BY id'), pkgs = all('SELECT * FROM package WHERE COALESCE(active,1)=1 ORDER BY id');
  if (!studios.length || !pkgs.length) throw new Error('Belum ada studio tersedia atau paket aktif');
  const pct = +(get("SELECT value FROM setting WHERE key='main_discount_pct'") || {}).value || 0, REFUND_H = +(process.env.REFUND_MIN_HOURS || 2);
  const taken = (sid, slot) => get("SELECT 1 FROM session WHERE studio_id=? AND slot=? AND status!='Dibatalkan'", sid, slot);
  const count = {}, skipped = [];
  PLAN.forEach(([o, off, hour, si, pi, state], i) => {
    const uid = owners[o]; if (!uid) return;
    const st = studios[(si - 1) % studios.length], pk = pkgs[(pi - 1) % pkgs.length], date = day(off), [bStat, pStat, sStat] = STATE[state];
    // booking aktif memakai slot: geser ke jam kosong berikutnya di hari yang sama bila slot sudah dipakai booking lain
    const k = HRS.indexOf(hour), h = sStat === 'Dibatalkan' ? hour : [...HRS.slice(k), ...HRS.slice(0, k)].find(x => !taken(st.id, `${date} ${x}:00`));
    if (h === undefined) { skipped.push(`${st.name} ${date}`); return; }
    const slot = `${date} ${h}:00`, at = slotMs(slot);
    // harga dihitung seperti quote() di server.js: biaya studio + paket - diskon utama
    const fee = st.price || 0, mainDisc = Math.round(pk.price * pct / 100), total = pk.price - mainDisc + fee;
    const created = state === 'pending' ? now - 2 * M : Math.min(now, at) - (2 + i % 3) * D, paid = ['pending', 'expired'].includes(state) ? null : created + 7 * M;
    const [reason, detail, before] = CANCEL[state] || [], cancelledAt = reason ? (before ? created + before : at - REFUND_H * 30 * M) : null;
    const bid = run(`INSERT INTO booking(user_id,package_id,status,amount,created_at,subtotal,main_disc,studio_fee,cancel_reason,cancel_detail,cancelled_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`, uid, pk.id, bStat, total, created, pk.price + fee, mainDisc, fee, reason || null, detail || null, cancelledAt).lastInsertRowid;
    run('INSERT INTO session(booking_id,studio_id,slot,start_time,end_time,status) VALUES(?,?,?,?,?,?)', bid, st.id, slot, state === 'done' ? at : null, state === 'done' ? at + pk.dur * M : null, sStat);
    run('INSERT INTO payment(booking_id,amount,status,method,expire_at,paid_at,refunded_at) VALUES(?,?,?,?,?,?,?)', bid, total, pStat, paid ? ['QRIS', 'Transfer Bank'][i % 2] : null,
      created + 15 * M, paid, pStat === 'refunded' ? cancelledAt : null);
    count[bStat] = (count[bStat] || 0) + 1;
  });

  // sesi studio contoh (dibuat admin): 09.00-17.50 (50 menit) untuk 7 hari ke depan di setiap studio yang belum dihapus.
  // Jam yang sudah lewat atau bertabrakan dengan sesi yang ada dilewati, jadi aman dijalankan berulang.
  let added = 0, linked = 0;
  for (const st of all('SELECT id FROM studio WHERE deleted_at IS NULL ORDER BY id')) for (let o = 0; o < 7; o++) for (let h = 9; h <= 17; h++) {
    const a = slotMs(`${day(o)} ${h}:00`), z = a + 50 * M; if (a <= now || get('SELECT 1 FROM studio_session WHERE studio_id=? AND deleted_at IS NULL AND start_time<? AND end_time>?', st.id, z, a)) continue;
    run(`INSERT INTO studio_session(studio_id,start_time,end_time,status) VALUES(?,?,?,'AVAILABLE')`, st.id, a, z); added++; }
  // booking demo aktif yang jam & studionya sama dengan sebuah sesi ditautkan ke sesi itu (paling banyak satu booking aktif per sesi)
  for (const b of all(`SELECT b.id,x.studio_id,x.slot FROM booking b JOIN session x ON x.booking_id=b.id WHERE b.user_id IN ${inn} AND b.status IN ('Menunggu Pembayaran','Terbayar') ORDER BY b.id`, ...ids)) {
    const ss = get('SELECT id FROM studio_session WHERE studio_id=? AND start_time=? AND deleted_at IS NULL', b.studio_id, slotMs(b.slot));
    if (!ss || get(`SELECT 1 FROM booking WHERE studio_session_id=? AND status IN ('Menunggu Pembayaran','Terbayar','Sesi Berjalan') AND id!=?`, ss.id, b.id)) continue; run('UPDATE booking SET studio_session_id=? WHERE id=?', ss.id, b.id); linked++; }
  run(`UPDATE studio_session SET status=CASE WHEN EXISTS(SELECT 1 FROM booking b WHERE b.studio_session_id=studio_session.id AND b.status IN ('Menunggu Pembayaran','Terbayar','Sesi Berjalan')) THEN 'UNAVAILABLE' ELSE 'AVAILABLE' END WHERE deleted_at IS NULL`); // sama dengan syncSessStatus di server.js

  run('DELETE FROM ops_item WHERE note=?', MARK); // pemasukan & biaya lain di laporan keuangan admin
  [[-14, 'Listrik & internet', 'biaya', 450000], [-7, 'Kertas & tinta cetak', 'biaya', 300000], [-3, 'Sewa studio untuk acara kampus', 'pemasukan', 500000]]
    .forEach(([off, label, kind, amount]) => run('INSERT INTO ops_item(date,label,kind,amount,note) VALUES(?,?,?,?,?)', day(off), label, kind, amount, MARK));

  console.log(`Data demo: ${EXTRA.length} customer contoh${wantCust ? ` (password sama dengan ${cust.email})` : ' (tidak bisa login: DEMO_CUSTOMER_* kosong)'}, 3 item keuangan.`);
  console.log(`Booking : ${old} lama dihapus, dibuat ${Object.entries(count).map(([s, n]) => `${n} ${s}`).join(', ')}.`);
  console.log(`Sesi    : ${added} ditambahkan, ${linked} booking ditautkan.`);
  if (count['Menunggu Pembayaran']) console.log('          Booking "Menunggu Pembayaran" otomatis batal 15 menit lagi (aturan pembayaran); jalankan ulang sebelum demo.');
  if (skipped.length) console.warn(`          Dilewati (semua jam sudah terisi): ${skipped.join('; ')}`);
}
db.exec('BEGIN');
try {
  const a = db.prepare('SELECT id FROM admin WHERE username=?').get(admin.user);
  if (a) db.prepare('UPDATE admin SET password=?,must_change=0,failed=0,locked_until=NULL,pw_changed_at=? WHERE id=?').run(hash(admin.pass), now, a.id);
  else db.prepare('INSERT INTO admin(username,password,must_change,created_at) VALUES(?,?,0,?)').run(admin.user, hash(admin.pass), now);
  console.log(`Admin "${admin.user}" ${a ? 'diperbarui' : 'dibuat'}.`);
  if (wantCust) {
    const u = db.prepare('SELECT id FROM user WHERE email=?').get(cust.email);
    if (db.prepare('SELECT 1 FROM user WHERE phone=? AND email!=?').get(cust.phone, cust.email)) throw new Error(`Nomor ${cust.phone} sudah dipakai akun lain`);
    if (u) db.prepare('UPDATE user SET name=?,phone=?,password=?,pw_changed_at=? WHERE id=?').run(cust.name, cust.phone, hash(cust.pass), now, u.id);
    else db.prepare('INSERT INTO user(name,email,password,phone) VALUES(?,?,?,?)').run(cust.name, cust.email, hash(cust.pass), cust.phone);
    console.log(`Customer "${cust.email}" ${u ? 'diperbarui' : 'dibuat'}.`);
  }
  if (wantData) seedData(); else console.log('Data demo dilewati (DEMO_DATA kosong).');
  db.exec('COMMIT');
} catch (err) { db.exec('ROLLBACK'); console.error('Gagal: ' + err.message); process.exit(1); }
