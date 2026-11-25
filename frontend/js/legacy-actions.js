// Aksi data-* sementara (fase 4 sampai 9, decisions.md 42): tombol shell dan kalender sudah memakai data-action/data-change,
// tetapi penanganannya masih kode lama di js/legacy. Fase 5a–8a mendaftarkan controller sebagai gantinya dan menghapus barisnya; fase 9 menghapus berkas ini.
import { logout, render, staffToggle } from "./legacy/core.js";
import { quickBook, startBook } from "./legacy/customer.js";
import { AD } from "./legacy/admin.js";

export function registerLegacyActions(registerActions) {
  registerActions({
    "auth:logout": () => logout(),
    "auth:staffToggle": () => staffToggle(),
    // kotak cari di header admin (dulu onchange="AD.q=this.value;render()")
    "admin:search": (dataset, event) => {
      AD.q = event.target.value;
      render();
    },
    // chip jam di kartu studio dan Book Now di Detail Studio (views/customer/*.js); fase 5b: BookingController
    "booking:quickBook": dataset => quickBook(Number(dataset.studio), dataset.date, Number(dataset.hour)),
    "booking:start": dataset => startBook(Number(dataset.id)),
  });
}

