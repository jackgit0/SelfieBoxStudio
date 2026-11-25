// Store aplikasi: satu objek state berisi slice (persisted, master, booking, runtime, data, photo, admin).
// Hanya slice "persisted" yang disimpan ke storage (localStorage["snapia"], kunci lama dipertahankan agar login tetap berlaku).
// Slice dipegang lewat rujukan: update() menggabungkan ke objek slice yang sama, sehingga kode lama yang memegang objeknya
// (S, M, R, BK, D, P, AD di js/legacy) tetap melihat perubahan. Selama kode lama masih ada, ubah slice dengan update(), bukan set().

const PERSISTED = "persisted";
// kunci state lama yang dibuang saat dimuat: kuis rekomendasi paket dan pilihan properti (fitur sudah dihapus),
// serta booking dan sesi foto (dulu disimpan di state, kini di slice data)
const DROPPED_KEYS = ["quiz", "setup", "bookings", "sessions"];

export function migrateSaved(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return {};
  }
  const result = { ...saved };
  for (const key of DROPPED_KEYS) {
    delete result[key];
  }
  if (result.acct === "pref") {
    result.acct = "profile"; // tab akun lama "pref" (preferensi) sudah diganti "profile"
  }
  return result;
}

function readSaved(storage, persistKey) {
  if (!storage || !persistKey) {
    return {};
  }
  try {
    return migrateSaved(JSON.parse(storage.getItem(persistKey)));
  } catch (error) {
    return {};
  }
}

export function createStore(initial = {}, { storage = null, persistKey = "" } = {}) {
  const state = { ...initial };
  if (!state[PERSISTED]) {
    state[PERSISTED] = {};
  }
  Object.assign(state[PERSISTED], readSaved(storage, persistKey));
  const listeners = new Set();

  function notify() {
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  function persist() {
    if (!storage || !persistKey) {
      return;
    }
    try {
      storage.setItem(persistKey, JSON.stringify(state[PERSISTED]));
    } catch (error) {
      // storage penuh atau diblokir (mode privat): state tetap berjalan di memori
    }
  }

  return {
    get() {
      return state;
    },
    // ganti slice utuh: set({ data: { bookings: [] } })
    set(patch) {
      Object.assign(state, patch);
      if (PERSISTED in patch) {
        persist();
      }
      notify();
    },
    // gabungkan ke satu slice; silent = tanpa render ulang (mis. saat mengetik di form)
    update(slice, patch, { silent = false } = {}) {
      if (!state[slice]) {
        state[slice] = {};
      }
      Object.assign(state[slice], patch);
      if (slice === PERSISTED) {
        persist();
      }
      if (!silent) {
        notify();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // simpan slice persisted sekarang (dipakai save() kode lama yang mengubah objeknya langsung)
    persist,
  };
}
