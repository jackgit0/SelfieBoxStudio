// Skema SQLite mengikuti ERD (+ kolom pendukung alur sesi)
const { DatabaseSync } = require('node:sqlite');
const path = require('path'), seed = require('./seed.json');
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, 'snapia.db'));
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS user(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,phone TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS budget_range(id INTEGER PRIMARY KEY,budget TEXT);
CREATE TABLE IF NOT EXISTS people_range(id INTEGER PRIMARY KEY,range TEXT);
CREATE TABLE IF NOT EXISTS package(id INTEGER PRIMARY KEY,name TEXT UNIQUE,price INTEGER,photo_count INTEGER,strip_size TEXT,strip_material TEXT,dur INTEGER);
CREATE TABLE IF NOT EXISTS studio(id INTEGER PRIMARY KEY,name TEXT,description TEXT,budget_range_id INTEGER REFERENCES budget_range(id),people_range_id INTEGER REFERENCES people_range(id));
CREATE TABLE IF NOT EXISTS property(id INTEGER PRIMARY KEY,name TEXT,type TEXT,img_url TEXT,extra TEXT);
CREATE TABLE IF NOT EXISTS pose(id INTEGER PRIMARY KEY AUTOINCREMENT,nama TEXT,img_url TEXT,people_range_id INTEGER REFERENCES people_range(id));
CREATE TABLE IF NOT EXISTS booking(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES user(id),package_id INTEGER NOT NULL REFERENCES package(id),status TEXT NOT NULL,amount INTEGER NOT NULL,created_at INTEGER);
CREATE TABLE IF NOT EXISTS payment(id INTEGER PRIMARY KEY AUTOINCREMENT,booking_id INTEGER NOT NULL REFERENCES booking(id),amount INTEGER,status TEXT,method TEXT,expire_at INTEGER);
CREATE TABLE IF NOT EXISTS session(id INTEGER PRIMARY KEY AUTOINCREMENT,booking_id INTEGER NOT NULL REFERENCES booking(id),studio_id INTEGER NOT NULL REFERENCES studio(id),slot TEXT NOT NULL,start_time INTEGER,end_time INTEGER,paused_at INTEGER,status TEXT NOT NULL,confirmed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS photo(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id INTEGER NOT NULL REFERENCES session(id),img_url TEXT,equipment_id INTEGER,expire_at INTEGER,taken_at INTEGER,fav INTEGER DEFAULT 0,sel INTEGER DEFAULT 0,drive TEXT DEFAULT 'lokal');
CREATE TABLE IF NOT EXISTS staff_log(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id INTEGER,action TEXT,at INTEGER);
CREATE INDEX IF NOT EXISTS ix_sess_slot ON session(studio_id,slot);
-- Satu slot aktif per studio dicegah di level DB (race condition)
CREATE UNIQUE INDEX IF NOT EXISTS ux_slot ON session(studio_id,slot) WHERE status!='Dibatalkan';`);
if (!db.prepare('SELECT 1 FROM package').get()) {
  const ins = (t, cols, rows) => { const st = db.prepare(`INSERT INTO ${t}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`); rows.forEach(r => st.run(...cols.map(c => r[c] ?? null))); };
  ins('budget_range', ['id', 'budget'], seed.BUDGET); ins('people_range', ['id', 'range'], seed.PEOPLE);
  ins('package', ['id', 'name', 'price', 'photo_count', 'strip_size', 'strip_material', 'dur'], seed.PKG);
  ins('studio', ['id', 'name', 'description', 'people_range_id', 'budget_range_id'], seed.STUDIOS);
  seed.PROP.forEach(p => db.prepare('INSERT INTO property(id,name,type,extra) VALUES(?,?,?,?)').run(p.id, p.name, p.type, p.bg || p.e));
  Object.entries(seed.POSES).forEach(([pid, l]) => l.forEach(n => db.prepare('INSERT INTO pose(nama,people_range_id) VALUES(?,?)').run(n, +pid)));
}
// ---- migrasi: tabel & kolom baru (aman untuk database lama) ----
db.exec(`CREATE TABLE IF NOT EXISTS password_reset(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES user(id),token_hash TEXT UNIQUE NOT NULL,expires_at INTEGER NOT NULL,used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS setting(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS ops_item(id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL,label TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,note TEXT);`);
const addCol = (t, c, def) => { if (!db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
addCol('user', 'pw_changed_at', 'INTEGER'); addCol('package', 'active', 'INTEGER DEFAULT 1'); addCol('payment', 'paid_at', 'INTEGER');
addCol('booking', 'subtotal', 'INTEGER'); addCol('booking', 'main_disc', 'INTEGER DEFAULT 0');
db.prepare(`INSERT OR IGNORE INTO setting(key,value) VALUES('main_discount_pct','0'),('main_discount_label','')`).run();

// ---- akun admin disimpan di database (password di-hash scrypt) ----
db.exec(`CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,must_change INTEGER DEFAULT 0,failed INTEGER DEFAULT 0,locked_until INTEGER,pw_changed_at INTEGER,created_at INTEGER)`);
// ---- migrasi v3 (desain baru): studio, properti, pembatalan & refund ----
addCol('studio', 'img', 'TEXT'); addCol('studio', 'price', 'INTEGER DEFAULT 0');
addCol('property', 'category', 'TEXT'); addCol('property', 'qty', 'INTEGER DEFAULT 1'); addCol('property', 'img', 'TEXT');
addCol('booking', 'studio_fee', 'INTEGER DEFAULT 0'); addCol('booking', 'cancel_reason', 'TEXT'); addCol('booking', 'cancel_detail', 'TEXT'); addCol('booking', 'cancelled_at', 'INTEGER');
addCol('payment', 'refunded_at', 'INTEGER');
// ---- migrasi fitur admin: status studio (AVAILABLE/UNAVAILABLE) & soft delete ----
addCol('studio', 'status', "TEXT DEFAULT 'AVAILABLE'"); addCol('studio', 'deleted_at', 'INTEGER');
db.prepare(`UPDATE studio SET status='AVAILABLE' WHERE status IS NULL OR status=''`).run();
// ---- migrasi fitur admin: sesi studio dibuat admin (terpisah dari tabel `session` = runtime sesi foto per booking) ----
db.exec(`CREATE TABLE IF NOT EXISTS studio_session(id INTEGER PRIMARY KEY AUTOINCREMENT,studio_id INTEGER NOT NULL REFERENCES studio(id),start_time INTEGER NOT NULL,end_time INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'AVAILABLE',deleted_at INTEGER);
CREATE INDEX IF NOT EXISTS ix_ssess ON studio_session(studio_id,start_time);`);
addCol('booking', 'studio_session_id', 'INTEGER REFERENCES studio_session(id)');
const flag = k => db.prepare('SELECT 1 FROM setting WHERE key=?').get(k), setFlag = k => db.prepare('INSERT OR IGNORE INTO setting(key,value) VALUES(?,?)').run(k, '1');
db.prepare(`UPDATE studio SET img='/img/studio-'||(CASE WHEN id%2=1 THEN 1 ELSE 2 END)||'.jpg' WHERE img IS NULL OR img=''`).run();
db.prepare(`UPDATE property SET qty=1 WHERE qty IS NULL`).run();
db.prepare(`UPDATE property SET category=CASE WHEN type='background' THEN 'Background' WHEN name LIKE 'Topi%' OR name LIKE 'Mahkota%' THEN 'Topi' WHEN name LIKE 'Kacamata%' THEN 'Kacamata' ELSE 'Lainnya' END WHERE category IS NULL`).run();
if (!flag('seed_design_v1')) { // properti contoh dari desain (foto di frontend/img)
  const ip = db.prepare('INSERT INTO property(name,type,qty,category,img) VALUES(?,?,?,?,?)');
  ip.run('Tirai Merah', 'background', 1, 'Background', '/img/prop-bg-merah.jpg'); ip.run('Topi Klasik', 'accessory', 2, 'Topi', '/img/prop-topi-klasik.jpg');
  ip.run('Topi Sport', 'accessory', 1, 'Topi', '/img/prop-topi-sport.jpg'); ip.run('Kacamata Aviator', 'accessory', 2, 'Kacamata', '/img/prop-kacamata.jpg'); setFlag('seed_design_v1'); }
if (!flag('mig_refund_v1')) { // sebelum fitur refund: booking terbayar yang dibatalkan dianggap sudah dikembalikan
  db.prepare(`UPDATE payment SET status='refunded' WHERE status='paid' AND booking_id IN (SELECT id FROM booking WHERE status='Dibatalkan')`).run(); setFlag('mig_refund_v1'); }
if (!flag('drop_onboarding_v1')) { // lingkup IMK: onboarding (preferensi untuk rekomendasi paket) dihapus beserta tabelnya
  db.exec('BEGIN'); try { db.exec('DROP TABLE IF EXISTS schedule_preference; DROP TABLE IF EXISTS setup_preference;'); setFlag('drop_onboarding_v1'); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } }
if (!flag('drop_addons_promo_v1')) { // lingkup IMK: properti hanya tampilan (tanpa harga add-on/vibe), tanpa kode promo; total booking & pembayaran yang tersimpan tidak diubah
  const has = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
  db.exec('PRAGMA foreign_keys=OFF'); db.exec('BEGIN'); // property.vibe_id ada di foreign key: kolom itu tidak bisa DROP COLUMN, tabel dibangun ulang (id tetap)
  try { for (const c of ['setup_json', 'promo_disc', 'promo_code']) if (has('booking', c)) db.exec(`ALTER TABLE booking DROP COLUMN ${c}`);
    if (['price', 'vibe_id', 'used_count'].some(c => has('property', c))) db.exec(`CREATE TABLE property_new(id INTEGER PRIMARY KEY,name TEXT,type TEXT,img_url TEXT,extra TEXT,category TEXT,qty INTEGER DEFAULT 1,img TEXT);
INSERT INTO property_new(id,name,type,img_url,extra,category,qty,img) SELECT id,name,type,img_url,extra,category,qty,img FROM property; DROP TABLE property; ALTER TABLE property_new RENAME TO property;`);
    db.exec('DROP TABLE IF EXISTS promo; DROP TABLE IF EXISTS vibe;');
    setFlag('drop_addons_promo_v1'); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } finally { db.exec('PRAGMA foreign_keys=ON'); } }
const hasCol = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c);
if (!flag('drop_studio_address_v1')) { // studio tanpa alamat (satu lokasi usaha, ditampilkan dari config.js di frontend)
  db.exec('BEGIN'); try { if (hasCol('studio', 'address')) db.exec('ALTER TABLE studio DROP COLUMN address'); setFlag('drop_studio_address_v1'); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } }
module.exports = db;
