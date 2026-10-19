// ===== SESI FOTO (kamera, timer, Google Drive) & GALERI =====
const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || "";
let drive = { token: null, folder: null }, curSes = null, poseI = 0, tick = null, poseT = null, stream = null, gSes = null, dMode = false, dSel = new Set();
function stopSessionTimers() { clearInterval(tick); clearInterval(poseT); stopCam(); }
V.session = () => {
  const s = sesOf() || S.sessions.filter(x => x.user_id == S.me && x.status == "Aktif").pop();
  if (!s) return `<div class="panel"><div class="card center"><h1 class="h2">Belum ada sesi aktif</h1><p class="m">Mulai dari menu Booking → pilih booking → Check-in & Mulai Sesi.</p><button class="btn" style="margin-top:12px" onclick="go('my')">Ke Booking Saya</button></div></div>`;
  curSes = s.id; const p = pkOf(s.pkg), items = s.setup ? setupItems(s.setup) : [];
  return `<div class="panel" style="max-width:1100px"><div class="row sp"><div><h1 class="h1">Sesi Foto</h1><p class="sub">Paket ${esc(p.name)} · target ${p.photo_count} foto (maks. ambil ${p.photo_count * 2}) · ${p.dur} menit</p></div><button class="btn ghost sm" onclick="csContact()">Customer Service</button></div>
<div class="sess" style="margin-top:14px"><div class="card"><div id="tm" class="timer"></div><video id="v" autoplay playsinline muted></video><canvas id="cv" hidden></canvas>
<div class="row" style="margin-top:12px"><button class="btn" id="shot" onclick="shoot()">${ic("camera", 18)} Ambil Foto</button><span id="cnt" class="m"></span></div><small id="ds" class="m"></small><div id="strip" class="strip"></div></div>
<div class="stack"><div class="card"><h3 class="h3">Pose Rekomendasi</h3><p id="pose" style="font-size:17px;margin:10px 0"></p><button class="btn sm ghost" onclick="nextPose()">Pose lain</button></div>
<div class="card"><h3 class="h3" style="margin-bottom:10px">Background & Properti</h3>${items.length ? previewHTML(s.setup) + `<p class="sm m" style="margin-top:8px">${items.map(i => esc(i.name)).join(", ")}</p>` : '<p class="m sm">Tidak ada setup tambahan pada sesi ini.</p>'}</div>
${S.staff ? `<div class="card"><h3 class="h3" style="margin-bottom:10px">Kendali Staf</h3><div class="row"><button class="btn sm ghost" onclick="staffAct('pause')">⏸ Jeda</button><button class="btn sm ghost" onclick="staffAct('resume')">▶ Lanjut</button><button class="btn sm danger" onclick="staffAct('stop')">⏹ Hentikan</button></div>${S.log.length ? `<p class="sm m" style="margin-top:8px">Log: ${esc(S.log.slice(-3).join(" · "))}</p>` : ""}</div>` : ""}</div></div></div>`;
};
V.gallery = () => {
  const L = S.sessions.filter(s => s.user_id == S.me);
  if (!L.length) return `<div class="panel"><h1 class="h1">Galeri</h1><div class="card center m" style="margin-top:14px">Belum ada sesi foto.<div style="margin-top:12px"><button class="btn" onclick="go('my')">Ke Booking Saya</button></div></div></div>`;
  const s = L.find(x => x.id == gSes) || L[L.length - 1]; gSes = s.id; const q = pkOf(s.pkg).photo_count, sel = s.photos.filter(p => p.sel).length, favs = s.photos.filter(p => p.fav).length;
  const grp = []; s.photos.forEach(p => { const g = grp[grp.length - 1]; g && p.t - g[g.length - 1].t < 20000 ? g.push(p) : grp.push([p]); });
  return `<div class="panel" style="max-width:1100px"><h1 class="h1">Galeri</h1><p class="sub">Pilih foto terbaikmu sesuai kuota paket, tandai favorit, lalu unduh.</p>
<div class="card" style="margin-top:14px"><div class="row sp"><select style="width:auto;max-width:100%" onchange="gSes=+this.value;dSel=new Set();render()">${L.map(x => `<option value="${x.id}" ${x.id == s.id ? "selected" : ""}>${new Date(x.start_time).toLocaleString("id-ID")} · ${esc(pkOf(x.pkg).name)}</option>`).join("")}</select>
<div class="row"><button class="btn sm ghost" onclick="toggleDel()">${dMode ? ic("check", 16) + " Selesai" : ic("trash", 16) + " Mode Hapus"}</button>${dMode ? `<button class="btn sm soft" onclick="selAllNonFav(${s.id})">Pilih semua non-favorit</button><button class="btn sm danger" ${dSel.size ? "" : "disabled"} onclick="bulkDel()">Hapus ${dSel.size} foto</button>` : ""}</div></div>
<p style="margin:12px 0">Terpilih untuk dicetak: <b>${sel}/${q}</b> ${sel > q ? '<span class="tag no">Melebihi kuota</span>' : ""} · ⭐ Favorit: <b>${favs}</b> <small class="m">(tanpa batas)</small><br><small class="m">${dMode ? "Mode hapus: klik foto yang ingin dihapus. Foto favorit ⭐ tidak akan terhapus." : "Klik foto untuk memilih, ⭐ untuk favorit."}</small></p>
${grp.map((g, i) => `<h3 class="h3" style="margin:14px 0 8px">Kelompok ${i + 1} ${g.length > 1 ? '<small class="m">(foto mirip)</small>' : ""}</h3><div class="gal">${g.map(p => `<div class="ph ${dMode ? (dSel.has(p.id) ? "dsel" : "") : (p.sel ? "sel" : "")}" onclick="selPh(${s.id},${p.id})"><img src="${p.img}" alt=""><span class="f" onclick="event.stopPropagation();fav(${s.id},${p.id})">${p.fav ? "⭐" : "☆"}</span><span class="f d" title="Hapus foto" onclick="event.stopPropagation();delPhoto(${s.id},${p.id})">🗑</span><small>Drive: ${p.drive || "lokal"}</small></div>`).join("")}</div>`).join("") || '<p class="m">Belum ada foto pada sesi ini.</p>'}
<div class="row" style="margin-top:16px"><button class="btn" onclick="confirmSel(${s.id})">Konfirmasi Pilihan</button>${s.confirmed ? `<button class="btn ghost" onclick="dl(${s.id})">${ic("download", 16)} Unduh Foto Terpilih</button>` : ""}</div></div></div>`;
};
// ===== GOOGLE DRIVE =====
function driveAuth(){return new Promise(res=>{if(!GOOGLE_CLIENT_ID||!window.google){return res(false)}
 google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:"https://www.googleapis.com/auth/drive.file",callback:r=>{drive.token=r.access_token;res(!!r.access_token)}}).requestAccessToken()})}
