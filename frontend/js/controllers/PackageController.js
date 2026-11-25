// PackageController: Pilihan Paket, memilih paket, popup Paket (Foto) Tidak Ditemukan, galat "Paket tidak valid" dan kontak Customer Service
// (dulu choosePkg, ensurePkg, pkgMissing, onPkgErr, csContact). Metode data-* menerima (dataset, event) dari core/events.js.
// refreshMaster = StudioController.refreshMaster (memuat ulang data master; true bila berubah); config = { wa, email }.
import { isActive } from "../models/package.js";
import { contactCustomerService } from "../components/contact.js";
import { missingPackageModal } from "../views/customer/packages.js";

// pesan galat server untuk paket yang tidak aktif (POST /quote dan /bookings)
const INVALID_PACKAGE = /^Paket(\/studio)? tidak valid/;

export function createPackageController({ store, ui, router, config, refreshMaster }) {
  const master = () => store.get().master;
  const selected = () => store.get().persisted.pkg;

  function contactCs() {
    contactCustomerService(config, ui);
  }

  // paket pilihan sudah tidak aktif: pilihan dikosongkan (halaman ikut dirender) lalu popup memberi tahu.
  // next = lanjutkan alur semula setelah paket lain dipilih langsung dari daftar di popup
  async function showMissing(next = null, { booking = false } = {}) {
    store.update("persisted", { pkg: null });
    const answer = await ui.modal(missingPackageModal(master(), { booking }));
    if (answer === "list") {
      router.navigate("/packages");
      return;
    }
    if (answer === "cs") {
      contactCs();
      return;
    }
    if (!answer || !isActive(master(), answer)) {
      return;
    }
    store.update("persisted", { pkg: Number(answer) }, { silent: Boolean(next) });
    if (next) {
      next();
    }
  }

  return {
    showMissing,
    contactCs,

    // "Pilih Paket Ini" di Pilihan Paket: kembali ke Browse dengan toast
    choose(dataset) {
      const item = master().packages.find(candidate => candidate.id == dataset.id);
      if (!item) {
        return showMissing();
      }
      store.update("persisted", { pkg: item.id }, { silent: true });
      router.navigate("/browse");
      ui.toast(`Paket ${item.name} dipilih. Pilih studio untuk melanjutkan.`);
    },

    // sebelum memulai booking: paket pilihan dipakai bila masih aktif, belum memilih = paket aktif pertama;
    // sudah tidak aktif = popup dan false (next dijalankan setelah paket lain dipilih)
    ensureSelected(next) {
      if (selected() && !isActive(master(), selected())) {
        showMissing(next);
        return false;
      }
      if (!selected()) {
        store.update("persisted", { pkg: master().packages[0].id }, { silent: true });
      }
      return true;
    },

    // galat API saat booking: "Paket tidak valid" dengan paket yang memang sudah nonaktif → popup langkah booking (true);
    // selain itu false, pemanggil menampilkan galatnya sendiri
    async handleError(error, next) {
      if (error.status != 400 || !INVALID_PACKAGE.test(error.message)) {
        return false;
      }
      await refreshMaster();
      if (isActive(master(), selected())) {
        return false;
      }
      showMissing(next, { booking: true });
      return true;
    },
  };
}
