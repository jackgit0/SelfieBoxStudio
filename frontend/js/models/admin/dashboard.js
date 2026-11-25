// Dashboard admin: pendapatan (hari ini, 7 dan 30 hari, sejak awal, harian) dan Rekapitulasi Operasional per periode.

export const PERIODS = [["day", "Hari ini"], ["week", "7 hari terakhir"], ["month", "30 hari terakhir"], ["all", "Sejak pemesanan pertama"]];

export function loadRevenue(api) {
  return api.get("/admin/revenue");
}

export function loadOperations(api, period) {
  return api.get("/admin/ops?period=" + period);
}

// isian form (teks) → body server; nominal jadi angka
export function operationBody(values) {
  return { date: values.date, label: values.label, kind: values.kind, amount: +values.amount, note: values.note };
}

// id = item yang diubah; tanpa id = item baru
export function saveOperation(api, id, body) {
  return id ? api.patch("/admin/ops/" + id, body) : api.post("/admin/ops", body);
}

export function deleteOperation(api, id) {
  return api.del("/admin/ops/" + id);
}