async function driveFolder(){if(drive.folder)return drive.folder;const h={Authorization:"Bearer "+drive.token,"Content-Type":"application/json"};
 const r=await(await fetch("https://www.googleapis.com/drive/v3/files",{method:"POST",headers:h,body:JSON.stringify({name:"Snapia Studio - "+new Date().toLocaleDateString("id-ID"),mimeType:"application/vnd.google-apps.folder"})})).json();return drive.folder=r.id}
async function uploadDrive(ph){if(!drive.token)return"lokal";try{const folder=await driveFolder(),bd="snapia",meta=JSON.stringify({name:"foto-"+ph.id+".jpg",parents:[folder]});
 const body=`--${bd}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${bd}\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${ph.img.split(",")[1]}\r\n--${bd}--`;
 const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",{method:"POST",headers:{Authorization:"Bearer "+drive.token,"Content-Type":"multipart/related; boundary="+bd},body});
 if(r.ok){ph.driveId=(await r.json()).id;return"drive"}return"gagal"}catch(e){return"gagal"}}
// ===== SESI (US-13..21) =====
const sesOf=()=>S.sessions.find(s=>s.id==curSes);
async function startSession(id){try{const s=await API.post(`/bookings/${id}/start`);await refresh();curSes=s.id}catch(e){err=e.message;return render()}
 driveAuth().then(ok=>{msg=ok?"Google Drive terhubung: foto otomatis dikirim ke Drive Anda.":"Drive belum terhubung (isi GOOGLE_CLIENT_ID). Foto disimpan di server.";go("session")})}
