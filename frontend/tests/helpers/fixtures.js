// Data contoh bersama untuk tes view dan controller: slice master dan state aplikasi kecil.
// Setiap pemanggilan membuat objek baru, jadi tes boleh mengubahnya.

export function sampleMaster(overrides = {}) {
  return {
    packages: [
      { id: 1, name: "Basic", price: 50000, photo_count: 3, dur: 15, strip_size: "2x6", strip_material: "Glossy" },
      { id: 2, name: "Standard", price: 90000, photo_count: 6, dur: 25, strip_size: "4x6", strip_material: "" },
    ],
    allPackages: [
      { id: 1, name: "Basic", price: 50000, photo_count: 3, dur: 15, strip_size: "2x6", strip_material: "Glossy" },
      { id: 2, name: "Standard", price: 90000, photo_count: 6, dur: 25, strip_size: "4x6", strip_material: "" },
      { id: 3, name: "Lama", price: 10000, photo_count: 1, dur: 5, strip_size: "", strip_material: "" },
    ],
    favouritePackageId: 2,
    discount: { pct: 0, label: "" },
    peopleRanges: [{ id: 1, range: "1-2" }, { id: 2, range: "3-5" }],
    budgetRanges: [],
    studios: [
      { id: 1, name: "Melati", description: "Studio terang", img: "/uploads/melati.jpg", address: "Jl. Veteran 3", price: 0, people_range_id: 2 },
      { id: 2, name: "Mawar", description: "Studio gelap", img: "", address: "", price: 0, people_range_id: 1 },
    ],
    allStudios: [
      { id: 1, name: "Melati", description: "Studio terang", img: "/uploads/melati.jpg", address: "Jl. Veteran 3", price: 0, people_range_id: 2 },
      { id: 2, name: "Mawar", description: "Studio gelap", img: "", address: "", price: 0, people_range_id: 1 },
      { id: 9, name: "Anggrek", description: "Disembunyikan admin", img: "", address: "", price: 0, people_range_id: 1 },
    ],
    properties: [
      { id: 1, name: "Latar Merah", category: "Background", qty: 2, img: "", bg: "#c33,#a22" },
      { id: 2, name: "Topi", category: "Aksesori", qty: 0, img: "/img/prop-topi-klasik.jpg" },
      { id: 3, name: "Bingkai", category: "", qty: 1, img: "", e: "🖼️" },
    ],
    poses: {},
    policy: { refund_hours: 2 },
    json: "",
    ...overrides,
  };
}

// state seperti store.get(): slice persisted, master, booking, runtime
export function sampleState({ persisted = {}, master = {}, runtime = {}, booking = {} } = {}) {
  return {
    persisted: { user: null, me: null, admin: false, pkg: null, bm: [], staff: false, ...persisted },
    master: sampleMaster(master),
    booking: { studio: null, date: null, slot: null, quote: null, rescheduleId: null, ...booking },
    runtime: { route: { name: "home", path: "/browse", params: {}, query: {} }, toast: { message: "", error: "" }, availability: {}, calendar: {}, ...runtime },
    data: { bookings: [], sessions: [] },
  };
}
