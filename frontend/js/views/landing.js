// Landing page (/, sebelum login): Home, About, Fasilitas, Keterangan, Join Sekarang, Contact Us (dulu V.landing di legacy/landing.js).
// View murni; scroll ke bagian, menu mobile, scroll-spy dan form Contact Us ditangani LandingController.
// options = { brand, wa, email, now } (default dari config.js; tes mengisinya sendiri).
import { html } from "../core/html.js";
import { SESSION_HOURS, padTwo, formatRupiahShort } from "../core/format.js";
import { BRAND, CS_EMAIL, CS_WA } from "../config.js";
import { capacityLabel, effectivePrice, priceRange } from "../models/master.js";
import { icon } from "../components/icon.js";
import { backgroundImage } from "../components/propertyVisual.js";
import { packageStrip } from "../components/packageCards.js";

// [id bagian, label menu]
export const LANDING_SECTIONS = [
  ["home", "Home"],
  ["about", "About"],
  ["fasilitas", "Fasilitas"],
  ["keterangan", "Keterangan"],
  ["kontak", "Contact Us"],
];
// bagian yang diperhatikan scroll-spy, urut dari atas (join tidak punya menu: dihitung Keterangan)
export const SPY_SECTIONS = ["home", "about", "fasilitas", "keterangan", "join", "kontak"];

// menu yang disorot: bagian terakhir yang atasnya sudah ≤ 200 px dari atas layar; mentok di bawah = bagian terakhir (Contact Us).
// tops = { id: getBoundingClientRect().top } (bagian yang tidak ada dilewati)
export function currentSection({ tops, innerHeight, scrollY, scrollHeight }) {
  let current = "home";
  for (const id of SPY_SECTIONS) {
    if (tops[id] !== undefined && tops[id] <= 200) {
      current = id;
    }
  }
  if (innerHeight + scrollY >= scrollHeight - 6) {
    current = "kontak";
  }
  return current === "join" ? "keterangan" : current;
}

const uniqueJoined = values => [...new Set(values.filter(Boolean))].join(" / ");

// [ikon, judul, kalimat dari data master]
const FACILITIES = [
  [
    "studio",
    "Studio Privat",
    master => `${master.studios.length} studio dengan kapasitas berbeda — dari sesi solo sampai rombongan.`,
  ],
  [
    "glasses",
    "Properti & Background",
    master =>
      `${master.properties.length}+ background dan aksesori siap pakai: topi, kacamata, tirai, dan banyak lagi.`,
  ],
  [
    "camera",
    "Kamera & Pencahayaan",
    () => "Lighting studio dan kamera siap pakai, kamu tinggal bergaya dan menekan tombol foto.",
  ],
  [
    "run",
    "Panduan Pose & Timer",
    () => "Rekomendasi pose berganti otomatis, hitung mundur jelas, dan peringatan sebelum waktu habis.",
  ],
  [
    "images",
    "Galeri Online",
    () =>
      "Pilih foto terbaik, tandai favorit, lalu unduh kapan saja. Foto juga bisa terkirim otomatis ke Google Drive.",
  ],
  [
    "receipt",
    "Cetak Strip Foto",
    master => {
      const sizes = uniqueJoined(master.packages.map(item => item.strip_size));
      const materials = uniqueJoined(master.packages.map(item => item.strip_material));
      return `Hasil strip ${sizes || "berkualitas"}${materials ? " dengan bahan " + materials : ""}.`;
    },
  ],
  [
    "card",
    "Booking & Bayar Online",
    () => "Reservasi kapan saja, bayar via QRIS atau transfer, invoice langsung ke emailmu.",
  ],
  [
    "users",
    "Customer Service",
    () => "Tim kami siap membantu reschedule, refund, dan kendala teknis saat sesi berlangsung.",
  ],
];
const STEPS = [
  ["calendar", "Pilih studio & jadwal", "Lihat studio yang tersedia, pilih tanggal dan sesi 50 menit yang cocok."],
  ["tag", "Pilih paket & bayar", "Bandingkan paket, cek totalnya, lalu bayar lewat QRIS atau transfer."],
  ["camera", "Datang & mulai foto", "Check-in, timer berjalan otomatis, dan panduan pose siap membantu."],
  ["images", "Pilih & unduh foto", "Pilih foto favorit sesuai kuota paket, lalu unduh atau kirim ke Google Drive."],
];

