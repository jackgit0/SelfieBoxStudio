// Paket foto untuk pelanggan: teks ringkas, daftar fitur dan status aktif. Murni, tanpa HTML (view yang menambah <b>).

// "3 foto · 15 menit · cetak 2x6" (kartu Pilihan Paket dan daftar paket di popup)
export function shortDescription(item) {
  return `${item.photo_count} foto · ${item.dur} menit${item.strip_size ? " · cetak " + item.strip_size : ""}`;
}

// baris fitur kartu Pilihan Paket (Figma 660:5062): before + bold (dicetak tebal) + after
export function features(item) {
  return [
    { before: "", bold: `${item.photo_count} foto`, after: ` cetak strip ${item.strip_size || ""}` },
    { before: "Kertas foto ", bold: item.strip_material || "standar", after: "" },
    { before: "Durasi sesi ", bold: `${item.dur} menit`, after: "" },
    { before: "Galeri online 30 hari", bold: "", after: "" },
    { before: "Akses semua properti studio", bold: "", after: "" },
  ];
}

// paket masih aktif (ada di daftar paket aktif data master)
export function isActive(master, id) {
  return master.packages.some(item => item.id == id);
}
