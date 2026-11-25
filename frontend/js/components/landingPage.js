// Adaptor DOM landing page untuk LandingController (decisions.md 60): gulir ke bagian, menu mobile, posisi bagian dan listener scroll.
// Tidak menyentuh document/window saat diimpor; main.js memberikan keduanya.
import { SPY_SECTIONS } from "../views/landing.js";

export function createLandingPage({ document, window }) {
  const menu = () => document.getElementById("lmenu");
  return {
    scrollToSection(id) {
      const section = document.getElementById(id);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    toggleMenu() {
      const element = menu();
      if (element) {
        element.hidden = !element.hidden;
      }
    },
    closeMenu() {
      const element = menu();
      if (element) {
        element.hidden = true;
      }
    },
    measure() {
      const tops = {};
      for (const id of SPY_SECTIONS) {
        const section = document.getElementById(id);
        if (section) {
          tops[id] = section.getBoundingClientRect().top;
        }
      }
      return {
        tops,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
      };
    },
    markSection(id, scrolled) {
      document.querySelectorAll("[data-s]").forEach(button => button.classList.toggle("on", button.dataset.s === id));
      const navbar = document.querySelector(".lnav");
      if (navbar) {
        navbar.classList.toggle("sc", scrolled);
      }
    },
    listenScroll(handler) {
      window.addEventListener("scroll", handler);
      return () => window.removeEventListener("scroll", handler);
    },
  };
}
