// Render (decisions.md 9 dan 39): shell (navbar + bilah bawah customer, sidebar admin, pembungkus form masuk, atau tanpa shell untuk landing)
// dipasang sekali per rute; perubahan store hanya merender ulang isi <main id="outlet">. Shell dipasang ulang bila path atau isinya berubah
// (judul, tab, nama user, Mode Staf, login), jadi fokus di elemen shell tidak hilang saat outlet dirender ulang.
// Modul ini tidak menyentuh window/document saat diimpor; elemen akar dan document diberikan main.js.
import { html } from "./html.js";
import { navbar, bottomBar } from "../components/navbar.js";
import { adminSidebar } from "../components/adminSidebar.js";
import { renderToasts } from "../components/toast.js";

// nama rute + session = { admin } → "landing" | "auth" | "admin" | "customer" (aturan render() lama)
export function layoutOf(routeName, session) {
  if (routeName === "landing") {
    return "landing";
  }
  if (routeName === "auth") {
    return "auth";
  }
  return session.admin ? "admin" : "customer";
}

// options = { layout, route (entri tabel rute), session = { user, staff } }; setiap shell memuat tepat satu #outlet
export function shellMarkup({ layout, route, session }) {
  if (layout === "landing") {
    return html`<div id="outlet"></div>`;
  }
  if (layout === "auth") {
    return html`<main id="outlet" class="authwrap"></main>`;
  }
  if (layout === "admin") {
    return html`<div class="adm">${adminSidebar(route)}<main id="outlet" class="amain"></main></div>`;
  }
  return html`${navbar(route, session)}
<main id="outlet" class="page"></main>
${bottomBar(route, session)}`;
}

// isi outlet: landing dan form masuk apa adanya (form masuk menampilkan toast-nya sendiri); customer = toast + isi; admin = header + toast + isi
export function composeOutlet({ layout, content, toast = {}, header = "" }) {
  if (layout === "landing" || layout === "auth") {
    return content;
  }
  if (layout === "admin") {
    return html`${header}${renderToasts(toast)}${content}`;
  }
  return html`${renderToasts(toast)}${content}`;
}

// root = elemen #app; resolve() = rute aktif setelah guard ({ route, path, params, query });
// before(match) = persiapan sebelum render; shell(match) dan outlet(match) = Safe; after(match) = setelah outlet terisi (lalu route.after)
export function createRenderer({ root, resolve, shell, outlet, before = () => {}, after = () => {} }) {
  let mounted = null;
  let outletElement = null;

  function mountShell(match, markup = String(shell(match))) {
    root.innerHTML = markup;
    outletElement = root.querySelector("#outlet");
    mounted = { path: match.path, markup };
  }

  function fillOutlet(match) {
    outletElement.innerHTML = String(outlet(match));
    after(match);
    if (match.route && typeof match.route.after === "function") {
      match.route.after(match);
    }
  }

  // render ulang outlet saja (shell dianggap tidak berubah); memasang shell hanya bila belum ada
  function renderOutlet() {
    const match = resolve();
    before(match);
    if (!outletElement) {
      mountShell(match);
    }
    fillOutlet(match);
  }

  function render() {
    const match = resolve();
    before(match);
    const markup = String(shell(match));
    if (!mounted || !outletElement || mounted.path !== match.path || mounted.markup !== markup) {
      mountShell(match, markup);
    }
    fillOutlet(match);
  }

  // setiap perubahan store (update/set tanpa silent) merender ulang
  function start(store) {
    return store.subscribe(() => render());
  }

  return { render, renderOutlet, mountShell, start };
}

const MENU_BUTTON = '[data-action="ui:toggleMenu"]';

// menu akun di navbar: data-action="ui:toggleMenu" membuka/menutup; klik di mana pun selain tombol avatar menutupnya
export function installShellActions({ registerActions, document }) {
  function setOpen(menu, open) {
    menu.hidden = !open;
    const button = document.querySelector(MENU_BUTTON);
    if (button) {
      button.setAttribute("aria-expanded", String(open));
    }
  }
  registerActions({
    "ui:toggleMenu": () => {
      const menu = document.querySelector("#menu");
      if (menu) {
        setOpen(menu, menu.hidden);
      }
    },
  });
  document.addEventListener("click", event => {
    const target = event.target;
    if (target && typeof target.closest === "function" && target.closest(MENU_BUTTON)) {
      return;
    }
    const menu = document.querySelector("#menu");
    if (menu && !menu.hidden) {
      setOpen(menu, false);
    }
  });
}
