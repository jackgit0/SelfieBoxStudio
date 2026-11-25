// Data master dari /api/master (paket, studio, properti, pose, diskon, kebijakan) dan turunannya.
// Fungsi turunan murni: menerima slice master sebagai argumen pertama, tidak membaca store.
import { formatRupiahShort } from "../core/format.js";

// respons /api/master (kunci huruf besar dari server) → slice master dengan nama lengkap;
// json = isi mentah sebagai teks, untuk membandingkan apakah data berubah saat dimuat ulang
export function mapMaster(response) {
  const master = {
    packages: response.PKG,
    allPackages: response.ALLPKG,
    favouritePackageId: response.FAV_PKG,
    discount: response.DISC,
    peopleRanges: response.PEOPLE,
    budgetRanges: response.BUDGET,
    studios: response.STUDIOS,
    allStudios: response.ALLSTUDIOS || response.STUDIOS,
    properties: response.PROP,
    poses: response.POSES,
    json: JSON.stringify(response),
  };
  if (response.POLICY) {
    master.policy = response.POLICY; // tanpa kebijakan di respons: nilai yang ada dipertahankan
  }
  return master;
}

export async function loadMaster(api) {
  return mapMaster(await api.get("/master"));
}

// paket menurut id, termasuk yang nonaktif; paket yang sudah dihapus → placeholder
export function packageOf(master, id) {
  return (
    master.allPackages.find(item => item.id == id) || {
      name: "(paket dihapus)",
      price: 0,
      photo_count: 1,
      dur: 1,
      strip_size: "",
      strip_material: "",
    }
  );
}

// harga paket setelah diskon utama
export function effectivePrice(master, item) {
  return Math.round(item.price * (1 - (master.discount.pct || 0) / 100));
}

export function studioOf(master, id) {
  return (
    master.allStudios.find(studio => studio.id == id) || {
      id,
      name: "(studio dihapus)",
      img: "",
      address: "-",
      price: 0,
      description: "",
    }
  );
}

// "Rp 50k - Rp 90k": rentang harga paket aktif untuk sebuah studio
export function priceRange(master, studio) {
  if (!master.packages.length) {
    return "-";
  }
  const prices = master.packages.map(item => effectivePrice(master, item) + (studio.price || 0));
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  return lowest === highest
    ? formatRupiahShort(lowest)
    : formatRupiahShort(lowest) + " - " + formatRupiahShort(highest);
}

// "3 - 5": kapasitas orang sebuah studio
export function capacityLabel(master, studio) {
  return ((master.peopleRanges.find(range => range.id == studio.people_range_id) || {}).range || "").replace(
    "-",
    " - ",
  );
}

// studio tampil ke pelanggan (ada di daftar studio aktif)
export function isStudioShown(master, id) {
  return master.studios.some(studio => studio.id == id);
}
