import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { loginView } from "../../js/views/auth/login.js";
import { registerView } from "../../js/views/auth/register.js";
import { forgotView } from "../../js/views/auth/forgot.js";
import { resetView } from "../../js/views/auth/reset.js";
import { staffPinModal } from "../../js/views/auth/staff.js";
import { sampleState } from "../helpers/fixtures.js";

const matchFor = mode => ({ route: { name: "auth", params: { mode } }, params: {}, query: {}, path: "/" + mode });
function render(view, mode, { persisted = {}, booking = {}, runtime = {} } = {}) {
  const markup = view(sampleState({ persisted, booking, runtime: { auth: { mode, resetToken: "" }, ...runtime } }), matchFor(mode));
  assert.ok(markup instanceof Safe);
  return String(markup);
}
const draft = { studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00" };

test("login: tab Masuk aktif, form data-submit novalidate, isian bernama, Lupa sandi? lewat data-route, tombol Beranda", () => {
  const text = render(loginView, "login");
  assert.match(text, /^<div class="authcard"><button class="back" data-route="\/"><svg[^]*?<\/svg> Beranda<\/button><div class="brand">SelfieBox Studio<\/div><p class="sub center" style="margin-bottom:14px">Sesi foto self-service, tinggal pilih dan datang\.<\/p>/);
  assert.match(text, /<div class="seg"><button class="on" data-route="\/login">Masuk<\/button><button class="" data-route="\/register">Daftar<\/button><\/div>/);
  assert.match(text, /<form novalidate data-submit="auth:login"><label for="e">Email atau username<\/label><input id="e" name="identifier" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value=""><label for="pw">Password<\/label><input id="pw" name="password" type="password" autocomplete="current-password">/);
  assert.match(text, /<div class="row sp" style="margin-top:18px"><button class="btn grow" type="submit">Masuk<\/button><\/div><p class="center sm" style="margin-top:14px"><a href="\/forgot-password" data-route="\/forgot-password">Lupa sandi\?<\/a><\/p><\/form>/);
  assert.doesNotMatch(text, /Masuk untuk melanjutkan booking|onclick=|onkeydown=/);
});

test("login: toast galat di dalam kartu; isian yang diketik tetap ada setelah galat (bukan password)", () => {
  const text = render(loginView, "login", { runtime: { toast: { message: "", error: "Email/username atau password salah" }, auth: { mode: "login", resetToken: "", form: { mode: "login", values: { identifier: "dewi@x.id" } } } } });
  assert.match(text, /<\/p><div class="toast err">Email\/username atau password salah<\/div>/);
  assert.match(text, /name="identifier"[^>]*value="dewi@x.id"/);
  const other = render(loginView, "login", { runtime: { auth: { mode: "login", resetToken: "", form: { mode: "register", values: { email: "x@y.z" } } } } });
  assert.match(other, /name="identifier"[^>]*value=""/);
});

test("login dengan draf booking: Masuk untuk melanjutkan booking; Kembali ke booking hanya bila sesi dan rincian harga ada", () => {
  const withQuote = render(loginView, "login", { persisted: { draft }, booking: { ...draft, quote: { total: 1 } } });
  assert.match(withQuote, /<button class="back" data-route="\/book\/pay"><svg[^]*?<\/svg> Kembali ke booking<\/button>/);
  assert.match(withQuote, /<h2 class="h3">Masuk untuk melanjutkan booking<\/h2><div class="mnote" style="margin:8px 0 14px"><svg[^]*?<\/svg> Kamu belum login\. Silakan masuk terlebih dahulu untuk membooking sesi\.<\/div>/);
  const withoutQuote = render(loginView, "login", { persisted: { draft }, booking: { ...draft, quote: null } });
  assert.match(withoutQuote, /Masuk untuk melanjutkan booking/);
  assert.match(withoutQuote, /data-route="\/"><svg[^]*?<\/svg> Beranda/);
  assert.doesNotMatch(render(loginView, "login"), /Kembali ke booking/);
});

test("register: tab Daftar aktif, empat isian bernama, draf juga tampil", () => {
  const text = render(registerView, "register", { persisted: { draft }, booking: { ...draft, quote: { total: 1 } } });
  assert.match(text, /<button class="" data-route="\/login">Masuk<\/button><button class="on" data-route="\/register">Daftar<\/button>/);
  assert.match(text, /<form novalidate data-submit="auth:register"><label for="n">Nama<\/label><input id="n" name="name" autocomplete="name" value=""><label for="p">Telepon<\/label><input id="p" name="phone" inputmode="numeric" autocomplete="tel" value=""><label for="e">Email<\/label><input id="e" name="email" type="email" autocomplete="email" value=""><label for="pw">Password \(min\. 6 karakter\)<\/label><input id="pw" name="password" type="password" autocomplete="new-password"><div style="margin-top:18px"><button class="btn block" type="submit">Daftar<\/button><\/div><\/form>/);
  assert.match(text, /Kembali ke booking/);
  assert.match(text, /Masuk untuk melanjutkan booking/);
});

test("forgot dan reset: tanpa tab dan tanpa catatan draf; Kembali ke /login", () => {
  const forgot = render(forgotView, "forgot", { persisted: { draft }, booking: { ...draft, quote: { total: 1 } } });
  assert.match(forgot, /<h2 class="h2">Lupa Sandi<\/h2><p class="m sm">Masukkan email akun Anda\. Tautan untuk membuat sandi baru akan dikirim ke email tersebut\.<\/p><form novalidate data-submit="auth:forgot"><label for="e">Email<\/label><input id="e" name="email" type="email" value=""><div class="row" style="margin-top:18px"><button class="btn grow" type="submit">Kirim Tautan<\/button><button class="btn ghost" type="button" data-route="\/login">Kembali<\/button><\/div><\/form>/);
  assert.doesNotMatch(forgot, /class="seg"|Masuk untuk melanjutkan booking|Kembali ke booking/);
  const reset = render(resetView, "reset");
  assert.match(reset, /<h2 class="h2">Buat Sandi Baru<\/h2><form novalidate data-submit="auth:reset"><label for="pw">Password baru<\/label><input id="pw" name="password" type="password" autocomplete="new-password"><label for="pw2">Ulangi password<\/label><input id="pw2" name="confirmation" type="password" autocomplete="new-password"><div style="margin-top:18px"><button class="btn block" type="submit">Simpan Sandi<\/button><\/div><\/form>/);
});

test("staffPinModal: judul, isian PIN numerik dan fokus awal di isian, Enter = Masuk, fokus kembali ke avatar", () => {
  const options = staffPinModal();
  assert.equal(options.title, "Masuk Mode Staf");
  assert.match(String(options.body), /<p>Masukkan PIN staf untuk mengaktifkan Mode Staf\.<\/p><label for="staff-pin">PIN staf<\/label><input id="staff-pin" type="password" inputmode="numeric" autocomplete="off">/);
  assert.deepEqual(options.buttons, [{ label: "Batal", value: null, style: "ghost" }, { label: "Masuk", value: "ok" }]);
  assert.equal(options.initialFocus, "#staff-pin");
  assert.equal(options.returnFocus, ".avatar");
  assert.equal(options.enterValue, "ok");
  assert.equal(options.read({ querySelector: () => ({ value: " 1234 " }) }), "1234");
});
