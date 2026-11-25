// Isi awal slice store (architecture.md → Store). Slice photo (PhotoSessionController.createPhotoState) dan admin
// (AdminController.createAdminState) dibuat oleh controller pemiliknya; main.js menggabungkan semuanya ke createStore().
// Setiap panggilan memberi objek baru, jadi tes tidak berbagi state.
export function createInitialState() {
  return {
    // state tersimpan (localStorage["snapia"]): user, peran admin, paket pilihan, bookmark studio, Mode Staf, …
    persisted: { user: null, me: null, admin: false, pkg: null, bm: [], staff: false, log: [] },
    // data master dari /api/master (models/master.js loadMaster); json = isi terakhir untuk refreshMaster
    master: { packages: [], allPackages: [], favouritePackageId: null, discount: { pct: 0, label: "" }, peopleRanges: [], budgetRanges: [], studios: [], allStudios: [], properties: [], poses: {}, policy: { refund_hours: 2 }, json: "" },
    // booking yang sedang diisi: studio, tanggal, sesi; quote = rincian harga dari /api/quote; rescheduleId = id booking yang sedang diubah jadwalnya
    booking: { studio: null, date: null, slot: null, quote: null, rescheduleId: null },
    // state sementara: rute aktif (nama, params, query, judul, tab), toast, cache ketersediaan slot, bulan kalender, isian pembatalan,
    // mode form masuk + token reset, form Contact Us di landing, dialog Akses Ditolak yang sedang terbuka
    runtime: {
      route: { name: "landing", path: "/", params: {}, query: {}, title: "", tab: null },
      toast: { message: "", error: "" },
      availability: {},
      calendar: {},
      cancel: { reason: "", detail: "" },
      auth: { mode: "login", resetToken: "" },
      contact: { n: "", e: "", m: "", ok: "", err: "", busy: false },
      accessDeniedOpen: false,
    },
    // booking dan sesi foto milik user yang masuk (dari /api/bookings dan /api/sessions; tidak disimpan)
    data: { bookings: [], sessions: [] },
  };
}
