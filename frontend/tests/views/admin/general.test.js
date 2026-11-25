// View halaman admin umum: Dashboard, Pengguna, Transaksi (teks kunci, escaping, keadaan kosong/memuat)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminState } from "../../../js/controllers/AdminController.js";
import { dashboardView } from "../../../js/views/admin/dashboard.js";
import { usersView } from "../../../js/views/admin/users.js";
import { transactionsView } from "../../../js/views/admin/transactions.js";
import { sampleState } from "../../helpers/fixtures.js";

const stateWith = admin => ({ ...sampleState(), admin: { ...createAdminState(), ...admin } });
const render = view => String(view);
const total = (total, n) => ({ total, n });
const revenue = { today: total(50000, 1), week: total(140000, 3), month: total(1600000, 20), all: total(2290000, 30), first_date: "2026-10-01", daily: [{ date: "2026-11-25", n: 1, total: 50000 }] };
const operations = { period: "month", booking_revenue: 1600000, other_income: 0, gross: 1600000, costs: 200000, net: 1400000, items: [{ id: 4, date: "2026-11-20", label: "Sewa <b>studio</b>", kind: "biaya", amount: 200000, note: "" }] };
const links = { adminPhotoUrl: id => `/api/admin/photos/${id}/image?t=tok` };

test("dashboard: memuat sampai pendapatan dan rekap ada", () => {
  assert.match(render(dashboardView(stateWith({}))), /Memuat…/);
  assert.match(render(dashboardView(stateWith({ revenue }))), /Memuat…/);
});

test("dashboard: kartu pendapatan, tabel 7 hari, rekap operasional, periode terpilih, item di-escape, form Tambah", () => {
  const out = render(dashboardView(stateWith({ revenue, operations })));
  for (const text of ["Hari ini", "7 hari terakhir", "30 hari terakhir", "Sejak pemesanan pertama", " · mulai 2026-10-01", "Pendapatan 7 hari terakhir", "Rp50.000", "Rekapitulasi Operasional", "Omset bersih", "Rp1.400.000", "Tambah item", ">Tambah</button>"]) assert.ok(out.includes(text), text);
  assert.match(out, /<option value="month" selected>30 hari terakhir<\/option>/);
  assert.match(out, /data-change="admin:setOperationsPeriod"/);
  assert.ok(out.includes("Sewa &lt;b&gt;studio&lt;/b&gt;"));
  assert.match(out, /data-action="admin:editOperation" data-id="4"/);
  assert.match(out, /data-action="admin:deleteOperation" data-id="4"/);
  assert.match(out, /<form[^>]*data-submit="admin:saveOperation"/);
  for (const name of ["date", "label", "kind", "amount", "note"]) assert.match(out, new RegExp(`name="${name}"`), name);
  assert.match(out, /color:var\(--green\)/);
});

test("dashboard: rekap tanpa item → keadaan kosong; omset bersih negatif merah", () => {
  const out = render(dashboardView(stateWith({ revenue, operations: { ...operations, items: [], net: -5 } })));
  assert.ok(out.includes("Belum ada item pada periode ini."));
  assert.match(out, /color:var\(--red\)/);
});

test("dashboard: mode ubah mengisi form dari item, tombol Simpan perubahan + Batal; draf yang gagal disimpan menang", () => {
  const editing = operations.items[0];
  let out = render(dashboardView(stateWith({ revenue, operations, editingOperation: editing })));
  assert.ok(out.includes("Ubah item"));
  assert.ok(out.includes("Simpan perubahan"));
  assert.match(out, /data-action="admin:cancelOperationEdit"/);
  assert.match(out, /name="amount"[^>]*value="200000"/);
  out = render(dashboardView(stateWith({ revenue, operations, editingOperation: editing, drafts: { operation: { date: "2026-11-21", label: "Listrik", kind: "pemasukan", amount: "abc", note: "x" } } })));
  assert.match(out, /name="label"[^>]*value="Listrik"/);
  assert.match(out, /<option value="pemasukan" selected>/);
});

