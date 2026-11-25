// Adaptor DOM layar Session Assistant di tablet studio untuk PhotoSessionController (decisions.md 60).
// Tidak menyentuh document saat diimpor; main.js memberikan document dan AudioContext.
import { mediaSrc } from "./propertyVisual.js";

export function createSessionScreen({ document }) {
  const $ = selector => document.querySelector(selector);
  return {
    attachStream(stream) {
      const video = $("#v");
      if (video) {
        video.srcObject = stream;
      }
    },
    cameraUnavailable() {
      const video = $("#v");
      if (video) {
        video.outerHTML = '<div class="kio-nocam m">Kamera tidak tersedia — foto simulasi digunakan.</div>';
      }
    },
    // url = foto pose dari data master (/img/... atau /media/... unggahan admin, dimuat dari origin API lewat mediaSrc)
    showPose(url, alt) {
      const pose = $("#pose");
      if (pose) {
        pose.src = mediaSrc(url);
        pose.alt = alt;
      }
    },
    // status = sessionStatus(), strip = photoStrip() dari views/admin/liveSession.js; strip hanya diganti bila daftar fotonya berubah
    update(status, strip) {
      const timer = $("#tm");
      if (!timer) {
        return;
      }
      timer.textContent = status.timer;
      timer.classList.toggle("warn", status.warn);
      $("#cnt").textContent = status.count;
      $("#shot").disabled = status.shootDisabled;
      const stripElement = $("#strip");
      if (stripElement && stripElement.dataset.k !== strip.key) {
        stripElement.dataset.k = strip.key;
        stripElement.innerHTML = String(strip.markup);
      }
      $("#ds").textContent = status.note;
    },
    // angka hitung mundur timer foto (3·2·1) besar di atas kamera
    showCountdown(seconds) {
      const box = $("#cd");
      if (box) {
        box.hidden = false;
        box.textContent = String(seconds);
      }
    },
    hideCountdown() {
      const box = $("#cd");
      if (box) {
        box.hidden = true;
        box.textContent = "";
      }
    },
    // satu bingkai dari kamera (rasio foto = rasio kamera, tidak gepeng), atau foto simulasi bila kamera tidak tersedia:
    // warna datar background pilihan (fill), selain itu warna acak
    capture({ fill = null } = {}) {
      const canvas = $("#cv");
      const video = $("#v");
      const width = 640;
      const height = video && video.videoWidth ? Math.round((width * video.videoHeight) / video.videoWidth) : 480;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (video && video.videoWidth) {
        context.drawImage(video, 0, 0, width, height);
      } else {
        context.fillStyle = fill || "hsl(" + Math.random() * 360 + ",70%,60%)"; // satu warna datar (decisions.md 64)
        context.fillRect(0, 0, width, height);
        context.font = "90px serif";
        context.fillText("😄", width / 2 - 45, height / 2 + 30);
      }
      return canvas.toDataURL("image/jpeg", 0.8);
    },
  };
}

// bunyi: peringatan waktu hampir habis (880 Hz, 0,4 detik) dan detak hitung mundur timer foto (660 Hz, 0,12 detik); diam bila Web Audio tidak tersedia
export function createBeeper(AudioContextClass) {
  function tone(frequency, length) {
    try {
      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      oscillator.connect(audio.destination);
      oscillator.frequency.value = frequency;
      oscillator.start();
      oscillator.stop(audio.currentTime + length);
    } catch (error) {
      // tanpa suara
    }
  }
  return {
    beep: () => tone(880, 0.4),
    tick: () => tone(660, 0.12),
  };
}
