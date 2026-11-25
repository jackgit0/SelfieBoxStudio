// PhotoSessionController: sesi foto (/sessions/:id) — mulai sesi, kamera, hitung mundur, pose, ambil foto, Google Drive, Kendali Staf
// (dulu startSession, V.session_after, syncS, upd, beep, warn, nextPose, shoot, staffAct, stopCam, stopSessionTimers di legacy/session.js;
// fitur teman sekelompok, perilaku dipertahankan kecuali yang dicatat di Progress fase 7).
// Adaptor dari main.js (decisions.md 60): screen: components/sessionScreen.js, media: { getUserMedia } (null tanpa kamera),
// timers: { setInterval, clearInterval, setTimeout }, sound: { beep }, drive: { clientId, google(), fetch }.
// refreshData = BookingController.refreshData (booking + sesi foto user); brand = nama aplikasi (folder Google Drive).
// Sesi di slice data diubah di tempat (sisa waktu tiap detik, foto baru) tanpa render ulang, seperti kode lama; layar diperbarui lewat screen.
import { packageOf } from "../models/master.js";
import { sessionStatus, photoStrip, stopSessionModal } from "../views/session/photoSession.js";

// isi awal slice photo (dulu objek P di legacy/session.js)
export function createPhotoState() {
  return {
    drive: { token: null, folder: null },
    session: null,
    poseIndex: 0,
    tickTimer: null,
    poseTimer: null,
    stream: null,
    gallerySession: null,
    deleteMode: false,
    deleteSelection: new Set(),
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
  drive,
  refreshData,
  brand,
}) {
  const sessions = models.photoSession;
  const state = () => store.get();
  const photo = () => state().photo;
  // kunjungan layar sesi yang sedang berjalan: { sessionId, cameraFailed, seconds }; null = timer tidak berjalan
  let visit = null;

  function showToast(toast, options) {
    store.update("runtime", { toast: { message: "", error: "", ...toast } }, options);
  }

  const render = () => store.update("runtime", {});

  function currentSession() {
    return sessions.shownSession(state().data.sessions, state().persisted.me, photo().session);
  }

  function refreshScreen(session) {
    screen.update(sessionStatus(session, packageOf(state().master, session.pkg)), photoStrip(session));
  }

  // step 0 = tampilkan pose sekarang, 1 = pose berikutnya
  function showPose(step) {
    const list = state().master.poses[1] || [];
    if (!list.length) {
      return;
    }
    photo().poseIndex = (photo().poseIndex + step) % list.length;
    screen.showPose("🧍 " + list[photo().poseIndex]);
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

  // sisa waktu dan status dari server; sesi berakhir → kamera mati dan toast
  async function sync(session) {
    try {
      const answer = await sessions.sync(api, session.id);
      const was = session.status;
      session.left = answer.left;
      session.paused = answer.paused;
      session.status = answer.status;
      if (was == "Aktif" && answer.status != "Aktif") {
        stopCamera();
        showToast({ message: "Sesi telah berakhir." });
      } else {
        refreshScreen(session);
      }
    } catch (error) {
      // seperti kode lama: sinkron yang gagal dicoba lagi 5 detik kemudian
    }
  }

  function countdown(session) {
    if (session.status == "Aktif" && !session.paused) {
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

  function requestCamera(current) {
    media.getUserMedia({ video: true }).then(
      cameraStream => {
        if (visit !== current) {
          cameraStream.getTracks().forEach(track => track.stop()); // layar sudah ditinggalkan
          return;
        }
        photo().stream = cameraStream;
        screen.attachStream(cameraStream);
      },
      () => {
        if (visit === current) {
          current.cameraFailed = true;
          screen.cameraUnavailable();
        }
      },
    );
  }

  async function uploadToDrive(item) {
    const token = photo().drive.token;
    const result = await models.drive.upload({
      fetch: drive.fetch,
      token,
      folder: photo().drive.folder,
      folderName: brand + " - " + new Date().toLocaleDateString("id-ID"),
      photo: item,
    });
    photo().drive.folder = result.folder;
    if (result.driveId) {
      item.driveId = result.driveId;
    }
    return result.status;
  }

  const controller = {
    // Check-in & Mulai Sesi (Detail Booking, data-id): sesi dibuat, data dimuat ulang, izin Google Drive diminta, lalu ke layar sesi
    async start({ id }) {
      try {
        const created = await sessions.start(api, Number(id));
        await refreshData();
        photo().session = created.id;
        photo().gallerySession = null; // Galeri membuka sesi terbaru (dulu tetap di sesi yang terakhir dilihat)
      } catch (error) {
        return showToast({ error: error.message });
      }
      const token = await models.drive.authorize({ clientId: drive.clientId, google: drive.google() });
      photo().drive.token = token;
      // toast sesudah pindah halaman: navigasi mengosongkan toast (dulu toast ini tidak pernah terlihat)
      router.navigate(`/sessions/${photo().session}`);
      showToast({
        message: token
          ? "Google Drive terhubung: foto otomatis dikirim ke Drive Anda."
          : "Drive belum terhubung (isi GOOGLE_CLIENT_ID). Foto disimpan di server.",
      });
    },

    // Buka Sesi (Detail Booking): sesi yang sedang dibuka atau sesi aktif user, selain itu Galeri
    open() {
      const active = sessions.activeSession(state().data.sessions, state().persisted.me);
      const id = photo().session || (active || {}).id;
      router.navigate(id ? `/sessions/${id}` : "/gallery");
    },

    // kait after() rute /sessions/:id (setiap render): kunjungan baru = kamera + timer; render ulang sesi yang sama = pasang lagi ke elemen baru.
    // Sesi = id di URL (sama dengan view), id yang tidak dikenal → sesi aktif user
    enter(match) {
      const session = sessions.shownSession(state().data.sessions, state().persisted.me, match.params.id);
      if (!session) {
        return;
      }
      photo().session = session.id;
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
      if (session.status == "Aktif" && media) {
        requestCamera(current);
      }
      showPose(0);
      photo().poseTimer = timers.setInterval(() => showPose(1), 8000);
      photo().tickTimer = timers.setInterval(() => countdown(session), 1000);
      refreshScreen(session);
    },

    // kait leave() rute /sessions/:id (dulu stopSessionTimers di render())
    stopTimers() {
      timers.clearInterval(photo().tickTimer);
      timers.clearInterval(photo().poseTimer);
      photo().tickTimer = null;
      photo().poseTimer = null;
      stopCamera();
      visit = null;
    },

    nextPose() {
      showPose(1);
    },

    async shoot() {
      const session = currentSession();
      if (!session || session.status != "Aktif" || session.paused) {
        return;
      }
      const emojis = session.setup
        ? session.setup.acc.map(id => (state().master.properties.find(item => item.id == id) || {}).e || "")
        : [];
      const image = screen.capture({ emojis });
      try {
        const answer = await sessions.shoot(api, session.id, image);
        const item = { id: answer.id, t: answer.t, fav: false, sel: false, drive: "…", img: image };
        session.photos.push(item);
        refreshScreen(session);
        item.drive = await uploadToDrive(item);
        sessions.markDrive(api, item.id, item.drive).catch(() => {});
      } catch (error) {
        showToast({ error: error.message }, { silent: true });
        await sync(session);
        render();
      }
    },

    // Kendali Staf (data-command = pause | resume | stop); Hentikan minta konfirmasi lewat modal
    async staffAction({ command }) {
      const session = currentSession();
      if (!state().persisted.staff || !session) {
        return;
      }
      if (command == "stop" && (await ui.modal(stopSessionModal())) !== true) {
        return;
      }
      try {
        const answer = await sessions.staffAction(api, session.id, command);
        store.update(
          "persisted",
          { log: [...state().persisted.log, command + " " + new Date().toLocaleTimeString()] },
          { silent: true },
        );
        session.left = answer.left;
        session.paused = answer.paused;
        session.status = answer.status;
        if (answer.status != "Aktif") {
          stopCamera();
          showToast({ message: "Sesi dihentikan staf." }, { silent: true });
        }
      } catch (error) {
        showToast({ error: error.message }, { silent: true });
      }
      render();
    },

    // foto dihapus dari strip layar sesi (GalleryController): perbarui hitungan dan strip di tempat
    showSession(sessionId) {
      const session = state().data.sessions.find(item => item.id == sessionId);
      if (session) {
        refreshScreen(session);
      }
    },
  };
  return controller;
}
