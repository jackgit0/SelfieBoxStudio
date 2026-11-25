// ===== SISI CUSTOMER: Beranda (Browse), Studio, Booking, Booking Saya, Pembatalan/Refund, Akun =====
import { API, BK, CONTROLLERS, D, M, R, S, V, save } from "./state.js";
import { BRAND } from "../config.js";
import { esc } from "../core/html.js";
import { SESSION_HOURS as HRS, formatDayMonthYear as fmtDMY, formatDate as fmtDate, formatTime as fmtTime, isoDate as iso, padTwo as pad, parseSlot, formatRupiah as rp, slotLabel, slotRange, todayIso as todayS } from "../core/format.js";
import { isStudioShown } from "../models/master.js";
import { modalIcon } from "../components/modal.js";
import { calendar } from "../components/calendar.js";
import { $, csContact, eff, go, ic, me, modal, pkOf, refresh, render, studioOf } from "./core.js";
import { freeHours } from "../models/studio.js";
import { priceTag } from "../components/packageCards.js";
import { studioUnavailable } from "../views/customer/studio.js";
import { openAuth } from "./landing.js";
const free = (sid, d) => freeHours(R.availability, sid, d, new Date()); // models/studio.js
const ptag = p => priceTag(M, p).markup; // components/packageCards.js

// ---------- kalender langkah Pilih Waktu (Filter Jadwal di Browse: StudioController) ----------
// components/calendar.js; bulan yang ditampilkan di R.calendar.book = { y, m } (fase 5b: BookingController)
function calHTML(ctx, sel) {
  const t = new Date(), c = R.calendar[ctx] || (R.calendar[ctx] = { y: t.getFullYear(), m: t.getMonth() });
  return calendar({ context: ctx, selected: sel, month: { year: c.y, month: c.m }, today: todayS() }).markup;
}
function calNav(ctx, dir) { const t = new Date(), c = R.calendar[ctx] || (R.calendar[ctx] = { y: t.getFullYear(), m: t.getMonth() }); let m = c.m + dir, y = c.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } if (y * 12 + m < t.getFullYear() * 12 + t.getMonth()) return; c.y = y; c.m = m; render(); }
function calPick(ctx, ds) { BK.date = ds; BK.slot = null; render(); }

// ---------- chip jam di kartu studio dan Book Now (data-action booking:quickBook / booking:start lewat legacy-actions.js; fase 5b: BookingController) ----------
// paket pilihan (dari Pilihan Paket atau pilihan sebelumnya) dipakai bila masih aktif; bila sudah dinonaktifkan/dihapus admin: popup Paket Foto Tidak Ditemukan
function ensurePkg(next) { if (S.pkg && !M.packages.find(p => p.id == S.pkg)) { pkgMissing(next); return false; } if (!S.pkg) S.pkg = M.packages[0].id; return true; }
function quickBook(sid, date, h) { if (!ensurePkg(() => quickBook(sid, date, h))) return; BK.rescheduleId = null; S.draft = null; Object.assign(BK, { studio: sid, date, slot: `${date} ${h}:00` }); go("time"); }
function startBook(sid) { if (!ensurePkg(() => startBook(sid))) return; BK.rescheduleId = null; S.draft = null; Object.assign(BK, { studio: sid, date: S.hDate || todayS(), slot: null }); go("time"); }


