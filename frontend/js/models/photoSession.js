// Sesi foto milik pelanggan (dulu refresh() dan fixS di core.js). Murni; api diberikan pemanggil.
// Kamera, timer dan Drive di PhotoSessionController; galeri di models/gallery.js.

// foto yang belum punya URL gambar memakai /api/photos/:id/img (api.imageUrl menambahkan token)
export async function listMine(api) {
  const sessions = await api.get("/sessions");
  return sessions.map(session => ({ ...session, photos: session.photos.map(photo => ({ ...photo, img: photo.img || api.imageUrl(photo.id) })) }));
}

// Check-in & Mulai Sesi dari Detail Booking: jawaban = sesi baru { id, … }
export function start(api, bookingId) {
  return api.post(`/bookings/${bookingId}/start`);
}

// sisa waktu dan status terbaru dari server: { left, paused, status }
export function sync(api, sessionId) {
  return api.get("/sessions/" + sessionId);
}

// unggah satu foto (data URL JPEG): jawaban = { id, t }
export function shoot(api, sessionId, image) {
  return api.post(`/sessions/${sessionId}/photos`, { img: image });
}

// tempat foto tersimpan: "drive", "gagal" atau "lokal"
export function markDrive(api, photoId, drive) {
  return api.patch("/photos/" + photoId, { drive });
}

// Kendali Staf: action = "pause" | "resume" | "stop"; jawaban = { left, paused, status }
export function staffAction(api, sessionId, action) {
  return api.post(`/sessions/${sessionId}/control`, { action });
}

// sesi foto yang masih berjalan milik user (yang terakhir)
export function activeSession(sessions, userId) {
  return sessions.filter(session => session.user_id == userId && session.status == "Aktif").pop();
}

// sesi yang tampil di layar Sesi Foto: sesi dengan id itu (dari URL atau yang sedang dibuka), selain itu sesi aktif user
export function shownSession(sessions, userId, currentId) {
  return sessions.find(session => session.id == currentId) || activeSession(sessions, userId);
}

// paling banyak foto yang boleh diambil: dua kali kuota paket
export function photoLimit(pkg) {
  return pkg.photo_count * 2;
}
