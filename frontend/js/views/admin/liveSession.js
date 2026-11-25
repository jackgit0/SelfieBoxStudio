// Session Assistant di tablet studio (/admin/studios/:id/live, dibuka dari ikon mata di Admin → Studio). Layar penuh tanpa sidebar admin.
// Keadaan: menunggu check-in (idle) → siap (booking sudah check-in, Mulai Sesi dari jam slot) → sesi berjalan (Figma "camera preview",
// node 451:2833) → selesai. Pilih background = modal (Figma "background", node 451:2846). View murni; timer, hitungan, strip dan catatan
// diperbarui di tempat tiap detik oleh PhotoSessionController lewat components/sessionScreen.js dengan isi sessionStatus() dan photoStrip().
import { html } from "../../core/html.js";
import { icon } from "../../components/icon.js";
import { propertyVisual } from "../../components/propertyVisual.js";
import { SELF_TIMERS, backgroundsOf, photoLimit } from "../../models/admin/liveSession.js";

const twoDigits = value => String(value).padStart(2, "0");

// isi bagian yang berubah tiap detik; session = sesi dari /api/admin/photo-sessions/:id (package = { photo_count, … })
export function sessionStatus(session, { counting = false } = {}) {
  const seconds = Math.max(0, session.left);
  const limit = photoLimit(session.package);
  const taken = session.photos.length;
  const active = session.status == "Aktif";
  let note = "";
  if (!active) {
    note = "Sesi telah berakhir.";
  } else if (taken >= limit) {
    note = "Kuota pengambilan foto habis.";
  } else if (session.left <= 60) {
    note = "⚠ Waktu hampir habis!";
  }
  return {
    timer: twoDigits(Math.floor(seconds / 60)) + ":" + twoDigits(seconds % 60),
    warn: session.left <= 60 && active,
    count: `Foto ${taken}/${limit}`,
    shootDisabled: !active || counting || taken >= limit,
    note,
  };
}

// strip foto yang sudah diambil (gambar lewat rute admin); key = daftar id (strip hanya diganti bila berubah)
export function photoStrip(session, photoUrl) {
  return {
    key: session.photos.map(photo => photo.id).join(),
    markup: html`${session.photos.map(
      photo =>
        html`<div class="th">
          <img src="${photo.img || photoUrl(photo.id)}" alt="Foto ${photo.id}" /><button
            title="Hapus foto"
            aria-label="Hapus foto ${photo.id}"
            data-action="photo:deletePhoto"
            data-photo="${photo.id}"
          >
            ${icon("trash", 14)}
          </button>
        </div>`,
    )}`,
  };
}

// Figma "background": 10 background dalam kisi 5×2, PILIH; resolve { value: "ok" | null, data: id terpilih }
export function backgroundModal(backgrounds, selectedId) {
  const swatches = backgrounds.map(
    item =>
      html`<label class="bgsw"
        ><input type="radio" name="bg" value="${item.id}" ${item.id == selectedId ? "checked" : ""} />${propertyVisual(
          item,
        )}<span>${item.name}</span></label
      >`,
  );
  return {
    title: "Pilih Background",
    className: "bgmodal",
    body: backgrounds.length
      ? html`<div class="bggrid" role="radiogroup" aria-label="Background">${swatches}</div>`
      : html`<p class="m">Belum ada background. Tambahkan di Admin → Properti (kategori Background).</p>`,
    buttons: [
      { label: "Batal", value: null, style: "ghost" },
      { label: "PILIH", value: "ok", style: "bgpick" },
    ],
    read: box => {
      const checked = box.querySelector('input[name="bg"]:checked');
      return checked ? Number(checked.value) : null;
    },
  };
}

// Keluar dan Akhiri Sesi: password admin; resolve { value: "ok" | null, data: password }
export function passwordModal({ title, text, okLabel, danger = false }) {
  return {
    title,
    body: html`<p>${text}</p>
      <label for="admin-pw">Password admin</label
      ><input id="admin-pw" type="password" autocomplete="current-password" />`,
    buttons: [
      { label: "Batal", value: null, style: "ghost" },
      { label: okLabel, value: "ok", style: danger ? "danger" : "" },
    ],
    initialFocus: "#admin-pw",
    enterValue: "ok",
    read: box => box.querySelector("#admin-pw").value,
  };
}

function topBar(studioName) {
  return html`<div class="kio-top">
    <span class="kio-brand">${icon("camera", 18)} ${studioName || "Studio"}</span>
    <button class="btn ghost sm" data-action="photo:exit">${icon("logout", 16)} Keluar</button>
  </div>`;
}

// pilihan kamera (kamera USB / capture card studio); disimpan per studio di browser tablet
function cameraPicker(live, chosen) {
  const cameras = live.cameras || [];
  if (cameras.length < 2) {
    return "";
  }
  return html`<label class="kio-cam-pick sm m"
    >Kamera
    <select data-change="photo:setCamera">
      ${cameras.map(
        (camera, index) =>
          html`<option value="${camera.deviceId}" ${camera.deviceId == chosen ? "selected" : ""}>
            ${camera.label || `Kamera ${index + 1}`}
          </option>`,
      )}
    </select></label
  >`;
}

