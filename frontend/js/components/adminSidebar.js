// Sidebar dan header halaman admin (dulu adminShell(), AMENU, ATITLE dan SEARCHABLE di admin.js), dibangun dari tabel rute (core/router.js).
// Sidebar = bagian shell (dipasang sekali per rute); header = bagian atas outlet, karena judul "(n)" dan peringatan password berubah tanpa pindah rute.
import { html } from "../core/html.js";
import { BRAND } from "../config.js";
import { ROUTES } from "../core/router.js";
import { icon } from "./icon.js";

const MUST_CHANGE = "⚠ Anda masih memakai password bawaan. Ganti password sekarang — fitur admin lain terkunci sampai password diganti.";

export function adminSidebar(route, routes = ROUTES) {
  const items = routes.filter(item => item.menu).map(item => html`<button class="${item.name === route.name ? "on" : ""}" data-route="${item.path}">${icon(item.menu.icon, 20)} ${item.menu.label}</button>`);
  return html`<aside class="side"><h3>Admin</h3>${items}<div class="foot"><div class="sm m" style="margin:0 6px 8px">${BRAND}</div><button data-action="auth:logout">${icon("logout", 20)} Keluar</button></div></aside>`;
}

// judul halaman; rute dengan count menambahkan jumlah isi slice admin itu bila sudah dimuat
export function adminTitle(route, admin = {}) {
  const list = route.count ? admin[route.count] : null;
  return route.title + (list ? ` (${list.length})` : "");
}

// options = { route, title, mustChange, query }; kotak cari hanya di rute searchable, nilainya dikirim lewat data-change="admin:search"
export function adminHeader({ route, title, mustChange = false, query = "" }) {
  const search = route.searchable ? html`<div class="search">${icon("search", 18)}<input placeholder="Search..." aria-label="Cari" value="${query}" data-change="admin:search"></div>` : "";
  return html`${mustChange ? html`<div class="toast err">${MUST_CHANGE}</div>` : ""}<div class="ahead"><h1>${title}</h1>${search}</div>`;
}
