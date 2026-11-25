// Galeri foto: pilih untuk dicetak, favorit, hapus, hapus massal, konfirmasi pilihan, unduh (dulu panggilan API di selPh, fav, delPhoto, bulkDel, confirmSel, dl
// di legacy/session.js). Murni; api diberikan pemanggil.

export function setSelected(api, photoId, selected) {
  return api.patch("/photos/" + photoId, { sel: selected });
}

export function setFavourite(api, photoId, favourite) {
  return api.patch("/photos/" + photoId, { fav: favourite });
}

export function remove(api, photoId) {
  return api.del("/photos/" + photoId);
}

// jawaban = { deleted, skipped_favorites } (foto favorit tidak ikut terhapus)
export function removeMany(api, photoIds) {
  return api.post("/photos/bulk-delete", { ids: photoIds });
}

export function confirmSelection(api, sessionId) {
  return api.post(`/sessions/${sessionId}/confirm`);
}

// kelompok "foto mirip": foto yang diambil kurang dari 20 detik setelah foto sebelumnya masuk kelompok yang sama
export function groupSimilar(photos) {
  const groups = [];
  for (const photo of photos) {
    const last = groups[groups.length - 1];
    if (last && photo.t - last[last.length - 1].t < 20000) {
      last.push(photo);
    } else {
      groups.push([photo]);
    }
  }
  return groups;
}

// nama berkas unduhan: kata pertama merek aplikasi + id foto, mis. "selfiebox-12.jpg" (dulu "snapia-12.jpg", nama lama aplikasi)
export function downloadName(brand, photoId) {
  return brand.split(" ")[0].toLowerCase() + "-" + photoId + ".jpg";
}

// URL unduhan satu foto (api.imageUrl menambahkan token)
export function downloadUrl(api, photoId) {
  return api.imageUrl(photoId) + "&dl=1";
}
