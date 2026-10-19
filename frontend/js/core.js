// ===== INTI: state, utilitas, ikon, shell (navbar), navigasi, autentikasi =====
const $ = s => document.querySelector(s);
const BRAND = window.BRAND || "SelfieBox Studio";
let PKG = [], ALLPKG = [], DISC = { pct: 0, label: "" }, PEOPLE = [], BUDGET = [], STUDIOS = [], VIBES = [], PROP = [], POSES = {}, POLICY = { refund_hours: 2 };
const V = {};
let S; try { S = JSON.parse(localStorage.getItem("snapia")); } catch (e) {}
S = Object.assign({ user: null, me: null, admin: false, view: "landing", p: {}, quiz: null, pkg: null, bm: [], staff: false, log: [] }, S || {});
S.setup = { bg: (S.setup && S.setup.bg) || null, acc: (S.setup && S.setup.acc) || [] }; S.bookings = []; S.sessions = [];
const save = () => { try { localStorage.setItem("snapia", JSON.stringify({ ...S, bookings: [], sessions: [] })); } catch (e) {} };
let msg = "", err = "", AV = {}, CAL = {}, B = { studio: null, date: null, slot: null }, editId = null, Q = null, promoCode = "";
const me = () => S.user;

// ---------- utilitas ----------
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rp = n => "Rp" + Number(n || 0).toLocaleString("id-ID");
const rpk = n => n >= 1000 ? "Rp " + Math.round(n / 1000) + "k" : "Rp " + n;
const pad = n => String(n).padStart(2, "0");
const HRS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];      // sesi 50 menit tiap jam (sama dengan server)
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const todayS = () => iso(new Date());
const slotLabel = h => `${pad(h)}:00 - ${pad(h)}:50`;
const parseSlot = s => { const [d, t] = String(s).split(" "); return { date: d, h: +t.split(":")[0] }; };
const slotRange = s => slotLabel(parseSlot(s).h);
const dObj = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fmtDate = d => dObj(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
const fmtDMY = d => d.split("-").reverse().join("/");
const fmtTime = ms => ms ? new Date(ms).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":").replace(",", " -") : "-";
const pkOf = id => ALLPKG.find(p => p.id == id) || { name: "(paket dihapus)", price: 0, photo_count: 1, dur: 1, strip_size: "", strip_material: "" };
const eff = p => Math.round(p.price * (1 - (DISC.pct || 0) / 100));
const ptag = p => DISC.pct ? `<s class="m">${rp(p.price)}</s> ${rp(eff(p))}` : rp(p.price);
const studioOf = id => STUDIOS.find(s => s.id == id) || { id, name: "(studio dihapus)", img: "", address: "-", price: 0, description: "" };
const free = (sid, d) => AV[sid + "|" + d] || HRS.filter(h => d > todayS() || h > new Date().getHours());
const priceRange = s => { if (!PKG.length) return "-"; const v = PKG.map(p => eff(p) + (s.price || 0)); const a = Math.min(...v), b = Math.max(...v); return a === b ? rpk(a) : rpk(a) + " - " + rpk(b); };
const capLabel = s => ((PEOPLE.find(p => p.id == s.people_range_id) || {}).range || "").replace("-", " - ");

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
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', refresh: '<path d="M20 11a8 8 0 00-14-4M4 4v4h4M4 13a8 8 0 0014 4M20 20v-4h-4"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};
const ic = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ""}</svg>`;
const icf = (n, s = 20) => ic(n, s).replace('fill="none"', 'fill="currentColor"');

// ---------- navigasi ----------
const ADMIN_VIEWS = ["adash", "acust", "astudio", "abook", "aprop", "apose", "atrx", "apkg", "aacct"];
const TITLES = { home: "Browse", studio: "Studio", time: "Pilih Waktu", pay: "Pembayaran", my: "Booking Saya", bdetail: "Detail Booking", cancel: "Pembatalan", refund: "Refund", success: "Booking", rescheduled: "Reschedule", gallery: "Galeri", session: "Sesi Foto", account: "Akun" };
const TABGROUP = { home: ["home", "studio", "time", "pay", "success", "rescheduled"], my: ["my", "bdetail", "cancel", "refund"], gallery: ["gallery", "session"] };
function go(v, p = {}, push = true) {
  S.view = v; S.p = p; msg = err = ""; AV = {}; save();
  if (push) { try { history.pushState({ v, p }, "", location.pathname + location.search); } catch (e) {} }
  window.scrollTo({ top: 0, behavior: "instant" }); render();
}
window.addEventListener("popstate", e => { const st = e.state; if (st && st.v) { S.view = st.v; S.p = st.p || {}; msg = err = ""; render(); } });
document.addEventListener("click", () => { const m = $("#menu"); if (m) m.hidden = true; });
const toggleMenu = e => { e.stopPropagation(); const m = $("#menu"); m.hidden = !m.hidden; };
const openAcct = tab => { S.acct = tab; go("account"); };
const toasts = () => (msg ? `<div class="toast">${esc(msg)}</div>` : "") + (err ? `<div class="toast err">${esc(err)}</div>` : "");

function shell(inner) {
  const nav = [["home", "Beranda", "home"], ["my", "Booking", "calendar"], ["gallery", "Galeri", "images"]], on = k => (TABGROUP[k] || []).includes(S.view);
  return `<header class="top"><div class="brand">${esc(BRAND)}</div><div class="mtitle">${TITLES[S.view] || ""}</div>