// ---------- Pilihan Paket (Figma 660:5062) ----------
const pkgDesc = p => `${p.photo_count} foto · ${p.dur} menit${p.strip_size ? " · cetak " + esc(p.strip_size) : ""}`;
const pkgFeat = p => [`<b>${p.photo_count} foto</b> cetak strip ${esc(p.strip_size || "")}`, `Kertas foto <b>${esc(p.strip_material || "standar")}</b>`, `Durasi sesi <b>${p.dur} menit</b>`, "Galeri online 30 hari", "Akses semua properti studio"];
V.packages = () => `<div class="pkpage"><div class="row" style="margin-bottom:16px"><button class="ib" aria-label="Kembali ke Browse" onclick="go('home')">${ic("left", 18)}</button><h1 class="h1">Pilihan Paket</h1></div>
<div class="pkwrap"><div class="ctr"><h2 class="h2">Temukan Paket Sesuai Kebutuhanmu</h2><p class="m" style="margin-top:8px">Nikmati pengalaman foto studio mandiri dengan hasil cetak berkualitas premium dan fasilitas lengkap.</p></div>
<div class="pkl">${M.packages.map(p => { const fav = p.id == M.favouritePackageId; return `<article class="pkc ${fav ? "fav" : ""}">${fav ? '<span class="badge">Paling Favorit</span>' : ""}<div class="row sp" style="flex-wrap:nowrap"><h3>Paket ${esc(p.name)}</h3>${p.id == S.pkg ? '<span class="tag">Dipilih</span>' : ""}</div><p class="pd">${pkgDesc(p)}</p>
<div class="pp">${M.discount.pct ? `<s>${rp(p.price)}</s> ` : ""}${rp(eff(p))} <small>/ sesi</small></div><ul>${pkgFeat(p).map(f => `<li>${ic("check", 16)}<span>${f}</span></li>`).join("")}</ul>
<button class="btn block ${fav ? "" : "ghost"}" onclick="choosePkg(${p.id})">Pilih Paket Ini</button></article>`; }).join("")}</div></div></div>`;
function choosePkg(id) { const p = M.packages.find(x => x.id == id); if (!p) return pkgMissing(); S.pkg = p.id; go("home"); R.toast.message = `Paket ${p.name} dipilih. Pilih studio untuk melanjutkan.`; render(); }

// ---------- popup Paket Foto Tidak Ditemukan (Figma 660:5538) ----------
// next: lanjutkan alur semula setelah customer memilih paket lain langsung dari daftar di popup
// booking = muncul di langkah Create Booking: judul dan kalimat dari Figma "Create Booking - Paket Tidak Ditemukan" (585:4251)
async function pkgMissing(next, booking = false) {
  S.pkg = null; save(); render();
  const v = await modal({ title: booking ? "Paket Tidak Ditemukan" : "Paket Foto Tidak Ditemukan", cls: "wide center", kicker: `<span class="tag no mkick">STATUS PAKET: TIDAK TERSEDIA</span>`,
    body: `<p>${booking ? "Paket tidak ditemukan. Silakan pilih paket lain." : "Maaf, paket foto yang Anda pilih saat ini sudah tidak tersedia atau telah habis kuotanya untuk sesi ini. Rincian paket tidak dapat ditampilkan."}</p><div class="mnote">Jangan khawatir, masih ada berbagai paket foto menarik lainnya yang siap kamu pesan! Silakan cek opsi paket studio di bawah ini.</div>
<div class="mpk">${M.packages.map(p => `<button class="mpkr" data-v="${p.id}"><span><b>Paket ${esc(p.name)}</b><small>${pkgDesc(p)}</small></span><b>${rp(eff(p))}</b></button>`).join("")}</div>`,
    buttons: [{ label: "Lihat & Pilih Paket Lain", value: "list", icon: "box" }, { label: "Hubungi Customer Service", value: "cs", style: "soft", icon: "mail" }] });
  if (v === "list") go("packages"); else if (v === "cs") csContact();
  else if (v && M.packages.find(p => p.id == v)) { S.pkg = +v; save(); if (next) next(); else render(); }
}
// error API "Paket tidak valid": muat ulang data master; bila paket memang sudah tidak aktif, tampilkan popup (true), selain itu biarkan pemanggil menampilkan pesan error
async function onPkgErr(e, next) { if (e.status != 400 || !/^Paket(\/studio)? tidak valid/.test(e.message)) return false; await CONTROLLERS.studio.refreshMaster(); if (M.packages.find(p => p.id == S.pkg)) return false; pkgMissing(next, true); return true; }

// ---------- studio tidak tersedia (Detail Studio sendiri: views/customer/studio.js) ----------
// studio yang tidak tersedia/dihapus tidak bisa dibuka untuk dipesan (riwayat booking tetap memakai studioOf)
const shown = id => isStudioShown(M, id), noStudio = (edit = false) => studioUnavailable({ rescheduleId: edit ? BK.rescheduleId : null }).markup;

