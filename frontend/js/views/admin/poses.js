// Daftar Pose admin (/admin/poses): nama/deskripsi pose dan jumlah orang per baris, lalu baris tambah. View murni (dulu poseRow, V.apose di admin.js).
// Setiap baris punya <form> sendiri (atribut form=); isian yang gagal disimpan di admin.drafts["pose-<id|new>"].
import { html } from "../../core/html.js";
import { matchesQuery } from "../../models/admin/search.js";
import { loadingCard, selectField } from "../../components/adminWidgets.js";

function poseRow(pose, admin, peopleRanges) {
  const key = pose.id || "new";
  const formId = "pose-form-" + key;
  const values = admin.drafts["pose-" + key] || pose;
  const submit = pose.id ? html`<form id="${formId}" novalidate data-submit="admin:savePose" data-id="${pose.id}"></form>` : html`<form id="${formId}" novalidate data-submit="admin:addPose"></form>`;
  const remove = pose.id ? html` <button class="btn sm ghost" type="button" data-action="admin:deletePose" data-id="${pose.id}">Hapus</button>` : "";
  const ranges = peopleRanges.map(range => [range.id, range.range + " orang"]);
  return html`<tr><td><input form="${formId}" name="nama" value="${values.nama || ""}" placeholder="Nama / deskripsi pose" aria-label="Pose" style="min-width:260px"></td><td>${selectField({ id: `po${key}r`, name: "people_range_id", options: ranges, current: values.people_range_id || 1, attributes: html`form="${formId}" aria-label="Jumlah orang"` })}</td><td style="white-space:nowrap">${submit}<button class="btn sm" type="submit" form="${formId}">${pose.id ? "Simpan" : "+ Tambah"}</button>${remove}</td></tr>`;
}

export function posesView(state) {
  const admin = state.admin;
  if (!admin.poses) {
    return loadingCard();
  }
  const peopleRanges = state.master.peopleRanges;
  const rows = admin.poses.filter(pose => matchesQuery(admin.query, pose.nama)).map(pose => poseRow(pose, admin, peopleRanges));
  return html`<div class="card"><div class="tbl"><table><tr><th>Pose</th><th>Jumlah orang</th><th></th></tr>${rows}${poseRow({}, admin, peopleRanges)}</table></div></div>`;
}
