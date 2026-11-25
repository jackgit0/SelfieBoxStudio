# Arsitektur frontend SelfieBox Studio

> **Target arsitektur, migrasi sedang berjalan di branch `refactor/frontend-mvc`.** Kode di branch ini dipindahkan bertahap dari skrip global lama ke struktur di bawah. Sejak fase 2 aplikasi dimuat sebagai modul ES dari `js/main.js`; kode lama yang belum dipindahkan ada di `js/legacy/` (`core.js`, `customer.js`, `session.js`, `landing.js`, `admin.js`, dengan state bersamanya di `legacy/state.js`), dan `js/legacy-bridge.js` memasang ke `window` nama-nama yang masih dipanggil atribut `onclick="…"`. Setiap tahap tetap membuat aplikasi berjalan. Branch ini tidak digabung ke `main`.

Frontend ini HTML, CSS, dan JavaScript murni: tanpa framework, tanpa build step, tanpa dependensi npm. Browser memuat modul ES langsung dari `js/main.js`.

## Susunan folder (tujuan akhir)

```
frontend/
├── index.html          # <div id="app">, CSS, <script type="module" src="/js/main.js">
├── package.json        # hanya {"type": "module"} agar tes Node bisa mengimpor modul
├── css/                # tokens.css · base.css · components.css · pages/*.css
├── tests/              # tes unit node --test, tests/helpers/ berisi API/UI/storage palsu
└── js/
    ├── main.js         # titik masuk: siapkan API, muat data master, pulihkan login, jalankan router
    ├── config.js       # API_BASE, GOOGLE_CLIENT_ID, CS_WA, CS_EMAIL, BRAND
    ├── core/           # router, store, html, events, render, format
    ├── models/         # MODEL: data dan panggilan ke server
    ├── controllers/    # CONTROLLER: aksi pengguna → model → store
    ├── views/          # VIEW: fungsi murni state → HTML
    └── components/     # potongan tampilan yang dipakai ulang (modal, navbar, kalender, ikon, …)
```

## Tiga lapisan

| Lapisan | Boleh | Tidak boleh |
|---|---|---|
| **Model** (`models/`) | memanggil server lewat `api`, membentuk data, menghitung nilai turunan | menyentuh DOM, membaca/menulis store, membuka dialog |
| **View** (`views/`, fungsi render di `components/`) | membaca state yang diberikan, mengembalikan `html`…`` | fetch, menulis store, menyentuh `document`/`window`/`localStorage` |
| **Controller** (`controllers/`) | menangani aksi, validasi, membuka `modal`, memanggil model, mengubah store, pindah halaman | menyusun HTML (selain isi modal lewat view/komponen), memanggil `fetch` langsung |

Pegangan saat ragu: *berbicara dengan server → model; mengembalikan HTML → view; sisanya → controller.*

Nama controller mengikuti tabel MVC dokumen APS: `BookingController`, `PaymentController`, `StudioController` (studio dan sesi, termasuk ketersediaan), `AdminBookingController`, ditambah `AuthController`, `AccountController`, `PackageController`, `PhotoSessionController`, `GalleryController`, `LandingController`, `AdminController`.

## Store

Satu store (`core/store.js`) dengan bagian-bagian berikut:

| Bagian | Isi | Disimpan |
|---|---|---|
| `persisted` | pengguna, paket pilihan, favorit, filter, tab, draf booking tamu | `localStorage["snapia"]` |
| `master` | paket, studio, properti, pose, diskon, kebijakan | tidak (dari `/api/master`) |
| `booking` | booking yang sedang dibuat: studio, tanggal, sesi, reschedule | per tab, `sessionStorage` |
| `runtime` | cache ketersediaan, kalender, toast, mode login | tidak |
| `data` | booking dan sesi foto milik pengguna | tidak |
| `photo` | kamera, timer, pose, Google Drive, galeri | tidak |
| `admin` | state panel admin | tidak |

Token login tetap di `localStorage["snapia_t"]` dan hanya dibaca `models/api.js`.

Perubahan store hanya me-render ulang isi `<main id="outlet">`; navbar/sidebar dipasang sekali per halaman. Form yang sedang diisi tidak di-render ulang: pesan galat, total, dan tombol diperbarui di tempat.

## HTML dan event

Semua view memakai `html`…`` dari `core/html.js`, yang otomatis meng-escape setiap nilai:

```js
html`<b>${studio.name}</b>`                              // nama di-escape
html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`  // array html digabung
```

Tidak ada lagi `onclick="…"`. Tombol memakai atribut data, dan satu pendengar di `core/events.js` meneruskannya ke controller:

| Atribut | Saat | Contoh |
|---|---|---|
| `data-action="controller:method"` | klik | `<button data-action="payment:confirm">Check Out</button>` |
| `data-change` / `data-input` / `data-enter` / `data-submit` | change / input / Enter / submit | `<select data-change="payment:setMethod">` |
| `data-route="/path"` | klik, pindah halaman | `<a href="/packages" data-route="/packages">` |

Atribut `data-*` lain (`data-id="12"`) masuk ke argumen pertama method controller.

## Rute

Setiap halaman punya URL, misalnya `/browse`, `/studios/3`, `/book/time`, `/book/pay`, `/bookings`, `/bookings/12`, `/account`, `/gallery`, `/admin/studios`. Daftar lengkap ada di `js/core/router.js`. Aturan akses sama seperti sebelumnya: tamu boleh melihat studio, paket, dan mengisi booking sampai Check Out; halaman lain perlu login; halaman admin hanya untuk admin. Tautan reset sandi dari email (`/#reset=…`) tetap berlaku.

