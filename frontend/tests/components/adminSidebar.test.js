import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { ROUTES } from "../../js/core/router.js";
import { adminSidebar, adminHeader, adminTitle } from "../../js/components/adminSidebar.js";
import { flat } from "../helpers/markup.js";

const routeOf = path => ROUTES.find(route => route.path === path);

test("sembilan menu dari tabel rute, urut seperti dulu (AMENU)", () => {
  const markup = adminSidebar(routeOf("/admin"));
  assert.ok(markup instanceof Safe);
  const items = [...flat(markup).matchAll(/<button class="[^"]*" data-route="([^"]+)"><svg[^]*?<\/svg> ([^<]+)<\/button>/g)].map(found => [found[1], found[2]]);
  assert.deepEqual(items, [["/admin", "Dashboard"], ["/admin/users", "Pengguna"], ["/admin/studios", "Studio"], ["/admin/bookings", "Booking"], ["/admin/props", "Properti"], ["/admin/poses", "Pose"], ["/admin/transactions", "Transaksi"], ["/admin/packages", "Paket &amp; Diskon"], ["/admin/account", "Akun Admin"]]);
});

test("menu yang menyala mengikuti rute; Keluar lewat data-action", () => {
  const text = flat(adminSidebar(routeOf("/admin/studios")));
  assert.match(text, /<button class="on" data-route="\/admin\/studios">/);
  assert.equal((text.match(/class="on"/g) || []).length, 1);
  assert.match(text, /<button data-action="auth:logout"><svg[^]*?<\/svg> Keluar<\/button>/);
  assert.match(text, /<aside class="side"><h3>Admin<\/h3>/);
  assert.doesNotMatch(text, /onclick=/);
});

test("peringatan password bawaan hanya bila ditandai", () => {
  const route = routeOf("/admin/account");
  assert.match(flat(adminHeader({ route, title: "Akun Admin", mustChange: true })), /^<div class="toast err">⚠ Anda masih memakai password bawaan\./);
  assert.doesNotMatch(flat(adminHeader({ route, title: "Akun Admin", mustChange: false })), /toast err/);
});

test("judul halaman dan kotak cari hanya untuk halaman yang bisa dicari", () => {
  const searchable = ROUTES.filter(route => route.searchable).map(route => route.name);
  assert.deepEqual(searchable, ["acust", "astudio", "abook", "aprop", "apose", "atrx"]);
  const text = flat(adminHeader({ route: routeOf("/admin/users"), title: "Daftar Pengguna", query: 'a"b' }));
  assert.match(text, /<div class="ahead"><h1>Daftar Pengguna<\/h1><div class="search"><svg[^]*?<\/svg><input placeholder="Search\.\.\." aria-label="Cari" value="a&quot;b" data-change="admin:search"><\/div><\/div>/);
  assert.doesNotMatch(flat(adminHeader({ route: routeOf("/admin"), title: "Administrasi Pendapatan" })), /search/);
});

test("adminTitle: judul rute, Daftar Studio dengan jumlah studio bila sudah dimuat", () => {
  assert.equal(adminTitle(routeOf("/admin"), {}), "Administrasi Pendapatan");
  assert.equal(adminTitle(routeOf("/admin/studios"), { studios: null }), "Daftar Studio");
  assert.equal(adminTitle(routeOf("/admin/studios"), { studios: [{}, {}, {}] }), "Daftar Studio (3)");
});
