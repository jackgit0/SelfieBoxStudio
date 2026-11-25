// ===== INTI: state, utilitas, ikon, shell (navbar), navigasi, autentikasi =====
import { API, BK, CONTROLLERS, D, M, R, RENDERER, ROUTER, S, V, save, saveBooking } from "./state.js";
import { BRAND } from "../config.js";
import { esc, raw } from "../core/html.js";
import { icon, iconFilled } from "../components/icon.js";
import { openModal } from "../components/modal.js";
import { renderToasts } from "../components/toast.js";
import * as masterModel from "../models/master.js";
import { legacyPath } from "../core/router.js";
import { P, stopSessionTimers } from "./session.js";
import { AD, adminReset } from "./admin.js";
import { composeOutlet, layoutOf, shellMarkup } from "../core/render.js";
import { adminHeader, adminTitle } from "../components/adminSidebar.js";
const $ = s => document.querySelector(s);
const me = () => S.user;

// ---------- utilitas ----------
// esc dan format (rp, pad, slotLabel, …) dari core/html.js dan core/format.js; pencarian data master dari models/master.js
const pkOf = id => masterModel.packageOf(M, id);
const eff = p => masterModel.effectivePrice(M, p);
const studioOf = id => masterModel.studioOf(M, id);
const priceRange = s => masterModel.priceRange(M, s);
const capLabel = s => masterModel.capacityLabel(M, s);

// ---------- ikon (garis, 24px) ----------
// components/icon.js; ic/icf mengembalikan string untuk template lama
const ic = (n, s = 20) => icon(n, s).markup;
const icf = (n, s = 20) => iconFilled(n, s).markup;

// ---------- navigasi ----------
// halaman = rute di core/router.js (path history); tamu boleh melihat studio, paket dan mengisi form booking, login diminta saat Check Out (keputusan 34–35).
// go(view, params) lama tetap dipakai atribut onclick (lewat jembatan window): kunci view lama → path lewat legacyPath(); fase 4–8b menggantinya dengan data-route / router.navigate
const activeSessionId = () => P.session || (D.sessions.filter(x => x.user_id == S.me && x.status == "Aktif").pop() || {}).id;
// goPath(path) = pindah halaman seperti go() lama (toast dan cache slot dibersihkan, state disimpan, gulir ke atas); dipakai juga oleh data-route (main.js)
function goPath(path) {
  R.toast.message = R.toast.error = ""; R.availability = {}; save();
  window.scrollTo({ top: 0, behavior: "instant" }); ROUTER.navigate(path);
}
function go(v, p = {}) { goPath(legacyPath(v, p, { rescheduleId: BK.rescheduleId, loginMode: R.auth.mode, sessionId: v === "session" ? activeSessionId() : null })); }
// rute aktif setelah guard → R.route (id angka seperti S.p.id lama); mode form masuk, tab Booking Saya dan tab Akun mengikuti URL
const numeric = params => Object.fromEntries(Object.entries(params).map(([k, v]) => [k, /^\d+$/.test(v) ? +v : v]));
function syncRoute(m) {
  const r = m.route;
  R.route = { name: r.name, path: m.path, params: numeric(m.params), query: m.query, title: r.title, tab: r.tab };
  if (r.name === "auth") R.auth.mode = r.params.mode;
  if (r.name === "time") CONTROLLERS.booking.syncReschedule(R.route.params.id); // /bookings/:id/reschedule dibuka langsung (BookingController)
}
// dialog bersama: components/modal.js openModal(); body dan kicker kode lama berupa HTML yang sudah di-escape pemanggil, cls = kelas tambahan .mbox
const modal = ({ body = "", kicker = "", cls = "", ...options }) => openModal({ ...options, body: raw(body), kicker: raw(kicker), className: cls });
const toasts = () => renderToasts(R.toast).markup;

