// Sesi foto milik pelanggan (dulu refresh() dan fixS di core.js). Murni; api diberikan pemanggil.
// Kamera, timer dan galeri tetap di js/legacy/session.js sampai fase 7.

// foto yang belum punya URL gambar memakai /api/photos/:id/img (api.imageUrl menambahkan token)
export async function listMine(api) {
  const sessions = await api.get("/sessions");
  return sessions.map(session => ({ ...session, photos: session.photos.map(photo => ({ ...photo, img: photo.img || api.imageUrl(photo.id) })) }));
}
