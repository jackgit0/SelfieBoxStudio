// Aksi data-* sementara (fase 4 sampai 9, decisions.md 42): tombol shell dan kalender sudah memakai data-action/data-change,
// tetapi penanganannya masih kode lama di js/legacy. Fase 5a–8a mendaftarkan controller sebagai gantinya dan menghapus barisnya; fase 9 menghapus berkas ini.
export function registerLegacyActions(registerActions) {
  // kotak cari admin pindah ke AdminController.setSearch (fase 8a); belum ada aksi lama lain
  registerActions({});
}
