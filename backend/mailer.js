// Pengirim email SMTP minimal tanpa dependensi (AUTH LOGIN; TLS langsung port 465, STARTTLS port 587).
// Tanpa SMTP_HOST: email ditulis ke folder outbox/ (.eml) dan dicatat di console -> aman untuk pengembangan.
const net = require('net'), tls = require('tls'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const enc = s => '=?UTF-8?B?' + Buffer.from(s).toString('base64') + '?=';
const wrap = s => s.replace(/(.{76})/g, '$1\r\n');
function build({ from, to, subject, html, attachments = [], replyTo }) {
  const b = 'b' + crypto.randomBytes(8).toString('hex');
  let m = `From: ${from}\r\nTo: ${to}\r\nSubject: ${enc(subject)}\r\n${replyTo ? `Reply-To: ${replyTo}\r\n` : ''}Date: ${new Date().toUTCString()}\r\nMessage-ID: <${crypto.randomBytes(8).toString('hex')}@snapia>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${b}"\r\n\r\n`;
  m += `--${b}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(Buffer.from(html).toString('base64'))}\r\n`;
  for (const a of attachments) m += `--${b}\r\nContent-Type: ${a.type}; name="${a.name}"\r\nContent-Disposition: attachment; filename="${a.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(Buffer.from(a.content).toString('base64'))}\r\n`;
  return m + `--${b}--\r\n`;
}
function smtp(cfg, from, to, data) {
  return new Promise((ok, no) => {
    let sock, buf = '', waiting = null, done = false;
    const fail = e => { if (!done) { done = true; try { sock.destroy(); } catch {} no(e instanceof Error ? e : new Error(String(e))); } };
    const attach = s => { sock = s; s.setEncoding('utf8'); s.setTimeout(15000, () => fail(new Error('SMTP timeout'))); s.on('error', fail);
      s.on('data', d => { buf += d; let m; while ((m = buf.match(/^(?:\d{3}-.*\r?\n)*\d{3} .*\r?\n/))) { buf = buf.slice(m[0].length); const w = waiting; waiting = null; w && w(m[0]); } }); };
    const read = () => new Promise(r => { waiting = r; });
    const cmd = async (c, exp) => { sock.write(c + '\r\n'); const r = await read(); if (!r.startsWith(String(exp))) throw new Error(`SMTP ${c.split(' ')[0]} gagal: ${r.trim()}`); return r; };
    (async () => {
      const mode = cfg.secure, port = cfg.port;
      if (mode === 'tls') { const s = tls.connect({ host: cfg.host, port, servername: cfg.host }); attach(s); await new Promise((r, j) => s.once('secureConnect', r).once('error', j)); }
      else { const s = net.connect({ host: cfg.host, port }); attach(s); }
      let r = await read(); if (!r.startsWith('220')) throw new Error('SMTP greeting: ' + r.trim());
      await cmd('EHLO snapia.local', 250);
      if (mode === 'starttls') { await cmd('STARTTLS', 220); const raw = sock; raw.removeAllListeners('data'); const s = tls.connect({ socket: raw, servername: cfg.host }); buf = ''; attach(s); await new Promise((r2, j) => s.once('secureConnect', r2).once('error', j)); await cmd('EHLO snapia.local', 250); }
      if (cfg.user) { await cmd('AUTH LOGIN', 334); await cmd(Buffer.from(cfg.user).toString('base64'), 334); await cmd(Buffer.from(cfg.pass || '').toString('base64'), 235); }
      await cmd(`MAIL FROM:<${cfg.addr}>`, 250); await cmd(`RCPT TO:<${to}>`, 250); await cmd('DATA', 354);
      sock.write(data.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..') + '\r\n.\r\n'); r = await read(); if (!r.startsWith('250')) throw new Error('SMTP DATA gagal: ' + r.trim());
      sock.write('QUIT\r\n'); done = true; sock.end(); ok();
    })().catch(fail);
  });
}
async function sendMail({ to, subject, html, attachments, replyTo }) {
  const host = process.env.SMTP_HOST, brand = process.env.BRAND || 'SelfieBox Studio';
  const addr = (process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@localhost').replace(/^.*<|>.*$/g, '');
  const from = `${enc(brand)} <${addr}>`, raw = build({ from, to, subject, html, attachments, replyTo });
  if (!host) { const dir = process.env.OUTBOX_DIR || path.join(__dirname, 'outbox'); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.eml'); fs.writeFileSync(f, raw);
    console.log(`[email-dev] SMTP belum diatur -> disimpan: ${f} | ke: ${to} | ${subject}`); return { dev: true }; }
  const port = +process.env.SMTP_PORT || 465, secure = process.env.SMTP_SECURE || (port === 465 ? 'tls' : port === 587 ? 'starttls' : 'none');
  await smtp({ host, port, secure, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, addr }, from, to, raw); return { sent: true };
}
module.exports = { sendMail };