// ---------- render (core/render.js; main.js membuat renderer dengan keempat kait di bawah) ----------
// render() lama = render ulang lewat renderer: shell dipasang ulang hanya bila rute atau isinya berubah, selain itu hanya outlet
const render = () => RENDERER.render();
const layoutNow = () => layoutOf(R.route.name, { admin: S.admin });
function renderBefore(m) {
  syncRoute(m); saveBooking(); const view = R.route.name;
  if (view !== "landing") window.onscroll = null;
  if (view !== "session" && typeof stopSessionTimers === "function") stopSessionTimers();
  if (layoutNow() === "admin" && view !== "astudio") AD.stdone = null; // notifikasi "Studio berhasil ditambahkan" hanya di halaman Studio
}
const renderShell = m => shellMarkup({ layout: layoutNow(), route: m.route, session: { user: S.me ? me() : null, staff: S.staff } });
// content = isi dari view baru (route.view, main.js); tanpa itu V.<view>() lama
function renderContent(m, content = null) {
  const layout = layoutNow();
  if (!content) content = raw((V[R.route.name] || V.auth)());
  const header = layout === "admin" ? adminHeader({ route: m.route, title: adminTitle(m.route, AD), mustChange: Boolean(AD.me && AD.me.must_change), query: AD.q }) : "";
  return composeOutlet({ layout, content, toast: R.toast, header });
}
// jam kosong Browse/Pilih Waktu dan muat ulang data master: kait route.after (main.js, StudioController)
function renderAfter() {
  const view = R.route.name;
  if (V[view + "_after"]) V[view + "_after"]();
}