V.session_after=()=>{const s=sesOf();if(!s)return;
 if(s.status=="Aktif"&&navigator.mediaDevices)navigator.mediaDevices.getUserMedia({video:true}).then(m=>{stream=m;const v=$("#v");if(v)v.srcObject=m}).catch(()=>{const v=$("#v");if(v)v.outerHTML='<div class="m">Kamera tidak tersedia — foto simulasi digunakan.</div>'});
 nextPose(0);clearInterval(poseT);poseT=setInterval(()=>nextPose(1),8000);
 let n=0;clearInterval(tick);tick=setInterval(()=>{if(s.status=="Aktif"&&!s.paused){s.left--;if(s.left==60)warn();if(s.left<=0)syncS(s)}upd(s);if(++n%5==0&&s.status=="Aktif")syncS(s)},1000);upd(s)};
async function syncS(s){try{const r=await API.get("/sessions/"+s.id),was=s.status;s.left=r.left;s.paused=r.paused;s.status=r.status;if(was=="Aktif"&&r.status!="Aktif"){stopCam();msg="Sesi telah berakhir.";render()}else upd(s)}catch(e){}}
function upd(s){const t=$("#tm");if(!t)return;const m=Math.max(0,s.left);t.textContent=String(m/60|0).padStart(2,"0")+":"+String(m%60).padStart(2,"0");t.classList.toggle("warn",s.left<=60&&s.status=="Aktif");
 const p=pkOf(s.pkg);$("#cnt").textContent=`Foto: ${s.photos.length}/${p.photo_count*2} · sisa ${p.photo_count*2-s.photos.length}`;
 $("#shot").disabled=s.status!="Aktif"||s.paused||s.photos.length>=p.photo_count*2;
 const sp=$("#strip");if(sp){const k=s.photos.map(p=>p.id).join();if(sp.dataset.k!=k){sp.dataset.k=k;sp.innerHTML=s.photos.map(p=>`<div class="th"><img src="${p.img}"><button title="Hapus foto" onclick="delPhoto(${s.id},${p.id})">🗑</button></div>`).join("")}}
 $("#ds").textContent=s.status!="Aktif"?"Sesi telah berakhir. Silakan pilih foto di Galeri.":s.paused?"Sesi dijeda staf — waktu tidak berkurang.":s.left<=60?"⚠ Waktu hampir habis!":""}
function beep(){try{const a=new AudioContext(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.4)}catch(e){}}
function warn(){beep();setTimeout(beep,600)}
function nextPose(a){const l=POSES[S.quiz?.people||1];poseI=(poseI+(a===0?0:1))%l.length;const e=$("#pose");if(e)e.textContent="🧍 "+l[poseI]}
async function shoot(){const s=sesOf();if(s.status!="Aktif"||s.paused)return;const c=$("#cv"),v=$("#v");const W=640,H=(v&&v.videoWidth)?Math.round(W*v.videoHeight/v.videoWidth):480;c.width=W;c.height=H;const x=c.getContext("2d"); // rasio foto = rasio kamera (tidak gepeng)
 if(v&&v.videoWidth){x.drawImage(v,0,0,W,H)}else{const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,"hsl("+Math.random()*360+",70%,60%)");g.addColorStop(1,"#222");x.fillStyle=g;x.fillRect(0,0,W,H);x.font="90px serif";x.fillText("😄",W/2-45,H/2+30)}
 const st=s.setup;if(st){x.font="40px serif";st.acc.forEach((id,i)=>x.fillText((PROP.find(p=>p.id==id)||{}).e||"",20+i*50,50))}
