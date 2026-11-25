// Titik masuk aplikasi (satu-satunya <script type="module"> di index.html).
// Fase 2: menyiapkan API dan store, membungkus objek state kode lama (js/legacy) dengan store, memasang jembatan window
// untuk atribut onclick lama, lalu menjalankan isi boot.js lama: muat data master, tautan #reset=, pulihkan login, render pertama.
import { API_BASE } from "./config.js";
import { createStore } from "./core/store.js";
import { createApi } from "./models/api.js";
import { loadMaster } from "./models/master.js";
import { S, M, BK, R, D, connectLegacy } from "./legacy/state.js";
import { $, render, refresh, logout } from "./legacy/core.js";
import "./legacy/customer.js";
import "./legacy/landing.js";
import { P } from "./legacy/session.js";
import { AD, aDenied } from "./legacy/admin.js";
import { installLegacyBridge } from "./legacy-bridge.js";

// localStorage bisa melempar galat bila diblokir browser; aplikasi tetap jalan tanpa penyimpanan
function browserStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function replaceUrlState(state) {
  try {
    history.replaceState(state, "", location.pathname + location.search);
  } catch (error) {
    // history tidak tersedia (mis. halaman dari berkas lokal)
  }
}

async function start() {
  const storage = browserStorage();
  const api = createApi({ base: API_BASE, storage });
  const store = createStore({ persisted: S, master: M, booking: BK, runtime: R, data: D, photo: P, admin: AD }, { storage, persistKey: "snapia" });
  connectLegacy({ api, store });
  installLegacyBridge();

  try {
    store.update("master", await loadMaster(api), { silent: true });
  } catch (error) {
    $("#app").innerHTML = "<p style='padding:24px'>Server API tidak dapat dihubungi. Jalankan backend: <code>cd backend && npm start</code></p>";
    return;
  }

  // tautan "buat sandi baru" dari email: /#reset=<token>; login yang tersimpan dilepas
  const resetMatch = /#reset=([a-f0-9]{64})/.exec(location.hash);
  if (resetMatch) {
    R.auth.resetToken = resetMatch[1];
    R.auth.mode = "reset";
    replaceUrlState(null);
    api.token = "";
    S.user = S.me = null;
    S.admin = false;
  }

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
  if (!S.me) {
    S.view = resetMatch ? "auth" : "landing";
  }
  replaceUrlState({ v: S.view, p: S.p });
  render();
}

start();