// ---------- autentikasi ----------
V.auth = () => {
  const tabs = `<div class="seg">${[["login", "Masuk"], ["register", "Daftar"]].map(t => `<button class="${R.auth.mode == t[0] ? "on" : ""}" onclick="go('auth',{mode:'${t[0]}'})">${t[1]}</button>`).join("")}</div>`;
  const draft = S.draft && ["login", "register"].includes(R.auth.mode), back = draft && BK.slot && BK.quote; // datang dari popup Belum Login (Figma 585:4400)
  const wrap = h => `<div class="authcard"><button class="back" onclick="${back ? "go('pay')" : "go('landing')"}">${ic("left", 16)} ${back ? "Kembali ke booking" : "Beranda"}</button><div class="brand">${esc(BRAND)}</div><p class="sub center" style="margin-bottom:14px">Sesi foto self-service, tinggal pilih dan datang.</p>${toasts()}${draft ? `<h2 class="h3">Masuk untuk melanjutkan booking</h2><div class="mnote" style="margin:8px 0 14px">${ic("info", 16)} Kamu belum login. Silakan masuk terlebih dahulu untuk membooking sesi.</div>` : ""}${h}</div>`;
  const key = 'onkeydown="if(event.key===\'Enter\')';
  if (R.auth.mode == "reset") return wrap(`<h2 class="h2">Buat Sandi Baru</h2><label>Password baru</label><input id="pw" type="password" autocomplete="new-password"><label>Ulangi password</label><input id="pw2" type="password" autocomplete="new-password" ${key}doReset()"><div style="margin-top:18px"><button class="btn block" onclick="doReset()">Simpan Sandi</button></div>`);
  if (R.auth.mode == "forgot") return wrap(`<h2 class="h2">Lupa Sandi</h2><p class="m sm">Masukkan email akun Anda. Tautan untuk membuat sandi baru akan dikirim ke email tersebut.</p><label>Email</label><input id="e" type="email" ${key}forgot()"><div class="row" style="margin-top:18px"><button class="btn grow" onclick="forgot()">Kirim Tautan</button><button class="btn ghost" onclick="go('auth',{mode:'login'})">Kembali</button></div>`);
  if (R.auth.mode == "register") return wrap(tabs + `<label>Nama</label><input id="n" autocomplete="name"><label>Telepon</label><input id="p" inputmode="numeric" autocomplete="tel"><label>Email</label><input id="e" type="email" autocomplete="email"><label>Password (min. 6 karakter)</label><input id="pw" type="password" autocomplete="new-password" ${key}reg()"><div style="margin-top:18px"><button class="btn block" onclick="reg()">Daftar</button></div>`);
  return wrap(tabs + `<label>Email atau username</label><input id="e" type="text" autocomplete="username" autocapitalize="none" spellcheck="false"><label>Password</label><input id="pw" type="password" autocomplete="current-password" ${key}login()"><div class="row sp" style="margin-top:18px"><button class="btn grow" onclick="login()">Masuk</button></div><p class="center sm" style="margin-top:14px"><a href="#" onclick="go('auth',{mode:'forgot'});return false">Lupa sandi?</a></p>`);
};
// muat ulang booking dan sesi foto milik user: BookingController.refreshData (dipakai session.js sampai fase 7)
const refresh = () => CONTROLLERS.booking.refreshData();
async function afterAuth(r) { API.token = r.token; S.admin = false; S.user = r.user; S.me = r.user.id; await refresh(); if (S.draft) return CONTROLLERS.booking.resumeDraft(); go("home"); } // draf booking tamu: kembali ke Paket & Pembayaran (BookingController)
function logout() { API.token = ""; API.staffToken = ""; S.user = S.me = null; S.staff = false; S.admin = false; S.draft = null; D.bookings = []; D.sessions = []; if (typeof adminReset === "function") adminReset(); R.auth.mode = "login"; go("landing"); }
// Mode Staf: PIN lewat modal "Masuk Mode Staf" (dulu dialog bawaan browser, decisions.md 4, 27, 41); fokus awal di isian PIN, Enter = Masuk,
// setelah ditutup fokus ke tombol avatar (item menu yang membukanya sudah tersembunyi)
const STAFF_PIN_BODY = `<p>Masukkan PIN staf untuk mengaktifkan Mode Staf.</p><label for="staff-pin">PIN staf</label><input id="staff-pin" type="password" inputmode="numeric" autocomplete="off">`;
async function staffToggle() {
  if (S.staff) { S.staff = false; API.staffToken = ""; }
  else {
    const answer = await modal({ title: "Masuk Mode Staf", body: STAFF_PIN_BODY, buttons: [{ label: "Batal", value: null, style: "ghost" }, { label: "Masuk", value: "ok" }], initialFocus: "#staff-pin", returnFocus: ".avatar", enterValue: "ok", read: box => box.querySelector("#staff-pin").value.trim() });
    const pin = answer.value === "ok" ? answer.data : ""; if (!pin) return;
    try { API.staffToken = (await API.post("/staff/login", { pin })).token; S.staff = true; } catch (e) { R.toast.error = e.message; }
  }
  save(); render();
}
async function reg() {
  const n = $("#n").value.trim(), e = $("#e").value.trim(), p = $("#p").value.trim(), pw = $("#pw").value;
  if (!n || !/\S+@\S+\.\S+/.test(e) || !/^\d{8,15}$/.test(p) || pw.length < 6) { R.toast.error = "Lengkapi data: email valid, telepon 8-15 digit, password min. 6 karakter."; return render(); }
  try { await afterAuth(await API.post("/auth/register", { name: n, email: e, phone: p, password: pw })); } catch (x) { R.toast.error = x.message; render(); }
}
// satu form masuk: isian berisi "@" = email customer, selain itu = username admin (username admin tidak boleh memuat "@")
async function login() {
  const e = $("#e").value.trim(), pw = $("#pw").value; if (!e || !pw) { R.toast.error = "Isi email/username dan password."; return render(); }
  try { if (e.includes("@")) await afterAuth(await API.post("/auth/login", { email: e, password: pw })); else await adminLogin(e, pw); }
  catch (x) { R.toast.error = x.status == 401 ? "Email/username atau password salah" : x.message; render(); }
}
async function forgot() {
  const e = $("#e").value.trim(); if (!/\S+@\S+\.\S+/.test(e)) { R.toast.error = "Masukkan email yang valid."; return render(); }
  try { const r = await API.post("/auth/forgot", { email: e }); go("auth", { mode: "login" }); R.toast.message = r.message; } catch (x) { R.toast.error = x.message; } render();
}
async function doReset() {
  const a = $("#pw").value, b = $("#pw2").value; if (a.length < 6 || a != b) { R.toast.error = "Password min. 6 karakter dan kedua isian harus sama."; return render(); }
  try { await API.post("/auth/reset", { token: R.auth.resetToken, password: a }); R.auth.resetToken = ""; go("auth", { mode: "login" }); R.toast.message = "Sandi berhasil diubah. Silakan masuk dengan sandi baru."; } catch (x) { R.toast.error = x.message; } render();
}
async function adminLogin(username, password) {
  const r = await API.post("/admin/login", { username, password }); API.token = r.token; S.admin = true; S.draft = null; S.user = { name: "Admin", id: 0 }; S.me = "admin"; AD.me = r.admin; go(r.admin.must_change ? "aacct" : "adash");
}
export { $, capLabel, doReset, eff, forgot, go, goPath, ic, icf, login, logout, me, modal, pkOf, priceRange, refresh, reg, render, renderAfter, renderBefore, renderContent, renderShell, staffToggle, studioOf, toasts };
