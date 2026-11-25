// Kotak cari di header admin: satu kata kunci dicocokkan ke beberapa kolom (dulu match() di admin.js).

export function matchesQuery(query, ...fields) {
  const needle = String(query || "").trim().toLowerCase();
  return !needle || fields.some(field => String(field ?? "").toLowerCase().includes(needle));
}
