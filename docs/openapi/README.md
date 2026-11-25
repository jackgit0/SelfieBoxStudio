# Spesifikasi OpenAPI

`openapi.json` (OpenAPI 3.1.0) mendeskripsikan seluruh REST API di `backend/server.js`: 71 operasi pada 52 path, dikelompokkan dalam 19 tag (customer dan admin).

Spesifikasi ini ditulis dari **kode yang berjalan sekarang**, bukan dari desain APS yang direvisi. Jadi biaya studio, status booking berbahasa Indonesia (`Menunggu Pembayaran`, `Terbayar`, ...), refund yang hanya berhasil 2 jam sebelum sesi, dan reschedule ke studio lain tercatat apa adanya. Bila perilaku server berubah, perbarui spesifikasinya juga.

## Melihat

- Tempel isi `openapi.json` di <https://editor.swagger.io>, atau impor ke Apidog / Postman / Insomnia.
- Redocly (tanpa memasang apa pun di proyek): `npx @redocly/cli preview-docs docs/openapi/openapi.json`

## Hal yang perlu diketahui

- Galat selalu `{ "error": "<pesan>" }`. Aksi admin yang berdampak pada booking (hapus studio, ubah/hapus sesi studio, hapus booking) menjawab 409 `needs_confirm` + `impact` sampai diulang dengan `?confirm=1`.
- Token di header `Authorization: Bearer <token>` atau query `?t=<token>`. Ekstensi `x-role` (`public`, `customer`, `admin`) pada tiap operasi menyebut peran yang dibutuhkan.
- `POST /api/staff/login` memerlukan token customer; `POST /api/sessions/{id}/control` memerlukan token customer dan header `X-Staff-Token`.
- Invoice dikembalikan sebagai `text/html`, foto sebagai `image/jpeg`.
- Uang dalam rupiah (bilangan bulat), waktu dalam epoch milidetik, slot jam `YYYY-MM-DD H:00` WIB tanpa nol di depan jam (`2026-11-26 8:00`).

## Memeriksa

```
node docs/openapi/check-routes.js                 # setiap route() di server.js ada di spec (dan sebaliknya), x-role sesuai
npx @redocly/cli lint docs/openapi/openapi.json    # validasi OpenAPI
```

`check-routes.js` tidak memerlukan dependensi dan keluar dengan kode 1 bila ada route yang belum didokumentasikan. Peringatan lint yang tersisa memang disengaja: tidak ada `license`, server `localhost`, dan `GET /api/master` tanpa respons 4xx.
