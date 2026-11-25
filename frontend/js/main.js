// Titik masuk aplikasi (satu-satunya <script type="module"> di index.html).
// Menyiapkan API, store dan router, membungkus objek state kode lama (js/legacy) dengan store, memasang jembatan window
// untuk atribut onclick lama, lalu menjalankan isi boot.js lama: muat data master, tautan #reset= (router), pulihkan login, render pertama.
import { API_BASE } from "./config.js";
import { createStore } from "./core/store.js";
import { createRouter } from "./core/router.js";
import { createApi } from "./models/api.js";
import { loadMaster } from "./models/master.js";
import { S, M, BK, R, D, connectLegacy } from "./legacy/state.js";
import { $, render, refresh, logout } from "./legacy/core.js";
import "./legacy/customer.js";
import "./legacy/landing.js";
import { P } from "./legacy/session.js";
import { AD, aDenied } from "./legacy/admin.js";
import { installLegacyBridge } from "./legacy-bridge.js";

// localStorage/sessionStorage bisa melempar galat bila diblokir browser; aplikasi tetap jalan tanpa penyimpanan
function browserStorage(name = "localStorage") {
  try {
    return window[name];
  } catch (error) {
    return null;
  }
}

async function start() {
  const storage = browserStorage();
  const api = createApi({ base: API_BASE, storage });
  // booking berjalan (studio, tanggal, sesi, id reschedule; tanpa quote) bertahan saat dimuat ulang, hanya di tab ini (decisions.md 26)
  const session = { storage: browserStorage("sessionStorage"), key: "snapia_booking", slices: { booking: ["studio", "date", "slot", "rescheduleId"] } };
  const store = createStore({ persisted: S, master: M, booking: BK, runtime: R, data: D, photo: P, admin: AD }, { storage, persistKey: "snapia", session });
  const router = createRouter({
    history: window.history,
    location: window.location,
    events: window,
    getSession: () => ({ loggedIn: Boolean(S.me), admin: Boolean(S.admin), mustChange: Boolean(S.admin && AD.me && AD.me.must_change) }),
    onChange: cause => {
      if (cause === "popstate") {
        R.toast.message = R.toast.error = "";
      }
      render();
    },
    // tautan "buat sandi baru" dari email (/#reset=<token>): login yang tersimpan dilepas
    onResetLink: token => {
      R.auth.resetToken = token;
      api.token = "";
      S.user = S.me = null;
      S.admin = false;
    },
  });
  connectLegacy({ api, store, router });
  installLegacyBridge();

  try {
    store.update("master", await loadMaster(api), { silent: true });
  } catch (error) {
    $("#app").innerHTML = "<p style='padding:24px'>Server API tidak dapat dihubungi. Jalankan backend: <code>cd backend && npm start</code></p>";
    return;
  }

  // back/forward dan tautan #reset= (diubah menjadi /reset-password)
  router.start();

  // pulihkan login (Mode Staf tidak ikut dipulihkan)
  S.staff = false;
  if (api.token && S.user) {
    try {
      S.me = S.admin ? "admin" : S.user.id;
      if (S.admin) {
        AD.me = await api.get("/admin/me");
      } else {
        await refresh();
      }
    } catch (error) {
      if (S.admin && error.status == 403 && /Hanya admin/.test(error.message)) {
        return aDenied(); // token yang tersimpan bukan token admin: dialog Akses Ditolak
      }
      logout();
      return;
    }
  } else {
    S.me = null;
  }
  render();
}

start();
