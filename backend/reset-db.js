// Kosongkan database lokal lalu isi ulang data awal (paket, studio, vibe, properti, pose dari seed.json).
// Pakai:  npm run db:reset [-- opsi]      (atau: node reset-db.js [opsi])
//   -y, --yes       tanpa konfirmasi
//   --demo          sesudahnya jalankan seed-demo.js (akun admin + customer dari .env.demo)
//   --keep-files    jangan hapus isi uploads/, media/, outbox/
// Semua customer, booking, sesi, pembayaran, promo, dan galeri HILANG. Matikan server dulu.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), { parseEnv } = require('util'), { spawnSync } = require('child_process');

const args = process.argv.slice(2), has = (...f) => f.some(x => args.includes(x));
const unknown = args.filter(a => !['-y', '--yes', '--demo', '--keep-files'].includes(a));
if (unknown.length) { console.error(`Opsi tidak dikenal: ${unknown.join(' ')}\nPakai: node reset-db.js [-y|--yes] [--demo] [--keep-files]`); process.exit(1); }

// Variabel shell menang, lalu .env (sama seperti server.js), agar DB_FILE dan folder sama dengan server
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(envFile, 'utf8')))) if (!(k in process.env)) process.env[k] = v;
const abs = (v, def) => v ? (path.isAbsolute(v) ? v : path.join(__dirname, v)) : path.join(__dirname, def);
const DB = abs(process.env.DB_FILE, 'snapia.db'); process.env.DB_FILE = DB;
const dirs = { uploads: abs(process.env.UPLOAD_DIR, 'uploads'), media: abs(process.env.MEDIA_DIR, 'media'), outbox: abs(process.env.OUTBOX_DIR, 'outbox') };
const PORT = +process.env.PORT || 3000;

// Server yang masih jalan tetap memegang berkas lama -> tolak
const serverUp = () => new Promise(ok => { const r = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 800 }, res => { res.resume(); ok(true); }); r.on('timeout', () => { r.destroy(); ok(false); }); r.on('error', () => ok(false)); });

// Hapus isi folder saja (foldernya dibuat ulang otomatis oleh server); jangan sentuh folder berbahaya
const clearDir = d => {
  const r = path.resolve(d);
  if ([path.parse(r).root, os.homedir(), __dirname, path.dirname(__dirname)].includes(r)) { console.warn(`  lewati ${r} (folder ini tidak boleh dikosongkan)`); return 0; }
  if (!fs.existsSync(r) || !fs.statSync(r).isDirectory()) return 0;
  const items = fs.readdirSync(r); items.forEach(f => fs.rmSync(path.join(r, f), { recursive: true, force: true })); return items.length;
};

(async () => {
  if (await serverUp()) { console.error(`Server masih jalan di port ${PORT}. Matikan dulu (Ctrl+C di terminal npm start), lalu ulangi.`); process.exit(1); }

  console.log(`Database : ${DB}${fs.existsSync(DB) ? '' : ' (belum ada)'}`);
  if (!has('--keep-files')) console.log(`Berkas   : ${Object.values(dirs).join(', ')}`);
  console.log('Semua customer, booking, sesi, pembayaran, promo, galeri, dan akun admin akan dihapus.');
  if (!has('-y', '--yes')) {
    if (!process.stdin.isTTY) { console.error('Tidak ada terminal untuk konfirmasi. Tambahkan --yes.'); process.exit(1); }
    const rl = require('readline/promises').createInterface({ input: process.stdin, output: process.stdout });
    const a = (await rl.question('Ketik "reset" untuk lanjut: ')).trim(); rl.close();
    if (a !== 'reset') { console.log('Dibatalkan, tidak ada yang diubah.'); process.exit(0); }
  }

  let n = 0; for (const s of ['', '-wal', '-shm', '-journal']) if (fs.existsSync(DB + s)) { fs.rmSync(DB + s); n++; }
  console.log(`Berkas database dihapus: ${n}`);
  if (!has('--keep-files')) for (const [k, d] of Object.entries(dirs)) console.log(`Isi ${k}/ dihapus: ${clearDir(d)}`);

  const db = require('./db'); // membuat skema + data awal dari seed.json
  const c = t => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  console.log(`Data awal: ${c('package')} paket, ${c('studio')} studio, ${c('vibe')} vibe, ${c('property')} properti, ${c('pose')} pose.`);
  db.close();

  if (has('--demo')) {
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, 'seed-demo.js')], { stdio: 'inherit', env: process.env, cwd: __dirname });
    if (r.status !== 0) { console.error('seed-demo.js gagal; database sudah direset tanpa akun demo.'); process.exit(r.status || 1); }
  } else { const u = (process.env.ADMIN_USER || '').trim() || 'adminstudio'; // sama dengan server.js saat tabel admin kosong
    console.log(`Belum ada admin. Saat server dinyalakan dibuat "${u}" dengan ${process.env.ADMIN_PASS ? 'password ADMIN_PASS dari .env' : 'password admin123 (wajib ganti saat login pertama)'}, atau jalankan: npm run seed:demo`); }
  console.log('Selesai. Jalankan: npm start');
})();