// ---------- booking: langkah 1 (tanggal & waktu) ----------
V.time = () => {
  if (!BK.studio) return `<div class="card">Pilih studio terlebih dahulu.</div>`; if (!shown(BK.studio)) return noStudio(true);
  const s = studioOf(BK.studio), d = BK.date || (BK.date = todayS()), fr = free(s.id, d);
  return `<div class="panel"><button class="back" onclick="BK.rescheduleId?go('bdetail',{id:BK.rescheduleId}):go('studio',{id:${s.id}})">${ic("left", 16)} ${BK.rescheduleId ? "Batal ubah jadwal" : "Kembali"}</button>
<div class="row sp"><div><h1 class="h1">${BK.rescheduleId ? "Ubah Jadwal" : "Pilih Tanggal & Waktu"}</h1><p class="sub">${esc(s.name)} · ${esc(s.address || "")}</p></div>${BK.rescheduleId ? "" : '<span class="steps">1/2</span>'}</div>
<div class="card" style="margin-top:16px"><div class="bk"><div><h3 class="h3" style="margin-bottom:10px">Pilih Tanggal</h3>${calHTML("book", d)}</div>
<div><h3 class="h3">Pilih Sesi</h3><p class="sub">${fmtDate(d)} · tiap sesi 50 menit</p><div class="slots">${HRS.map(h => { const dt = `${d} ${h}:00`; return `<button class="pill ${BK.slot == dt ? "on" : ""}" ${fr.includes(h) ? "" : "disabled"} onclick="BK.slot='${dt}';render()">${slotLabel(h)}</button>`; }).join("")}</div></div></div>
<button class="btn block" style="margin-top:22px" onclick="nextTime()">${BK.rescheduleId ? "Simpan Jadwal Baru" : "Lanjut ke Pembayaran"}</button></div></div>`;
};
async function loadQuote() { BK.quote = await API.post("/quote", { package_id: S.pkg, studio_id: BK.studio }); }
// sesi yang sudah lewat / terisi menurut data ketersediaan terakhir (sama dengan aturan server: sesi dimulai setelah sekarang)
const slotGone = sl => { const { date, h } = parseSlot(sl); return !free(BK.studio, date).includes(h); };
async function nextTime() {
  if (!BK.date || !BK.slot) return inputInvalid(); if (slotGone(BK.slot)) return sesiGone();
  if (BK.rescheduleId) {
    try { await API.patch("/bookings/" + BK.rescheduleId, { studio_id: BK.studio, date: BK.slot }); const id = BK.rescheduleId; clearBooking(); await refresh(); return go("rescheduled", { id }); }
    catch (e) { return bookingErr(e, nextTime); }
  }
  BK.quote = null; try { await loadQuote(); } catch (e) { return bookingErr(e, nextTime); } go("pay");
}
// draf booking tamu setelah login (popup Belum Login → Masuk/Daftar): kembali ke Paket & Pembayaran dengan studio, sesi dan paket yang sama
async function resumeDraft() {
  const d = S.draft; S.draft = null; BK.rescheduleId = null; Object.assign(BK, { studio: d.studio, date: d.date, slot: d.slot }); BK.quote = null; save();
  try { await loadQuote(); } catch (e) { go("time"); return bookingErr(e, nextTime); } go("pay");
}

