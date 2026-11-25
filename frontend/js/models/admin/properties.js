// Properti studio di panel admin (dulu CATS, propBody, propSave, propDel di admin.js). Kategori "Background" menjadi background, selain itu aksesori.

export const CATEGORIES = ["Background", "Topi", "Rompi", "Kalung", "Kacamata", "Lainnya"];

export function loadProperties(api) {
  return api.get("/admin/properties");
}

// isian baris (teks) → body server; image = gambar yang baru diunggah (opsional)
export function propertyBody(values, image) {
  const body = { name: values.name, category: values.category, qty: Number(values.qty) };
  if (image) {
    body.img = image;
  }
  return body;
}

// id = properti yang diubah; tanpa id = properti baru
export function saveProperty(api, id, body) {
  return id ? api.patch("/admin/properties/" + id, body) : api.post("/admin/properties", body);
}

export function deleteProperty(api, id) {
  return api.del("/admin/properties/" + id);
}
