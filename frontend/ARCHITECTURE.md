# Arsitektur frontend SelfieBox Studio

Frontend ini HTML, CSS, dan JavaScript murni: tanpa framework, tanpa build step, tanpa dependensi npm. Browser memuat modul ES langsung dari `js/main.js`.

## Susunan folder

```
frontend/
├── index.html          # <div id="app">, CSS, <script type="module" src="/js/main.js">
├── package.json        # hanya {"type": "module"} agar tes Node bisa mengimpor modul
├── css/
│   ├── tokens.css      # variabel :root (warna, radius, bayangan) dari file Figma IMK
│   ├── base.css        # reset, tipografi, pembantu tata letak, tombol, isian form
│   ├── components.css  # tag, toast, navbar + bilah bawah, kartu, segmen, kalender, sidebar admin, modal
│   └── pages/          # landing.css · booking.css · account.css (form masuk) · session.css · admin.css
├── tests/              # tes unit node --test, tests/helpers/ berisi API/UI/storage palsu
└── js/
    ├── main.js         # titik masuk: siapkan API, muat data master, pulihkan login, jalankan router
    ├── config.js       # API_BASE, GOOGLE_CLIENT_ID, CS_WA, CS_EMAIL, BRAND
    ├── core/           # router, store, state (isi awal), navigation, html, events, render, format
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

Nama controller mengikuti tabel MVC dokumen APS: `BookingController`, `PaymentController`, `StudioController` (studio dan sesi, termasuk ketersediaan), `AdminBookingController`, ditambah `AuthController`, `AccountController`, `PackageController`, `PhotoSessionController` (Session Assistant di tablet studio, admin), `GalleryController`, `LandingController`, `AdminController`.

## Store

Satu store (`core/store.js`) dengan bagian-bagian berikut:

| Bagian | Isi | Disimpan |
|---|---|---|
| `persisted` | pengguna, paket pilihan, favorit, filter, tab, draf booking tamu, kamera tablet per studio | `localStorage["snapia"]` |
| `master` | paket, studio, properti, pose, diskon, kebijakan | tidak (dari `/api/master`) |
| `booking` | booking yang sedang dibuat: studio, tanggal, sesi, reschedule | per tab, `sessionStorage` |
| `runtime` | cache ketersediaan, kalender, toast, mode login | tidak |
| `data` | booking dan sesi foto milik pengguna | tidak |
| `photo` | layar tablet studio (`live`: keadaan, timer foto, background, kamera), timer dan stream kamera, galeri | tidak |
| `admin` | state panel admin | tidak |

Token login tetap di `localStorage["snapia_t"]` dan hanya dibaca `models/api.js`.

Isi awal setiap bagian ada di `core/state.js` (`photo` dan `admin` dari controller pemiliknya). Perubahan store hanya me-render ulang isi `<main id="outlet">`; navbar/sidebar dipasang ulang hanya saat halaman atau isinya berubah. Form ditulis sebagai `<form novalidate data-submit="controller:method">` dengan field bernama; `main.js` meneruskan `formValues(form)` ke controller, dan isian yang gagal disimpan dikembalikan ke form sebagai draf. Mengetik tanpa mengirim memakai `store.update(…, { silent: true })` agar tidak me-render ulang. Halaman admin menampilkan data hanya-baca; form satu record dibuka dengan `admin:startEdit` (kunci di `admin.editing`, sama dengan kunci draf) dan ditutup dengan `admin:cancelEdit`, setelah Simpan berhasil, atau oleh kait `leave` rute (`AdminController.stopEditing`).

## HTML dan event

Semua view memakai `html`…`` dari `core/html.js`, yang otomatis meng-escape setiap nilai:

```js
html`<b>${studio.name}</b>`                              // nama di-escape
html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`  // array html digabung
```

Tidak ada atribut handler inline (`on…`) dan tidak ada nama aplikasi di `window`. Tombol memakai atribut data, dan satu pendengar di `core/events.js` meneruskannya ke controller:

| Atribut | Saat | Contoh |
|---|---|---|
| `data-action="controller:method"` | klik | `<button data-action="payment:confirm">Check Out</button>` |
| `data-change` / `data-input` / `data-enter` / `data-submit` | change / input / Enter / submit | `<select data-change="payment:setMethod">` |
| `data-route="/path"` | klik, pindah halaman | `<a href="/packages" data-route="/packages">` |

Atribut `data-*` lain (`data-id="12"`) masuk ke argumen pertama method controller. `innerHTML` hanya ditulis oleh `core/render.js`, `components/modal.js` dan adaptor layar sesi foto (`components/sessionScreen.js`).

## Rute