// ---------- popup galat Create Booking (Figma 585:3886, 585:4061, 585:4251, 585:4358, 585:4400) ----------
// satu pemetaan: status/pesan API → popup; next = lanjutkan langkah semula setelah paket lain dipilih
async function bookingErr(e, next) {
  const m = e.message || "";
  if (e.status == 401) return needLogin();
  if (e.status == 409 && /^Jadwal (sudah|baru) tidak tersedia/.test(m)) return sesiBooked(); // "Jadwal sudah tidak tersedia" (booking) / "Jadwal baru tidak tersedia" (reschedule)
  if (await onPkgErr(e, next)) return;                                                       // "Paket tidak valid" / "Paket/studio tidak valid" dengan paket nonaktif
  if (m === "Format/jam slot tidak valid") return inputInvalid();
  if (["Jadwal sudah lewat", "Studio tidak tersedia", "Paket/studio tidak valid"].includes(m)) return sesiGone(); // paket masih aktif: studionya yang hilang
  await modal({ title: "Booking Gagal", cls: "center", kicker: mIcon("alert"), body: `<p>${esc(m)}</p>`, buttons: [{ label: "Tutup", value: null }] });
}
const mIcon = (n, cls = "no") => modalIcon(n, cls).markup; // components/modal.js
// kembali ke langkah Pilih Tanggal & Waktu dengan sesi dikosongkan dan ketersediaan dimuat ulang
function backToTime() { BK.slot = null; BK.quote = null; R.availability = {}; if (R.route.name === "time") render(); else go("time"); } // render memicu prefetch jam kosong (kait route.after)
async function inputInvalid() {
  await modal({ title: "Input Tidak Valid", cls: "center", kicker: mIcon("alert"), body: "<p>Input booking tidak lengkap atau tidak valid. Pilih tanggal dan sesi terlebih dahulu.</p>", buttons: [{ label: "Pilih Tanggal & Sesi", value: 1, icon: "calendar" }] });
  if (R.route.name !== "time") backToTime();
}
async function sesiGone() {
  const lbl = BK.slot ? slotLabel(parseSlot(BK.slot).h) : ""; await CONTROLLERS.studio.refreshMaster(); const st = shown(BK.studio);
  await modal({ title: "Sesi Tidak Tersedia", cls: "center", kicker: mIcon("clock"), body: st ? `<p>Sesi ${lbl} tidak lagi tersedia. Silakan pilih sesi lain.</p>` : "<p>Studio ini sedang tidak tersedia. Silakan pilih studio lain.</p>",
    buttons: [st ? { label: "Pilih Sesi Lain", value: 1, icon: "calendar" } : { label: "Cari Studio Lain", value: 1, icon: "search" }] });
  if (st) backToTime(); else { BK.slot = null; BK.quote = null; go(BK.rescheduleId ? "bdetail" : "home", BK.rescheduleId ? { id: BK.rescheduleId } : {}); if (BK.rescheduleId) BK.rescheduleId = null; }
}
async function sesiBooked() {
  await modal({ title: "Maaf, Sesi Sudah Dibooking", cls: "center", kicker: mIcon("calendar"), body: "<p>Sesi ini sudah memiliki booking aktif. Silakan pilih sesi lain.</p>", buttons: [{ label: "Pilih Sesi Lain", value: 1, icon: "calendar" }] });
  backToTime();
}
// Belum Login: draf (studio, tanggal, sesi) disimpan agar setelah Masuk/Daftar alur kembali ke Paket & Pembayaran
async function needLogin() {
  S.draft = { studio: BK.studio, date: BK.date, slot: BK.slot }; save();
  const v = await modal({ title: "Masuk untuk melanjutkan booking", cls: "center", kicker: mIcon("info", "blue"), body: "<p>Kamu belum login. Silakan masuk terlebih dahulu untuk membooking sesi.</p>",
    buttons: [{ label: "Masuk", value: "login", icon: "user" }, { label: "Daftar", value: "register", style: "ghost" }] });
  if (!v) return;
  if (S.me) { API.token = ""; S.user = S.me = null; D.bookings = []; D.sessions = []; } // token kedaluwarsa (401 saat booking)
  openAuth(v);
}

