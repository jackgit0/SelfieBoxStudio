// Jembatan sementara (fase 2 sampai 9, decisions.md 19 dan 36): kode lama masih memakai atribut onclick="…", onchange="…" dan sejenisnya.
// Atribut itu dijalankan di lingkup global, jadi setiap nama yang muncul di dalamnya (fungsi dan objek state) dipasang ke window di sini.
// Setiap fase yang memindahkan fitur ke atribut data-* (core/events.js) menghapus namanya dari daftar; fase 9 menghapus berkas ini.
// Daftar = semua nama milik js/legacy yang muncul di teks string kode lama (lebih luas dari yang benar-benar dipakai atribut, tidak masalah).
import * as state from "./legacy/state.js";
import * as core from "./legacy/core.js";
import * as admin from "./legacy/admin.js";

const BRIDGED = {
  state: ["R", "S"],
  core: ["go", "ic", "me", "modal", "render"],
  admin: ["AD", "bookDel", "bookSave", "loading", "openBook", "poseDel", "poseSave", "propDel", "propSave", "pthumb", "sel", "upImg"],
};

const MODULES = { state, core, admin };

// dipanggil main.js sebelum render pertama
export function installLegacyBridge() {
  for (const [moduleName, names] of Object.entries(BRIDGED)) {
    for (const name of names) {
      window[name] = MODULES[moduleName][name];
    }
  }
}
