// ===== STATE BERSAMA KODE LAMA (refactor MVC fase 2) =====
// Objek fase 1 dalam satu modul daun (tidak mengimpor berkas fitur), agar sudah terisi sebelum berkas fitur menjalankan V.home = … saat dimuat:
// core.js dan berkas fitur saling mengimpor, sehingga sebagian berkas fitur dievaluasi lebih dulu daripada core.js (decisions.md 31).
// main.js membungkus objek-objek ini dengan store (slice persisted = S, master = M, booking = BK, runtime = R, data = D) lalu memanggil connectLegacy().

// state tersimpan (localStorage["snapia"]): nilai awal di sini, isi tersimpan dimuat ke objek yang sama oleh store
export const S = { user: null, me: null, admin: false, pkg: null, bm: [], staff: false, log: [] };
// data master dari /api/master (models/master.js loadMaster); json = isi terakhir untuk refreshMaster
export const M = { packages: [], allPackages: [], favouritePackageId: null, discount: { pct: 0, label: "" }, peopleRanges: [], budgetRanges: [], studios: [], allStudios: [], properties: [], poses: {}, policy: { refund_hours: 2 }, json: "" };
// tabel view lama: V.<view>() → HTML, V.<view>_after() setelah render; <view> = nama rute di core/router.js (dipindah per fitur di fase 4–8b)
export const V = {};
// booking dan sesi foto milik user yang masuk (dari /api/bookings dan /api/sessions; tidak disimpan)
export const D = { bookings: [], sessions: [] };
// state sementara (tidak disimpan): rute aktif (dari router: nama view, params, query, judul, tab), toast, cache ketersediaan slot, bulan kalender, isian pembatalan, mode form masuk + token reset, form Contact Us di landing, dialog Akses Ditolak yang sedang terbuka
export const R = { route: { name: "landing", path: "/", params: {}, query: {}, title: "", tab: null }, toast: { message: "", error: "" }, availability: {}, calendar: {}, cancel: { reason: "", detail: "" }, auth: { mode: "login", resetToken: "" }, contact: { n: "", e: "", m: "", ok: "", err: "", busy: false }, accessDeniedOpen: false };
// booking yang sedang diisi: studio, tanggal, sesi; quote = rincian harga dari /api/quote; rescheduleId = id booking yang sedang diubah jadwalnya
export const BK = { studio: null, date: null, slot: null, quote: null, rescheduleId: null };

// klien API (models/api.js), store, router (core/router.js) dan renderer (core/render.js), diisi main.js lewat connectLegacy() sebelum render pertama
export let API = null;
export let ROUTER = null;
// renderer (core/render.js) yang dipakai render() lama
export let RENDERER = null;
// controller baru (js/controllers) yang dipanggil kode lama: { studio, package } (decisions.md 43)
export let CONTROLLERS = {};
let store = null;
export function connectLegacy({ api, store: appStore, router, renderer, controllers = {} }) {
  API = api;
  ROUTER = router;
  RENDERER = renderer;
  CONTROLLERS = controllers;
  store = appStore;
}
// simpan S (state tersimpan) dan booking berjalan (BK, per tab) lewat store
export const save = () => {
  if (store) store.persist();
};
// simpan hanya booking berjalan ke sessionStorage (dipanggil setiap render: kode lama mengubah BK langsung)
export const saveBooking = () => {
  if (store) store.persistSession();
};