// ---------- booking: langkah 2 (paket & pembayaran) ----------
function qr() {
  let h = 7, r = ""; for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { h = (h * 31 + x * 17 + y * 13 + (BK.studio || 1)) % 97; const fx = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (fx ? (x % 6 == 0 || y % 6 == 0 || x == 14 || x == 20 || y == 14 || y == 20 || (x % 6 > 1 && x % 6 < 5 && y % 6 > 1 && y % 6 < 5)) : h % 2) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }
  return `<svg viewBox="0 0 21 21" width="160" fill="#1c2748" style="background:#fff;padding:8px;border-radius:12px;border:1px solid var(--line-2)">${r}</svg>`;
}
async function selectPkg(id) { S.pkg = id; save(); R.toast.message = R.toast.error = ""; try { await loadQuote(); } catch (e) { return bookingErr(e, () => selectPkg(S.pkg)); } render(); }
V.pay = () => {
  if (BK.slot && !BK.quote && shown(BK.studio)) return `<div class="card">Memuat rincian pembayaran…</div>`; // dimuat ulang di tab yang sama: quote diambil lagi (V.pay_after)
  if (!BK.slot || !BK.quote) return `<div class="card">Pilih jadwal terlebih dahulu.</div>`; if (!shown(BK.studio)) return noStudio();
  if (!M.packages.find(x => x.id == S.pkg)) return `<div class="panel"><button class="back" onclick="go('time')">${ic("left", 16)} Kembali</button><div class="card"><h2 class="h2">Pilih Paket</h2><p class="sub">Paket sebelumnya tidak tersedia. Pilih paket lain untuk melanjutkan.</p><div class="pkpick" style="margin-top:12px">${M.packages.map(x => `<button class="pill" onclick="selectPkg(${x.id})">${esc(x.name)}</button>`).join("")}</div></div></div>`;
  const s = studioOf(BK.studio), p = pkOf(S.pkg), col = f => M.packages.map(x => `<td class="${x.id == S.pkg ? "sel" : ""}">${f(x)}</td>`).join(""), method = S.method || "QRIS";
  return `<div class="panel"><button class="back" onclick="go('time')">${ic("left", 16)} Kembali</button><div class="row sp"><h1 class="h1">Paket & Pembayaran</h1><span class="steps">2/2</span></div>
<div class="card" style="margin-top:16px"><div class="bk"><div><h2 class="h2">Paket</h2><div style="overflow-x:auto;margin-top:8px"><table class="cmp"><tr><th>Fitur</th>${M.packages.map(x => `<th>${esc(x.name)}</th>`).join("")}</tr>
<tr><td>Strip</td>${col(x => x.photo_count + " foto")}</tr><tr><td>Ukuran</td>${col(x => esc(x.strip_size || "-"))}</tr><tr><td>Bahan</td>${col(x => esc(x.strip_material || "-"))}</tr><tr><td>Durasi</td>${col(x => x.dur + " mnt")}</tr><tr><td>Cloud</td>${col(() => "30 hari")}</tr><tr><td>Harga</td>${col(x => ptag(x))}</tr></table></div>
<p class="sm m" style="margin-top:14px">${ic("calendar", 14)} ${esc(s.name)} · ${fmtDate(parseSlot(BK.slot).date)} · ${slotRange(BK.slot)}</p></div>
<div><h3 class="h3">Pilih Paket</h3><div class="pkpick">${M.packages.map(x => `<button class="pill ${x.id == S.pkg ? "on" : ""}" onclick="selectPkg(${x.id})">${esc(x.name)}</button>`).join("")}</div>
<h3 class="h3">Rincian Pembayaran</h3><div style="margin-top:6px"><div class="kv"><span>Studio</span><b>${rp(BK.quote.studio_fee)}</b></div><div class="kv"><span>Paket ${esc(p.name)}</span><b>${rp(p.price)}</b></div>
${BK.quote.mainDisc ? `<div class="kv disc"><span>Diskon utama (${BK.quote.pct}%)</span><b>-${rp(BK.quote.mainDisc)}</b></div>` : ""}<div class="kv total"><span>Total</span><b>${rp(BK.quote.total)}</b></div></div>
<label>Metode pembayaran</label><select onchange="S.method=this.value;render()"><option ${method == "QRIS" ? "selected" : ""}>QRIS</option><option ${method == "Transfer Bank" ? "selected" : ""}>Transfer Bank</option></select>
<div class="qr">${method == "QRIS" ? qr() : `<div class="sm m center" style="padding:14px">Transfer ke <b>BCA 123 456 7890</b><br>a.n. ${esc(BRAND)} (simulasi)</div>`}</div>
<button class="btn block" onclick="confirmPay()">Check Out</button></div></div></div></div>`;
};
// booking berjalan bertahan saat dimuat ulang di tab yang sama (sessionStorage, decisions.md 26); quote tidak disimpan, jadi diambil lagi di sini
let quoteLoading = false;
V.pay_after = async () => {
  if (!BK.slot || BK.quote || quoteLoading || !shown(BK.studio)) return;
  quoteLoading = true;
  try { await loadQuote(); } catch (e) { quoteLoading = false; go("time"); return bookingErr(e, nextTime); }
  quoteLoading = false; render();
};
// setelah Check Out / reschedule berhasil: booking berjalan dikosongkan (juga dari sessionStorage)
function clearBooking() { Object.assign(BK, { studio: null, date: null, slot: null, quote: null, rescheduleId: null }); save(); }
async function confirmPay() {
  if (!S.me) return needLogin(); // tamu: login dulu sebelum booking dibuat (keputusan 35)
  try { const b = await API.post("/bookings", { package_id: S.pkg, studio_id: BK.studio, date: BK.slot }); await API.post(`/bookings/${b.id}/pay`, { method: S.method || "QRIS" });
    clearBooking(); await refresh(); S.payOpen = false; go("success", { id: b.id }); }
  catch (e) { R.availability = {}; bookingErr(e, () => selectPkg(S.pkg)); }
}

