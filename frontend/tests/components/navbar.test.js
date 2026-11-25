import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { navbar, bottomBar } from "../../js/components/navbar.js";
import { flat } from "../helpers/markup.js";

const browse = { title: "Browse", tab: "home" };
const guest = { user: null };
const customer = { user: { name: "Dewi <b>" } };

const tabRoutes = markup => [...flat(markup).matchAll(/<button class="tab[^"]*" data-route="([^"]+)">/g)].map(found => found[1]);

test("navbar tamu: tanpa nama user, tombol Masuk (/login) dan Daftar (/register)", () => {
  const markup = navbar(browse, guest);
  assert.ok(markup instanceof Safe);
  const text = flat(markup);
  assert.doesNotMatch(text, /uname|Dewi/);
  assert.match(text, /<button class="btn ghost sm" data-route="\/login">Masuk<\/button>/);
  assert.match(text, /<button class="btn sm" data-route="\/register">Daftar<\/button>/);
  assert.doesNotMatch(text, /id="menu"/);
});

test("navbar tamu: tab Booking dan Galeri membuka /login, Beranda membuka /browse", () => {
  assert.deepEqual(tabRoutes(navbar(browse, guest)), ["/browse", "/login", "/login"]);
});

test("navbar customer: nama di-escape tepat satu kali, tab ke halamannya", () => {
  const text = flat(navbar(browse, customer));
  assert.equal(text.split("Dewi &lt;b&gt;").length - 1, 1);
  assert.doesNotMatch(text, /Dewi <b>/);
  assert.deepEqual(tabRoutes(text), ["/browse", "/bookings", "/gallery"]);
  assert.doesNotMatch(text, /data-route="\/login"/);
});

test("tab yang menyala mengikuti tab rute; judul seluler dari rute", () => {
  const text = flat(navbar({ title: "Booking Saya", tab: "my" }, customer));
  assert.match(text, /<button class="tab on" data-route="\/bookings">/);
  assert.match(text, /<button class="tab " data-route="\/browse">/);
  assert.match(text, /<div class="mtitle">Booking Saya<\/div>/);
  assert.equal((text.match(/class="tab on"/g) || []).length, 1);
  assert.equal((flat(navbar({ title: "Akun", tab: null }, customer)).match(/class="tab on"/g) || []).length, 0);
});

test("menu akun: Pengaturan Akun, Riwayat Pembayaran, Keluar lewat data-*; Mode Staf sudah dihapus", () => {
  const text = flat(navbar(browse, customer));
  assert.match(text, /<button class="avatar" aria-label="Menu akun" aria-haspopup="true" aria-expanded="false" data-action="ui:toggleMenu">/);
  assert.match(text, /<div id="menu" class="menu" hidden>/);
  assert.match(text, /data-route="\/account">[^]*?Pengaturan Akun<\/button>/);
  assert.match(text, /data-route="\/account\/payments">[^]*?Riwayat Pembayaran<\/button>/);
  assert.doesNotMatch(text, /Staf|staffToggle/);
  assert.match(text, /data-action="auth:logout">[^]*?Keluar<\/button>/);
  assert.doesNotMatch(text, /onclick=/);
});


test("bilah bawah: tiga tab, yang menyala dari rute, tamu ke /login", () => {
  const text = flat(bottomBar({ tab: "gallery" }, customer));
  assert.match(text, /^<nav class="bottom">/);
  assert.deepEqual([...text.matchAll(/data-route="([^"]+)"/g)].map(found => found[1]), ["/browse", "/bookings", "/gallery"]);
  assert.match(text, /<button class="on" data-route="\/gallery">/);
  assert.deepEqual([...flat(bottomBar({ tab: "home" }, guest)).matchAll(/data-route="([^"]+)"/g)].map(found => found[1]), ["/browse", "/login", "/login"]);
});
