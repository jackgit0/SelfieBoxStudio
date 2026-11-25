// Pose panduan sesi foto di panel admin (dulu poseSave, poseDel di admin.js): nama/deskripsi dan rentang jumlah orang.

export function loadPoses(api) {
  return api.get("/admin/poses");
}

export function poseBody(values) {
  return { nama: values.nama, people_range_id: Number(values.people_range_id) };
}

export function savePose(api, id, body) {
  return id ? api.patch("/admin/poses/" + id, body) : api.post("/admin/poses", body);
}

export function deletePose(api, id) {
  return api.del("/admin/poses/" + id);
}
