// StudioController, sisi pelanggan (tabel MVC APS: StudioController = studio + sesi): filter Browse, bookmark, tab properti,
// ketersediaan sesi (prefetch setelah render Browse dan Pilih Waktu) dan muat ulang data master. Sisi admin menyusul di fase 8b.
// Metode yang dipanggil dari atribut data-* menerima (dataset, event) dari core/events.js.
import { isoDate } from "../core/format.js";

// rute yang menampilkan jam kosong (Browse dan langkah Pilih Waktu, juga saat reschedule)
const AVAILABILITY_ROUTES = ["home", "time"];

export function createStudioController({ api, store, router, models, now = () => new Date() }) {
  const { studio: studioModel, master: masterModel } = models;

  // bulan sekarang (batas mundur kalender)
  function currentMonth() {
    const today = now();
    return { year: today.getFullYear(), month: today.getMonth() };
  }

  // studio dan tanggal yang perlu data ketersediaan untuk rute aktif
  function availabilityTargets(state) {
    const today = isoDate(now());
    if (state.runtime.route.name === "home") {
      return { date: studioModel.filterDate(state.persisted.hDate, today), studioIds: state.master.studios.map(studio => studio.id) };
    }
    const studioIds = state.booking.studio ? [state.booking.studio] : [];
    return { date: state.booking.date || today, studioIds };
  }

  return {
    // kalender Filter Jadwal (data-context="home"): pilih tanggal
    pickDate(dataset) {
      store.update("persisted", { hDate: dataset.date });
    },

    // panah bulan kalender Filter Jadwal; tidak bisa mundur melewati bulan sekarang
    moveMonth(dataset) {
      const calendars = store.get().runtime.calendar;
      const shown = calendars.home || currentMonth();
      const target = shown.year * 12 + shown.month + Number(dataset.step);
      const limit = currentMonth();
      if (target < limit.year * 12 + limit.month) {
        return;
      }
      const next = { year: Math.floor(target / 12), month: target % 12 };
      store.update("runtime", { calendar: { ...calendars, home: next } });
    },

    setHourFrom(dataset, event) {
      store.update("persisted", { hFrom: Number(event.target.value) });
    },

    setHourTo(dataset, event) {
      store.update("persisted", { hTo: Number(event.target.value) });
    },

    // bintang di kartu studio dan Detail Studio; daftar bookmark disimpan (localStorage)
    toggleBookmark(dataset) {
      const bookmarks = studioModel.toggleBookmark(store.get().persisted.bm, Number(dataset.id));
      store.update("persisted", { bm: bookmarks });
    },

    // tab kategori properti di Detail Studio
    setPropertyCategory(dataset) {
      store.update("persisted", { pCat: dataset.category });
    },

    // ambil jam kosong yang belum ada di cache (dulu prefetch() di core.js); render ulang sekali,
    // dan hanya bila halaman masih menampilkan jam kosong
    async prefetchAvailability() {
      const { date, studioIds } = availabilityTargets(store.get());
      const fetched = {};
      for (const studioId of studioIds) {
        const key = studioModel.availabilityKey(studioId, date);
        if (store.get().runtime.availability[key] || key in fetched) {
          continue;
        }
        try {
          fetched[key] = await studioModel.availability(api, studioId, date);
        } catch (error) {
          // jaringan/server bermasalah: kartu memakai perkiraan jam (freeHours) sampai render berikutnya
        }
      }
      if (!Object.keys(fetched).length) {
        return;
      }
      const availability = { ...store.get().runtime.availability, ...fetched };
      const stillShown = AVAILABILITY_ROUTES.includes(store.get().runtime.route.name);
      store.update("runtime", { availability }, { silent: !stillShown });
    },

    // muat ulang data master (admin mungkin mengubah studio/properti/paket); render ulang hanya bila berbeda.
    // true = data berubah
    async refreshMaster() {
      try {
        const master = await masterModel.loadMaster(api);
        if (master.json === store.get().master.json) {
          return false;
        }
        store.update("master", master);
        return true;
      } catch (error) {
        return false;
      }
    },
  };
}
