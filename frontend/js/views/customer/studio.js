// Detail Studio (/studios/:id): kartu studio, Book Now, properti per kategori; kartu "Studio tidak tersedia". View murni (dulu V.studio dan noStudio()).
import { html } from "../../core/html.js";
import { capacityLabel, isStudioShown, priceRange, studioOf } from "../../models/master.js";
import { icon, iconFilled } from "../../components/icon.js";
import { backgroundImage, propertyVisual } from "../../components/propertyVisual.js";

const ALL_CATEGORIES = "Semua";
const OTHER_CATEGORY = "Lainnya";

const categoryOf = property => property.category || OTHER_CATEGORY;

// studio yang disembunyikan/dihapus tidak bisa dipesan; saat reschedule tombolnya kembali ke detail booking
export function studioUnavailable({ rescheduleId = null } = {}) {
  const back = rescheduleId
    ? html`<button class="btn" data-route="/bookings/${rescheduleId}">Kembali ke booking</button>`
    : html`<button class="btn" data-route="/browse">Cari studio lain</button>`;
  return html`<div class="panel">
    <div class="card center">
      <h1 class="h1">Studio tidak tersedia</h1>
      <p class="sub">Studio ini sedang tidak dapat dipesan.</p>
      <div style="margin-top:12px">${back}</div>
    </div>
  </div>`;
}

function propertyCard(property) {
  const soldOut = property.qty <= 0;
  return html`<div class="prop ${soldOut ? "off" : ""}">
    ${propertyVisual(property)}
    <div class="pinfo"><b>${property.name}</b><small>${soldOut ? "Habis" : "Qty. " + property.qty}</small></div>
  </div>`;
}

function propertySection(master, selected) {
  const categories = [ALL_CATEGORIES, ...new Set(master.properties.map(categoryOf))];
  const shown = master.properties.filter(property => selected === ALL_CATEGORIES || categoryOf(property) === selected);
  const tabs = categories.map(
    category =>
      html`<button
        class="tabx ${category === selected ? "on" : ""}"
        data-action="studio:setPropertyCategory"
        data-category="${category}"
      >
        ${category}
      </button>`,
  );
  return html`<div>
    <h2 class="h2">Properti</h2>
    <p class="sub">Background dan aksesori yang tersedia di studio ini.</p>
    <div class="tabsx">${tabs}</div>
    <div class="props">${shown.length ? shown.map(propertyCard) : html`<p class="m">Belum ada properti.</p>`}</div>
  </div>`;
}

export function studioView(state, match) {
  const { persisted, master } = state;
  if (!isStudioShown(master, match.params.id)) {
    return studioUnavailable();
  }
  const studio = studioOf(master, match.params.id);
  const bookmarked = (persisted.bm || []).includes(studio.id);
  return html`<button class="back" data-route="/browse">${icon("left", 16)} Kembali</button>
    <div class="sdet">
      <div class="left stack">
        <div class="bigcard">
          <div class="simg" style="${backgroundImage(studio.img)}"></div>
          <div class="sbody">
            <div class="row sp" style="flex-wrap:nowrap">
              <h1 class="h2">${studio.name}</h1>
              <button
                class="star ${bookmarked ? "on" : ""}"
                aria-label="Favorit"
                data-action="studio:toggleBookmark"
                data-id="${studio.id}"
              >
                ${iconFilled("star", 20)}
              </button>
            </div>
            <p class="desc" style="-webkit-line-clamp:6">${studio.description}</p>
            <div class="row" style="margin-top:6px;color:var(--muted-2);font-size:12px">
              ${icon("pin", 14)} ${studio.address || "-"}
            </div>
            <div class="row sp" style="margin-top:12px">
              <button class="btn" data-action="booking:start" data-id="${studio.id}">Book Now</button>
              <div class="meta" style="margin:0">
                <span>${icon("users", 14)} ${capacityLabel(master, studio)}</span
                ><span>${icon("tag", 14)} ${priceRange(master, studio)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${propertySection(master, persisted.pCat || ALL_CATEGORIES)}
    </div>`;
}
