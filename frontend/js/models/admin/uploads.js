// Unggah gambar admin (studio, properti): data URL JPEG/PNG/WebP yang sudah diperkecil di browser → disimpan server di /media.
// Pengecilan gambar (canvas) tetap di kode lama admin.js sampai fase 8b memindahkan form studio dan properti.

export async function uploadImage(api, dataUrl) {
  const answer = await api.post("/admin/media", { data: dataUrl });
  return answer.url;
}
