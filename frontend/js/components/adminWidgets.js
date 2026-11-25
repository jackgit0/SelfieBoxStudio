// Potongan tampilan panel admin: kartu Memuat… dan kartu statistik pendapatan (dulu loading dan stat() di admin.js).
import { html } from "../core/html.js";
import { formatRupiah } from "../core/format.js";

export function loadingCard() {
  return html`<div class="card m">Memuat…</div>`;
}

// revenue = { total, n }; extra = teks tambahan setelah jumlah transaksi
export function statCard(title, revenue, extra = "") {
  return html`<div class="stat"><small class="m">${title}</small><b>${formatRupiah(revenue.total)}</b><small class="m">${revenue.n} transaksi${extra}</small></div>`;
}

// <select> panel admin (dulu sel() di admin.js): options = [[nilai, label]]; current dibandingkan longgar (angka dari server, teks dari form)
export function selectField({ id, name, options, current, attributes = "" }) {
  return html`<select id="${id}" name="${name}" ${attributes}>${options.map(([value, label]) => html`<option value="${value}" ${value == current ? "selected" : ""}>${label}</option>`)}</select>`;
}
