// Pindah halaman dari aplikasi (data-route dan router.navigate milik controller): toast dan cache slot dibersihkan,
// state disimpan, gulir ke atas, lalu router.navigate(path). Back/forward tidak lewat sini (router onChange di main.js).
// scrollToTop diberikan main.js (window.scrollTo), jadi modul ini tidak menyentuh window.
export function createNavigator({ store, router, scrollToTop }) {
  return {
    navigate(path) {
      store.update("runtime", { toast: { message: "", error: "" }, availability: {} }, { silent: true });
      store.persist();
      scrollToTop();
      router.navigate(path);
    },
  };
}
