// Pengguna (/admin/users): daftar pelanggan dengan pencarian dan detail pelanggan (riwayat pembelian + foto).
// View murni (dulu V.acust di admin.js). links = { adminPhotoUrl(id) } dari main.js (token tetap di models/api.js, decisions.md 50).
import { html } from "../../core/html.js";
import { formatDateTimeWib, formatRupiah } from "../../core/format.js";
import { matchesQuery } from "../../models/admin/search.js";
import { loadingCard } from "../../components/adminWidgets.js";

const statusTone = status => (["Terbayar", "Selesai", "Sesi Berjalan"].includes(status) ? "ok" : status == "Dibatalkan" ? "no" : "");

function customerRows(customers, query) {
  const rows = customers.filter(user => matchesQuery(query, user.name, user.email, user.phone));
  if (!rows.length) {
    return html`<tr><td colspan="7" class="m">Tidak ada pengguna.</td></tr>`;
  }
  return rows.map(user => html`<tr><td>${user.name}</td><td>${user.email}</td><td>${user.phone}</td><td>${user.bookings}</td><td>${formatRupiah(user.spent)}</td><td>${user.photos}</td><td style="white-space:nowrap"><button class="btn sm" data-action="admin:openCustomer" data-id="${user.id}">Detail</button> <button class="btn sm ghost" data-action="admin:deleteCustomer" data-id="${user.id}" data-name="${user.name}">Hapus akun</button></td></tr>`);
}

function purchaseRows(bookings) {
  if (!bookings.length) {
    return html`<tr><td colspan="9" class="m">Belum ada pembelian.</td></tr>`;
  }
  return bookings.map(booking => html`<tr><td>${formatDateTimeWib(booking.created_at)}</td><td>${booking.package}</td><td>${booking.studio}</td><td>${booking.slot}</td><td>${formatRupiah(booking.subtotal ?? booking.amount)}</td><td>${booking.main_disc ? "-" + formatRupiah(booking.main_disc) : "-"}</td><td><b>${formatRupiah(booking.amount)}</b></td><td>${booking.method || "-"}</td><td><span class="tag ${statusTone(booking.status)}">${booking.status}</span></td></tr>`);
}

function photoGrid(photos, links) {
  if (!photos.length) {
    return html`<p class="m">Belum ada foto.</p>`;
  }
  return photos.map(photo => html`<div class="ph"><a href="${links.adminPhotoUrl(photo.id)}" target="_blank" rel="noopener"><img src="${links.adminPhotoUrl(photo.id)}" loading="lazy" alt=""></a><span class="f">${photo.fav ? "⭐" : ""}</span><small>${formatDateTimeWib(photo.taken_at)}</small></div>`);
}

function customerDetail(detail, links) {
  const customer = detail.customer;
  return html`<div class="card" style="margin-top:16px"><div class="row sp"><h3 class="h3">${customer.name} <small class="m">· ${customer.email} · ${customer.phone}</small></h3><button class="btn sm ghost" data-action="admin:closeCustomer">Tutup</button></div>
<h4 style="margin:14px 0 6px">Riwayat pembelian</h4><div class="tbl"><table><tr><th>Dipesan</th><th>Paket</th><th>Studio</th><th>Jadwal</th><th>Subtotal</th><th>Diskon</th><th>Total</th><th>Metode</th><th>Status</th></tr>
${purchaseRows(detail.bookings)}</table></div>
<h4 style="margin:16px 0 8px">Foto (${detail.photos.length})</h4><div class="gal">${photoGrid(detail.photos, links)}</div></div>`;
}

export function usersView(state, match, links) {
  const { customers, customerDetail: detail, query } = state.admin;
  if (!customers) {
    return loadingCard();
  }
  return html`<div class="card"><div class="tbl"><table><tr><th>Nama</th><th>Email</th><th>Telepon</th><th>Booking</th><th>Total belanja</th><th>Foto</th><th></th></tr>${customerRows(customers, query)}</table></div></div>${detail ? customerDetail(detail, links) : ""}`;
}
