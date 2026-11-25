// Sesi foto di tablet studio (Admin → Studio → ikon mata, /admin/studios/:id/live) dan check-in di Admin → Booking. Murni; api diberikan pemanggil.
// Tablet masuk sebagai admin; customer tidak lagi memulai sesi atau mengambil foto dari perangkatnya sendiri.

// keadaan tablet: { studio, state: "idle" | "ready" | "running", booking (sudah check-in), next (booking berikutnya hari ini), session (bila berjalan) }
export function loadLive(api, studioId) {
  return api.get(`/admin/studios/${studioId}/live`);
}

// check-in di meja depan (hari sesi, sampai slot berakhir): jawaban = detail booking admin terbaru
export function checkIn(api, bookingId) {
  return api.post(`/admin/bookings/${bookingId}/checkin`);
}

// Mulai Sesi di tablet (sudah check-in, jam slot sudah tiba): jawaban = sesi berjalan
export function startSession(api, bookingId) {
  return api.post(`/admin/bookings/${bookingId}/start`);
}

// sisa waktu dan status terbaru: { left, status, photos, … }
export function syncSession(api, sessionId) {
  return api.get(`/admin/photo-sessions/${sessionId}`);
}

// unggah satu foto (data URL JPEG): jawaban = { id, t }
export function shoot(api, sessionId, image) {
  return api.post(`/admin/photo-sessions/${sessionId}/photos`, { img: image });
}

export function deletePhoto(api, photoId) {
  return api.del(`/admin/photos/${photoId}`);
}

// Akhiri Sesi: butuh password admin (customer sendirian di ruang studio bersama tablet)
export function endSession(api, sessionId, password) {
  return api.post(`/admin/photo-sessions/${sessionId}/end`, { password });
}

// Keluar dari layar tablet ke Admin → Studio: password admin dicek di server
export function verifyPassword(api, password) {
  return api.post("/admin/verify-password", { password });
}

// paling banyak foto yang boleh diambil: dua kali kuota paket (sama dengan server)
export function photoLimit(pkg) {
  return pkg.photo_count * 2;
}

// pilihan timer foto di kartu TIMER (Figma "camera preview"): 3 atau 5 detik
export const SELF_TIMERS = [3, 5];

// background dari properti admin (kategori Background), urut seperti data master
export function backgroundsOf(master) {
  return (master.properties || []).filter(item => item.type == "background" || item.category == "Background");
}

// warna datar sebuah background untuk foto simulasi (tanpa kamera): warna pertama dari "warna1,warna2"; null bila hanya gambar
export function backgroundFill(background) {
  return background && background.bg ? background.bg.split(",")[0].trim() : null;
}
