// Studio di panel admin (dulu stRead, studioSave, stReview, stSave, studioDel di admin.js): daftar, tambah lewat Ringkasan Studio, ubah, hapus.
// Validasi lokal Tambah Studio = aturan server + gambar wajib (Figma 592:5056 Input Tidak Valid, 592:5140 Nama Sudah Digunakan); server tetap penentu akhir.
import { confirmPath } from "./confirmable.js";

export const STUDIO_INVALID = "Input studio tidak valid. Periksa field yang ditandai.";
export const STUDIO_DUPLICATE = "Nama studio sudah digunakan oleh studio lain.";
export const STUDIO_DUPLICATE_FIELD = "Nama studio sudah digunakan. Gunakan nama lain.";
const NAME_REQUIRED = "Nama studio wajib diisi.";
const PRICE_INVALID = "Biaya sewa harus bilangan bulat 0 atau lebih.";
const IMAGE_REQUIRED = "Gambar studio wajib diunggah.";

export function loadStudios(api) {
  return api.get("/admin/studios");
}

export function createStudio(api, body) {
  return api.post("/admin/studios", body);
}

export function updateStudio(api, id, body) {
  return api.patch("/admin/studios/" + id, body);
}

// confirmed = ulangi dengan ?confirm=1 setelah dialog dampak (withConfirm)
export function deleteStudio(api, id, confirmed = false) {
  const path = "/admin/studios/" + id;
  return api.del(confirmed ? confirmPath(path) : path);
}

// isian form (teks) → body server; biaya kosong = 0; image = URL gambar yang baru diunggah (opsional)
export function studioBody(values, image) {
  const body = {
    name: values.name,
    status: values.status,
    description: values.description,
    address: values.address,
    price: values.price === "" || values.price === undefined ? 0 : Number(values.price),
    people_range_id: Number(values.people_range_id),
    budget_range_id: Number(values.budget_range_id),
  };
  if (image) {
    body.img = image;
  }
  return body;
}

// galat isian Tambah Studio, atau null bila boleh lanjut ke Ringkasan Studio. studios = daftar studio admin (cek nama ganda)
export function newStudioErrors(body, studios, image) {
  const name = String(body.name || "").trim();
  const errors = {};
  if (!name) {
    errors.name = NAME_REQUIRED;
  } else if ((studios || []).some(studio => String(studio.name).trim().toLowerCase() === name.toLowerCase())) {
    errors.name = STUDIO_DUPLICATE_FIELD;
  }
  if (!Number.isInteger(body.price) || body.price < 0) {
    errors.price = PRICE_INVALID;
  }
  if (!image) {
    errors.img = IMAGE_REQUIRED;
  }
  const keys = Object.keys(errors);
  if (!keys.length) {
    return null;
  }
  const onlyDuplicate = errors.name === STUDIO_DUPLICATE_FIELD && keys.length === 1;
  return { top: onlyDuplicate ? STUDIO_DUPLICATE : STUDIO_INVALID, ...errors };
}

// galat server saat menyimpan dari Ringkasan Studio → galat isian (kembali ke form), atau null bila bukan galat isian
export function serverStudioErrors(error) {
  if (error.status == 409 && /sudah dipakai/.test(error.message)) {
    return { top: STUDIO_DUPLICATE, name: STUDIO_DUPLICATE_FIELD };
  }
  if (error.status != 400) {
    return null;
  }
  if (/Nama/.test(error.message)) {
    return { top: STUDIO_INVALID, name: NAME_REQUIRED };
  }
  if (/Angka/.test(error.message)) {
    return { top: STUDIO_INVALID, price: PRICE_INVALID };
  }
  return { top: STUDIO_INVALID, other: error.message };
}

// " 2 booking dibatalkan, 1 di-refund, 1 refund gagal (…)." setelah studio/sesi dihapus; kosong bila tidak ada booking yang dibatalkan
export function cancelledSummary(result) {
  if (!result.cancelled) {
    return "";
  }
  const refunded = result.refunded ? `, ${result.refunded} di-refund` : "";
  const failed = result.refund_failed ? `, ${result.refund_failed} refund gagal (tindak lanjuti manual di menu Transaksi)` : "";
  return ` ${result.cancelled} booking dibatalkan${refunded}${failed}.`;
}
