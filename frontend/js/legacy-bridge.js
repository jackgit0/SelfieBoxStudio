// Jembatan sementara (fase 2 sampai 9, decisions.md 19 dan 36): kode lama masih memakai atribut onclick="…", onchange="…" dan sejenisnya.
// Atribut itu dijalankan di lingkup global, jadi setiap nama yang muncul di dalamnya (fungsi dan objek state) dipasang ke window di sini.
// Setiap fase yang memindahkan fitur ke atribut data-* (core/events.js) menghapus namanya dari daftar; fase 9 menghapus berkas ini.
// Daftar = semua nama milik js/legacy yang muncul di teks string kode lama (lebih luas dari yang benar-benar dipakai atribut, tidak masalah).
import * as state from "./legacy/state.js";
import * as core from "./legacy/core.js";
import * as customer from "./legacy/customer.js";
import * as session from "./legacy/session.js";
import * as landing from "./legacy/landing.js";
import * as admin from "./legacy/admin.js";

const BRIDGED = {
  state: ["R", "S"],
  core: ["changePw", "doReset", "forgot", "go", "ic", "login", "logout", "me", "modal", "refresh", "reg", "render"],
  customer: ["confirmPay", "doCancel", "mailInv", "openCancel", "payNow", "qr", "saveProfile", "selectPkg"],
  session: ["P", "bulkDel", "confirmSel", "delPhoto", "dl", "fav", "nextPose", "ph", "selAllNonFav", "selPh", "shoot", "staffAct", "startSession", "toggleDel", "warn"],
  landing: ["lpMenu", "openAuth", "sendContact", "toSec"],
  admin: ["AD", "acctSave", "bookDel", "bookSave", "delCust", "discSave", "loading", "opDel", "opEdit", "opSave", "openBook", "openCust", "pkActive", "pkAdd", "pkDel", "pkSave", "poseDel", "poseSave", "propDel", "propSave", "pthumb", "sAdd", "sDay", "sDel", "sNav", "sSave", "sel", "stCancel", "stEdit", "stReview", "stSave", "stat", "studioDel", "studioSave", "upImg"],
};

const MODULES = { state, core, customer, session, landing, admin };

// dipanggil main.js sebelum render pertama
export function installLegacyBridge() {
  for (const [moduleName, names] of Object.entries(BRIDGED)) {
    for (const name of names) {
      window[name] = MODULES[moduleName][name];
    }
  }
}
