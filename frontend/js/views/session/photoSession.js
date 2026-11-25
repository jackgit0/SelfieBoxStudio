// Layar Sesi Foto (/sessions/:id): kamera, timer, hitungan foto, strip foto, pose rekomendasi, Kendali Staf (dulu V.session dan upd() di legacy/session.js).
// View murni. Timer, hitungan, strip dan catatan diperbarui di tempat tiap detik oleh PhotoSessionController lewat components/sessionScreen.js,
// dengan isi dari sessionStatus() dan photoStrip() di bawah.
import { html } from "../../core/html.js";
import { packageOf } from "../../models/master.js";
import { photoLimit, shownSession } from "../../models/photoSession.js";
import { icon } from "../../components/icon.js";

const twoDigits = value => String(value).padStart(2, "0");

// isi bagian yang berubah tiap detik
export function sessionStatus(session, pkg) {
  const seconds = Math.max(0, session.left);
  const limit = photoLimit(pkg);
  const taken = session.photos.length;
  const active = session.status == "Aktif";
  let note = "";
  if (!active) {
    note = "Sesi telah berakhir. Silakan pilih foto di Galeri.";
  } else if (session.paused) {
    note = "Sesi dijeda staf — waktu tidak berkurang.";
  } else if (session.left <= 60) {
    note = "⚠ Waktu hampir habis!";
  }
  return {
    timer: twoDigits(Math.floor(seconds / 60)) + ":" + twoDigits(seconds % 60),
    warn: session.left <= 60 && active,
    count: `Foto: ${taken}/${limit} · sisa ${limit - taken}`,
    shootDisabled: !active || Boolean(session.paused) || taken >= limit,
    note,
  };
}

// strip foto yang sudah diambil; key = daftar id (strip hanya diganti bila berubah)
export function photoStrip(session) {
  return {
    key: session.photos.map(photo => photo.id).join(),
    markup: html`${session.photos.map(photo => html`<div class="th"><img src="${photo.img}" /><button title="Hapus foto" data-action="gallery:deletePhoto" data-session="${session.id}" data-photo="${photo.id}">🗑</button></div>`)}`,
  };
}

// Hentikan di Kendali Staf (dulu dialog konfirmasi bawaan peramban, decisions.md 63)
export function stopSessionModal() {
  return {
    title: "Konfirmasi Hentikan Sesi",
    body: html`<p>Hentikan sesi?</p>`,
    buttons: [
      { label: "Batal", value: false, style: "ghost" },
      { label: "Hentikan", value: true, style: "danger" },
    ],
  };
}

function staffControls(persisted) {
  const button = (className, command, label) =>
    html`<button class="btn sm ${className}" data-action="photo:staffAction" data-command="${command}">
      ${label}
    </button>`;
  return html`<div class="card">
    <h3 class="h3" style="margin-bottom:10px">Kendali Staf</h3>
    <div class="row">
      ${button("ghost", "pause", "⏸ Jeda")}${button("ghost", "resume", "▶ Lanjut")}${button("danger", "stop", "⏹ Hentikan")}
    </div>
    ${persisted.log.length ? html`<p class="sm m" style="margin-top:8px">Log: ${persisted.log.slice(-3).join(" · ")}</p>` : ""}
  </div>`;
}

export function photoSessionView(state, match) {
  // sesi di URL (/sessions/:id); id yang tidak dikenal → sesi aktif user
  const session = shownSession(state.data.sessions, state.persisted.me, match.params.id);
  if (!session) {
    return html`<div class="panel">
      <div class="card center">
        <h1 class="h2">Belum ada sesi aktif</h1>
        <p class="m">Mulai dari menu Booking → pilih booking → Check-in & Mulai Sesi.</p>
        <button class="btn" style="margin-top:12px" data-route="/bookings">Ke Booking Saya</button>
      </div>
    </div>`;
  }
  const pkg = packageOf(state.master, session.pkg);
  return html`<div class="panel" style="max-width:1100px">
    <div class="row sp">
      <div>
        <h1 class="h1">Sesi Foto</h1>
        <p class="sub">
          Paket ${pkg.name} · target ${pkg.photo_count} foto (maks. ambil ${photoLimit(pkg)}) · ${pkg.dur} menit
        </p>
      </div>
      <button class="btn ghost sm" data-action="package:contactCs">Customer Service</button>
    </div>
    <div class="sess" style="margin-top:14px">
      <div class="card">
        <div id="tm" class="timer"></div>
        <video id="v" autoplay playsinline muted></video><canvas id="cv" hidden></canvas>
        <div class="row" style="margin-top:12px">
          <button class="btn" id="shot" data-action="photo:shoot">${icon("camera", 18)} Ambil Foto</button
          ><span id="cnt" class="m"></span>
        </div>
        <small id="ds" class="m"></small>
        <div id="strip" class="strip"></div>
      </div>
      <div class="stack">
        <div class="card">
          <h3 class="h3">Pose Rekomendasi</h3>
          ${
            (state.master.poses[1] || []).length
              ? html`<img id="pose" class="pose-img" alt="" />
                  <button class="btn sm ghost" data-action="photo:nextPose">Pose lain</button>`
              : html`<p class="m sm" style="margin-top:8px">Belum ada contoh pose.</p>`
          }
        </div>
        <div class="card">
          <h3 class="h3" style="margin-bottom:10px">Background & Properti</h3>
          <p class="m sm">Background dan properti tersedia di studio, pakai sesukamu.</p>
        </div>
        ${state.persisted.staff ? staffControls(state.persisted) : ""}
      </div>
    </div>
  </div>`;
}
