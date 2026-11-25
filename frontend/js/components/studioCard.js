// Kartu studio di Browse (dulu studioCard() di customer.js): kartu membuka Detail Studio, bintang = bookmark, chip = langsung ke Pilih Waktu.
import { html } from "../core/html.js";
import { slotLabel } from "../core/format.js";
import { capacityLabel, priceRange } from "../models/master.js";
import { icon, iconFilled } from "./icon.js";
import { backgroundImage } from "./propertyVisual.js";

// options = { master, date (YYYY-MM-DD), hours (jam kosong yang ditampilkan, maks. tiga), bookmarked }
export function studioCard(studio, { master, date, hours, bookmarked }) {
  const chips = hours.map(
    hour =>
      html`<button
        class="chip"
        data-action="booking:quickBook"
        data-studio="${studio.id}"
        data-date="${date}"
        data-hour="${hour}"
      >
        ${slotLabel(hour)}
      </button>`,
  );
  return html`<article class="scard">
    <div class="box" data-route="/studios/${studio.id}">
      <div class="simg" style="${backgroundImage(studio.img)}"></div>
      <div class="sbody">
        <div class="row sp" style="flex-wrap:nowrap">
          <h3>${studio.name}</h3>
          <button
            class="star ${bookmarked ? "on" : ""}"
            aria-label="Favorit"
            data-action="studio:toggleBookmark"
            data-id="${studio.id}"
            data-stop
          >
            ${iconFilled("star", 20)}
          </button>
        </div>
        <p class="desc">${studio.description}</p>
        <div class="meta">
          <span>${icon("users", 14)} ${capacityLabel(master, studio)}</span
          ><span>${icon("tag", 14)} ${priceRange(master, studio)}</span>
        </div>
      </div>
    </div>
    <div class="chips">${chips.length ? chips : html`<span class="chip none">Tidak ada sesi tersedia</span>`}</div>
  </article>`;
}
