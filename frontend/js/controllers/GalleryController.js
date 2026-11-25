// GalleryController: Galeri (/gallery) dan tombol hapus di strip layar Sesi Foto — pilih sesi, pilih foto untuk dicetak, favorit, hapus (satu / massal),
// konfirmasi pilihan, unduh (dulu selPh, fav, delPhoto, toggleDel, togDel, selAllNonFav, bulkDel, confirmSel, dl di legacy/session.js;
// fitur teman sekelompok, perilaku dipertahankan kecuali yang dicatat di Progress fase 7).
// Foto di slice data diubah di tempat seperti kode lama. drive: { fetch } (hapus berkas Drive), files: { download(url, nama) },
// photoSession: PhotoSessionController (strip layar sesi), refreshData: BookingController.refreshData.
import { gallerySessionOf, deletePhotoModal, deleteSelectedModal, deleteFailedModal } from "../views/session/gallery.js";

export function createGalleryController({ api, store, ui, models, drive, files, photoSession, refreshData }) {
  const gallery = models.gallery;
  const state = () => store.get();
  const photo = () => state().photo;
  const render = () => store.update("runtime", {});

  function setToast(toast, options) {
    store.update("runtime", { toast: { message: "", error: "", ...toast } }, options);
  }

  const sessionById = id => state().data.sessions.find(session => session.id == id);
  const photoOf = (sessionId, photoId) => sessionById(sessionId).photos.find(item => item.id == photoId);

  // mode hapus: tandai / lepas foto untuk dihapus; foto favorit tidak bisa dihapus massal
  function toggleForDelete(sessionId, photoId) {
    const item = photoOf(sessionId, photoId);
    if (item.fav) {
      return setToast({ message: "Foto favorit tidak dapat dihapus massal. Hilangkan bintangnya dulu bila ingin menghapusnya." });
    }
    const selection = photo().deleteSelection;
    if (selection.has(item.id)) {
      selection.delete(item.id);
    } else {
      selection.add(item.id);
    }
    setToast({ message: "", error: state().runtime.toast.error });
  }

  return {
    // kait after() rute /gallery: sesi yang tampil dicatat sebagai pilihan (seperti V.gallery lama)
    enter() {
      const session = gallerySessionOf(state());
      if (session) {
        photo().gallerySession = session.id;
      }
    },

    // data-change pada pilihan sesi
    showSession(dataset, event) {
      photo().gallerySession = Number(event.target.value);
      photo().deleteSelection = new Set();
      render();
    },

    // klik foto: pilih untuk dicetak (konfirmasi pilihan dibatalkan), atau tandai untuk dihapus di mode hapus
    select({ session: sessionId, photo: photoId }) {
      if (photo().deleteMode) {
        return toggleForDelete(sessionId, photoId);
      }
      const item = photoOf(sessionId, photoId);
      item.sel = !item.sel;
      sessionById(sessionId).confirmed = false;
      render();
      gallery.setSelected(api, item.id, item.sel).catch(error => setToast({ error: error.message }));
    },

    toggleFavourite({ session: sessionId, photo: photoId }) {
      const item = photoOf(sessionId, photoId);
      item.fav = !item.fav;
      if (item.fav) {
        photo().deleteSelection.delete(item.id);
      }
      render();
      gallery.setFavourite(api, item.id, item.fav).catch(() => {});
    },

    // hapus satu foto (Galeri atau strip layar sesi), dengan konfirmasi
    async deletePhoto({ session: sessionId, photo: photoId }) {
      if ((await ui.modal(deletePhotoModal())) !== true) {
        return;
      }
      const session = sessionById(sessionId);
      const item = photoOf(sessionId, photoId);
      try {
        await gallery.remove(api, item.id);
        if (item.driveId && photo().drive.token) {
          models.drive.remove({ fetch: drive.fetch, token: photo().drive.token, driveId: item.driveId });
        }
        session.photos = session.photos.filter(other => other.id != item.id);
        if (item.sel) {
          session.confirmed = false;
        }
      } catch (error) {
        return ui.modal(deleteFailedModal(error.message));
      }
      if (state().runtime.route.name == "session") {
        photoSession.showSession(session.id);
      } else {
        setToast({ message: "Foto dihapus." });
      }
    },

    toggleDeleteMode() {
      photo().deleteMode = !photo().deleteMode;
      photo().deleteSelection = new Set();
      setToast({});
    },

    selectAllNonFavourite({ session: sessionId }) {
      sessionById(sessionId).photos.forEach(item => {
        if (!item.fav) {
          photo().deleteSelection.add(item.id);
        }
      });
      render();
    },

    async deleteSelected() {
      const selection = photo().deleteSelection;
      if (!selection.size || (await ui.modal(deleteSelectedModal(selection.size))) !== true) {
        return;
      }
      setToast({}, { silent: true });
      try {
        const answer = await gallery.removeMany(api, [...selection]);
        photo().deleteSelection = new Set();
        photo().deleteMode = false;
        await refreshData();
        setToast({ message: `${answer.deleted} foto dihapus${answer.skipped_favorites ? `, ${answer.skipped_favorites} foto favorit dilewati` : ""}.` }, { silent: true });
      } catch (error) {
        setToast({ error: error.message }, { silent: true });
      }
      render();
    },

    async confirmSelection({ session: sessionId }) {
      try {
        await gallery.confirmSelection(api, Number(sessionId));
        sessionById(sessionId).confirmed = true;
        setToast({ message: "Pilihan dikonfirmasi." }, { silent: true });
      } catch (error) {
        setToast({ error: error.message }, { silent: true });
      }
      render();
    },

    // Unduh Foto Terpilih: satu unduhan per foto yang dipilih untuk dicetak
    download({ session: sessionId }) {
      sessionById(sessionId).photos.filter(item => item.sel).forEach(item => files.download(gallery.downloadUrl(api, item.id), "snapia-" + item.id + ".jpg"));
    },
  };
}
