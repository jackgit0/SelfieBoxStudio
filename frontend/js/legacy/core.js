// ===== INTI: state, utilitas, ikon, shell (navbar), navigasi, autentikasi =====
import { API, BK, D, M, R, ROUTER, S, V, save } from "./state.js";
import { BRAND, CS_EMAIL, CS_WA } from "../config.js";
import { esc } from "../core/html.js";
import { SESSION_HOURS as HRS, formatRupiah as rp, todayIso as todayS } from "../core/format.js";
import * as masterModel from "../models/master.js";
import { legacyPath } from "../core/router.js";
import { resumeDraft } from "./customer.js";
import { P, stopSessionTimers } from "./session.js";
import { AD, adminReset, adminShell } from "./admin.js";
const $ = s => document.querySelector(s);
const me = () => S.user;

// ---------- utilitas ----------
// esc dan format (rp, pad, slotLabel, …) dari core/html.js dan core/format.js; pencarian data master dari models/master.js
const pkOf = id => masterModel.packageOf(M, id);
const eff = p => masterModel.effectivePrice(M, p);
const ptag = p => M.discount.pct ? `<s class="m">${rp(p.price)}</s> ${rp(eff(p))}` : rp(p.price);
const studioOf = id => masterModel.studioOf(M, id);
const free = (sid, d) => R.availability[sid + "|" + d] || HRS.filter(h => d > todayS() || h > new Date().getHours());
const priceRange = s => masterModel.priceRange(M, s);
const capLabel = s => masterModel.capacityLabel(M, s);

