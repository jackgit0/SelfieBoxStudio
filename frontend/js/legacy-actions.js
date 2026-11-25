// Aksi data-* sementara (fase 4 sampai 9, decisions.md 42): tombol shell dan kalender sudah memakai data-action/data-change,
// tetapi penanganannya masih kode lama di js/legacy. Fase 5a–8a mendaftarkan controller sebagai gantinya dan menghapus barisnya; fase 9 menghapus berkas ini.
import { logout, render, staffToggle } from "./legacy/core.js";
import { calNav, calPick } from "./legacy/customer.js";
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
    // kalender: "home" = Filter Jadwal di Browse (fase 5a: StudioController), "book" = Pilih Waktu (fase 5b: BookingController)
    "calendar:month": dataset => calNav(dataset.context, Number(dataset.step)),
    "calendar:pick": dataset => calPick(dataset.context, dataset.date),
  });
}

