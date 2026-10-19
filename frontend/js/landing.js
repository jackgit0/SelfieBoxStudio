// ===== LANDING PAGE (sebelum login): Home, About, Fasilitas, Keterangan, Join Sekarang, Contact Us =====
const LP = { n: "", e: "", m: "", ok: "", err: "", busy: false };
const LSECS = [["home", "Home"], ["about", "About"], ["fasilitas", "Fasilitas"], ["keterangan", "Keterangan"], ["kontak", "Contact Us"]];
const openAuth = mode => { authMode = mode; go("auth"); };
function toSec(id) { const m = $("#lmenu"); if (m) m.hidden = true; const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
const lpMenu = () => { const m = $("#lmenu"); if (m) m.hidden = !m.hidden; };
function lpSpy() { // sorot menu sesuai bagian yang sedang dilihat
  let cur = "home"; ["home", "about", "fasilitas", "keterangan", "join", "kontak"].forEach(id => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 200) cur = id; });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 6) cur = "kontak"; // mentok di bawah = bagian terakhir
  if (cur === "join") cur = "keterangan"; document.querySelectorAll("[data-s]").forEach(b => b.classList.toggle("on", b.dataset.s === cur));
  const n = $(".lnav"); if (n) n.classList.toggle("sc", window.scrollY > 8);
}
async function sendContact() {
  if (LP.busy) return; LP.ok = LP.err = ""; LP.busy = true; render();
  try { const r = await API.post("/contact", { name: LP.n, email: LP.e, message: LP.m }); LP.ok = r.message; LP.n = LP.e = LP.m = ""; } catch (e) { LP.err = e.message; }
  LP.busy = false; render(); setTimeout(() => toSec("kontak"), 30);
}
const FAC = [
  ["studio", "Studio Privat", () => `${STUDIOS.length} studio dengan kapasitas berbeda — dari sesi solo sampai rombongan.`],
  ["glasses", "Properti & Background", () => `${PROP.length}+ background dan aksesori siap pakai: topi, kacamata, tirai, dan banyak lagi.`],
  ["camera", "Kamera & Pencahayaan", () => "Lighting studio dan kamera siap pakai, kamu tinggal bergaya dan menekan tombol foto."],
  ["run", "Panduan Pose & Timer", () => "Rekomendasi pose berganti otomatis, hitung mundur jelas, dan peringatan sebelum waktu habis."],
  ["images", "Galeri Online", () => "Pilih foto terbaik, tandai favorit, lalu unduh kapan saja. Foto juga bisa terkirim otomatis ke Google Drive."],
  ["receipt", "Cetak Strip Foto", () => { const sz = [...new Set(PKG.map(p => p.strip_size).filter(Boolean))].join(" / "), mt = [...new Set(PKG.map(p => p.strip_material).filter(Boolean))].join(" / "); return `Hasil strip ${sz || "berkualitas"}${mt ? " dengan bahan " + mt : ""}.`; }],
  ["card", "Booking & Bayar Online", () => "Reservasi kapan saja, bayar via QRIS atau transfer, invoice langsung ke emailmu."],
  ["users", "Customer Service", () => "Tim kami siap membantu reschedule, refund, dan kendala teknis saat sesi berlangsung."]
];
const STEPS = [["calendar", "Pilih studio & jadwal", "Lihat studio yang tersedia, pilih tanggal dan sesi 50 menit yang cocok."], ["tag", "Pilih paket & bayar", "Bandingkan paket, pakai kode promo bila ada, lalu bayar lewat QRIS atau transfer."], ["camera", "Datang & mulai foto", "Check-in, timer berjalan otomatis, dan panduan pose siap membantu."], ["images", "Pilih & unduh foto", "Pilih foto favorit sesuai kuota paket, lalu unduh atau kirim ke Google Drive."]];
function lpStudio(s) {
  return `<article class="lcard"><div class="simg" style="${bgi(s.img)}"></div><div class="sbody"><h3 class="h3">${esc(s.name)}</h3><p class="desc" style="min-height:0">${esc(s.description)}</p>
<div class="row sp" style="margin-top:10px"><span class="m sm">${ic("users", 14)} ${esc(capLabel(s))} orang</span><b class="sm">${priceRange(s)}</b></div></div></article>`;
}
V.landing = () => {
  const min = PKG.length ? Math.min(...PKG.map(eff)) : 0, addr = (STUDIOS[0] || {}).address || "Jl. Veteran No. 3", wa = window.CS_WA, mail = window.CS_EMAIL, first = HRS[0], last = HRS[HRS.length - 1];
  const links = LSECS.map(l => `<button data-s="${l[0]}" onclick="toSec('${l[0]}')">${l[1]}</button>`).join("");
  const propImgs = PROP.filter(p => p.img).slice(0, 4);
  return `<div class="lp"><header class="lnav"><div class="lnav-in"><a class="brand" href="#" onclick="toSec('home');return false">${esc(BRAND)}</a><nav class="llinks">${links}</nav>
<div class="lact"><button class="btn ghost sm" onclick="openAuth('login')">Masuk</button><button class="btn sm" onclick="openAuth('register')">Join Sekarang</button><button class="ib lburger" aria-label="Menu" onclick="lpMenu()">${ic("menu", 20)}</button></div></div>
<div id="lmenu" class="lmenu" hidden>${LSECS.map(l => `<button onclick="toSec('${l[0]}')">${l[1]}</button>`).join("")}<button onclick="openAuth('login')">Masuk</button></div></header>

<section id="home" class="hero"><div class="lw hero-in"><div><span class="tag">Studio foto self-service</span><h1 class="hero-h">Abadikan momen terbaikmu, <span>tanpa ribet.</span></h1>
<p class="hero-p">Pilih studio, atur jadwal, lalu bergaya sepuasnya dengan panduan pose dan timer otomatis. Hasil foto bisa langsung kamu pilih, unduh, dan simpan.</p>
<div class="row" style="margin-top:22px"><button class="btn" onclick="openAuth('register')">Join Sekarang</button><button class="btn ghost" onclick="toSec('fasilitas')">Lihat Fasilitas</button></div>
<div class="hero-stats"><div><b>${STUDIOS.length}</b><span>Studio</span></div><div><b>${PROP.length}+</b><span>Properti</span></div><div><b>50 mnt</b><span>Per sesi</span></div><div><b>${rpk(min)}</b><span>Mulai dari</span></div></div></div>
<div class="hero-img"><div class="simg" style="${bgi((STUDIOS[0] || {}).img || "img/studio-1.jpg")}"></div><div class="hero-float">${ic("clock", 18)}<div><b>Buka setiap hari</b><small>${pad(first)}.00 – ${pad(last)}.50 WIB</small></div></div></div></div></section>

<section id="about" class="sec"><div class="lw about"><div class="about-img"><div class="simg" style="${bgi(((STUDIOS[1] || STUDIOS[0]) || {}).img || "img/studio-2.jpg")}"></div></div>
<div><span class="eyebrow">About</span><h2 class="sec-h">Studio foto yang bisa kamu atur sendiri</h2>
<p class="lead">${esc(BRAND)} adalah studio foto self-service: kamu memesan jadwal secara online, datang, dan mengambil fotomu sendiri dengan bantuan timer, panduan pose, dan properti yang sudah kami siapkan.</p>
<p class="lead">Cocok untuk foto solo, couple, keluarga, sampai teman satu geng — tanpa fotografer, tanpa antre, dan harga yang jelas sejak awal.</p>
<div class="vals"><div>${ic("check", 18)} Harga transparan</div><div>${ic("check", 18)} Booking online 24/7</div><div>${ic("check", 18)} Foto tersimpan online</div></div></div></div></section>

<section id="fasilitas" class="sec alt"><div class="lw"><span class="eyebrow">Fasilitas</span><h2 class="sec-h">Semua yang kamu butuhkan untuk sesi foto</h2><p class="lead" style="max-width:640px">Dari studio sampai galeri online, semuanya sudah kami siapkan.</p>
<div class="fgrid">${FAC.map(f => `<div class="fcard"><div class="fic">${ic(f[0], 22)}</div><h3>${f[1]}</h3><p>${esc(f[2]())}</p></div>`).join("")}</div>
<h3 class="h2" style="margin:44px 0 6px">Studio kami</h3><p class="sub">Pilih studio sesuai jumlah orang dan suasana yang kamu mau.</p><div class="lgrid">${STUDIOS.map(lpStudio).join("")}</div>
${propImgs.length ? `<h3 class="h2" style="margin:44px 0 6px">Properti & background</h3><p class="sub">Sebagian koleksi yang bisa kamu pakai saat sesi.</p><div class="pgal">${propImgs.map(p => `<figure><div class="simg" style="${bgi(p.img)}"></div><figcaption>${esc(p.name)}</figcaption></figure>`).join("")}</div>` : ""}</div></section>

<section id="keterangan" class="sec"><div class="lw"><span class="eyebrow">Keterangan</span><h2 class="sec-h">Cara kerja, paket, dan ketentuan</h2>
<div class="steps4">${STEPS.map((s, i) => `<div class="stp"><div class="num">${i + 1}</div><div class="fic">${ic(s[0], 22)}</div><h3>${s[1]}</h3><p>${s[2]}</p></div>`).join("")}</div>
<h3 class="h2" style="margin:44px 0 6px">Paket & harga</h3><p class="sub">${DISC.pct ? `Diskon ${DISC.pct}%${DISC.label ? " — " + esc(DISC.label) : ""} sudah termasuk pada harga di bawah.` : "Pilih paket saat memesan."}</p><div class="pk-grid">${pkgCards()}</div>
<h3 class="h2" style="margin:44px 0 12px">Informasi penting</h3><div class="info">
<div class="card"><h4>${ic("clock", 18)} Jam operasional</h4><p>Setiap hari ${pad(first)}.00 – ${pad(last)}.50 WIB. Satu sesi berlangsung 50 menit.</p></div>
<div class="card"><h4>${ic("card", 18)} Pembayaran</h4><p>QRIS atau transfer bank. Invoice dikirim ke email dan dapat diunduh dari menu Booking.</p></div>
<div class="card"><h4>${ic("refresh", 18)} Pembatalan & refund</h4><p>Batalkan dari menu Booking. Refund otomatis jika pembatalan minimal ${POLICY.refund_hours} jam sebelum sesi.</p></div>
<div class="card"><h4>${ic("images", 18)} Foto kamu</h4><p>Foto tersimpan di galeri online selama 30 hari, bisa diunduh, dan dapat dikirim otomatis ke Google Drive.</p></div></div></div></section>

<section id="join" class="lw"><div class="cta"><div><h2>Siap bergaya? Join Sekarang!</h2><p>Buat akun gratis dalam semenit, pilih jadwal, dan sesi fotomu siap berjalan.</p></div><div class="row"><button class="btn light" onclick="openAuth('register')">Join Sekarang</button><button class="btn ghost-w" onclick="openAuth('login')">Sudah punya akun? Masuk</button></div></div></section>

<section id="kontak" class="sec"><div class="lw"><span class="eyebrow">Contact Us</span><h2 class="sec-h">Ada pertanyaan? Hubungi kami</h2><div class="contact"><div class="stack">
<div class="citem">${ic("pin", 20)}<div><b>Alamat</b><p>${esc(addr)}</p></div></div><div class="citem">${ic("clock", 20)}<div><b>Jam operasional</b><p>Setiap hari ${pad(first)}.00 – ${pad(last)}.50 WIB</p></div></div>
<div class="citem">${ic("users", 20)}<div><b>WhatsApp</b><p>${wa ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">+${esc(wa)}</a>` : "Hubungi kami lewat formulir."}</p></div></div>
<div class="citem">${ic("mail", 20)}<div><b>Email</b><p>${mail ? `<a href="mailto:${esc(mail)}">${esc(mail)}</a>` : "Kirim pesan lewat formulir di samping."}</p></div></div></div>
<form class="card" onsubmit="event.preventDefault();sendContact()"><h3 class="h3">Kirim pesan</h3>${LP.ok ? `<div class="toast" style="margin-top:10px">${esc(LP.ok)}</div>` : ""}${LP.err ? `<div class="toast err" style="margin-top:10px">${esc(LP.err)}</div>` : ""}
<label>Nama</label><input value="${esc(LP.n)}" oninput="LP.n=this.value" maxlength="80" autocomplete="name"><label>Email</label><input type="email" value="${esc(LP.e)}" oninput="LP.e=this.value" autocomplete="email"><label>Pesan</label><textarea oninput="LP.m=this.value" maxlength="1000">${esc(LP.m)}</textarea>
<button class="btn block" style="margin-top:16px" ${LP.busy ? "disabled" : ""}>${LP.busy ? "Mengirim…" : "Kirim Pesan"}</button></form></div></div></section>

<footer class="lfoot"><div class="lw lfoot-in"><b>${esc(BRAND)}</b><div class="llinks2">${LSECS.map(l => `<a href="#" onclick="toSec('${l[0]}');return false">${l[1]}</a>`).join("")}<a href="#" onclick="openAuth('login');return false">Masuk</a></div><span class="m sm">© ${new Date().getFullYear()} ${esc(BRAND)}. Semua hak dilindungi.</span></div></footer></div>`;
};
V.landing_after = () => { window.onscroll = lpSpy; lpSpy(); };
