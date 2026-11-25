// Sesi foto milik pelanggan (dulu refresh() dan fixS di core.js). Murni; api diberikan pemanggil.
// Sesi dijalankan admin dari tablet studio (models/admin/liveSession.js); pelanggan hanya melihat status di Detail Booking dan foto di Galeri.

// foto yang belum punya URL gambar memakai /api/photos/:id/image (api.imageUrl menambahkan token)
export async function listMine(api) {
  const sessions = await api.get("/sessions");
  return sessions.map(session => ({
    ...session,
    photos: session.photos.map(photo => ({ ...photo, img: photo.img || api.imageUrl(photo.id) })),
  }));
}

// sesi foto milik sebuah booking (status di Detail Booking)
export function sessionOfBooking(sessions, bookingId) {
  return sessions.find(session => session.booking_id == bookingId) || null;
}
