// Adaptor DOM layar Sesi Foto untuk PhotoSessionController (decisions.md 60; dulu bagian DOM dari V.session_after, upd, nextPose, shoot, beep di legacy/session.js).
// Tidak menyentuh document saat diimpor; main.js memberikan document dan AudioContext.

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
        video.outerHTML = '<div class="m">Kamera tidak tersedia — foto simulasi digunakan.</div>';
      }
    },
    showPose(text) {
      const pose = $("#pose");
      if (pose) {
        pose.textContent = text;
      }
    },
    // status = sessionStatus(), strip = photoStrip() dari views/session/photoSession.js; strip hanya diganti bila daftar fotonya berubah
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
    // satu bingkai dari kamera (rasio foto = rasio kamera, tidak gepeng), atau foto simulasi bila kamera tidak tersedia; emojis = aksesori setup
    capture({ emojis }) {
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
        context.fillStyle = "hsl(" + Math.random() * 360 + ",70%,60%)"; // satu warna datar (decisions.md 64)
        context.fillRect(0, 0, width, height);
        context.font = "90px serif";
        context.fillText("😄", width / 2 - 45, height / 2 + 30);
      }
      context.font = "40px serif";
      emojis.forEach((emoji, index) => context.fillText(emoji, 20 + index * 50, 50));
      return canvas.toDataURL("image/jpeg", 0.8);
    },
  };
}

// bunyi peringatan waktu hampir habis (880 Hz, 0,4 detik); diam bila Web Audio tidak tersedia
export function createBeeper(AudioContextClass) {
  return {
    beep() {
      try {
        const audio = new AudioContextClass();
        const oscillator = audio.createOscillator();
        oscillator.connect(audio.destination);
        oscillator.frequency.value = 880;
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.4);
      } catch (error) {
        // tanpa suara
      }
    },
  };
}
