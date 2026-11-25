// Paket & Diskon: paket foto (termasuk yang nonaktif) dan diskon utama (persen untuk harga semua paket).

export function loadPackages(api) {
  return api.get("/admin/packages");
}

export function loadDiscount(api) {
  return api.get("/admin/discount");
}

// isian baris paket (teks) → body server
export function packageBody(values) {
  return {
    name: values.name,
    price: +values.price,
    photo_count: +values.photo_count,
    dur: +values.dur,
    strip_size: values.strip_size,
    strip_material: values.strip_material,
  };
}

export function discountBody(values) {
  return { pct: +values.pct, label: values.label };
}

export function savePackage(api, id, body) {
  return api.patch("/admin/packages/" + id, body);
}

export function addPackage(api, body) {
  return api.post("/admin/packages", body);
}

export function activatePackage(api, id) {
  return api.patch("/admin/packages/" + id, { active: true });
}

// paket yang pernah dibeli hanya dinonaktifkan: jawaban { deactivated: true }
export function deletePackage(api, id) {
  return api.del("/admin/packages/" + id);
}

export function saveDiscount(api, body) {
  return api.put("/admin/discount", body);
}
