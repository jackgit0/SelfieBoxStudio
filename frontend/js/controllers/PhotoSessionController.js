// PhotoSessionController: Session Assistant di tablet studio (/admin/studios/:id/live, dibuka dari ikon mata di Admin → Studio).
// Tablet masuk sebagai admin. Alur: layar tunggu (Muat ulang manual, pilih kamera) → booking yang sudah check-in di meja depan →
// Mulai Sesi (dari jam slot) → kamera, hitung mundur sesi, timer foto 3/5 detik, ambil foto, background, pose, Panggil Staff →
// Akhiri Sesi (password admin) atau waktu habis → layar selesai. Keluar ke Admin → Studio juga butuh password admin.
// Adaptor dari main.js (decisions.md 60): screen = components/sessionScreen.js, media = { getUserMedia, enumerateDevices } (null tanpa kamera),
// timers = { setInterval, clearInterval, setTimeout, clearTimeout }, sound = { beep, tick }, photoUrl = api.adminPhotoUrl,
// admin = inti AdminController (handleAccessError). Sesi di slice photo diubah di tempat (sisa waktu tiap detik, foto baru) tanpa render ulang.
import { backgroundModal, passwordModal, photoStrip, sessionStatus } from "../views/admin/liveSession.js";

// isi awal slice photo: Galeri (drive, gallerySession, deleteMode, deleteSelection; GalleryController) dan layar tablet (live)
export function createPhotoState() {
  return {
    drive: { token: null, folder: null },
    gallerySession: null,
    deleteMode: false,
    deleteSelection: new Set(),
    poseIndex: 0,
    tickTimer: null,
    poseTimer: null,
    countTimer: null,
    stream: null,
    // studioId, data = jawaban /live, error, ended = { customer }, cameras, selfTimer, backgrounds = { [sessionId]: propertyId }, counting
    live: {
      studioId: null,
      data: null,
      error: "",
      ended: null,
      cameras: null,
      selfTimer: 3,
      backgrounds: {},
      counting: false,
    },
  };
}

