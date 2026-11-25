// Transaksi (/admin/transactions): total pembayaran masuk dan refund, lalu tabel pembayaran dengan pencarian.
// View murni (dulu V.atrx di admin.js).
import { html } from "../../core/html.js";
import { formatDateTimeWib, formatRupiah } from "../../core/format.js";
import { PAYMENT_LABELS } from "../../models/booking.js";
import { matchesQuery } from "../../models/admin/search.js";
import { loadingCard } from "../../components/adminWidgets.js";

const statusTone = status => (status == "paid" ? "ok" : status == "refunded" ? "" : "no");

function paymentRows(rows, query) {
  const shown = rows.filter(row => matchesQuery(query, row.customer, row.email, row.invoice, row.status, row.method));
  if (!shown.length) {
    return html`<tr>
      <td colspan="7" class="m">Belum ada transaksi.</td>
    </tr>`;
  }
  return shown.map(
    row =>
      html`<tr>
        <td>${row.invoice}</td>
        <td>${formatDateTimeWib(row.paid_at)}</td>
        <td>${row.customer}<br /><small class="m">${row.email}</small></td>
        <td>${row.method || "-"}</td>
        <td>${formatRupiah(row.amount)}</td>
        <td><span class="tag ${statusTone(row.status)}">${PAYMENT_LABELS[row.status] || row.status}</span></td>
        <td>${row.refunded_at ? formatDateTimeWib(row.refunded_at) : "-"}</td>
      </tr>`,
  );
}

export function transactionsView(state) {
  const { transactions, query } = state.admin;
  if (!transactions) {
    return loadingCard();
  }
  return html`<div class="stats">
      <div class="stat"><small class="m">Total pembayaran masuk</small><b>${formatRupiah(transactions.paid)}</b></div>
      <div class="stat"><small class="m">Total refund</small><b>${formatRupiah(transactions.refunded)}</b></div>
    </div>
    <div class="card">
      <div class="tbl">
        <table>
          <tr>
            <th>Invoice</th>
            <th>Waktu bayar</th>
            <th>Pelanggan</th>
            <th>Metode</th>
            <th>Nominal</th>
            <th>Status</th>
            <th>Refund</th>
          </tr>
          ${paymentRows(transactions.rows, query)}
        </table>
      </div>
    </div>`;
}
