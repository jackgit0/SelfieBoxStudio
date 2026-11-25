// Aksi data-* sementara (fase 4 sampai 9, decisions.md 42): tombol shell dan kalender sudah memakai data-action/data-change,
// tetapi penanganannya masih kode lama di js/legacy. Fase 5a–8a mendaftarkan controller sebagai gantinya dan menghapus barisnya; fase 9 menghapus berkas ini.
import { render } from "./legacy/core.js";
import { delPhoto } from "./legacy/session.js";
import { AD } from "./legacy/admin.js";

export function registerLegacyActions(registerActions) {
  registerActions({
    // tombol hapus di strip foto layar Sesi Foto sampai GalleryController (fase 7, commit galeri)
    "gallery:deletePhoto": dataset => delPhoto(Number(dataset.session), Number(dataset.photo)),
    // kotak cari di header admin (dulu onchange="AD.q=this.value;render()")
    "admin:search": (dataset, event) => {
      AD.q = event.target.value;
      render();
    },
  });
}