export function createPhotoSessionController({
  api,
  store,
  ui,
  router,
  models,
  screen,
  media,
  timers,
  sound,
  photoUrl,
  admin: adminCore,
}) {
  const liveModel = models.admin.liveSession;
  const state = () => store.get();
  const photo = () => state().photo;
  const live = () => photo().live;
  // kunjungan sesi yang sedang berjalan: { sessionId, cameraFailed, seconds }; null = timer tidak berjalan
  let visit = null;
  let loading = false;

  function showToast(toast, options) {
    store.update("runtime", { toast: { message: "", error: "", ...toast } }, options);
  }

  const render = () => store.update("runtime", {});

  function setLive(patch, options) {
    store.update("photo", { live: { ...live(), ...patch } }, options);
  }

  function failWith(error) {
    if (adminCore && adminCore.handleAccessError(error)) {
      return;
    }
    showToast({ error: error.message });
  }

  function runningSession() {
    const data = live().data;
    return data && data.state == "running" ? data.session : null;
  }

  function backgroundOf(session) {
    const id = (live().backgrounds || {})[session.id];
    return liveModel.backgroundsOf(state().master).find(item => item.id == id) || null;
  }

  function refreshScreen(session) {
    screen.update(sessionStatus(session, { counting: live().counting }), photoStrip(session, photoUrl));
  }

  // step 0 = tampilkan pose sekarang, 1 = pose berikutnya; pose = foto contoh (url) untuk rentang jumlah orang pertama
  function showPose(step) {
    const master = state().master;
    const list = master.poses[1] || [];
    if (!list.length) {
      return;
    }
    const range = (master.peopleRanges || []).find(item => item.id == 1);
    photo().poseIndex = (photo().poseIndex + step) % list.length;
    screen.showPose(list[photo().poseIndex], range ? `Contoh pose untuk ${range.range} orang` : "Contoh pose");
  }

  function warn() {
    sound.beep();
    timers.setTimeout(() => sound.beep(), 600);
  }

  function stopCamera() {
    const current = photo().stream;
    if (current) {
      current.getTracks().forEach(track => track.stop());
      photo().stream = null;
    }
  }

  function cancelCountdown() {
    if (photo().countTimer) {
      timers.clearTimeout(photo().countTimer);
      photo().countTimer = null;
    }
    if (live().counting) {
      live().counting = false;
      screen.hideCountdown();
    }
  }

  // sesi berakhir (waktu habis atau Akhiri Sesi): kamera dan timer berhenti, layar Terima kasih
  function finish(session) {
    controller.stopTimers();
    setLive({ ended: { customer: session.customer }, data: null });
  }

  // sisa waktu dan status dari server
  async function sync(session) {
    try {
      const answer = await liveModel.syncSession(api, session.id);
      session.left = answer.left;
      session.status = answer.status;
      if (answer.status != "Aktif") {
        finish(session);
      } else {
        refreshScreen(session);
      }
    } catch (error) {
      // sinkron yang gagal dicoba lagi 5 detik kemudian
    }
  }

  function countdown(session) {
    if (session.status == "Aktif") {
      session.left--;
      if (session.left == 60) {
        warn();
      }
      if (session.left <= 0) {
        sync(session);
      }
    }
    refreshScreen(session);
    visit.seconds++;
    if (visit.seconds % 5 == 0 && session.status == "Aktif") {
      sync(session);
    }
  }

  function cameraConstraints() {
    const chosen = (state().persisted.cameras || {})[live().studioId];
    return chosen ? { video: { deviceId: { exact: chosen } } } : { video: true };
  }

  // daftar kamera (video input); label baru terisi setelah izin kamera diberikan, jadi dibaca ulang setelah kamera menyala
  async function listCameras() {
    if (!media || !media.enumerateDevices) {
      return;
    }
    try {
      const cameras = (await media.enumerateDevices())
        .filter(device => device.kind == "videoinput")
        .map(device => ({ deviceId: device.deviceId, label: device.label }));
      if (JSON.stringify(live().cameras) !== JSON.stringify(cameras)) {
        setLive({ cameras }, { silent: true });
        if (!runningSession()) {
          render(); // pilihan kamera hanya tampil di layar tunggu
        }
      }
    } catch (error) {
      // tanpa daftar kamera: kamera bawaan dipakai
    }
  }

  function requestCamera(current) {
    media.getUserMedia(cameraConstraints()).then(
      cameraStream => {
        if (visit !== current) {
          cameraStream.getTracks().forEach(track => track.stop()); // layar sudah ditinggalkan
          return;
        }
        photo().stream = cameraStream;
        screen.attachStream(cameraStream);
        listCameras();
      },
      () => {
        if (visit === current) {
          current.cameraFailed = true;
          screen.cameraUnavailable();
        }
      },
    );
  }

  async function load() {
    const studioId = live().studioId;
    loading = true;
    try {
      const data = await liveModel.loadLive(api, studioId);
      if (live().studioId == studioId) {
        setLive({ data, error: "" });
      }
    } catch (error) {
      if (live().studioId == studioId) {
        setLive({ error: error.message }, { silent: true });
      }
      failWith(error);
    } finally {
      loading = false;
    }
  }

  async function askPassword(options) {
    const answer = await ui.modal(passwordModal(options));
    return answer && answer.value == "ok" ? answer.data : null;
  }

  // satu langkah hitung mundur timer foto; 0 = ambil foto
  function step(session, current, seconds) {
    if (visit !== current || session.status != "Aktif") {
      cancelCountdown();
      return;
    }
    if (seconds > 0) {
      screen.showCountdown(seconds);
      sound.tick();
      photo().countTimer = timers.setTimeout(() => step(session, current, seconds - 1), 1000);
      return;
    }
    photo().countTimer = null;
    live().counting = false;
    screen.hideCountdown();
    takePhoto(session);
  }

  async function takePhoto(session) {
    const image = screen.capture({ fill: liveModel.backgroundFill(backgroundOf(session)) });
    try {
      const answer = await liveModel.shoot(api, session.id, image);
      session.photos.push({ id: answer.id, t: answer.t, fav: false, sel: false, img: image });
      refreshScreen(session);
    } catch (error) {
      showToast({ error: error.message }, { silent: true });
      await sync(session);
      render();
    }
  }

  const controller = {
    // kait after() rute (setiap render): studio baru → muat keadaan tablet; sesi berjalan → kamera + timer
    // (render ulang sesi yang sama = pasang lagi ke elemen baru); selain itu kamera dan timer berhenti
    enter(match) {
      const studioId = Number(match.params.id);
      if (live().studioId != studioId) {
        controller.stopTimers();
        setLive({ studioId, data: null, error: "", ended: null, counting: false }, { silent: true });
      }
      if (live().cameras === null) {
        setLive({ cameras: [] }, { silent: true });
        listCameras();
      }
      if (!live().data && !live().error && !live().ended && !loading) {
        load();
        return;
      }
      const session = runningSession();
      if (!session) {
        controller.stopTimers();
        return;
      }
      if (visit && visit.sessionId === session.id) {
        if (photo().stream) {
          screen.attachStream(photo().stream);
        } else if (visit.cameraFailed) {
          screen.cameraUnavailable();
        }
        showPose(0);
        refreshScreen(session);
        return;
      }
      controller.stopTimers();
      const current = { sessionId: session.id, cameraFailed: false, seconds: 0 };
      visit = current;
      if (media) {
        requestCamera(current);
      } else {
        current.cameraFailed = true;
        screen.cameraUnavailable();
      }
      showPose(0);
      photo().poseTimer = timers.setInterval(() => showPose(1), 8000);
      photo().tickTimer = timers.setInterval(() => countdown(session), 1000);
      refreshScreen(session);
    },

    // kait leave() rute dan saat sesi berakhir
    stopTimers() {
      cancelCountdown();
      timers.clearInterval(photo().tickTimer);
      timers.clearInterval(photo().poseTimer);
      photo().tickTimer = null;
      photo().poseTimer = null;
      stopCamera();
      visit = null;
    },

    // Muat ulang (layar tunggu dan layar selesai)
    refresh() {
      setLive({ data: null, error: "", ended: null }, { silent: true });
      load();
    },

    // Mulai Sesi (data-id = booking yang sudah check-in)
    async start({ id }) {
      try {
        const session = await liveModel.startSession(api, Number(id));
        setLive({ data: { ...live().data, state: "running", session }, ended: null });
      } catch (error) {
        failWith(error);
        controller.refresh();
      }
    },

    // kartu TIMER: 3 atau 5 detik
    setTimer({ seconds }) {
      setLive({ selfTimer: Number(seconds) });
    },

    // pilihan kamera disimpan per studio di browser tablet; sesi berjalan → kamera diganti
    setCamera(dataset, event) {
      const studioId = live().studioId;
      store.update(
        "persisted",
        { cameras: { ...(state().persisted.cameras || {}), [studioId]: event.target.value } },
        { silent: true },
      );
      if (visit) {
        stopCamera();
        requestCamera(visit);
      }
    },

    // Ambil Foto: hitung mundur timer foto (3/5 detik, detak tiap detik), lalu foto
    shoot() {
      const session = runningSession();
      if (!session || session.status != "Aktif" || live().counting || !visit) {
        return;
      }
      live().counting = true;
      refreshScreen(session);
      step(session, visit, live().selfTimer || 3);
    },

    nextPose() {
      showPose(1);
    },

    // hapus foto dari strip selama sesi berjalan
    async deletePhoto({ photo: photoId }) {
      const session = runningSession();
      if (!session) {
        return;
      }
      try {
        await liveModel.deletePhoto(api, photoId);
        session.photos = session.photos.filter(item => item.id != photoId);
        refreshScreen(session);
      } catch (error) {
        showToast({ error: error.message });
      }
    },

    // Figma "background": pilih satu dari background properti admin; disimpan di tablet per sesi
    async pickBackground() {
      const session = runningSession();
      if (!session) {
        return;
      }
      const backgrounds = liveModel.backgroundsOf(state().master);
      const current = (live().backgrounds || {})[session.id] || null;
      const answer = await ui.modal(backgroundModal(backgrounds, current));
      if (!answer || answer.value != "ok" || !answer.data) {
        return;
      }
      const chosen = backgrounds.find(item => item.id == answer.data);
      setLive({ backgrounds: { ...live().backgrounds, [session.id]: answer.data } }, { silent: true });
      showToast({ message: `Background diganti ke ${chosen ? chosen.name : "pilihanmu"}.` });
    },

    // Akhiri Sesi: password admin
    async end() {
      const session = runningSession();
      if (!session) {
        return;
      }
      const password = await askPassword({
        title: "Akhiri sesi sekarang?",
        text: "Sisa waktu sesi tidak dapat dikembalikan. Masukkan password admin untuk mengakhiri sesi.",
        okLabel: "Akhiri Sesi",
        danger: true,
      });
      if (password === null) {
        return;
      }
      try {
        await liveModel.endSession(api, session.id, password);
        finish(session);
      } catch (error) {
        failWith(error);
      }
    },

    // Keluar ke Admin → Studio: password admin
    async exit() {
      const password = await askPassword({
        title: "Keluar dari layar tablet?",
        text: "Masukkan password admin untuk kembali ke panel admin.",
        okLabel: "Keluar",
      });
      if (password === null) {
        return;
      }
      try {
        await liveModel.verifyPassword(api, password);
      } catch (error) {
        failWith(error);
        return;
      }
      controller.stopTimers();
      setLive({ studioId: null, data: null, error: "", ended: null }, { silent: true });
      router.navigate("/admin/studios");
    },
  };
  return controller;
}
