// LandingController: landing page (/) — gulir ke bagian, menu mobile, scroll-spy dan form Contact Us
// (dulu toSec, lpMenu, lpSpy, V.landing_after, sendContact dan openAuth di legacy/landing.js; fitur teman sekelompok, perilaku dipertahankan).
// page = adaptor DOM dari main.js (decisions.md 60): scrollToSection(id), toggleMenu(), closeMenu(), measure() → { tops, innerHeight, scrollY, scrollHeight },
//        markSection(id, scrolled), listenScroll(handler) → fungsi pelepas. timers = { setTimeout }.
import { currentSection } from "../views/landing.js";

export function createLandingController({ api, store, router, models, page, timers }) {
  const state = () => store.get();
  let stopListening = null;

  function contact() {
    return state().runtime.contact;
  }

  function setContact(patch, options) {
    store.update("runtime", { contact: { ...contact(), ...patch } }, options);
  }

  // sorot menu sesuai bagian yang sedang dilihat; navbar diberi bayangan setelah digulir
  function spy() {
    const position = page.measure();
    page.markSection(currentSection(position), position.scrollY > 8);
  }

  const controller = {
    scrollTo({ section }) {
      page.closeMenu();
      page.scrollToSection(section);
    },

    toggleMenu() {
      page.toggleMenu();
    },

    // kait after() rute /: dipanggil setiap render landing, jadi listener lama dilepas dulu (tidak menumpuk)
    startScrollSpy() {
      controller.stopScrollSpy();
      stopListening = page.listenScroll(spy);
      spy();
    },

    // kait leave() rute / (dulu window.onscroll = null di render())
    stopScrollSpy() {
      if (stopListening) {
        stopListening();
        stopListening = null;
      }
    },

    // data-input="landing:setContactField" data-field="n|e|m": isian disimpan tanpa render ulang
    setContactField({ field }, event) {
      setContact({ [field]: event.target.value }, { silent: true });
    },

    async sendContact() {
      const typed = contact();
      if (typed.busy) {
        return;
      }
      setContact({ ok: "", err: "", busy: true });
      try {
        const answer = await models.contact.sendMessage(api, { name: typed.n, email: typed.e, message: typed.m });
        setContact({ ok: answer.message, n: "", e: "", m: "" }, { silent: true });
      } catch (error) {
        setContact({ err: error.message }, { silent: true });
      }
      setContact({ busy: false });
      timers.setTimeout(() => controller.scrollTo({ section: "kontak" }), 30);
    },

    // Masuk / Join Sekarang dari landing: draf booking tamu yang lama tidak dilanjutkan (decisions.md 59)
    openAuth({ mode }) {
      store.update("persisted", { draft: null }, { silent: true });
      router.navigate(mode === "register" ? "/register" : "/login");
    },
  };
  return controller;
}
