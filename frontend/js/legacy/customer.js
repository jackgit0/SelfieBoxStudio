// ===== SISI CUSTOMER: Beranda (Browse), Studio, Booking, Booking Saya, Pembatalan/Refund, Akun =====
import { API, D, M, R, S, V, save } from "./state.js";
import { esc, raw } from "../core/html.js";
import { formatDate as fmtDate, formatTime as fmtTime, parseSlot, formatRupiah as rp, slotRange } from "../core/format.js";
import { isStudioShown } from "../models/master.js";
import { $, go, ic, me, modal, pkOf, refresh, render, studioOf } from "./core.js";
import { PAYMENT_LABELS, bookingById } from "../models/booking.js";
import { bookingRows, keyValueRows, paymentDetail } from "../components/keyValueRows.js";
// studio yang tidak tersedia/dihapus tidak bisa dipesan lagi (riwayat booking tetap memakai studioOf); tombol Reschedule disembunyikan
const shown = id => isStudioShown(M, id);

// ---------- booking: langkah Pilih Waktu, Paket & Pembayaran, halaman hasil ----------
// views/customer/time.js, pay.js, success.js, rescheduled.js; controllers/BookingController.js dan PaymentController.js
// baris rincian untuk halaman lama di bawah dan admin.js: components/keyValueRows.js (nilai dari kode lama sudah berupa HTML), models/booking.js
const PAYLBL = PAYMENT_LABELS;
const kvs = rows => keyValueRows(rows.map(([label, value, cls]) => [raw(String(label)), raw(String(value)), cls])).markup;
const bookRows = b => bookingRows(M, b).markup;
const payDetail = b => paymentDetail(M, b).markup;
const bookOf = () => bookingById(D.bookings, R.route.params.id);

// ---------- Booking Saya ----------
const UPCOMING = ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan"];
const stTag = b => `<span class="tag ${["Terbayar", "Selesai", "Sesi Berjalan"].includes(b.status) ? "ok" : b.status == "Dibatalkan" ? "no" : "warn"}">${b.status}</span>`;
V.my = () => {
  const tab = S.myTab || "up"; D.bookings.forEach(b => { if (b.status == "Menunggu Pembayaran" && Date.now() > b.expire_at) b.status = "Dibatalkan"; });
  let L = D.bookings.filter(b => b.user_id == S.me && (tab == "up" ? UPCOMING.includes(b.status) : !UPCOMING.includes(b.status))); L.sort((a, b) => tab == "up" ? (a.date < b.date ? -1 : 1) : (a.date < b.date ? 1 : -1));
  const groups = {}; L.forEach(b => (groups[parseSlot(b.date).date] = groups[parseSlot(b.date).date] || []).push(b));
  return `<div class="panel"><h1 class="h1">Booking Saya</h1><div class="seg"><button class="${tab == "up" ? "on" : ""}" onclick="go('my')">Mendatang</button><button class="${tab == "hist" ? "on" : ""}" onclick="go('my',{tab:'hist'})">Riwayat</button></div>
${Object.keys(groups).map(d => `<div class="dayh">${fmtDate(d)}</div>${groups[d].map(b => `<button class="brow" onclick="go('bdetail',{id:${b.id}})"><div><b>${esc(studioOf(b.studio).name)}</b><div class="sub">${esc(pkOf(b.package_id).name)} · ${stTag(b)}</div></div><b>${slotRange(b.date)}</b></button>`).join("")}`).join("") || `<div class="card center m" style="margin-top:12px">${tab == "up" ? "Belum ada booking mendatang." : "Belum ada riwayat booking."}<div style="margin-top:12px"><button class="btn" onclick="go('home')">Cari studio</button></div></div>`}</div>`;
};
const canChange = b => ["Menunggu Pembayaran", "Terbayar"].includes(b.status);
// konfirmasi lewat modal (dulu dialog bawaan browser, decisions.md 4, 27, 57)
const PAY_CONFIRM = { title: "Konfirmasi Pembayaran", body: "<p>Bayar sekarang via QRIS (simulasi)?</p>", buttons: [{ label: "Batal", value: false, style: "ghost" }, { label: "Bayar", value: true }] };
const CANCEL_CONFIRM = { title: "Konfirmasi Pembatalan", body: "<p>Yakin membatalkan booking ini?</p>", buttons: [{ label: "Kembali", value: false, style: "ghost" }, { label: "Ya, Batalkan", value: true }] };
async function payNow(id) { if ((await modal(PAY_CONFIRM)) !== true) return; try { await API.post(`/bookings/${id}/pay`, { method: "QRIS" }); await refresh(); S.payOpen = false; go("success", { id }); } catch (e) { R.toast.error = e.message; render(); } }
V.bdetail = () => {
  const b = bookOf(); if (!b) return `<div class="panel"><button class="back" onclick="go('my')">${ic("left", 16)} Kembali</button><div class="card">Booking tidak ditemukan.</div></div>`;
  const s = studioOf(b.studio), pt = parseSlot(b.date), pending = b.status == "Menunggu Pembayaran";
  return `<div class="panel"><button class="back" onclick="go('my')">${ic("left", 16)} Booking Saya</button>
<div class="row sp" style="align-items:flex-start"><div><h1 class="h1"><a href="#" style="color:inherit;text-decoration:none" onclick="go('studio',{id:${s.id}});return false">${esc(s.name)} ${ic("ext", 18)}</a></h1><div class="h1" style="font-size:24px">${slotRange(b.date)}</div></div><div style="text-align:right"><div class="h2">${fmtDate(pt.date)}</div>${stTag(b)}</div></div>
<div class="row" style="margin:16px 0">${canChange(b) ? `${shown(b.studio) ? `<button class="btn sm" data-action="booking:startReschedule" data-id="${b.id}">Reschedule</button>` : ""}<button class="btn sm ghost" onclick="openCancel(${b.id})">Batalkan</button>` : ""}${pending ? `<button class="btn sm" onclick="payNow(${b.id})">Bayar</button>` : ""}${b.status == "Terbayar" ? `<button class="btn sm soft" onclick="startSession(${b.id})">${ic("camera", 16)} Check-in & Mulai Sesi</button>` : ""}${b.status == "Sesi Berjalan" ? `<button class="btn sm soft" onclick="go('session')">Buka Sesi</button>` : ""}</div>
<div class="card"><h3 class="h3" style="margin-bottom:6px">Detail Booking</h3>${bookRows(b)}<hr><h3 class="h3" style="margin-bottom:6px">Detail Pembayaran</h3>${payDetail(b)}
${b.cancel_reason ? `<hr><div class="kv"><span>Alasan pembatalan</span><b>${esc(b.cancel_reason)}</b></div>` : ""}
${b.paid && b.status != "Dibatalkan" ? `<div class="row" style="margin-top:12px"><a class="btn sm ghost" href="${API.invoiceUrl(b.id, 1)}" download>${ic("download", 16)} Unduh invoice</a><button class="btn sm ghost" data-action="payment:emailInvoice" data-id="${b.id}">${ic("mail", 16)} Kirim ke email</button></div>` : ""}</div></div>`;
};