## Contoh: alur booking

Fitur booking sudah sepenuhnya MVC (fase 5a–5b), jadi dipakai sebagai contoh. Berikut perjalanan satu klik, tombol **Check Out** di langkah Paket & Pembayaran, sampai halaman **Studio Berhasil Direservasi**.

**1. View menandai tombolnya** (`js/views/customer/pay.js`). View hanya mengembalikan HTML dari state; tidak ada `onclick`, hanya nama aksinya:

```js
<button class="btn block" data-action="payment:confirm">Check Out</button>
```

**2. `main.js` mendaftarkan aksi itu** ke method controller. Satu pendengar klik di `core/events.js` membaca `data-action`, mencari `"payment:confirm"`, lalu memanggilnya dengan `dataset` dan `event`:

```js
"payment:confirm": payment.confirm,
```

**3. Controller menjalankan alurnya** (`js/controllers/PaymentController.js`). Tamu belum boleh membuat booking, jadi BookingController membuka popup "Masuk untuk melanjutkan booking" dan menyimpan drafnya. Pelanggan yang sudah masuk: booking dibuat, dibayar, data dimuat ulang, lalu pindah halaman. Setiap galat API diteruskan ke satu tabel pemetaan galat → popup (`BOOKING_ERRORS` di `BookingController.js`):

```js
async confirm() {
  const { persisted, booking: draft } = state();
  if (!persisted.me) {
    return booking.requireLogin();
  }
  try {
    const created = await bookingModel.create(api, { packageId: persisted.pkg, studioId: draft.studio, slot: draft.slot });
    await paymentModel.pay(api, created.id, persisted.method || DEFAULT_METHOD);
    booking.clearBooking();
    await refresh();
    store.update("persisted", { payOpen: false }, { silent: true });
    router.navigate(`/bookings/${created.id}/success`);
  } catch (error) {
    store.update("runtime", { availability: {} }, { silent: true });
    return booking.handleError(error, () => controller.selectPackage({ id: state().persisted.pkg }));
  }
},
```

**4. Model berbicara dengan server** (`js/models/booking.js`, `js/models/payment.js`). Model tidak tahu apa-apa soal DOM atau store; `api` diberikan pemanggil:

```js
export function create(api, { packageId, studioId, slot }) {
  return api.post("/bookings", { package_id: packageId, studio_id: studioId, date: slot });
}
export function pay(api, id, method) {
  return api.post(`/bookings/${id}/pay`, { method });
}
```

**5. Store diperbarui.** `booking.clearBooking()` mengosongkan slice `booking` (juga dari `sessionStorage`), `refresh()` memuat ulang slice `data` (booking dan sesi foto milik pelanggan; sampai fase 6 masih `refresh()` dari `js/legacy/core.js`). Pembaruan dengan `{ silent: true }` tidak merender; render terjadi sekali saat pindah halaman.

**6. Router pindah halaman.** `router.navigate("/bookings/12/success")` mengganti URL; rute `/bookings/:id/success` di `core/router.js` hanya untuk pelanggan, dan `main.js` memberinya view:

```js
"/bookings/:id/success": { view: (state, match) => successView(state, match, links) },
```

**7. View menggambar hasilnya** (`js/views/customer/success.js`). Booking dicari dari slice `data` dengan id dari URL; tautan invoice dibuat lewat `links.invoiceUrl`, karena token login hanya dikenal `models/api.js`:

```js
const booking = bookingById(data.bookings, match.params.id);
if (!booking) {
  return html`<div class="card">Memuat…</div>`;
}
```

**Di mana tesnya.** Setiap lapisan dites tanpa browser:

| Lapisan | Berkas tes | Yang dicek |
|---|---|---|
| Model | `tests/models/booking.test.js`, `tests/models/payment.test.js` | isi permintaan ke server, `isSlotGone`, `paymentRows` |
| View | `tests/views/pay.test.js`, `tests/views/success.test.js`, `tests/views/time.test.js` | total dari quote, paket terpilih, QRIS/transfer, tombol tidak pernah disabled |
| Controller | `tests/controllers/PaymentController.test.js`, `tests/controllers/BookingController.test.js` | tamu tidak membuat booking, urutan booking → bayar → sukses, tabel galat → popup |

Tes controller memakai store asli (`createStore`) dengan API dan UI palsu dari `tests/helpers/`, lalu mencatat urutan render, popup dan navigasi:

```js
test("confirm sebagai tamu: popup Masuk untuk melanjutkan booking, belum ada POST /bookings", async () => {
  const { api, log, controller } = setup({ persisted: { me: null, user: null } });
  await controller.confirm();
  assert.deepEqual(log, ["modal:Masuk untuk melanjutkan booking"]);
  assert.ok(!api.calls.some(call => call.path === "/bookings"));
});
```

Fitur lain mengikuti pola yang sama: view menandai aksi dengan `data-*`, `main.js` mendaftarkan method controller dan view per rute, controller memanggil model lalu `store.update` / `router.navigate`.

## Menjalankan tes

Dari folder aplikasi (`SelfieBoxStudio/`):

```
node --test "frontend/tests/**/*.test.js"      # tes unit frontend
cd backend && npm test                         # dan file tes backend lain, lihat README
```

Tes unit memakai API, UI, dan storage palsu dari `frontend/tests/helpers/`, jadi tidak perlu server atau browser.