const sectionButton = ([id, label]) =>
  html`<button data-s="${id}" data-action="landing:scrollTo" data-section="${id}">${label}</button>`;
const authButton = (className, mode, label) =>
  html`<button class="${className}" data-action="landing:openAuth" data-mode="${mode}">${label}</button>`;

function studioCard(master, studio) {
  return html`<article class="lcard go" data-route="/studios/${studio.id}">
    <div class="simg" style="${backgroundImage(studio.img)}"></div>
    <div class="sbody">
      <h3 class="h3">${studio.name}</h3>
      <p class="desc" style="min-height:0">${studio.description}</p>
      <div class="row sp" style="margin-top:10px">
        <span class="m sm">${icon("users", 14)} ${capacityLabel(master, studio)} orang</span
        ><b class="sm">${priceRange(master, studio)}</b>
      </div>
    </div>
  </article>`;
}

function contactForm(contact) {
  return html`<form class="card" novalidate data-submit="landing:sendContact">
    <h3 class="h3">Kirim pesan</h3>
    ${contact.ok ? html`<div class="toast" style="margin-top:10px">${contact.ok}</div>` : ""}${contact.err ? html`<div class="toast err" style="margin-top:10px">${contact.err}</div>` : ""}
    <label>Nama</label
    ><input
      value="${contact.n}"
      data-input="landing:setContactField"
      data-field="n"
      maxlength="80"
      autocomplete="name"
    /><label>Email</label
    ><input
      type="email"
      value="${contact.e}"
      data-input="landing:setContactField"
      data-field="e"
      autocomplete="email"
    /><label>Pesan</label
    ><textarea data-input="landing:setContactField" data-field="m" maxlength="1000">${contact.m}</textarea>
    <button class="btn block" style="margin-top:16px" ${contact.busy ? "disabled" : ""}>
      ${contact.busy ? "Mengirim…" : "Kirim Pesan"}
    </button>
  </form>`;
}

