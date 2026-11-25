// ===== GALERI (sesi foto, kamera, timer dan Google Drive sudah di PhotoSessionController, fase 7) =====
import { API, CONTROLLERS, D, R, S, V } from "./state.js";
import { esc } from "../core/html.js";
import { go, ic, modal, pkOf, refresh, render } from "./core.js";
// state sesi foto & galeri (tidak disimpan): token/folder Google Drive, sesi yang sedang dibuka, indeks pose, timer, stream kamera, sesi yang dipilih di Galeri, mode hapus + foto yang dipilih untuk dihapus
const P = { drive: { token: null, folder: null }, session: null, poseIndex: 0, tickTimer: null, poseTimer: null, stream: null, gallerySession: null, deleteMode: false, deleteSelection: new Set() };
V.gallery = () => {
  const L = D.sessions.filter(s => s.user_id == S.me);
  if (!L.length) return `<div class="panel"><h1 class="h1">Galeri</h1><div class="card center m" style="margin-top:14px">Belum ada sesi foto.<div style="margin-top:12px"><button class="btn" onclick="go('my')">Ke Booking Saya</button></div></div></div>`;
  const s = L.find(x => x.id == P.gallerySession) || L[L.length - 1]; P.gallerySession = s.id; const q = pkOf(s.pkg).photo_count, sel = s.photos.filter(p => p.sel).length, favs = s.photos.filter(p => p.fav).length;
  const grp = []; s.photos.forEach(p => { const g = grp[grp.length - 1]; g && p.t - g[g.length - 1].t < 20000 ? g.push(p) : grp.push([p]); });
  return `<div class="panel" style="max-width:1100px"><h1 class="h1">Galeri</h1><p class="sub">Pilih foto terbaikmu sesuai kuota paket, tandai favorit, lalu unduh.</p>
<div class="card" style="margin-top:14px"><div class="row sp"><select style="width:auto;max-width:100%" onchange="P.gallerySession=+this.value;P.deleteSelection=new Set();render()">${L.map(x => `<option value="${x.id}" ${x.id == s.id ? "selected" : ""}>${new Date(x.start_time).toLocaleString("id-ID")} · ${esc(pkOf(x.pkg).name)}</option>`).join("")}</select>
<div class="row"><button class="btn sm ghost" onclick="toggleDel()">${P.deleteMode ? ic("check", 16) + " Selesai" : ic("trash", 16) + " Mode Hapus"}</button>${P.deleteMode ? `<button class="btn sm soft" onclick="selAllNonFav(${s.id})">Pilih semua non-favorit</button><button class="btn sm danger" ${P.deleteSelection.size ? "" : "disabled"} onclick="bulkDel()">Hapus ${P.deleteSelection.size} foto</button>` : ""}</div></div>
<p style="margin:12px 0">Terpilih untuk dicetak: <b>${sel}/${q}</b> ${sel > q ? '<span class="tag no">Melebihi kuota</span>' : ""} · ⭐ Favorit: <b>${favs}</b> <small class="m">(tanpa batas)</small><br><small class="m">${P.deleteMode ? "Mode hapus: klik foto yang ingin dihapus. Foto favorit ⭐ tidak akan terhapus." : "Klik foto untuk memilih, ⭐ untuk favorit."}</small></p>
${grp.map((g, i) => `<h3 class="h3" style="margin:14px 0 8px">Kelompok ${i + 1} ${g.length > 1 ? '<small class="m">(foto mirip)</small>' : ""}</h3><div class="gal">${g.map(p => `<div class="ph ${P.deleteMode ? (P.deleteSelection.has(p.id) ? "dsel" : "") : (p.sel ? "sel" : "")}" onclick="selPh(${s.id},${p.id})"><img src="${p.img}" alt=""><span class="f" onclick="event.stopPropagation();fav(${s.id},${p.id})">${p.fav ? "⭐" : "☆"}</span><span class="f d" title="Hapus foto" onclick="event.stopPropagation();delPhoto(${s.id},${p.id})">🗑</span><small>Drive: ${p.drive || "lokal"}</small></div>`).join("")}</div>`).join("") || '<p class="m">Belum ada foto pada sesi ini.</p>'}
<div class="row" style="margin-top:16px"><button class="btn" onclick="confirmSel(${s.id})">Konfirmasi Pilihan</button>${s.confirmed ? `<button class="btn ghost" onclick="dl(${s.id})">${ic("download", 16)} Unduh Foto Terpilih</button>` : ""}</div></div></div>`;
};
// ===== GALERI (US-22..24) =====
const ph=(sid,pid)=>D.sessions.find(s=>s.id==sid).photos.find(p=>p.id==pid);
function selPh(sid,pid){if(P.deleteMode)return togDel(sid,pid);const s=D.sessions.find(s=>s.id==sid),p=ph(sid,pid);p.sel=!p.sel;s.confirmed=false;render();API.patch("/photos/"+pid,{sel:p.sel}).catch(e=>{R.toast.error=e.message;render()})}
function fav(sid,pid){const p=ph(sid,pid);p.fav=!p.fav;if(p.fav)P.deleteSelection.delete(pid);render();API.patch("/photos/"+pid,{fav:p.fav}).catch(()=>{})}
async function delPhoto(sid,pid){
 if((await modal({title:"Konfirmasi Hapus Foto",body:"<p>Hapus foto ini secara permanen?</p>",buttons:[{label:"Batal",value:false,style:"ghost"},{label:"Hapus",value:true,style:"danger"}]}))!==true)return;
 const s=D.sessions.find(s=>s.id==sid),p=ph(sid,pid);
 try{
  await API.del("/photos/"+pid);
  if(p.driveId&&P.drive.token)fetch("https://www.googleapis.com/drive/v3/files/"+p.driveId,{method:"DELETE",headers:{Authorization:"Bearer "+P.drive.token}}).catch(()=>{});
  s.photos=s.photos.filter(x=>x.id!=pid);if(p.sel)s.confirmed=false;
 }catch(e){return modal({title:"Foto Gagal Dihapus",body:"<p>"+esc(e.message)+"</p>"})}
 if(R.route.name=="session")CONTROLLERS.photo.showSession(sid);else{R.toast.message="Foto dihapus.";render()}
}
const toggleDel=()=>{P.deleteMode=!P.deleteMode;P.deleteSelection=new Set();R.toast.message=R.toast.error="";render()};
function togDel(sid,pid){const p=ph(sid,pid);if(p.fav){R.toast.message="Foto favorit tidak dapat dihapus massal. Hilangkan bintangnya dulu bila ingin menghapusnya.";return render()}R.toast.message="";P.deleteSelection.has(pid)?P.deleteSelection.delete(pid):P.deleteSelection.add(pid);render()}
function selAllNonFav(sid){D.sessions.find(s=>s.id==sid).photos.forEach(p=>{if(!p.fav)P.deleteSelection.add(p.id)});render()}
async function bulkDel(){if(!P.deleteSelection.size||(await modal({title:"Konfirmasi Hapus Foto",body:`<p>Hapus ${P.deleteSelection.size} foto terpilih secara permanen? Foto favorit tidak ikut terhapus.</p>`,buttons:[{label:"Batal",value:false,style:"ghost"},{label:"Hapus",value:true,style:"danger"}]}))!==true)return;R.toast.message=R.toast.error="";
 try{const r=await API.post("/photos/bulk-delete",{ids:[...P.deleteSelection]});P.deleteSelection=new Set();P.deleteMode=false;await refresh();R.toast.message=`${r.deleted} foto dihapus${r.skipped_favorites?`, ${r.skipped_favorites} foto favorit dilewati`:""}.`}catch(e){R.toast.error=e.message}render()}
async function confirmSel(sid){try{await API.post(`/sessions/${sid}/confirm`);D.sessions.find(s=>s.id==sid).confirmed=true;R.toast.message="Pilihan dikonfirmasi."}catch(e){R.toast.error=e.message}render()}
function dl(sid){const s=D.sessions.find(s=>s.id==sid);s.photos.filter(p=>p.sel).forEach(p=>{const a=document.createElement("a");a.href=API.imageUrl(p.id)+"&dl=1";a.download="snapia-"+p.id+".jpg";document.body.appendChild(a);a.click();a.remove()})}
export { P, bulkDel, confirmSel, delPhoto, dl, fav, ph, selAllNonFav, selPh, toggleDel };
