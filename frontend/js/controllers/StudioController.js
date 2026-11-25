// StudioController, sisi pelanggan (tabel MVC APS: StudioController = studio + sesi): filter Browse, bookmark, tab properti,
// ketersediaan sesi (prefetch setelah render Browse dan Pilih Waktu) dan muat ulang data master.
// Sisi admin (fase 8b, dulu bagian Studio dan Sesi di admin.js): Daftar Studio dengan Tambah Studio → Ringkasan Studio → Berhasil, ubah dan hapus studio,
// panel Detail Sesi (kalender bulan, tambah/ubah/hapus sesi). Aksi admin lewat AdminController (admin.run / admin.load / handleAccessError).
// Metode yang dipanggil dari atribut data-* menerima (dataset, event) dari core/events.js.
import { isoDate } from "../core/format.js";
import { shiftMonth } from "../components/calendar.js";
import { sessionChangeBody, sessionImpactBody, studioImpactBody } from "../views/admin/dialogs.js";
import { CANCELLED } from "./AdminController.js";

// rute yang menampilkan jam kosong (Browse dan langkah Pilih Waktu, juga saat reschedule)
const AVAILABILITY_ROUTES = ["home", "time"];

// admin = AdminController (run, load, handleAccessError); files.readImage(file) → data URL yang sudah diperkecil (components/imageFile.js)
export function createStudioController({
  api,
  store,
  ui,
  router,
  models,
  admin: adminCore = null,
  files = null,
  now = () => new Date(),
}) {
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
      return {
        date: studioModel.filterDate(state.persisted.hDate, today),
        studioIds: state.master.studios.map(studio => studio.id),
      };
    }
    const studioIds = state.booking.studio ? [state.booking.studio] : [];
    return { date: state.booking.date || today, studioIds };
  }

  // ---------- sisi admin ----------
  const adminState = () => store.get().admin;
  const adminModels = () => models.admin;
  const today = () => isoDate(now());

  function updateAdmin(patch, { silent = true } = {}) {
    store.update("admin", patch, { silent });
  }

  // toast yang dibaca AdminController.run setelah aksi selesai (okMessage kosong)
  function setToast(toast) {
    store.update("runtime", { toast: { message: "", error: "", ...toast } }, { silent: true });
  }

  function without(object, key) {
    const { [key]: dropped, ...rest } = object;
    return rest;
  }

  // data master (studio untuk pelanggan) dimuat ulang tanpa render
  async function reloadMaster() {
    store.update("master", await masterModel.loadMaster(api), { silent: true });
  }

  function findSession(studioId, id) {
    const list = adminState().sessions[adminModels().sessions.sessionsKey(adminState(), studioId, today())] || [];
    return list.find(session => session.id == id);
  }

  // setelah sesi berubah: cache sesi studio itu dibuang, ringkasan dikosongkan, daftar studio (jumlah sesi, dampak hapus) dimuat ulang tanpa layar Memuat
  async function refreshSessions(studioId) {
    const prefix = studioId + "|";
    const sessions = Object.fromEntries(
      Object.entries(adminState().sessions).filter(([key]) => !key.startsWith(prefix)),
    );
    updateAdmin({ sessions, bookings: null, transactions: null, revenue: null, operations: null });
    try {
      updateAdmin({ studios: await adminModels().studios.loadStudios(api) });
    } catch (error) {
      updateAdmin({ studios: null }); // gagal muat ulang: daftar dimuat lagi saat render
    }
  }

  const controller = {
    // kalender Filter Jadwal (data-context="home"): pilih tanggal
    pickDate(dataset) {
      store.update("persisted", { hDate: dataset.date });
    },

    // panah bulan kalender Filter Jadwal; tidak bisa mundur melewati bulan sekarang
    moveMonth(dataset) {
      const calendars = store.get().runtime.calendar;
      const next = shiftMonth(calendars.home || currentMonth(), dataset.step, currentMonth());
      if (!next) {
        return;
      }
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

    // ---------- admin: Daftar Studio (/admin/studios) ----------
    // kait after halaman: daftar studio sekali, lalu sesi bulan yang tampil untuk setiap studio yang terbuka
    loadStudios() {
      const loading = adminCore.load("studios", () => adminModels().studios.loadStudios(api), []);
      for (const studio of adminState().studios || []) {
        if (adminState().openStudios[studio.id]) {
          controller.loadSessions(studio.id);
        }
      }
      return loading;
    },

    toggleStudio({ id }) {
      const open = adminState().openStudios;
      updateAdmin({ openStudios: { ...open, [id]: !open[id] } }, { silent: false });
    },

    // tombol "Tambah studio" (buka/tutup); kartu Berhasil hilang
    openNew() {
      const open = adminState().openStudios;
      updateAdmin({ openStudios: { ...open, new: !open.new }, studioDone: null }, { silent: false });
    },

    cancelNew() {
      setToast({});
      updateAdmin(
        {
          newStudio: null,
          studioSummary: false,
          studioErrors: null,
          images: without(adminState().images, "new"),
          openStudios: { ...adminState().openStudios, new: false },
        },
        { silent: false },
      );
    },

    // unggah gambar (data-change pada input file di dalam form studio). key = "new" atau id studio; values = isian form saat itu,
    // disimpan agar tidak hilang saat halaman dirender ulang. Studio baru: galat isian lama dihapus (dicek ulang di Lihat Ringkasan)
    async uploadImage({ studio: key }, file, values = {}) {
      if (!file) {
        return;
      }
      setToast({});
      const isNew = key === "new";
      if (isNew) {
        updateAdmin({ newStudio: adminModels().studios.studioBody(values) });
      } else {
        updateAdmin({ drafts: { ...adminState().drafts, ["studio-" + key]: values } });
      }
      try {
        const url = await adminModels().uploads.uploadImage(api, await files.readImage(file));
        updateAdmin({ images: { ...adminState().images, [key]: url } });
        if (isNew) {
          updateAdmin({ studioErrors: null });
        }
        setToast({ message: isNew ? "Gambar diunggah." : "Gambar diunggah. Klik Simpan untuk menerapkan." });
      } catch (error) {
        setToast({ error: error.message });
      }
      updateAdmin({}, { silent: false });
    },

    // Lihat Ringkasan: validasi lokal (nama, nama ganda, biaya, gambar wajib); lolos → Ringkasan Studio, gagal → galat isian + fokus ke field pertama
    review(values) {
      const body = adminModels().studios.studioBody(values);
      const errors = adminModels().studios.newStudioErrors(body, adminState().studios, adminState().images.new);
      setToast({});
      updateAdmin(
        { newStudio: body, studioDone: null, studioErrors: errors, studioSummary: !errors },
        { silent: false },
      );
      if (errors) {
        ui.focus(".amain .inv");
      }
    },

    // "Ubah" di Ringkasan Studio: kembali ke form, isian tetap
    backToForm() {
      updateAdmin({ studioSummary: false }, { silent: false });
    },

    // Simpan Studio: hanya dari Ringkasan Studio. Galat isian dari server → kembali ke form (409 nama ganda: daftar dimuat ulang)
    save() {
      const draft = adminState().newStudio;
      if (!adminState().studioSummary || !draft) {
        return Promise.resolve(false);
      }
      return adminCore.run(
        async () => {
          const name = String(draft.name).trim();
          let created;
          try {
            // draf lama (tersimpan sebelum status diturunkan server) bisa masih membawa status: tidak dikirim
            const { status, ...fields } = draft;
            created = await adminModels().studios.createStudio(api, { ...fields, name, img: adminState().images.new });
          } catch (error) {
            const errors = adminModels().studios.serverStudioErrors(error);
            if (!errors) {
              throw error;
            }
            updateAdmin({
              studioErrors: errors,
              studioSummary: false,
              ...(error.status == 409 ? { studios: null } : {}),
            });
            return;
          }
          // studio baru belum punya booking, jadi slotnya kosong: status turunannya Tersedia
          const text = `${name} tersedia dan tampil di daftar studio pelanggan.`;
          updateAdmin({
            images: without(adminState().images, "new"),
            openStudios: { ...adminState().openStudios, new: false, [created.id]: true },
            newStudio: null,
            studioSummary: false,
            studioErrors: null,
            studioDone: { title: "Studio berhasil ditambahkan", text },
            studios: null,
          });
          await reloadMaster();
        },
        "",
        "Hanya admin yang dapat menambahkan studio.",
      );
    },

    // simpan form Detail Studio sebuah studio (satu langkah); gagal → isian baris itu disimpan sebagai draf
    edit({ id }, values) {
      const key = "studio-" + id;
      return adminCore.run(
        async () => {
          const body = adminModels().studios.studioBody(values, adminState().images[id]);
          body.price = body.price || 0;
          await adminModels().studios.updateStudio(api, id, body);
          updateAdmin({
            images: without(adminState().images, id),
            drafts: without(adminState().drafts, key),
            studios: null,
          });
          await reloadMaster();
        },
        "Studio disimpan.",
        "Hanya admin yang dapat mengubah studio.",
        { draft: { key, values } },
      );
    },

    // hapus studio: dialog dampak (withConfirm), booking aktif dibatalkan dan di-refund oleh server
    delete({ id }) {
      const studio = (adminState().studios || []).find(entry => entry.id == id);
      if (!studio) {
        return Promise.resolve(false);
      }
      return adminCore.run(async () => {
        const answer = await adminModels().confirmable.withConfirm(
          confirmed => adminModels().studios.deleteStudio(api, id, confirmed),
          {
            ui,
            title: `Hapus ${studio.name}?`,
            okLabel: "Ya, Hapus Studio",
            describeImpact: studioImpactBody,
            known: studio.impact,
          },
        );
        if (!answer) {
          return CANCELLED;
        }
        updateAdmin({
          studios: null,
          bookings: null,
          transactions: null,
          revenue: null,
          operations: null,
          sessions: {},
          openStudios: without(adminState().openStudios, id),
        });
        await reloadMaster();
        setToast({ message: `Studio "${studio.name}" dihapus.` + adminModels().studios.cancelledSummary(answer) });
      });
    },

    // ---------- admin: panel Detail Sesi ----------
    // sesi bulan yang tampil, sekali per studio|bulan; galat akses lewat AdminController (401 keluar, 403 Akses ditolak)
    async loadSessions(studioId) {
      const sessionModel = adminModels().sessions;
      const key = sessionModel.sessionsKey(adminState(), studioId, today());
      const flag = "s" + key;
      if (adminState().sessions[key] || adminState().loading[flag]) {
        return;
      }
      updateAdmin({ loading: { ...adminState().loading, [flag]: true } });
      let list;
      try {
        list = await sessionModel.loadSessions(api, studioId, sessionModel.shownMonth(adminState(), studioId, today()));
      } catch (error) {
        updateAdmin({ loading: { ...adminState().loading, [flag]: false } });
        if (adminCore.handleAccessError(error)) {
          return;
        }
        setToast({ error: error.message });
        list = [];
      }
      updateAdmin(
        { sessions: { ...adminState().sessions, [key]: list }, loading: { ...adminState().loading, [flag]: false } },
        { silent: false },
      );
    },

    // panah bulan (tanpa batas mundur); hari terpilih ikut pindah bulan; form sesi ditutup
    moveSessionMonth({ studio, step }) {
      const sessionModel = adminModels().sessions;
      const month = sessionModel.shiftMonth(sessionModel.shownMonth(adminState(), studio, today()), step);
      updateAdmin(
        {
          sessionMonths: { ...adminState().sessionMonths, [studio]: month },
          sessionDays: { ...adminState().sessionDays, [studio]: sessionModel.dayForMonth(month, today()) },
          editingSession: null,
          addingSessionFor: null,
        },
        { silent: false },
      );
    },

    pickSessionDay({ studio, date }) {
      updateAdmin(
        { sessionDays: { ...adminState().sessionDays, [studio]: date }, editingSession: null, addingSessionFor: null },
        { silent: false },
      );
    },

    // chip jam: buka/tutup form ubah sesi itu
    toggleSession({ id }) {
      updateAdmin(
        { editingSession: adminState().editingSession == id ? null : Number(id), addingSessionFor: null },
        { silent: false },
      );
    },

    // chip TAMBAH: buka/tutup form tambah sesi studio itu
    toggleAddSession({ studio }) {
      updateAdmin(
        { addingSessionFor: adminState().addingSessionFor == studio ? null : Number(studio), editingSession: null },
        { silent: false },
      );
    },

    closeSessionForm() {
      updateAdmin({ editingSession: null, addingSessionFor: null }, { silent: false });
    },

    // tambah sesi (berulang n hari; tanggal yang bertabrakan dilewati server). Galat (mis. bertabrakan) → toast, form tetap dengan isiannya
    addSession({ studio }, values) {
      const key = "session-new-" + studio;
      return adminCore.run(
        async () => {
          const answer = await adminModels().sessions.addSessions(api, studio, adminModels().sessions.addBody(values));
          updateAdmin({
            addingSessionFor: null,
            drafts: without(adminState().drafts, key),
            sessionDays: { ...adminState().sessionDays, [studio]: values.date },
            sessionMonths: { ...adminState().sessionMonths, [studio]: values.date.slice(0, 7) },
          });
          await refreshSessions(studio);
          let message =
            answer.created.length > 1
              ? `${answer.created.length} sesi berhasil ditambahkan.`
              : "Sesi berhasil ditambahkan.";
          if (answer.skipped.length) {
            message += ` ${answer.skipped.length} tanggal dilewati karena bertabrakan: ${answer.skipped.join(", ")}.`;
          }
          setToast({ message });
        },
        "",
        undefined,
        { draft: { key, values } },
      );
    },

    // ubah jam sesi: tanpa dialog awal (server memvalidasi jam dulu); dialog hanya bila server meminta konfirmasi. Dibatalkan → isian tetap
    saveSession({ studio, id }, values) {
      const session = findSession(studio, id);
      if (!session) {
        return Promise.resolve(false);
      }
      const key = "session-" + id;
      return adminCore.run(
        async () => {
          const answer = await adminModels().confirmable.withConfirm(
            confirmed =>
              adminModels().sessions.updateSession(api, id, adminModels().sessions.changeBody(values), confirmed),
            {
              ui,
              title: `Ubah sesi ${session.start} - ${session.end}?`,
              okLabel: "Ya, Ubah Sesi",
              describeImpact: sessionChangeBody,
              known: session.impact,
              askFirst: false,
            },
          );
          if (!answer) {
            updateAdmin({ drafts: { ...adminState().drafts, [key]: values } });
            return CANCELLED;
          }
          updateAdmin({
            editingSession: null,
            drafts: without(adminState().drafts, key),
            sessionDays: { ...adminState().sessionDays, [studio]: answer.date },
            sessionMonths: { ...adminState().sessionMonths, [studio]: answer.date.slice(0, 7) },
          });
          await refreshSessions(studio);
          setToast({
            message:
              "Sesi berhasil diperbarui." +
              (answer.notified
                ? ` Pelanggan dari ${answer.notified} booking terdampak sudah diberi tahu lewat email.`
                : ""),
          });
        },
        "",
        undefined,
        { draft: { key, values } },
      );
    },

    deleteSession({ studio, id }) {
      const session = findSession(studio, id);
      if (!session) {
        return Promise.resolve(false);
      }
      return adminCore.run(async () => {
        const answer = await adminModels().confirmable.withConfirm(
          confirmed => adminModels().sessions.deleteSession(api, id, confirmed),
          {
            ui,
            title: `Hapus sesi ${session.date} ${session.start} - ${session.end}?`,
            okLabel: "Ya, Hapus Sesi",
            describeImpact: sessionImpactBody,
            known: session.impact,
          },
        );
        if (!answer) {
          return CANCELLED;
        }
        updateAdmin({ editingSession: null });
        await refreshSessions(studio);
        setToast({ message: "Sesi dihapus." + adminModels().studios.cancelledSummary(answer) });
      });
    },
  };
  return controller;
}
