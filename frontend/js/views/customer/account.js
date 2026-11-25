// Pengaturan Akun: Edit Profil (/account) dan Riwayat Pembayaran (/account/payments). View murni (dulu V.account di customer.js).
// links = { invoiceUrl(id, download) } dari main.js. Form Edit Profil dikirim lewat data-submit (AccountController, decisions.md 54).
import { html } from "../../core/html.js";
import { formatRupiah, formatTime } from "../../core/format.js";
import { packageOf, studioOf } from "../../models/master.js";
import { PAYMENT_LABELS } from "../../models/booking.js";
import { paymentHistory } from "../../models/account.js";
import { icon } from "../../components/icon.js";

const TABS = [
  { tab: "profile", label: "Edit Profil", path: "/account" },
  { tab: "pay", label: "Riwayat Pembayaran", path: "/account/payments" },
];

const PAYMENT_TONES = { paid: "ok", refunded: "" };

function profileForm(user) {
  return html`<form class="card" novalidate data-submit="account:saveProfile">
    <h3 class="h3">Edit Profil</h3>
    <label for="pn">Nama</label><input id="pn" name="name" value="${user.name}" /><label for="pp">Telepon</label
    ><input id="pp" name="phone" value="${user.phone || ""}" inputmode="numeric" /><label>Email</label
    ><input value="${user.email}" disabled />
    <div class="row" style="margin-top:18px">
      <button class="btn" type="submit">Simpan</button
      ><button class="btn ghost" type="button" data-action="account:requestPasswordChange">
        ${icon("mail", 16)} Ubah sandi via email
      </button>
    </div>
  </form>`;
}

function paymentTable(master, bookings, links) {
  const payments = paymentHistory(bookings);
  if (!payments.length) {
    return html`<div class="card">
      <h3 class="h3">Riwayat Pembayaran</h3>
      <p class="m" style="margin-top:8px">Belum ada transaksi.</p>
    </div>`;
  }
  const rows = payments.map(
    booking =>
      html`<tr>
        <td>${formatTime(booking.paid_at)}</td>
        <td>${studioOf(master, booking.studio).name}</td>
        <td>${packageOf(master, booking.package_id).name}</td>
        <td>${formatRupiah(booking.amount)}</td>
        <td>
          <span class="tag ${PAYMENT_TONES[booking.pay_status] ?? "no"}">${PAYMENT_LABELS[booking.pay_status]}</span>
        </td>
        <td>
          ${booking.paid && booking.status !== "Dibatalkan" ? html`<a class="btn sm ghost" href="${links.invoiceUrl(booking.id, 0)}" target="_blank" rel="noopener">${icon("receipt", 14)} Kwitansi Digital</a>` : ""}
        </td>
      </tr>`,
  );
  return html`<div class="card">
    <h3 class="h3">Riwayat Pembayaran</h3>
    <div class="tbl">
      <table>
        <tr>
          <th>Waktu</th>
          <th>Studio</th>
          <th>Paket</th>
          <th>Total</th>
          <th>Status</th>
          <th></th>
        </tr>
        ${rows}
      </table>
    </div>
  </div>`;
}

// match.route.params.tab = "profile" | "pay"
export function accountView(state, match, links) {
  const tab = match.route.params.tab || "profile";
  const tabs = TABS.map(
    item => html`<button class="${item.tab === tab ? "on" : ""}" data-route="${item.path}">${item.label}</button>`,
  );
  const body =
    tab === "pay" ? paymentTable(state.master, state.data.bookings, links) : profileForm(state.persisted.user);
  return html`<div class="panel">
    <h1 class="h1">Pengaturan Akun</h1>
    <div class="seg">${tabs}</div>
    ${body}
    <div style="margin-top:18px">
      <button class="btn ghost" data-action="auth:logout">${icon("logout", 16)} Keluar</button>
    </div>
  </div>`;
}
