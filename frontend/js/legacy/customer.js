// ===== SISI CUSTOMER (sisa): Pengaturan Akun =====
// Browse, Studio, langkah booking, Booking Saya, detail, pembatalan dan refund sudah MVC (js/views/customer, js/controllers)
import { API, D, R, S, V, save } from "./state.js";
import { esc, raw } from "../core/html.js";
import { formatTime as fmtTime, formatRupiah as rp } from "../core/format.js";
import { $, ic, me, pkOf, render, studioOf } from "./core.js";
import { PAYMENT_LABELS } from "../models/booking.js";
import { keyValueRows } from "../components/keyValueRows.js";
// untuk halaman akun di bawah dan admin.js (nilai dari kode lama sudah berupa HTML)
const PAYLBL = PAYMENT_LABELS;
const kvs = rows => keyValueRows(rows.map(([label, value, cls]) => [raw(String(label)), raw(String(value)), cls])).markup;

// ---------- akun: profil, riwayat pembayaran ----------
V.account = () => {
  const tab = S.acct || "profile", u = me(), tabs = [["profile", "Edit Profil"], ["pay", "Riwayat Pembayaran"]];
  let body = "";
  if (tab == "profile") body = `<div class="card"><h3 class="h3">Edit Profil</h3><label>Nama</label><input id="pn" value="${esc(u.name)}"><label>Telepon</label><input id="pp" value="${esc(u.phone || "")}" inputmode="numeric"><label>Email</label><input value="${esc(u.email)}" disabled>
<div class="row" style="margin-top:18px"><button class="btn" onclick="saveProfile()">Simpan</button><button class="btn ghost" onclick="changePw()">${ic("mail", 16)} Ubah sandi via email</button></div></div>`;
  if (tab == "pay") { const L = D.bookings.filter(b => b.pay_status && !["pending", "batal"].includes(b.pay_status)).sort((a, b) => (b.paid_at || 0) - (a.paid_at || 0));
    body = `<div class="card"><h3 class="h3">Riwayat Pembayaran</h3>${L.length ? `<div class="tbl"><table><tr><th>Waktu</th><th>Studio</th><th>Paket</th><th>Total</th><th>Status</th><th></th></tr>${L.map(b => `<tr><td>${fmtTime(b.paid_at)}</td><td>${esc(studioOf(b.studio).name)}</td><td>${esc(pkOf(b.package_id).name)}</td><td>${rp(b.amount)}</td><td><span class="tag ${b.pay_status == "paid" ? "ok" : b.pay_status == "refunded" ? "" : "no"}">${PAYLBL[b.pay_status]}</span></td>
<td>${b.paid && b.status != "Dibatalkan" ? `<a class="btn sm ghost" href="${API.invoiceUrl(b.id, 0)}" target="_blank" rel="noopener">${ic("receipt", 14)} Kwitansi Digital</a>` : ""}</td></tr>`).join("")}</table></div>` : `<p class="m" style="margin-top:8px">Belum ada transaksi.</p>`}</div>`; }
  return `<div class="panel"><h1 class="h1">Pengaturan Akun</h1><div class="seg">${tabs.map(t => `<button class="${t[0] == tab ? "on" : ""}" onclick="go('account',{tab:'${t[0]}'})">${t[1]}</button>`).join("")}</div>${body}<div style="margin-top:18px"><button class="btn ghost" onclick="logout()">${ic("logout", 16)} Keluar</button></div></div>`;
};
async function saveProfile() { R.toast.message = R.toast.error = ""; try { const r = await API.patch("/me", { name: $("#pn").value, phone: $("#pp").value }); S.user = { ...S.user, ...r }; save(); R.toast.message = "Profil disimpan."; } catch (e) { R.toast.error = e.message; } render(); }
export { PAYLBL, kvs, saveProfile };
