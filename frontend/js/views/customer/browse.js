// Halaman Browse (/browse): Filter Jadwal (tanggal dan jam), daftar studio dengan jam kosong, strip paket. View murni (dulu V.home).
import { html } from "../../core/html.js";
import { SESSION_HOURS, isoDate, padTwo } from "../../core/format.js";
import { filterDate, freeHours } from "../../models/studio.js";
import { calendar } from "../../components/calendar.js";
import { icon } from "../../components/icon.js";
import { studioCard } from "../../components/studioCard.js";
import { packageStrip } from "../../components/packageCards.js";

const DEFAULT_FROM = 8;
const DEFAULT_TO = 20;
const CHIPS_PER_CARD = 3;

function hourOptions(selected) {
  return SESSION_HOURS.map(
    hour => html`<option value="${hour}" ${hour == selected ? "selected" : ""}>${padTwo(hour)}:00</option>`,
  );
}

// bulan yang ditampilkan kalender Filter Jadwal: runtime.calendar.home, bawaan bulan sekarang
function shownMonth(runtime, now) {
  return runtime.calendar.home || { year: now.getFullYear(), month: now.getMonth() };
}

export function browseView(state, match, now = new Date()) {
  const { persisted, master, runtime } = state;
  const today = isoDate(now);
  const date = filterDate(persisted.hDate, today);
  const from = persisted.hFrom ?? DEFAULT_FROM;
  const to = persisted.hTo ?? DEFAULT_TO;
  const bookmarks = persisted.bm || [];
  const cards = master.studios.map(studio => {
    const hours = freeHours(runtime.availability, studio.id, date, now)
      .filter(hour => hour >= from && hour <= to)
      .slice(0, CHIPS_PER_CARD);
    return studioCard(studio, { master, date, hours, bookmarked: bookmarks.includes(studio.id) });
  });
  return html`<div class="home">
    <aside class="filter card soft">
      <h3 class="h3">Filter Jadwal</h3>
      <p class="sub" style="margin-bottom:12px">Pilih waktu yang sesuai, kami tampilkan studio yang tersedia.</p>
      ${calendar({ context: "home", selected: date, month: shownMonth(runtime, now), today })}
      <div class="trange">
        <div>
          <label>Dari jam</label
          ><select data-change="studio:setHourFrom">
            ${hourOptions(from)}
          </select>
        </div>
        <div>
          <label>Sampai jam</label
          ><select data-change="studio:setHourTo">
            ${hourOptions(to)}
          </select>
        </div>
      </div>
    </aside>
    <section style="min-width:0">
      <h1 class="h1">Browse</h1>
      <p class="sub">Temukan studio yang cocok sama selera kamu.</p>
      <div class="grid3">${cards}</div>
      <div class="row sp" style="margin-top:36px">
        <h2 class="h2">Paket</h2>
        <button class="btn sm ghost" data-route="/packages">Lihat semua paket ${icon("right", 16)}</button>
      </div>
      <p class="sub">Pilih paket saat memesan — harga sudah termasuk diskon yang berlaku.</p>
      <div class="pk-grid">${packageStrip(master, persisted.pkg)}</div>
    </section>
  </div>`;
}
