// Store aplikasi: satu objek state berisi slice (persisted, master, booking, runtime, data, photo, admin).
// Slice "persisted" disimpan ke storage (localStorage["snapia"], kunci lama dipertahankan agar login tetap berlaku).
// Opsi session = { storage, key, slices: { slice: [field, …] } } menyimpan field tertentu per tab (sessionStorage["snapia_booking"]:
// booking berjalan tanpa quote, decisions.md 26); kuncinya dihapus bila semua field kosong.
// Slice dipegang lewat rujukan (decisions.md 33): update() menggabungkan ke objek slice yang sama, sehingga controller yang
// memegang objek slice (mis. state = store.get()) tetap melihat perubahan; set() mengganti slice utuh.

const PERSISTED = "persisted";
// kunci state lama yang dibuang saat dimuat: kuis rekomendasi paket dan pilihan properti (fitur sudah dihapus),
// booking dan sesi foto (dulu disimpan di state, kini di slice data), serta halaman aktif view/p (sejak fase 3 dari URL lewat router)
const DROPPED_KEYS = ["quiz", "setup", "bookings", "sessions", "view", "p"];

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

function readSession(session) {
  if (!session || !session.storage) {
    return {};
  }
  try {
    const saved = JSON.parse(session.storage.getItem(session.key));
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    return {};
  }
}

function pickFields(source, fields) {
  const picked = {};
  for (const field of fields) {
    if (source && source[field] !== undefined && source[field] !== null) {
      picked[field] = source[field];
    }
  }
  return picked;
}

export function createStore(initial = {}, { storage = null, persistKey = "", session = null } = {}) {
  const state = { ...initial };
  if (!state[PERSISTED]) {
    state[PERSISTED] = {};
  }
  Object.assign(state[PERSISTED], readSaved(storage, persistKey));
  const sessionSlices = session ? session.slices : {};
  const savedSession = readSession(session);
  for (const [slice, fields] of Object.entries(sessionSlices)) {
    if (!state[slice]) {
      state[slice] = {};
    }
    Object.assign(state[slice], pickFields(savedSession[slice], fields));
  }
  const listeners = new Set();

  function notify() {
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  function persistSession() {
    if (!session || !session.storage) {
      return;
    }
    const saved = {};
    let filled = false;
    for (const [slice, fields] of Object.entries(sessionSlices)) {
      saved[slice] = pickFields(state[slice], fields);
      filled = filled || Object.keys(saved[slice]).length > 0;
    }
    try {
      if (filled) {
        session.storage.setItem(session.key, JSON.stringify(saved));
      } else {
        session.storage.removeItem(session.key);
      }
    } catch (error) {
      // sessionStorage diblokir: booking tetap berjalan di memori, hanya tidak bertahan saat dimuat ulang
    }
  }

  function persist() {
    persistSession();
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
      } else if (Object.keys(patch).some(slice => slice in sessionSlices)) {
        persistSession();
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
      } else if (slice in sessionSlices) {
        persistSession();
      }
      if (!silent) {
        notify();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // simpan slice persisted (dan slice per tab) sekarang (dipakai save() kode lama yang mengubah objeknya langsung)
    persist,
    // simpan hanya slice per tab (dipanggil render() kode lama: BK diubah langsung tanpa update)
    persistSession,
  };
}
