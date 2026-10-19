// Atur ulang akun admin langsung di database (mis. lupa password / akun terkunci).
// Pakai:  node reset-admin.js <username> <password-baru>
const crypto = require('crypto'), db = require('./db');
const [u, p] = process.argv.slice(2);
if (!u || !p || p.length < 8) { console.error('Pakai: node reset-admin.js <username> <password-baru (min. 8 karakter)>'); process.exit(1); }
const salt = crypto.randomBytes(16).toString('hex'), h = salt + ':' + crypto.scryptSync(p, salt, 32).toString('hex'), now = Date.now();
const cur = db.prepare('SELECT id FROM admin WHERE username=?').get(u);
if (cur) db.prepare('UPDATE admin SET password=?,must_change=0,failed=0,locked_until=NULL,pw_changed_at=? WHERE id=?').run(h, now, cur.id);
else db.prepare('INSERT INTO admin(username,password,must_change,created_at) VALUES(?,?,0,?)').run(u, h, now);
console.log(cur ? `Password admin "${u}" diperbarui; semua sesi lama dicabut.` : `Akun admin "${u}" dibuat.`);