// ---------- ikon (garis, 24px) ----------
const IC = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  images: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c2.4.6 4 2.2 4 5.2"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.2"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  down: '<path d="M6 9l6 6 6-6"/>', up: '<path d="M6 15l6-6 6 6"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="4"/>', settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>', logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', studio: '<path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6"/>',
  glasses: '<circle cx="7" cy="14" r="4"/><circle cx="17" cy="14" r="4"/><path d="M11 14h2M3 14l2-8M21 14l-2-8"/>', run: '<circle cx="14" cy="4" r="2"/><path d="M7 21l3-6 3 2v4M10 15l1-5 4 2 3-1M9 10l-3 2"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', dash: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', refresh: '<path d="M20 11a8 8 0 00-14-4M4 4v4h4M4 13a8 8 0 0014 4M20 20v-4h-4"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/>'
};
const ic = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ""}</svg>`;
const icf = (n, s = 20) => ic(n, s).replace('fill="none"', 'fill="currentColor"');

// ---------- navigasi ----------
// halaman = rute di core/router.js (path history); tamu boleh melihat studio, paket dan mengisi form booking, login diminta saat Check Out (keputusan 34–35).
// go(view, params) lama tetap dipakai atribut onclick (lewat jembatan window): kunci view lama → path lewat legacyPath(); fase 4–8b menggantinya dengan data-route / router.navigate
const activeSessionId = () => P.session || (D.sessions.filter(x => x.user_id == S.me && x.status == "Aktif").pop() || {}).id;
function go(v, p = {}) {
  R.toast.message = R.toast.error = ""; R.availability = {}; save();
  const path = legacyPath(v, p, { rescheduleId: BK.rescheduleId, loginMode: R.auth.mode, sessionId: v === "session" ? activeSessionId() : null });
  window.scrollTo({ top: 0, behavior: "instant" }); ROUTER.navigate(path);
}
// rute aktif setelah guard → R.route (id angka seperti S.p.id lama); mode form masuk, tab Booking Saya dan tab Akun mengikuti URL
const numeric = params => Object.fromEntries(Object.entries(params).map(([k, v]) => [k, /^\d+$/.test(v) ? +v : v]));
function syncRoute() {
  const m = ROUTER.resolve(), r = m.route;
  R.route = { name: r.name, path: m.path, params: numeric(m.params), query: m.query, title: r.title, tab: r.tab };
  if (r.name === "auth") R.auth.mode = r.params.mode;
  if (r.name === "my") S.myTab = m.query.tab === "history" ? "hist" : "up";
  if (r.name === "account") S.acct = r.params.tab;
}
document.addEventListener("click", () => { const m = $("#menu"); if (m) m.hidden = true; });
const toggleMenu = e => { e.stopPropagation(); const m = $("#menu"); m.hidden = !m.hidden; };
const openAcct = tab => go("account", { tab });
// dialog bersama (Figma "Konfirmasi …" dan popup error): resolve dengan value tombol yang ditekan, null bila ditutup (Escape / klik di luar).
// body = HTML yang sudah di-escape pemanggil; buttons = [{ label, value, style ("ghost"/"soft"/"danger"), icon }]; kicker = HTML di atas judul; cls = kelas tambahan .mbox;
// tombol di dalam body dengan atribut data-v="…" juga menutup dialog dan resolve dengan string itu
function modal({ title, body = "", buttons = [{ label: "Tutup", value: null }], kicker = "", cls = "" }) {
  return new Promise(res => { const d = document.createElement("div"), back = document.activeElement; d.className = "mdl";
    d.innerHTML = `<div class="mbox ${cls}" role="dialog" aria-modal="true" aria-labelledby="mdl-t">${kicker}<h3 id="mdl-t">${esc(title)}</h3><div class="mtx">${body}</div><div class="row mbtn">${buttons.map((b, i) => `<button class="btn sm ${b.style || ""}" data-i="${i}">${b.icon ? ic(b.icon, 16) : ""}${esc(b.label)}</button>`).join("")}</div></div>`;
    const key = e => { if (e.key === "Escape") done(null); else if (e.key === "Tab") { e.preventDefault(); const bs = [...d.querySelectorAll("button")], i = bs.indexOf(document.activeElement); bs[(i + (e.shiftKey ? bs.length - 1 : 1)) % bs.length].focus(); } },
      done = v => { d.remove(); document.removeEventListener("keydown", key); if (back && back.focus && document.contains(back)) back.focus(); res(v); };
    d.onclick = e => { const b = e.target.closest("button[data-i], button[data-v]"); if (b) done(b.dataset.i !== undefined ? buttons[b.dataset.i].value : b.dataset.v); else if (e.target === d) done(null); };
    document.addEventListener("keydown", key); document.body.appendChild(d); d.querySelector(".mbtn button").focus(); });
}
const toasts = () => (R.toast.message ? `<div class="toast">${esc(R.toast.message)}</div>` : "") + (R.toast.error ? `<div class="toast err">${esc(R.toast.error)}</div>` : "");

const acctMenu = () => `<div class="usr">${S.staff ? '<span class="tag warn">Staf</span>' : ""}<span class="uname">${esc(me().name)}</span><button class="avatar" aria-label="Menu akun" onclick="toggleMenu(event)">${ic("user", 20)}</button>
<div id="menu" class="menu" hidden><button onclick="openAcct('profile')">${ic("user", 18)} Pengaturan Akun</button><button onclick="openAcct('pay')">${ic("receipt", 18)} Riwayat Pembayaran</button>
<button onclick="staffToggle()">${ic("settings", 18)} ${S.staff ? "Nonaktifkan Mode Staf" : "Mode Staf"}</button><button onclick="logout()">${ic("logout", 18)} Keluar</button></div></div>`;
// tab Booking/Galeri untuk tamu membuka halaman Masuk
const navGo = k => S.me || k === "home" ? `go('${k}')` : "openAuth('login')";
function shell(inner) {
  const nav = [["home", "Beranda", "home"], ["my", "Booking", "calendar"], ["gallery", "Galeri", "images"]], on = k => R.route.tab === k;
  return `<header class="top"><div class="brand">${esc(BRAND)}</div><div class="mtitle">${R.route.title}</div>