<nav class="tabs">${nav.map(n => `<button class="tab ${on(n[0]) ? "on" : ""}" onclick="go('${n[0]}')">${ic(n[2], 18)}<span>${n[1]}</span></button>`).join("")}</nav>
<div class="usr">${S.staff ? '<span class="tag warn">Staf</span>' : ""}<span class="uname">${esc(me().name)}</span><button class="avatar" aria-label="Menu akun" onclick="toggleMenu(event)">${ic("user", 20)}</button>
<div id="menu" class="menu" hidden><button onclick="openAcct('profile')">${ic("user", 18)} Pengaturan Akun</button><button onclick="openAcct('pay')">${ic("receipt", 18)} Riwayat Pembayaran</button>
<button onclick="staffToggle()">${ic("settings", 18)} ${S.staff ? "Nonaktifkan Mode Staf" : "Mode Staf"}</button><button onclick="logout()">${ic("logout", 18)} Keluar</button></div></div></header>
<main class="page">${toasts()}${inner}</main>
<nav class="bottom">${nav.map(n => `<button class="${on(n[0]) ? "on" : ""}" onclick="go('${n[0]}')">${ic(n[2], 22)}<span>${n[1]}</span></button>`).join("")}</nav>`;
}
// muat ulang data master (studio/properti/paket) bila admin mengubahnya; render ulang hanya jika berbeda
let _mj = "";
async function refreshMaster() { try { const m = await API.get("/master"), j = JSON.stringify(m); if (j === _mj) return; _mj = j; ({ PKG, ALLPKG, DISC, PEOPLE, BUDGET, STUDIOS, VIBES, PROP, POSES } = m); if (m.POLICY) POLICY = m.POLICY; render(); } catch (e) {} }
V.home_after = V.studio_after = () => { if (!S.admin) refreshMaster(); };
function render() {
  if (!S.me && !["auth", "landing"].includes(S.view)) S.view = "landing";
  if (S.view !== "landing") window.onscroll = null;
  if (S.admin && !ADMIN_VIEWS.includes(S.view)) S.view = "adash";
  if (S.admin && typeof AD !== "undefined" && AD.me && AD.me.must_change && S.view !== "aacct") S.view = "aacct"; // password bawaan: hanya halaman Akun Admin yang terbuka
  if (!S.admin && ADMIN_VIEWS.includes(S.view)) S.view = S.me ? "home" : "auth";
  if (S.view !== "session" && typeof stopSessionTimers === "function") stopSessionTimers();
  const f = V[S.view] || V.auth, inner = f();
  $("#app").innerHTML = S.view === "landing" ? inner : S.view === "auth" ? `<div class="authwrap">${inner}</div>` : S.admin ? adminShell(inner) : shell(inner);
  if (V[S.view + "_after"]) V[S.view + "_after"]();
  if (["home", "time"].includes(S.view)) prefetch();
}
async function prefetch() {
  const home = S.view === "home", d = home ? (S.hDate || todayS()) : (B.date || todayS()), ids = home ? STUDIOS.map(s => s.id) : (B.studio ? [B.studio] : []); let ch = 0;
  for (const id of ids) { const k = id + "|" + d; if (AV[k]) continue; try { AV[k] = (await API.get(`/availability?studio_id=${id}&date=${d}`)).free; ch = 1; } catch (e) {} }
  if (ch && ["home", "time"].includes(S.view)) render();
}

// ---------- autentikasi ----------
let authMode = "login", resetTok = "";
V.auth = () => {
  const tabs = `<div class="seg">${[["login", "Masuk"], ["register", "Daftar"]].map(t => `<button class="${authMode == t[0] ? "on" : ""}" onclick="authMode='${t[0]}';msg=err='';render()">${t[1]}</button>`).join("")}</div>`;
  const wrap = h => `<div class="authcard"><button class="back" onclick="go('landing')">${ic("left", 16)} Beranda</button><div class="brand">${esc(BRAND)}</div><p class="sub center" style="margin-bottom:14px">Sesi foto self-service, tinggal pilih dan datang.</p>${toasts()}${h}</div>`;
  const key = 'onkeydown="if(event.key===\'Enter\')';
  if (authMode == "reset") return wrap(`<h2 class="h2">Buat Sandi Baru</h2><label>Password baru</label><input id="pw" type="password" autocomplete="new-password"><label>Ulangi password</label><input id="pw2" type="password" autocomplete="new-password" ${key}doReset()"><div style="margin-top:18px"><button class="btn block" onclick="doReset()">Simpan Sandi</button></div>`);
  if (authMode == "forgot") return wrap(`<h2 class="h2">Lupa Sandi</h2><p class="m sm">Masukkan email akun Anda. Tautan untuk membuat sandi baru akan dikirim ke email tersebut.</p><label>Email</label><input id="e" type="email" ${key}forgot()"><div class="row" style="margin-top:18px"><button class="btn grow" onclick="forgot()">Kirim Tautan</button><button class="btn ghost" onclick="authMode='login';msg=err='';render()">Kembali</button></div>`);
  if (authMode == "admin") return wrap(`<h2 class="h2">Login Admin</h2><label>Username</label><input id="au" autocomplete="username"><label>Password</label><input id="pw" type="password" autocomplete="current-password" ${key}adminLogin()"><div style="margin-top:18px"><button class="btn block" onclick="adminLogin()">Masuk Admin</button></div><p class="center sm" style="margin-top:14px"><a href="#" onclick="authMode='login';msg=err='';render();return false">← Kembali ke login customer</a></p>`);
  if (authMode == "register") return wrap(tabs + `<label>Nama</label><input id="n" autocomplete="name"><label>Telepon</label><input id="p" inputmode="numeric" autocomplete="tel"><label>Email</label><input id="e" type="email" autocomplete="email"><label>Password (min. 6 karakter)</label><input id="pw" type="password" autocomplete="new-password" ${key}reg()"><div style="margin-top:18px"><button class="btn block" onclick="reg()">Daftar</button></div>`);
  return wrap(tabs + `<label>Email</label><input id="e" type="email" autocomplete="email"><label>Password</label><input id="pw" type="password" autocomplete="current-password" ${key}login()"><div class="row sp" style="margin-top:18px"><button class="btn grow" onclick="login()">Masuk</button></div><p class="center sm" style="margin-top:14px"><a href="#" onclick="authMode='forgot';msg=err='';render();return false">Lupa sandi?</a> · <a href="#" onclick="authMode='admin';msg=err='';render();return false">Masuk sebagai admin</a></p>`);
};
const fixS = s => { s.photos.forEach(p => p.img = p.img || API.imgUrl(p.id)); return s; };
async function refresh() {
  S.bookings = await API.get("/bookings"); S.sessions = (await API.get("/sessions")).map(fixS);
  try { const pr = await API.get("/preferences"); if (pr.schedule && !S.quiz) S.quiz = { purpose: "Couple", people: pr.schedule.people, vibe: (pr.setup && pr.setup.vibe) || 1, budget: pr.schedule.budget, ok: true }; } catch (e) {}
}
async function afterAuth(r) { API.token = r.token; localStorage.setItem("snapia_t", r.token); S.admin = false; S.user = r.user; S.me = r.user.id; await refresh(); go("home"); }
function logout() { API.token = ""; API.staff = ""; localStorage.removeItem("snapia_t"); S.user = S.me = null; S.staff = false; S.admin = false; S.bookings = []; S.sessions = []; if (typeof adminReset === "function") adminReset(); authMode = "login"; go("landing"); }
async function staffToggle() { if (S.staff) { S.staff = false; API.staff = ""; } else { const pin = prompt("PIN staf:"); if (!pin) return; try { API.staff = (await API.post("/staff/login", { pin })).token; S.staff = true; } catch (e) { err = e.message; } } save(); render(); }
async function reg() {
  const n = $("#n").value.trim(), e = $("#e").value.trim(), p = $("#p").value.trim(), pw = $("#pw").value;
  if (!n || !/\S+@\S+\.\S+/.test(e) || !/^\d{8,15}$/.test(p) || pw.length < 6) { err = "Lengkapi data: email valid, telepon 8-15 digit, password min. 6 karakter."; return render(); }
  try { await afterAuth(await API.post("/auth/register", { name: n, email: e, phone: p, password: pw })); } catch (x) { err = x.message; render(); }
}
async function login() {
  const e = $("#e").value.trim(), pw = $("#pw").value; if (!e || !pw) { err = "Isi email dan password."; return render(); }
  try { await afterAuth(await API.post("/auth/login", { email: e, password: pw })); } catch (x) { err = x.message; render(); }
}
async function forgot() {
  const e = $("#e").value.trim(); if (!/\S+@\S+\.\S+/.test(e)) { err = "Masukkan email yang valid."; return render(); }
  try { const r = await API.post("/auth/forgot", { email: e }); authMode = "login"; msg = r.message; } catch (x) { err = x.message; } render();
}
async function doReset() {
  const a = $("#pw").value, b = $("#pw2").value; if (a.length < 6 || a != b) { err = "Password min. 6 karakter dan kedua isian harus sama."; return render(); }
  try { await API.post("/auth/reset", { token: resetTok, password: a }); resetTok = ""; authMode = "login"; msg = "Sandi berhasil diubah. Silakan masuk dengan sandi baru."; } catch (x) { err = x.message; } render();
}
async function adminLogin() {
  try { const r = await API.post("/admin/login", { username: $("#au").value.trim(), password: $("#pw").value }); API.token = r.token; localStorage.setItem("snapia_t", r.token); S.admin = true; S.user = { name: "Admin", id: 0 }; S.me = "admin"; AD.me = r.admin; go(r.admin.must_change ? "aacct" : "adash"); }
  catch (x) { err = x.message; render(); }
}
async function changePw() { try { await API.post("/auth/forgot", { email: me().email }); msg = "Tautan untuk mengubah sandi telah dikirim ke " + me().email; } catch (x) { err = x.message; } render(); }
function csContact() { const wa = window.CS_WA, mail = window.CS_EMAIL; if (wa) window.open("https://wa.me/" + wa, "_blank"); else if (mail) location.href = "mailto:" + mail; else alert("Silakan hubungi staf di studio atau kontak Customer Service Anda. (Atur nomor di frontend/js/config.js)"); }