try{const data=c.toDataURL("image/jpeg",.8),r=await API.post(`/sessions/${s.id}/photos`,{img:data}),ph={id:r.id,t:r.t,fav:false,sel:false,drive:"…",img:data};s.photos.push(ph);upd(s);
  ph.drive=await uploadDrive(ph);API.patch("/photos/"+ph.id,{drive:ph.drive}).catch(()=>{})}catch(e){err=e.message;await syncS(s);render()}}
async function staffAct(a){const s=sesOf();if(!S.staff||!s)return;if(a=="stop"&&!confirm("Hentikan sesi?"))return;
 try{const r=await API.post(`/sessions/${s.id}/control`,{action:a});S.log.push(a+" "+new Date().toLocaleTimeString());s.left=r.left;s.paused=r.paused;s.status=r.status;if(r.status!="Aktif"){stopCam();msg="Sesi dihentikan staf."}}catch(e){err=e.message}render()}
function stopCam(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
// ===== GALERI (US-22..24) =====
const ph=(sid,pid)=>S.sessions.find(s=>s.id==sid).photos.find(p=>p.id==pid);
function selPh(sid,pid){if(dMode)return togDel(sid,pid);const s=S.sessions.find(s=>s.id==sid),p=ph(sid,pid);p.sel=!p.sel;s.confirmed=false;render();API.patch("/photos/"+pid,{sel:p.sel}).catch(e=>{err=e.message;render()})}
function fav(sid,pid){const p=ph(sid,pid);p.fav=!p.fav;if(p.fav)dSel.delete(pid);render();API.patch("/photos/"+pid,{fav:p.fav}).catch(()=>{})}
async function delPhoto(sid,pid){
 if(!confirm("Hapus foto ini secara permanen?"))return;
 const s=S.sessions.find(s=>s.id==sid),p=ph(sid,pid);
 try{
  await API.del("/photos/"+pid);
  if(p.driveId&&drive.token)fetch("https://www.googleapis.com/drive/v3/files/"+p.driveId,{method:"DELETE",headers:{Authorization:"Bearer "+drive.token}}).catch(()=>{});
  s.photos=s.photos.filter(x=>x.id!=pid);if(p.sel)s.confirmed=false;
 }catch(e){return alert(e.message)}
 if(S.view=="session")upd(s);else{msg="Foto dihapus.";render()}
}
const toggleDel=()=>{dMode=!dMode;dSel=new Set();msg=err="";render()};
function togDel(sid,pid){const p=ph(sid,pid);if(p.fav){msg="Foto favorit tidak dapat dihapus massal. Hilangkan bintangnya dulu bila ingin menghapusnya.";return render()}msg="";dSel.has(pid)?dSel.delete(pid):dSel.add(pid);render()}
function selAllNonFav(sid){S.sessions.find(s=>s.id==sid).photos.forEach(p=>{if(!p.fav)dSel.add(p.id)});render()}
async function bulkDel(){if(!dSel.size||!confirm(`Hapus ${dSel.size} foto terpilih secara permanen? Foto favorit tidak ikut terhapus.`))return;msg=err="";
 try{const r=await API.post("/photos/bulk-delete",{ids:[...dSel]});dSel=new Set();dMode=false;await refresh();msg=`${r.deleted} foto dihapus${r.skipped_favorites?`, ${r.skipped_favorites} foto favorit dilewati`:""}.`}catch(e){err=e.message}render()}
async function confirmSel(sid){try{await API.post(`/sessions/${sid}/confirm`);S.sessions.find(s=>s.id==sid).confirmed=true;msg="Pilihan dikonfirmasi."}catch(e){err=e.message}render()}
function dl(sid){const s=S.sessions.find(s=>s.id==sid);s.photos.filter(p=>p.sel).forEach(p=>{const a=document.createElement("a");a.href=API.imgUrl(p.id)+"&dl=1";a.download="snapia-"+p.id+".jpg";document.body.appendChild(a);a.click();a.remove()})}