function waitingCard(live, chosenCamera) {
  const data = live.data;
  const ready = data.state == "ready" ? data.booking : null;
  const next = data.next;
  let body;
  if (ready) {
    body = html`<p class="kio-kicker">Sudah check-in</p>
      <h1 class="kio-h">Halo, ${ready.customer}!</h1>
      <p class="sub">Paket ${ready.package} · sesi ${ready.time} - ${ready.end}</p>
      ${ready.can_start
        ? html`<button class="btn kio-start" data-action="photo:start" data-id="${ready.booking_id}">
            ${icon("camera", 22)} Mulai Sesi
          </button>`
        : html`<p class="kio-wait">Sesi mulai pukul ${ready.time}</p>`}`;
  } else {
    body = html`<p class="kio-kicker">${data.studio.name}</p>
      <h1 class="kio-h">Menunggu check-in</h1>
      <p class="sub">
        ${next
          ? html`Booking berikutnya: <b>${next.time}</b> · ${next.customer} · Paket ${next.package}${next.checked_in
                ? ""
                : " (belum check-in)"}`
          : "Tidak ada booking lagi hari ini."}
      </p>
      <p class="sm m">Check-in dilakukan admin di menu Booking.</p>`;
  }
  return html`<div class="kio-wait-card card center">
    ${body}
    <div class="row kio-wait-actions">
      <button class="btn ghost sm" data-action="photo:refresh">${icon("refresh", 16)} Muat ulang</button>
      ${cameraPicker(live, chosenCamera)}
    </div>
  </div>`;
}

function endedCard(ended) {
  return html`<div class="kio-wait-card card center">
    <p class="kio-kicker">Sesi selesai</p>
    <h1 class="kio-h">Terima kasih${ended.customer ? ", " + ended.customer : ""}!</h1>
    <p class="sub">Foto sudah tersimpan. Pilih dan unduh fotomu di menu Galeri pada akunmu.</p>
    <div class="row kio-wait-actions">
      <button class="btn" data-action="photo:refresh">Kembali ke layar tunggu</button>
    </div>
  </div>`;
}

function poseCard(master) {
  const poses = master.poses[1] || [];
  return html`<div class="kio-pose">
    <h3 class="h3">Pose Rekomendasi</h3>
    ${poses.length
      ? html`<img id="pose" class="pose-img" alt="" />
          <button class="btn sm ghost" data-action="photo:nextPose">Pose lain</button>`
      : html`<p class="m sm">Belum ada contoh pose.</p>`}
  </div>`;
}

function runningScreen(state, live) {
  const session = live.data.session;
  const backgrounds = backgroundsOf(state.master);
  const chosen = backgrounds.find(item => item.id == (live.backgrounds || {})[session.id]);
  const timerPills = SELF_TIMERS.map(
    seconds =>
      html`<button
        class="kio-tpill ${live.selfTimer == seconds ? "on" : ""}"
        data-action="photo:setTimer"
        data-seconds="${seconds}"
        aria-pressed="${String(live.selfTimer == seconds)}"
      >
        ${seconds} detik
      </button>`,
  );
  return html`<div class="kio">
    <section class="kio-main">
      <div class="kio-view">
        <video id="v" autoplay playsinline muted></video><canvas id="cv" hidden></canvas>
        <span class="kio-pill kio-live"><i class="kio-dot" aria-hidden="true"></i>${session.studio_name}</span>
        <span id="tm" class="kio-pill kio-timer" role="timer" aria-label="Sisa waktu sesi"></span>
        ${chosen ? html`<span class="kio-chip">Background: ${chosen.name}</span>` : ""}
        <div id="cd" class="kio-count" aria-live="assertive" hidden></div>
      </div>
      <div class="kio-under">
        <span class="kio-who">${session.customer} · Paket ${session.package.name}</span>
        <span id="cnt" class="m"></span>
        <small id="ds" class="kio-note"></small>
      </div>
      <div id="strip" class="strip"></div>
    </section>
    <aside class="kio-rail">
      <div class="kio-timercard">
        <h2>TIMER</h2>
        ${timerPills}
      </div>
      <button class="btn kio-shot" id="shot" data-action="photo:shoot">${icon("camera", 20)} Ambil Foto</button>
      <button class="btn soft" data-action="photo:pickBackground">${icon("images", 18)} Ganti Background</button>
      ${poseCard(state.master)}
      <button class="btn ghost" data-action="package:contactCs">${icon("user", 18)} Panggil Staff</button>
      <button class="btn danger sm" data-action="photo:end">Akhiri Sesi</button>
    </aside>
  </div>`;
}

export function liveSessionView(state, match) {
  const live = state.photo.live || {};
  const studioId = Number(match.params.id);
  const studio = (state.master.allStudios || []).find(item => item.id == studioId);
  const ready = live.studioId == studioId && live.data;
  const name = ready ? live.data.studio.name : studio ? studio.name : "";
  const chosenCamera = (state.persisted.cameras || {})[studioId] || "";
  let content;
  if (live.studioId == studioId && live.error) {
    content = html`<div class="kio-wait-card card center">
      <h1 class="kio-h">Layar tablet tidak dapat dimuat</h1>
      <p class="sub">${live.error}</p>
      <button class="btn ghost sm" data-action="photo:refresh">${icon("refresh", 16)} Muat ulang</button>
    </div>`;
  } else if (live.studioId == studioId && live.ended) {
    content = endedCard(live.ended);
  } else if (!ready) {
    content = html`<div class="kio-wait-card card center m">Memuat…</div>`;
  } else if (live.data.state == "running") {
    content = runningScreen(state, live);
  } else {
    content = waitingCard(live, chosenCamera);
  }
  return html`<div class="kio-page">${topBar(name)}${content}</div>`;
}