// ---------- pembatalan & refund ----------
const REASONS = ["Tidak ada waktu", "Penggunaan dana lain", "Pemesanan ganda", "Pembatalan lainnya"];
function openCancel(id) { R.cancel.reason = ""; R.cancel.detail = ""; go("cancel", { id }); }
V.cancel = () => {
  const b = bookOf(); if (!b) return `<div class="card">Booking tidak ditemukan.</div>`; const paid = b.paid;
  return `<div class="panel"><button class="back" onclick="go('bdetail',{id:${b.id}})">${ic("left", 16)} Kembali</button><h1 class="h1">Pembatalan Booking</h1><p class="sub">${esc(studioOf(b.studio).name)} · ${fmtDate(parseSlot(b.date).date)} · ${slotRange(b.date)}</p>
<div class="card" style="margin-top:16px"><h3 class="h3">Alasan Pembatalan</h3><div class="reasons">${REASONS.map(r => `<button class="reason ${R.cancel.reason == r ? "on" : ""}" onclick="R.cancel.reason='${r}';render()"><i></i>${r}</button>`).join("")}</div>
${R.cancel.reason == "Pembatalan lainnya" ? `<textarea placeholder="Tuliskan alasan pembatalan kamu" oninput="R.cancel.detail=this.value">${esc(R.cancel.detail)}</textarea>` : ""}
${paid ? `<p class="sm m" style="margin:10px 0">${ic("clock", 14)} Refund diproses otomatis jika pembatalan dilakukan minimal ${M.policy.refund_hours} jam sebelum sesi dimulai.</p>` : ""}
<button class="btn block" style="margin-top:8px" ${R.cancel.reason ? "" : "disabled"} onclick="doCancel(${b.id})">${paid ? "Refund" : "Batalkan Booking"}</button></div></div>`;
};
async function doCancel(id) {
  if ((await modal(CANCEL_CONFIRM)) !== true) return;
  try { const r = await API.post(`/bookings/${id}/cancel`, { reason: R.cancel.reason, detail: R.cancel.detail }); S.cancelRes = r; await refresh(); go("refund", { id }); } catch (e) { R.toast.error = e.message; render(); }
}
V.refund = () => {
  const r = S.cancelRes, b = bookOf(); if (!r || !b) return `<div class="panel"><div class="card center">Booking dibatalkan.<div style="margin-top:12px"><button class="btn" onclick="go('home')">Kembali ke Beranda</button></div></div></div>`;
  const st = r.refund.state;
  if (st == "refunded") return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Refund Berhasil</h1><img class="ill" src="/img/ill-refund-ok.png" alt=""><div style="text-align:left">${kvs([["Waktu", fmtTime(r.refund.at)], ["Status", "Refunded"], ["Total", rp(r.refund.amount)]])}</div><button class="btn block" style="margin-top:18px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
  if (st == "failed") return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Maaf Refund Gagal</h1><img class="ill" src="/img/ill-refund-fail.png" alt=""><p class="m sm">Booking sudah dibatalkan, namun refund hanya tersedia untuk pembatalan minimal ${r.refund.min_hours} jam sebelum sesi.</p><button class="btn block" style="margin-top:18px" data-action="package:contactCs">Hubungi Customer Service</button><button class="btn ghost block" style="margin-top:10px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
  return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Booking Dibatalkan</h1><p class="m" style="margin:10px 0 18px">Booking belum dibayar, jadi tidak ada refund yang diperlukan.</p><button class="btn block" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
};

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
export { PAYLBL, doCancel, kvs, openCancel, payNow, saveProfile };
