// Daftar Studio admin (/admin/studios): accordion per studio dengan form Detail Studio + panel Detail Sesi, lalu Tambah studio:
// form Detail Studio Baru dengan galat isian (Figma 592:5056, 592:5140) → Ringkasan Studio (592:4329) → kartu Berhasil (592:4689).
// View murni (dulu studioForm, V.astudio, stDone, stSummary di admin.js). Form dikirim lewat data-submit (StudioController.edit / review);
// isian form ubah yang gagal disimpan di admin.drafts["studio-<id>"], isian Tambah Studio di admin.newStudio.
import { html } from "../../core/html.js";
import { formatRupiah, isoDate } from "../../core/format.js";
import { matchesQuery } from "../../models/admin/search.js";
import { backgroundImage } from "../../components/propertyVisual.js";
import { icon } from "../../components/icon.js";
import { loadingCard, selectField } from "../../components/adminWidgets.js";
import { sessionPanel } from "./sessions.js";

// status tidak diisi admin: server menurunkannya dari slot kosong 14 hari ke depan (status + free_slots di baris daftar)
const STATUS_RULE = "Status dihitung otomatis: Tersedia bila masih ada slot kosong dalam 14 hari ke depan.";
const isAvailable = studio => studio.status != "UNAVAILABLE";

const fieldError = (errors, field) =>
  errors && errors[field] ? html`<p class="ferr" id="ste_${field}">${errors[field]}</p>` : "";
const invalidAttributes = (errors, field) =>
  errors && errors[field] ? html` aria-invalid="true" aria-describedby="ste_${field}"` : "";
const invalidClass = (errors, field) => (errors && errors[field] ? "inv" : "");

function errorBanner(errors) {
  if (!errors) {
    return "";
  }
  return html`<div class="ferr-top" role="alert">
    ${icon("alert", 18)}<span>${errors.top}${errors.other ? ` (${errors.other})` : ""}</span>
  </div>`;
}

// studio = baris daftar (null untuk studio baru); values = isian yang tampil; image = gambar yang tampil; errors hanya untuk studio baru
function studioForm({ studio, values, image, errors, master }) {
  const id = studio ? studio.id : "N";
  const imageKey = studio ? studio.id : "new";
  const isNew = !studio;
  const capacity = master.peopleRanges.map(range => [range.id, range.range + " orang"]);
  const budgets = master.budgetRanges.map(range => [range.id, range.budget]);
  const intro = isNew
    ? html`<p class="sm m" style="margin-bottom:10px">
          Isi data studio. Nama dan gambar wajib diisi, dan nama tidak boleh sama dengan studio lain.
        </p>
        ${errorBanner(errors)}`
    : "";
  const buttons = isNew
    ? html`<button class="btn ghost" type="button" data-action="studio:cancelNew">Batal</button
        ><button class="btn" type="submit">Lihat Ringkasan</button>`
    : html`<button class="btn" type="submit">Simpan</button>`;
  const note = isNew
    ? ""
    : html`<p class="sm m" style="margin-top:8px">
        ${studio.active_bookings} booking aktif dari ${studio.bookings} booking (tanpa yang batal) · ${STATUS_RULE}
        Studio tanpa slot kosong disembunyikan dari customer.
      </p>`;
  const submit = isNew ? html`data-submit="studio:review"` : html`data-submit="studio:edit" data-id="${studio.id}"`;
  return html`<form class="spanel" novalidate ${submit}>
    <h4>${isNew ? "Detail Studio Baru" : "Detail Studio"}</h4>
    ${intro}
    <div class="sgrid">
      <div>
        <label for="st${id}n">Nama</label
        ><input
          id="st${id}n"
          name="name"
          class="${invalidClass(errors, "name")}"
          placeholder="Contoh: Studio Kreatif"
          value="${values.name || ""}"
          ${invalidAttributes(errors, "name")}
        />${fieldError(errors, "name")}<label for="st${id}d">Deskripsi</label
        ><textarea id="st${id}d" name="description">${values.description || ""}</textarea>
        <div class="row" style="flex-wrap:nowrap">
          <div class="grow">
            <label for="st${id}p">Biaya sewa studio (Rp)</label
            ><input
              id="st${id}p"
              name="price"
              type="number"
              min="0"
              step="1"
              class="${invalidClass(errors, "price")}"
              value="${values.price ?? 0}"
              ${invalidAttributes(errors, "price")}
            />${fieldError(errors, "price")}
          </div>
          <div class="grow">
            <label for="st${id}r">Kapasitas</label
            >${selectField({ id: `st${id}r`, name: "people_range_id", options: capacity, current: values.people_range_id || 1 })}
          </div>
          <div class="grow">
            <label for="st${id}b">Rentang budget</label
            >${selectField({ id: `st${id}b`, name: "budget_range_id", options: budgets, current: values.budget_range_id || 1 })}
          </div>
        </div>
      </div>
      <div>
        <label>Gambar</label>
        <div class="thumb ${invalidClass(errors, "img")}" style="${backgroundImage(image)}">
          ${image ? "" : "Belum ada gambar"}
        </div>
        ${fieldError(errors, "img")}
        <div class="row" style="margin-top:10px">
          <label class="btn sm soft" style="margin:0"
            >${icon("upload", 16)} ${image && isNew ? "Ganti gambar" : "Unggah gambar"}<input
              type="file"
              accept="image/*"
              hidden
              data-change="studio:uploadImage"
              data-studio="${imageKey}"
          /></label>
        </div>
        <div class="row" style="margin-top:18px">${buttons}</div>
        ${note}
      </div>
    </div>
  </form>`;
}

