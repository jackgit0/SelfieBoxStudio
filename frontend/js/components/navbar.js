// Navbar customer (dulu shell(), acctMenu() dan navGo() di core.js): header dengan tab, menu akun, dan bilah bawah di layar kecil.
// route = { title, tab } (dari tabel rute), session = { user, staff }; user null = tamu.
import { html } from "../core/html.js";
import { BRAND } from "../config.js";
import { icon } from "./icon.js";

const TABS = [
  { tab: "home", label: "Beranda", icon: "home", path: "/browse" },
  { tab: "my", label: "Booking", icon: "calendar", path: "/bookings" },
  { tab: "gallery", label: "Galeri", icon: "images", path: "/gallery" },
];

// tamu yang membuka Booking atau Galeri diarahkan ke halaman Masuk
function tabPath(tab, session) {
  return session.user || tab.tab === "home" ? tab.path : "/login";
}

function accountMenu(session) {
  return html`<div class="usr">${session.staff ? html`<span class="tag warn">Staf</span>` : ""}<span class="uname">${session.user.name}</span><button class="avatar" aria-label="Menu akun" aria-haspopup="true" aria-expanded="false" data-action="ui:toggleMenu">${icon("user", 20)}</button>
<div id="menu" class="menu" hidden><button data-route="/account">${icon("user", 18)} Pengaturan Akun</button><button data-route="/account/payments">${icon("receipt", 18)} Riwayat Pembayaran</button>
<button data-action="auth:staffToggle">${icon("settings", 18)} ${session.staff ? "Nonaktifkan Mode Staf" : "Mode Staf"}</button><button data-action="auth:logout">${icon("logout", 18)} Keluar</button></div></div>`;
}

const guestButtons = () => html`<div class="usr"><button class="btn ghost sm" data-route="/login">Masuk</button><button class="btn sm" data-route="/register">Daftar</button></div>`;

export function navbar(route, session) {
  const tabs = TABS.map(tab => html`<button class="tab ${route.tab === tab.tab ? "on" : ""}" data-route="${tabPath(tab, session)}">${icon(tab.icon, 18)}<span>${tab.label}</span></button>`);
  return html`<header class="top"><div class="brand">${BRAND}</div><div class="mtitle">${route.title}</div>
<nav class="tabs">${tabs}</nav>
${session.user ? accountMenu(session) : guestButtons()}</header>`;
}

export function bottomBar(route, session) {
  const tabs = TABS.map(tab => html`<button class="${route.tab === tab.tab ? "on" : ""}" data-route="${tabPath(tab, session)}">${icon(tab.icon, 22)}<span>${tab.label}</span></button>`);
  return html`<nav class="bottom">${tabs}</nav>`;
}
