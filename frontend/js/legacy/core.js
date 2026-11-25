// ===== INTI (sisa): utilitas, ikon, navigasi go()/goPath(), kait render, modal dan toast untuk kode lama landing.js, session.js, admin.js =====
import { BK, CONTROLLERS, D, M, R, RENDERER, ROUTER, S, V, save, saveBooking } from "./state.js";
import { raw } from "../core/html.js";
import { icon, iconFilled } from "../components/icon.js";
import { openModal } from "../components/modal.js";
import { renderToasts } from "../components/toast.js";
import * as masterModel from "../models/master.js";
import { legacyPath } from "../core/router.js";
import { P, stopSessionTimers } from "./session.js";
import { AD } from "./admin.js";
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
  if (!content) content = raw(V[R.route.name] ? V[R.route.name]() : "");
  const header = layout === "admin" ? adminHeader({ route: m.route, title: adminTitle(m.route, AD), mustChange: Boolean(AD.me && AD.me.must_change), query: AD.q }) : "";
  return composeOutlet({ layout, content, toast: R.toast, header });
}
// jam kosong Browse/Pilih Waktu dan muat ulang data master: kait route.after (main.js, StudioController)
function renderAfter() {
  const view = R.route.name;
  if (V[view + "_after"]) V[view + "_after"]();
}

// ---------- autentikasi ----------
// views/auth/*, controllers/AuthController.js (Masuk, Daftar, Lupa/Buat Sandi, keluar, Mode Staf, pemulihan login saat dibuka)
// muat ulang booking dan sesi foto milik user (BookingController.refreshData) dan keluar (AuthController.logout): dipakai session.js (fase 7) dan admin.js (fase 8a)
const refresh = () => CONTROLLERS.booking.refreshData();
const logout = () => CONTROLLERS.auth.logout();
export { $, capLabel, eff, go, goPath, ic, icf, logout, me, modal, pkOf, priceRange, refresh, render, renderAfter, renderBefore, renderContent, renderShell, studioOf, toasts };