// ---------- halaman hasil: sukses, reschedule ----------
const PAYLBL = { paid: "Lunas", refunded: "Refunded", refund_failed: "Refund gagal", pending: "Menunggu pembayaran", batal: "Batal" };
function payRows(b) {
  const fee = b.studio_fee || 0, r = [["Studio", rp(fee)], ["Paket " + pkOf(b.package_id).name, rp(b.subtotal - fee)]];
  if (b.main_disc) r.push(["Diskon utama", "-" + rp(b.main_disc), "disc"]); r.push(["Total", rp(b.amount), "total"]); return r;
}
const kvs = rows => rows.map(r => `<div class="kv ${r[2] || ""}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");
const bookRows = b => { const s = studioOf(b.studio), pt = parseSlot(b.date); return kvs([["Studio", esc(s.name)], ["Paket", esc(pkOf(b.package_id).name)], ["Tanggal", fmtDMY(pt.date)], ["Jam", slotRange(b.date)], ["Lokasi", esc(s.address || "-")]]); };
const payDetail = b => kvs([["Waktu", fmtTime(b.paid_at)], ["Status", PAYLBL[b.pay_status] || b.pay_status], ["Metode", esc(b.method || "-")], ...payRows(b)]);
const bookOf = () => D.bookings.find(x => x.id == R.route.params.id);
V.success = () => {
  const b = bookOf(); if (!b) return `<div class="card">Memuat…</div>`;
  return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Studio Berhasil Direservasi</h1><img class="ill" src="/img/ill-booking.png" alt="">
<div style="text-align:left;margin-top:8px"><h3 class="h3" style="margin-bottom:6px">Detail Transaksi</h3>${bookRows(b)}<button class="coll" onclick="S.payOpen=!S.payOpen;render()">Detail Pembayaran ${ic(S.payOpen ? "up" : "down", 16)}</button>${S.payOpen ? `<div style="padding-bottom:10px">${payDetail(b)}</div>` : ""}</div>
<div class="row" style="margin-top:12px;flex-wrap:nowrap"><a class="btn ghost grow" href="${API.invoiceUrl(b.id, 1)}" download>${ic("download", 16)} Unduh invoice</a><button class="btn ghost" onclick="mailInv(${b.id})">${ic("mail", 16)}</button></div>
<button class="btn block" style="margin-top:10px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
};
V.rescheduled = () => {
  const b = bookOf(); if (!b) return `<div class="card">Memuat…</div>`;
  return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Reschedule Berhasil</h1><img class="ill" src="/img/ill-reschedule.png" alt=""><div style="text-align:left">${bookRows(b)}</div><button class="btn block" style="margin-top:18px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
};
async function mailInv(id) { R.toast.message = R.toast.error = ""; try { const r = await API.post(`/bookings/${id}/invoice/email`); R.toast.message = r.dev ? "Mode pengembangan: SMTP belum diatur, email disimpan di folder backend/outbox." : "Invoice dikirim ke email Anda."; } catch (e) { R.toast.error = e.message; } render(); }

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
function startReschedule(id) { const b = D.bookings.find(x => x.id == id); BK.rescheduleId = id; Object.assign(BK, { studio: b.studio, date: parseSlot(b.date).date, slot: null }); go("time"); }
async function payNow(id) { if (!confirm("Bayar sekarang via QRIS (simulasi)?")) return; try { await API.post(`/bookings/${id}/pay`, { method: "QRIS" }); await refresh(); S.payOpen = false; go("success", { id }); } catch (e) { R.toast.error = e.message; render(); } }
V.bdetail = () => {
  const b = bookOf(); if (!b) return `<div class="panel"><button class="back" onclick="go('my')">${ic("left", 16)} Kembali</button><div class="card">Booking tidak ditemukan.</div></div>`;
  const s = studioOf(b.studio), pt = parseSlot(b.date), pending = b.status == "Menunggu Pembayaran";
  return `<div class="panel"><button class="back" onclick="go('my')">${ic("left", 16)} Booking Saya</button>
<div class="row sp" style="align-items:flex-start"><div><h1 class="h1"><a href="#" style="color:inherit;text-decoration:none" onclick="go('studio',{id:${s.id}});return false">${esc(s.name)} ${ic("ext", 18)}</a></h1><div class="h1" style="font-size:24px">${slotRange(b.date)}</div></div><div style="text-align:right"><div class="h2">${fmtDate(pt.date)}</div>${stTag(b)}</div></div>
<div class="row" style="margin:16px 0">${canChange(b) ? `${shown(b.studio) ? `<button class="btn sm" onclick="startReschedule(${b.id})">Reschedule</button>` : ""}<button class="btn sm ghost" onclick="openCancel(${b.id})">Batalkan</button>` : ""}${pending ? `<button class="btn sm" onclick="payNow(${b.id})">Bayar</button>` : ""}${b.status == "Terbayar" ? `<button class="btn sm soft" onclick="startSession(${b.id})">${ic("camera", 16)} Check-in & Mulai Sesi</button>` : ""}${b.status == "Sesi Berjalan" ? `<button class="btn sm soft" onclick="go('session')">Buka Sesi</button>` : ""}</div>
<div class="card"><h3 class="h3" style="margin-bottom:6px">Detail Booking</h3>${bookRows(b)}<hr><h3 class="h3" style="margin-bottom:6px">Detail Pembayaran</h3>${payDetail(b)}
${b.cancel_reason ? `<hr><div class="kv"><span>Alasan pembatalan</span><b>${esc(b.cancel_reason)}</b></div>` : ""}
${b.paid && b.status != "Dibatalkan" ? `<div class="row" style="margin-top:12px"><a class="btn sm ghost" href="${API.invoiceUrl(b.id, 1)}" download>${ic("download", 16)} Unduh invoice</a><button class="btn sm ghost" onclick="mailInv(${b.id})">${ic("mail", 16)} Kirim ke email</button></div>` : ""}</div></div>`;
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
  if (!confirm("Yakin membatalkan booking ini?")) return;
  try { const r = await API.post(`/bookings/${id}/cancel`, { reason: R.cancel.reason, detail: R.cancel.detail }); S.cancelRes = r; await refresh(); go("refund", { id }); } catch (e) { R.toast.error = e.message; render(); }
}
V.refund = () => {
  const r = S.cancelRes, b = bookOf(); if (!r || !b) return `<div class="panel"><div class="card center">Booking dibatalkan.<div style="margin-top:12px"><button class="btn" onclick="go('home')">Kembali ke Beranda</button></div></div></div>`;
  const st = r.refund.state;
  if (st == "refunded") return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Refund Berhasil</h1><img class="ill" src="/img/ill-refund-ok.png" alt=""><div style="text-align:left">${kvs([["Waktu", fmtTime(r.refund.at)], ["Status", "Refunded"], ["Total", rp(r.refund.amount)]])}</div><button class="btn block" style="margin-top:18px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
  if (st == "failed") return `<div class="panel" style="max-width:640px"><div class="card center"><h1 class="h1">Maaf Refund Gagal</h1><img class="ill" src="/img/ill-refund-fail.png" alt=""><p class="m sm">Booking sudah dibatalkan, namun refund hanya tersedia untuk pembatalan minimal ${r.refund.min_hours} jam sebelum sesi.</p><button class="btn block" style="margin-top:18px" onclick="csContact()">Hubungi Customer Service</button><button class="btn ghost block" style="margin-top:10px" onclick="go('home')">Kembali ke Beranda</button></div></div>`;
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
export { PAYLBL, calNav, calPick, choosePkg, confirmPay, doCancel, kvs, mailInv, nextTime, openCancel, payNow, qr, quickBook, resumeDraft, saveProfile, selectPkg, startBook, startReschedule };
