// Daftar Properti admin (/admin/props): foto, nama, kategori, qty per baris, lalu baris tambah. View murni (dulu pthumb, propRow, V.aprop di admin.js).
// Setiap baris punya <form> sendiri (input terikat lewat atribut form=, form tidak boleh membungkus <tr>); foto diunggah lewat
// data-change="admin:uploadPropertyImage". Gambar baru di admin.images["property-<id|new>"], isian yang gagal/sedang diisi di admin.drafts.
import { html } from "../../core/html.js";
import { CATEGORIES } from "../../models/admin/properties.js";
import { matchesQuery } from "../../models/admin/search.js";
import { backgroundImage } from "../../components/propertyVisual.js";
import { icon } from "../../components/icon.js";
import { loadingCard, selectField } from "../../components/adminWidgets.js";

function propertyRow(property, admin) {
  const key = property.id || "new";
  const formId = "property-form-" + key;
  const values = admin.drafts["property-" + key] || property;
  const image = admin.images["property-" + key] || property.img;
  const submit = property.id ? html`<form id="${formId}" novalidate data-submit="admin:saveProperty" data-id="${property.id}"></form>` : html`<form id="${formId}" novalidate data-submit="admin:addProperty"></form>`;
  const remove = property.id ? html` <button class="btn sm ghost" type="button" data-action="admin:deleteProperty" data-id="${property.id}">Hapus</button>` : "";
  return html`<tr><td><label class="pthumb" style="${image ? backgroundImage(image) : ""}">${image ? "" : icon("upload", 20)}<input type="file" accept="image/*" hidden form="${formId}" data-change="admin:uploadPropertyImage" data-key="${key}" aria-label="Foto ${values.name || "properti baru"}"></label></td><td><input form="${formId}" name="name" value="${values.name || ""}" placeholder="Nama properti" aria-label="Nama properti"></td><td>${selectField({ id: `pr${key}c`, name: "category", options: CATEGORIES.map(category => [category, category]), current: values.category || "Topi", attributes: html`form="${formId}" aria-label="Kategori"` })}</td><td><input form="${formId}" name="qty" type="number" min="0" value="${values.qty ?? 1}" style="width:80px" aria-label="Qty"></td>
<td style="white-space:nowrap">${submit}<button class="btn sm" type="submit" form="${formId}">${property.id ? "Simpan" : "+ Tambah"}</button>${remove}</td></tr>`;
}

export function propertiesView(state) {
  const admin = state.admin;
  if (!admin.properties) {
    return loadingCard();
  }
  const rows = admin.properties.filter(property => matchesQuery(admin.query, property.name, property.category)).map(property => propertyRow(property, admin));
  return html`<div class="card"><div class="tbl"><table><tr><th>Foto</th><th>Nama</th><th>Kategori</th><th>Qty</th><th></th></tr>${rows}${propertyRow({}, admin)}</table></div><p class="sm m" style="margin-top:8px">Qty 0 = properti ditampilkan "Habis" di halaman studio. Kategori "Background" menjadi background, selain itu aksesori.</p></div>`;
}
