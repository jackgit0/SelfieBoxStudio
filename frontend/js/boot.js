// ===== BOOT: muat data master, pulihkan sesi login, render =====
(async () => {
  try { const m = await API.get("/master"); Object.assign(M, { packages: m.PKG, allPackages: m.ALLPKG, favouritePackageId: m.FAV_PKG, discount: m.DISC, peopleRanges: m.PEOPLE, budgetRanges: m.BUDGET, studios: m.STUDIOS, allStudios: m.ALLSTUDIOS || m.STUDIOS, properties: m.PROP, poses: m.POSES }); if (m.POLICY) M.policy = m.POLICY; M.json = JSON.stringify(m); }
  catch (e) { $("#app").innerHTML = "<p style='padding:24px'>Server API tidak dapat dihubungi. Jalankan backend: <code>cd backend && npm start</code></p>"; return; }
  const hm = /#reset=([a-f0-9]{64})/.exec(location.hash);
  if (hm) { R.auth.resetToken = hm[1]; R.auth.mode = "reset"; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} API.token = ""; localStorage.removeItem("snapia_t"); S.user = S.me = null; S.admin = false; }
  S.staff = false;
  if (API.token && S.user) { try { S.me = S.admin ? "admin" : S.user.id; if (S.admin) AD.me = await API.get("/admin/me"); else await refresh(); } catch (e) { if (S.admin && e.status == 403 && /Hanya admin/.test(e.message)) return aDenied(); logout(); return; } } else S.me = null;
  if (!S.me) S.view = hm ? "auth" : "landing";
  try { history.replaceState({ v: S.view, p: S.p }, "", location.pathname + location.search); } catch (e) {}
  render();
})();
