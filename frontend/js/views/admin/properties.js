// Daftar Properti admin (/admin/props): foto, nama, kategori, qty per baris, lalu tombol + Tambah properti. View murni (dulu pthumb, propRow, V.aprop di admin.js).
// Baris tampil hanya-baca dengan Ubah dan Hapus; hanya baris admin.editing ("property-<id|new>") yang menjadi form dengan Simpan/Tambah dan Batal
// (dev/admin-edit-mode-plan.md). Form baris memakai <form> sendiri (input terikat lewat atribut form=, form tidak boleh membungkus <tr>); foto diunggah lewat
// data-change="admin:uploadPropertyImage". Gambar baru di admin.images["property-<id|new>"], isian yang gagal/sedang diisi di admin.drafts.
import { html } from "../../core/html.js";
import { CATEGORIES } from "../../models/admin/properties.js";
import { matchesQuery } from "../../models/admin/search.js";
import { backgroundImage } from "../../components/propertyVisual.js";
import { icon } from "../../components/icon.js";
import { loadingCard, selectField } from "../../components/adminWidgets.js";

// baris hanya-baca: foto, nama, kategori, qty (tag Habis bila 0), Ubah dan Hapus
function propertyView(property) {
  const image = property.img;
  return html`<tr>
    <td>
      <span class="pthumb ro" style="${image ? backgroundImage(image) : ""}" role="img" aria-label="Foto ${property.name}"
        >${image ? "" : icon("images", 20)}</span
      >
    </td>
    <td>${property.name}</td>
    <td>${property.category}</td>
    <td>${property.qty}${Number(property.qty) === 0 ? html` <span class="tag no">Habis</span>` : ""}</td>
    <td style="white-space:nowrap">
      <button class="btn sm ghost" type="button" data-action="admin:startEdit" data-key="property-${property.id}" aria-label="Ubah ${property.name}">
        Ubah</button
      > <button class="btn sm ghost" type="button" data-action="admin:deleteProperty" data-id="${property.id}">Hapus</button>
    </td>
  </tr>`;
}

// baris form (record yang diubah, atau baris tambah bila property kosong)
function propertyForm(property, admin) {
  const key = property.id || "new";
  const formId = "property-form-" + key;
  const values = admin.drafts["property-" + key] || property;
  const image = admin.images["property-" + key] || property.img;
  const submit = property.id
    ? html`<form id="${formId}" novalidate data-submit="admin:saveProperty" data-id="${property.id}"></form>`
    : html`<form id="${formId}" novalidate data-submit="admin:addProperty"></form>`;
  return html`<tr>
    <td>
      <label class="pthumb" style="${image ? backgroundImage(image) : ""}"
        >${image ? "" : icon("upload", 20)}<input
          type="file"
          accept="image/*"
          hidden
          form="${formId}"
          data-change="admin:uploadPropertyImage"
          data-key="${key}"
          aria-label="Foto ${values.name || "properti baru"}"
      /></label>
    </td>
    <td>
      <input
        form="${formId}"
        name="name"
        data-edit-focus
        value="${values.name || ""}"
        placeholder="Nama properti"
        aria-label="Nama properti"
      />
    </td>
    <td>
      ${selectField({ id: `pr${key}c`, name: "category", options: CATEGORIES.map(category => [category, category]), current: values.category || "Topi", attributes: html`form="${formId}" aria-label="Kategori"` })}
    </td>
    <td>
      <input
        form="${formId}"
        name="qty"
        type="number"
        min="0"
        value="${values.qty ?? 1}"
        style="width:80px"
        aria-label="Qty"
      />
    </td>
    <td style="white-space:nowrap">
      ${submit}<button class="btn sm" type="submit" form="${formId}">${property.id ? "Simpan" : "Tambah"}</button
      > <button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal</button>
    </td>
  </tr>`;
}

export function propertiesView(state) {
  const admin = state.admin;
  if (!admin.properties) {
    return loadingCard();
  }
  const rows = admin.properties
    .filter(property => matchesQuery(admin.query, property.name, property.category))
    .map(property =>
      admin.editing == "property-" + property.id ? propertyForm(property, admin) : propertyView(property),
    );
  const adding = admin.editing == "property-new";
  return html`<div class="card">
    <div class="tbl">
      <table>
        <tr>
          <th>Foto</th>
          <th>Nama</th>
          <th>Kategori</th>
          <th>Qty</th>
          <th></th>
        </tr>
        ${rows}${adding ? propertyForm({}, admin) : ""}
      </table>
    </div>
    ${adding
      ? ""
      : html`<button class="btn sm" type="button" style="margin-top:12px" data-action="admin:startEdit" data-key="property-new">
          ${icon("plus", 16)} Tambah properti
        </button>`}
    <p class="sm m" style="margin-top:8px">
      Qty 0 = properti ditampilkan "Habis" di halaman studio. Kategori "Background" menjadi background, selain itu
      aksesori.
    </p>
  </div>`;
}