export function landingView(state, match, { brand = BRAND, wa = CS_WA, email = CS_EMAIL, now = new Date() } = {}) {
  const master = state.master;
  const contact = state.runtime.contact;
  const lowest = master.packages.length ? Math.min(...master.packages.map(item => effectivePrice(master, item))) : 0;
  const address = (master.studios[0] || {}).address || "Jl. Veteran No. 3";
  const first = padTwo(SESSION_HOURS[0]);
  const last = padTwo(SESSION_HOURS[SESSION_HOURS.length - 1]);
  const heroImage = (master.studios[0] || {}).img || "/img/studio-1.jpg";
  const aboutImage = (master.studios[1] || master.studios[0] || {}).img || "/img/studio-2.jpg";
  const propertyImages = master.properties.filter(property => property.img).slice(0, 4);
  const discount = master.discount;
  return html`<div class="lp">
    <header class="lnav">
      <div class="lnav-in">
        <a class="brand" href="#home" data-action="landing:scrollTo" data-section="home">${brand}</a>
        <nav class="llinks">${LANDING_SECTIONS.map(sectionButton)}</nav>
        <div class="lact">
          ${authButton("btn ghost sm", "login", "Masuk")}${authButton("btn sm", "register", "Join Sekarang")}<button
            class="ib lburger"
            aria-label="Menu"
            data-action="landing:toggleMenu"
          >
            ${icon("menu", 20)}
          </button>
        </div>
      </div>
      <div id="lmenu" class="lmenu" hidden>
        ${LANDING_SECTIONS.map(([id, label]) => html`<button data-action="landing:scrollTo" data-section="${id}">${label}</button>`)}<button
          data-route="/browse"
        >
          Lihat Studio</button
        ><button data-action="landing:openAuth" data-mode="login">Masuk</button>
      </div>
    </header>

    <section id="home" class="hero">
      <div class="lw hero-in">
        <div>
          <span class="tag">Studio foto self-service</span>
          <h1 class="hero-h">Abadikan momen terbaikmu, <span>tanpa ribet.</span></h1>
          <p class="hero-p">
            Pilih studio, atur jadwal, lalu bergaya sepuasnya dengan panduan pose dan timer otomatis. Hasil foto bisa
            langsung kamu pilih, unduh, dan simpan.
          </p>
          <div class="row" style="margin-top:22px">
            ${authButton("btn", "register", "Join Sekarang")}<button class="btn ghost" data-route="/browse">
              Lihat Studio
            </button>
          </div>
          <div class="hero-stats">
            <div><b>${master.studios.length}</b><span>Studio</span></div>
            <div><b>${master.properties.length}+</b><span>Properti</span></div>
            <div><b>50 mnt</b><span>Per sesi</span></div>
            <div><b>${formatRupiahShort(lowest)}</b><span>Mulai dari</span></div>
          </div>
        </div>
        <div class="hero-img">
          <div class="simg" style="${backgroundImage(heroImage)}"></div>
          <div class="hero-float">
            ${icon("clock", 18)}
            <div><b>Buka setiap hari</b><small>${first}.00 – ${last}.50 WIB</small></div>
          </div>
        </div>
      </div>
    </section>

    <section id="about" class="sec">
      <div class="lw about">
        <div class="about-img"><div class="simg" style="${backgroundImage(aboutImage)}"></div></div>
        <div>
          <span class="eyebrow">About</span>
          <h2 class="sec-h">Studio foto yang bisa kamu atur sendiri</h2>
          <p class="lead">
            ${brand} adalah studio foto self-service: kamu memesan jadwal secara online, datang, dan mengambil fotomu
            sendiri dengan bantuan timer, panduan pose, dan properti yang sudah kami siapkan.
          </p>
          <p class="lead">
            Cocok untuk foto solo, couple, keluarga, sampai teman satu geng — tanpa fotografer, tanpa antre, dan harga
            yang jelas sejak awal.
          </p>
          <div class="vals">
            <div>${icon("check", 18)} Harga transparan</div>
            <div>${icon("check", 18)} Booking online 24/7</div>
            <div>${icon("check", 18)} Foto tersimpan online</div>
          </div>
        </div>
      </div>
    </section>

    <section id="fasilitas" class="sec alt">
      <div class="lw">
        <span class="eyebrow">Fasilitas</span>
        <h2 class="sec-h">Semua yang kamu butuhkan untuk sesi foto</h2>
        <p class="lead" style="max-width:640px">Dari studio sampai galeri online, semuanya sudah kami siapkan.</p>
        <div class="fgrid">
          ${FACILITIES.map(
            ([name, title, text]) =>
              html`<div class="fcard">
                <div class="fic">${icon(name, 22)}</div>
                <h3>${title}</h3>
                <p>${text(master)}</p>
              </div>`,
          )}
        </div>
        <h3 class="h2" style="margin:44px 0 6px">Studio kami</h3>
        <div class="row sp">
          <p class="sub">Pilih studio sesuai jumlah orang dan suasana yang kamu mau.</p>
          <button class="btn sm ghost" data-route="/browse">Lihat Studio & Jadwal ${icon("right", 16)}</button>
        </div>
        <div class="lgrid">${master.studios.map(studio => studioCard(master, studio))}</div>
        ${
          propertyImages.length
            ? html`<h3 class="h2" style="margin:44px 0 6px">Properti & background</h3>
                <p class="sub">Sebagian koleksi yang bisa kamu pakai saat sesi.</p>
                <div class="pgal">
                  ${propertyImages.map(
                    property =>
                      html`<figure>
                        <div class="simg" style="${backgroundImage(property.img)}"></div>
                        <figcaption>${property.name}</figcaption>
                      </figure>`,
                  )}
                </div>`
            : ""
        }
      </div>
    </section>

    <section id="keterangan" class="sec">
      <div class="lw">
        <span class="eyebrow">Keterangan</span>
        <h2 class="sec-h">Cara kerja, paket, dan ketentuan</h2>
        <div class="steps4">
          ${STEPS.map(
            ([name, title, text], index) =>
              html`<div class="stp">
                <div class="num">${index + 1}</div>
                <div class="fic">${icon(name, 22)}</div>
                <h3>${title}</h3>
                <p>${text}</p>
              </div>`,
          )}
        </div>
        <h3 class="h2" style="margin:44px 0 6px">Paket & harga</h3>
        <p class="sub">
          ${discount.pct ? html`Diskon ${discount.pct}%${discount.label ? " — " + discount.label : ""} sudah termasuk pada harga di bawah.` : "Pilih paket saat memesan."}
        </p>
        <div class="pk-grid">${packageStrip(master, state.persisted.pkg)}</div>
        <div style="margin-top:14px">
          <button class="btn sm ghost" data-route="/packages">Lihat semua paket ${icon("right", 16)}</button>
        </div>
        <h3 class="h2" style="margin:44px 0 12px">Informasi penting</h3>
        <div class="info">
          <div class="card">
            <h4>${icon("clock", 18)} Jam operasional</h4>
            <p>Setiap hari ${first}.00 – ${last}.50 WIB. Satu sesi berlangsung 50 menit.</p>
          </div>
          <div class="card">
            <h4>${icon("card", 18)} Pembayaran</h4>
            <p>QRIS atau transfer bank. Invoice dikirim ke email dan dapat diunduh dari menu Booking.</p>
          </div>
          <div class="card">
            <h4>${icon("refresh", 18)} Pembatalan & refund</h4>
            <p>
              Batalkan dari menu Booking. Refund otomatis jika pembatalan minimal ${master.policy.refund_hours} jam
              sebelum sesi.
            </p>
          </div>
          <div class="card">
            <h4>${icon("images", 18)} Foto kamu</h4>
            <p>
              Foto tersimpan di galeri online selama 30 hari, bisa diunduh, dan dapat dikirim otomatis ke Google Drive.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section id="join" class="lw">
      <div class="cta">
        <div>
          <h2>Siap bergaya? Join Sekarang!</h2>
          <p>Buat akun gratis dalam semenit, pilih jadwal, dan sesi fotomu siap berjalan.</p>
        </div>
        <div class="row">
          ${authButton("btn light", "register", "Join Sekarang")}${authButton("btn ghost-w", "login", "Sudah punya akun? Masuk")}
        </div>
      </div>
    </section>

    <section id="kontak" class="sec">
      <div class="lw">
        <span class="eyebrow">Contact Us</span>
        <h2 class="sec-h">Ada pertanyaan? Hubungi kami</h2>
        <div class="contact">
          <div class="stack">
            <div class="citem">
              ${icon("pin", 20)}
              <div>
                <b>Alamat</b>
                <p>${address}</p>
              </div>
            </div>
            <div class="citem">
              ${icon("clock", 20)}
              <div>
                <b>Jam operasional</b>
                <p>Setiap hari ${first}.00 – ${last}.50 WIB</p>
              </div>
            </div>
            <div class="citem">
              ${icon("users", 20)}
              <div>
                <b>WhatsApp</b>
                <p>
                  ${wa ? html`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">+${wa}</a>` : "Hubungi kami lewat formulir."}
                </p>
              </div>
            </div>
            <div class="citem">
              ${icon("mail", 20)}
              <div>
                <b>Email</b>
                <p>
                  ${email ? html`<a href="mailto:${email}">${email}</a>` : "Kirim pesan lewat formulir di samping."}
                </p>
              </div>
            </div>
          </div>
          ${contactForm(contact)}
        </div>
      </div>
    </section>

    <footer class="lfoot">
      <div class="lw lfoot-in">
        <b>${brand}</b>
        <div class="llinks2">
          ${LANDING_SECTIONS.map(([id, label]) => html`<a href="#${id}" data-action="landing:scrollTo" data-section="${id}">${label}</a>`)}<a
            href="/login"
            data-action="landing:openAuth"
            data-mode="login"
            >Masuk</a
          >
        </div>
        <span class="m sm">© ${now.getFullYear()} ${brand}. Semua hak dilindungi.</span>
      </div>
    </footer>
  </div>`;
}