test("pengguna: memuat, tabel dengan pencarian, tombol Detail/Hapus akun membawa id dan nama asli", () => {
  assert.match(render(usersView(stateWith({}), {}, links)), /Memuat…/);
  const customers = [{ id: 3, name: "Dewi <i>", email: "d@x.id", phone: "0812", bookings: 2, spent: 90000, photos: 1 }, { id: 4, name: "Budi", email: "b@x.id", phone: "0813", bookings: 0, spent: 0, photos: 0 }];
  let out = render(usersView(stateWith({ customers }), {}, links));
  assert.ok(out.includes("Dewi &lt;i&gt;"));
  assert.ok(out.includes("Rp90.000"));
  assert.match(out, /data-action="admin:openCustomer" data-id="3"/);
  assert.match(out, /data-action="admin:deleteCustomer" data-id="3" data-name="Dewi &lt;i&gt;"/);
  out = render(usersView(stateWith({ customers, query: "budi" }), {}, links));
  assert.ok(!out.includes("Dewi"));
  assert.ok(out.includes("Budi"));
  out = render(usersView(stateWith({ customers, query: "zzz" }), {}, links));
  assert.ok(out.includes("Tidak ada pengguna."));
});

test("pengguna: detail pelanggan dengan riwayat pembelian, foto lewat tautan admin, tombol Tutup", () => {
  const customerDetail = { customer: { id: 3, name: "Dewi", email: "d@x.id", phone: "0812" }, bookings: [{ created_at: 0, package: "Basic", studio: "Melati", slot: "2026-11-27 8:00", subtotal: 50000, amount: 45000, main_disc: 5000, method: "qris", status: "Terbayar" }], photos: [{ id: 7, fav: 1, taken_at: 0 }] };
  const out = render(usersView(stateWith({ customers: [], customerDetail }), {}, links));
  for (const text of ["Riwayat pembelian", "Basic", "Melati", "2026-11-27 8:00", "-Rp5.000", "Rp45.000", "qris", "Foto (1)", "⭐"]) assert.ok(out.includes(text), text);
  assert.match(out, /<span class="tag ok">Terbayar<\/span>/);
  assert.match(out, /href="\/api\/admin\/photos\/7\/image\?t=tok"/);
  assert.match(out, /data-action="admin:closeCustomer"/);
  const empty = render(usersView(stateWith({ customers: [], customerDetail: { ...customerDetail, bookings: [], photos: [] } }), {}, links));
  assert.ok(empty.includes("Belum ada pembelian."));
  assert.ok(empty.includes("Belum ada foto."));
});

test("transaksi: memuat, total masuk/refund, baris dengan label status, pencarian, kosong", () => {
  assert.match(render(transactionsView(stateWith({}))), /Memuat…/);
  const transactionsData = { paid: 150000, refunded: 50000, rows: [{ invoice: "INV-1", paid_at: 0, customer: "Dewi", email: "d@x.id", method: "qris", amount: 50000, status: "refunded", refunded_at: 0 }, { invoice: "INV-2", paid_at: 0, customer: "<Budi>", email: "b@x.id", method: null, amount: 100000, status: "paid", refunded_at: null }] };
  let out = render(transactionsView(stateWith({ transactions: transactionsData })));
  for (const text of ["Total pembayaran masuk", "Rp150.000", "Total refund", "Rp50.000", "INV-1", "&lt;Budi&gt;"]) assert.ok(out.includes(text), text);
  assert.match(out, /<span class="tag ok">Lunas<\/span>/);
  out = render(transactionsView(stateWith({ transactions: transactionsData, query: "inv-2" })));
  assert.ok(!out.includes("INV-1"));
  out = render(transactionsView(stateWith({ transactions: { paid: 0, refunded: 0, rows: [] } })));
  assert.ok(out.includes("Belum ada transaksi."));
});