<nav class="tabs">${nav.map(n => `<button class="tab ${on(n[0]) ? "on" : ""}" onclick="${navGo(n[0])}">${ic(n[2], 18)}<span>${n[1]}</span></button>`).join("")}</nav>
${S.me ? acctMenu() : `<div class="usr"><button class="btn ghost sm" onclick="openAuth('login')">Masuk</button><button class="btn sm" onclick="openAuth('register')">Daftar</button></div>`}</header>
<main class="page">${toasts()}${inner}</main>
<nav class="bottom">${nav.map(n => `<button class="${on(n[0]) ? "on" : ""}" onclick="${navGo(n[0])}">${ic(n[2], 22)}<span>${n[1]}</span></button>`).join("")}</nav>`;
}
// muat ulang data master (studio/properti/paket) bila admin mengubahnya; render ulang hanya jika berbeda
async function refreshMaster() { try { const m = await masterModel.loadMaster(API); if (m.json === M.json) return; Object.assign(M, m); render(); } catch (e) {} }
V.home_after = V.studio_after = () => { if (!S.admin) refreshMaster(); };
function render() {
  syncRoute(); const view = R.route.name;
  if (view !== "landing") window.onscroll = null;
  if (view !== "session" && typeof stopSessionTimers === "function") stopSessionTimers();
  const f = V[view] || V.auth, inner = f();
  $("#app").innerHTML = view === "landing" ? inner : view === "auth" ? `<div class="authwrap">${inner}</div>` : S.admin ? adminShell(inner) : shell(inner);
  if (V[view + "_after"]) V[view + "_after"]();
  if (["home", "time"].includes(view)) prefetch();
}
async function prefetch() {
  const home = R.route.name === "home", d = home ? (S.hDate || todayS()) : (BK.date || todayS()), ids = home ? M.studios.map(s => s.id) : (BK.studio ? [BK.studio] : []); let ch = 0;
  for (const id of ids) { const k = id + "|" + d; if (R.availability[k]) continue; try { R.availability[k] = (await API.get(`/availability?studio_id=${id}&date=${d}`)).free; ch = 1; } catch (e) { if (e.status == 400) { R.availability[k] = []; ch = 1; } } } // studio ditolak (mis. tidak tersedia): tidak ada slot
  if (ch && ["home", "time"].includes(R.route.name)) render();
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
const fixS = s => { s.photos.forEach(p => p.img = p.img || API.imageUrl(p.id)); return s; };
async function refresh() {
  D.bookings = await API.get("/bookings"); D.sessions = (await API.get("/sessions")).map(fixS);
}
async function afterAuth(r) { API.token = r.token; S.admin = false; S.user = r.user; S.me = r.user.id; await refresh(); if (S.draft) return resumeDraft(); go("home"); } // draf booking tamu: kembali ke Paket & Pembayaran
function logout() { API.token = ""; API.staffToken = ""; S.user = S.me = null; S.staff = false; S.admin = false; S.draft = null; D.bookings = []; D.sessions = []; if (typeof adminReset === "function") adminReset(); R.auth.mode = "login"; go("landing"); }
async function staffToggle() { if (S.staff) { S.staff = false; API.staffToken = ""; } else { const pin = prompt("PIN staf:"); if (!pin) return; try { API.staffToken = (await API.post("/staff/login", { pin })).token; S.staff = true; } catch (e) { R.toast.error = e.message; } } save(); render(); }
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
async function changePw() { try { await API.post("/auth/forgot", { email: me().email }); R.toast.message = "Tautan untuk mengubah sandi telah dikirim ke " + me().email; } catch (x) { R.toast.error = x.message; } render(); }
function csContact() { const wa = CS_WA, mail = CS_EMAIL; if (wa) window.open("https://wa.me/" + wa, "_blank"); else if (mail) location.href = "mailto:" + mail; else alert("Silakan hubungi staf di studio atau kontak Customer Service Anda. (Atur nomor di frontend/js/config.js)"); }
export { $, capLabel, changePw, csContact, doReset, eff, forgot, free, go, ic, icf, login, logout, me, modal, openAcct, pkOf, prefetch, priceRange, ptag, refresh, refreshMaster, reg, render, staffToggle, studioOf, toasts, toggleMenu };