function summaryCard(values, image, master) {
  const capacity = master.peopleRanges.find(range => range.id == values.people_range_id);
  const budget = master.budgetRanges.find(range => range.id == values.budget_range_id);
  const name = String(values.name).trim();
  const row = (term, value) =>
    html`<dt>${term}</dt>
      <dd>${value}</dd>`;
  return html`<div class="body one">
    <div class="spanel">
      <h4>Ringkasan Studio</h4>
      <p class="sm m" style="margin-bottom:12px">
        Periksa data studio baru sebelum disimpan. Pilih Ubah untuk memperbaiki isian.
      </p>
      <div class="sgrid">
        <dl class="sumdl">
          ${row("Nama", name)}${row("Deskripsi", values.description || "-")}${row("Status", "Otomatis dari slot kosong (14 hari ke depan)")}${row("Biaya sewa studio", formatRupiah(values.price))}${row("Kapasitas", capacity ? capacity.range + " orang" : "-")}${row("Rentang budget", budget ? budget.budget : "-")}
        </dl>
        <div><div class="thumb" style="${backgroundImage(image)}" role="img" aria-label="Gambar ${name}"></div></div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:18px">
        <button class="btn ghost" data-action="studio:backToForm">${icon("edit", 16)} Ubah</button
        ><button class="btn" data-action="studio:save">Simpan Studio</button>
      </div>
    </div>
  </div>`;
}

function studioRow(studio, admin, master, today) {
  const open = Boolean(admin.openStudios[studio.id]);
  const free = Number.isInteger(studio.free_slots) ? ` · ${studio.free_slots} slot kosong (14 hari)` : "";
  const meta = formatRupiah(studio.price || 0) + ` · ${studio.sessions} sesi` + free;
  const body = open
    ? html`<div class="body one">
        ${studioForm({ studio, values: admin.drafts["studio-" + studio.id] || studio, image: admin.images[studio.id] || studio.img || "", errors: null, master })}${sessionPanel(admin, studio, today)}
      </div>`
    : "";
  return html`<div class="acc">
    <div class="acc-h">
      <button class="acc-t" data-action="studio:toggleStudio" data-id="${studio.id}" aria-expanded="${String(open)}">
        <span>${studio.name}</span
        ><span class="tag ${isAvailable(studio) ? "ok" : "off"}"
          >${isAvailable(studio) ? "Tersedia" : "Tidak tersedia"}</span
        ><span class="meta">${meta}</span>
      </button>
      <button
        class="ibtn"
        data-route="/admin/studios/${studio.id}/live"
        title="Buka Session Assistant (tablet studio)"
        aria-label="Buka Session Assistant ${studio.name}"
      >
        ${icon("eye", 18)}</button
      ><button
        class="ibtn del"
        data-action="studio:delete"
        data-id="${studio.id}"
        title="Hapus studio"
        aria-label="Hapus ${studio.name}"
      >
        ${icon("trash", 18)}</button
      ><button
        class="ibtn"
        data-action="studio:toggleStudio"
        data-id="${studio.id}"
        aria-label="Buka/tutup detail"
        aria-expanded="${String(open)}"
      >
        ${icon(open ? "up" : "down", 20)}
      </button>
    </div>
    ${body}
  </div>`;
}

function newStudioSection(admin, master) {
  const open = Boolean(admin.openStudios.new);
  const summary = open && admin.studioSummary && admin.newStudio;
  const image = admin.images.new || "";
  let body = "";
  if (summary) {
    body = summaryCard(admin.newStudio, image, master);
  } else if (open) {
    body = html`<div class="body one">
      ${studioForm({ studio: null, values: admin.newStudio || {}, image, errors: admin.studioErrors, master })}
    </div>`;
  }
  return html`<div class="acc">
    <button data-action="studio:openNew" aria-expanded="${String(open)}">
      <span>${icon("plus", 18)} Tambah studio${summary ? " · Ringkasan" : ""}</span
      >${icon(open ? "up" : "down", 20)}</button
    >${body}
  </div>`;
}

// kartu Berhasil: tampil di halaman Studio sampai aksi admin berikutnya
function doneCard(done) {
  return done
    ? html`<div class="toast okc" role="status">
        ${icon("check", 20)}
        <div><b>${done.title}</b><small>${done.text}</small></div>
      </div>`
    : "";
}

export function studiosView(state, match, now = new Date()) {
  const admin = state.admin;
  if (!admin.studios) {
    return loadingCard();
  }
  const today = isoDate(now);
  const rows = admin.studios
    .filter(studio => matchesQuery(admin.query, studio.name, studio.description))
    .map(studio => studioRow(studio, admin, state.master, today));
  return html`${doneCard(admin.studioDone)}${rows} ${newStudioSection(admin, state.master)}`;
}