Setiap halaman punya URL, misalnya `/browse`, `/studios/3`, `/book/time`, `/book/pay`, `/bookings`, `/bookings/12`, `/account`, `/gallery`, `/admin/studios`. Daftar lengkap ada di `js/core/router.js`. Aturan akses sama seperti sebelumnya: tamu boleh melihat studio, paket, dan mengisi booking sampai Check Out; halaman lain perlu login; halaman admin hanya untuk admin. Tautan reset sandi dari email (`/#reset=…`) tetap berlaku.

Session Assistant berjalan di tablet studio yang masuk sebagai admin: `/admin/studios/:id/live` (ikon mata di Admin → Studio) memakai layout `kiosk` di `core/render.js`, yaitu layar penuh tanpa sidebar admin, hanya toast + isi. Pelanggan tidak punya layar sesi; check-in dilakukan admin di Admin → Booking, dan pelanggan melihat statusnya di Detail Booking serta fotonya di Galeri. Keluar dari layar tablet dan Akhiri Sesi meminta password admin.

## Contoh: alur booking

Fitur booking dipakai sebagai contoh. Berikut perjalanan satu klik, tombol **Check Out** di langkah Paket & Pembayaran, sampai halaman **Studio Berhasil Direservasi**.

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

**5. Store diperbarui.** `booking.clearBooking()` mengosongkan slice `booking` (juga dari `sessionStorage`), `refresh()` (`BookingController.refreshData`) memuat ulang slice `data` (booking dan sesi foto milik pelanggan). Pembaruan dengan `{ silent: true }` tidak merender; render terjadi sekali saat pindah halaman.

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

## Menambah halaman baru

Urutannya selalu rute → model → view → controller → aksi → tes. Contoh: halaman "Voucher Saya" di `/vouchers`.

1. **Rute** (`js/core/router.js`, `ROUTES`): `{ path: "/vouchers", name: "vouchers", access: "customer", title: "Voucher", tab: null }`. `access` menentukan siapa yang boleh membuka (`public`, `guest`, `customer`, `admin`); guard yang sudah ada mengalihkan yang lain. Path baru otomatis disajikan `index.html` oleh server.
2. **Model** (`js/models/voucher.js`): fungsi murni yang menerima `api`, mis. `export function listMine(api) { return api.get("/vouchers"); }`. Tanpa DOM, tanpa store.
3. **View** (`js/views/customer/vouchers.js`): `export function vouchersView(state, match) { return html`…`; }`, membaca state yang diberikan saja. Teks UI dalam bahasa Indonesia; tombol diberi `data-action="voucher:use"` dan `data-id`.
4. **Controller** (`js/controllers/VoucherController.js`): `export function createVoucherController({ api, store, ui, router, models })` mengembalikan method seperti `async load()` dan `async use(dataset)`. Konfirmasi lewat `ui.modal`, hasil ke `store.update`, pindah halaman lewat `router.navigate`.
5. **Sambungkan di `main.js`**: buat controller-nya di `start()`, tambahkan halaman di `pagesFor()` (`"/vouchers": { view: vouchersView, after: () => voucher.load() }`), daftarkan aksinya di `controllerActions()` (`"voucher:use": voucher.use`), dan tambahkan kontrolernya ke objek `controllers`. Gaya halaman masuk ke `css/pages/` (atau `components.css` bila dipakai ulang), tanpa gradient.
6. **Tes** (ditulis lebih dulu): `tests/models/voucher.test.js` dengan `createFakeApi`, `tests/views/vouchers.test.js` dengan `sampleState()`, `tests/controllers/VoucherController.test.js` dengan store asli + `createFakeUi`/`createFakeApi`. `tests/main.test.js` gagal bila sebuah `data-action` di view belum terdaftar di `controllerActions()`, dan `tests/imports.test.js` memastikan modul baru bisa diimpor tanpa browser.

## Menjalankan tes

Dari folder aplikasi (`SelfieBoxStudio/`):

```
node --test "frontend/tests/**/*.test.js"      # tes unit frontend
cd backend && npm test                         # dan file tes backend lain, lihat README
```

Tes unit memakai API, UI, dan storage palsu dari `frontend/tests/helpers/`, jadi tidak perlu server atau browser.

## Format kode

`js/` dirapikan dengan Prettier (`.prettierrc.json`), termasuk HTML di dalam `html`…`` yang ditata seperti berkas HTML biasa. Prettier tidak dipasang sebagai dependensi; perintahnya memakai `npx` dengan versi yang dikunci:

```
cd frontend
npm run format          # rapikan js/
npm run format:check    # hanya periksa (gagal bila ada berkas yang belum rapi)
```

Baris baru dan indentasi yang ditambahkan Prettier ikut masuk ke string keluaran view, tetapi diabaikan browser. Karena itu tes view mencocokkan markup lewat `flat()` dari `tests/helpers/markup.js`, yang membuang spasi tersebut sebelum regex dicocokkan. Tulis tes view baru dengan `flat(view(...))`, bukan `String(view(...))`.
