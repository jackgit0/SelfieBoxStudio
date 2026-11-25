// Bandingkan route di backend/server.js dengan paths di openapi.json (tanpa dependensi).
// Jalankan dari mana saja: node docs/openapi/check-routes.js  -> exit 1 bila ada yang tidak cocok
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'server.js'), 'utf8');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'openapi.json'), 'utf8'));
const code = new Set([...src.matchAll(/route\('([A-Z]+)',\s*'([^']+)',\s*(\d)/g)].map(m => `${m[1]} ${m[2].replace(/:(\w+)/g, '{$1}')}`));
const doc = new Set(Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).filter(k => /^(get|post|put|patch|delete)$/.test(k)).map(m => `${m.toUpperCase()} ${p}`)));
// peran: 0 publik, 1 customer, 2 admin (x-role di spec)
const roles = Object.fromEntries([...src.matchAll(/route\('([A-Z]+)',\s*'([^']+)',\s*(\d)/g)].map(m => [`${m[1]} ${m[2].replace(/:(\w+)/g, '{$1}')}`, ['public', 'customer', 'admin'][+m[3]]]));
const missing = [...code].filter(r => !doc.has(r)), extra = [...doc].filter(r => !code.has(r));
const roleBad = [...code].filter(r => doc.has(r)).filter(r => { const [m, p] = r.split(' '); return spec.paths[p][m.toLowerCase()]['x-role'] !== roles[r]; });
missing.forEach(r => console.log('Tidak ada di spec :', r)); extra.forEach(r => console.log('Tidak ada di kode :', r)); roleBad.forEach(r => console.log('x-role berbeda    :', r, '(kode:', roles[r] + ')'));
if (missing.length || extra.length || roleBad.length) process.exit(1);
console.log(`OK: ${code.size} route cocok dengan spec`);
