import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { accountView } from "../../js/views/customer/account.js";
import { sampleState } from "../helpers/fixtures.js";
import { flat } from "../helpers/markup.js";

const links = { invoiceUrl: (id, download) => `/api/bookings/${id}/invoice?t=tok${download ? "&dl=1" : ""}` };
const matchFor = tab => ({ route: { name: "account", params: { tab } }, params: {}, query: {}, path: tab === "pay" ? "/account/payments" : "/account" });
function view(tab, bookings = []) {
  const value = sampleState({ persisted: { me: 5, user: { id: 5, name: "Dewi <D>", email: "d@x.id", phone: "0812345678" } } });
  value.data.bookings = bookings;
  const markup = accountView(value, matchFor(tab), links);
  assert.ok(markup instanceof Safe);
  return flat(markup);
}

test("account: dua tab lewat data-route, Edit Profil aktif di /account, Keluar lewat auth:logout", () => {
  const text = view("profile");
  assert.match(text, /<h1 class="h1">Pengaturan Akun<\/h1><div class="seg"><button class="on" data-route="\/account">Edit Profil<\/button><button class="" data-route="\/account\/payments">Riwayat Pembayaran<\/button><\/div>/);
  assert.match(text, /<div style="margin-top:18px"><button class="btn ghost" data-action="auth:logout"><svg[^]*?<\/svg> Keluar<\/button><\/div>/);
  assert.doesNotMatch(text, /onclick=/);
});

test("account: Edit Profil = form data-submit dengan nama/telepon terisi (di-escape), email disabled, Ubah sandi via email", () => {
  const text = view("profile");
  assert.match(text, /<form class="card" novalidate data-submit="account:saveProfile"><h3 class="h3">Edit Profil<\/h3>/);
  assert.match(text, /<label for="pn">Nama<\/label><input id="pn" name="name" value="Dewi &lt;D&gt;">/);
  assert.match(text, /<label for="pp">Telepon<\/label><input id="pp" name="phone" value="0812345678" inputmode="numeric">/);
  assert.match(text, /<label>Email<\/label><input value="d@x.id" disabled>/);
  assert.match(text, /<button class="btn" type="submit">Simpan<\/button><button class="btn ghost" type="button" data-action="account:requestPasswordChange"><svg[^]*?<\/svg> Ubah sandi via email<\/button>/);
});

test("account: Riwayat Pembayaran = tabel pembayaran terbaru dulu, Kwitansi Digital hanya untuk yang dibayar dan tidak dibatalkan", () => {
  const bookings = [
    { id: 1, studio: 1, package_id: 1, amount: 50000, pay_status: "paid", paid: 1, status: "Terbayar", paid_at: Date.UTC(2026, 10, 20, 3) },
    { id: 2, studio: 2, package_id: 2, amount: 90000, pay_status: "refunded", paid: 1, status: "Dibatalkan", paid_at: Date.UTC(2026, 10, 22, 3) },
    { id: 3, studio: 1, package_id: 1, amount: 50000, pay_status: "pending", paid: 0, status: "Menunggu Pembayaran" },
  ];
  const text = view("pay", bookings);
  assert.match(text, /<button class="" data-route="\/account">Edit Profil<\/button><button class="on" data-route="\/account\/payments">Riwayat Pembayaran<\/button>/);
  assert.match(text, /<tr><th>Waktu<\/th><th>Studio<\/th><th>Paket<\/th><th>Total<\/th><th>Status<\/th><th><\/th><\/tr>/);
  assert.equal([...text.matchAll(/<tr><td>/g)].length, 2);
  assert.ok(text.indexOf("<td>Mawar</td>") < text.indexOf("<td>Melati</td>"));
  assert.match(text, /<span class="tag ">Refunded<\/span>/);
  assert.match(text, /<span class="tag ok">Lunas<\/span><\/td>\n?<td><a class="btn sm ghost" href="\/api\/bookings\/1\/invoice\?t=tok" target="_blank" rel="noopener"><svg[^]*?<\/svg> Kwitansi Digital<\/a><\/td>/);
  assert.equal([...text.matchAll(/Kwitansi Digital/g)].length, 1);
});

test("account: Riwayat Pembayaran kosong", () => {
  assert.match(view("pay"), /<div class="card"><h3 class="h3">Riwayat Pembayaran<\/h3><p class="m" style="margin-top:8px">Belum ada transaksi\.<\/p><\/div>/);
});
