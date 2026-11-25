// Pose panduan sesi foto di panel admin (dulu poseSave, poseDel di admin.js): foto contoh pose dan rentang jumlah orang, tanpa nama.

export function loadPoses(api) {
  return api.get("/admin/poses");
}

// isian baris → body server; image = foto yang baru diunggah (wajib saat menambah, opsional saat mengubah: server memakai foto lama)
export function poseBody(values, image) {
  const body = { people_range_id: Number(values.people_range_id) };
  if (image) {
    body.img = image;
  }
  return body;
}

export function savePose(api, id, body) {
  return id ? api.patch("/admin/poses/" + id, body) : api.post("/admin/poses", body);
}

export function deletePose(api, id) {
  return api.del("/admin/poses/" + id);
}
