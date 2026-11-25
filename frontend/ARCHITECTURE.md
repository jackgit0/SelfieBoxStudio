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

## Menjalankan tes

Dari folder aplikasi (`SelfieBoxStudio/`):

```
node --test "frontend/tests/**/*.test.js"      # tes unit frontend
cd backend && npm test                         # dan file tes backend lain, lihat README
```

Tes unit memakai API, UI, dan storage palsu dari `frontend/tests/helpers/`, jadi tidak perlu server atau browser.
