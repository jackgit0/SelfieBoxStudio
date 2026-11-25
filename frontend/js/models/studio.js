// Studio di sisi pelanggan: ketersediaan sesi per tanggal dan bookmark. Murni (tanpa DOM, tanpa store); api diberikan pemanggil.
import { SESSION_HOURS, isoDate } from "../core/format.js";

// kunci cache ketersediaan (runtime.availability): "<id studio>|<YYYY-MM-DD>"
export function availabilityKey(studioId, date) {
  return studioId + "|" + date;
}

// jam sesi yang masih kosong menurut server; 400 (mis. studio tidak tersedia atau dihapus) = tidak ada slot
export async function availability(api, studioId, date) {
  try {
    const answer = await api.get(`/availability?studio_id=${studioId}&date=${date}`);
    return answer.free;
  } catch (error) {
    if (error.status == 400) {
      return [];
    }
    throw error;
  }
}

// jam kosong untuk kartu studio dan langkah Pilih Waktu: data server di cache bila ada,
// selain itu perkiraan = semua jam untuk tanggal mendatang, jam setelah sekarang untuk hari ini (dulu free() di core.js)
export function freeHours(cache, studioId, date, now) {
  const cached = cache[availabilityKey(studioId, date)];
  if (cached) {
    return cached;
  }
  const today = isoDate(now);
  return SESSION_HOURS.filter(hour => date > today || hour > now.getHours());
}

// tanggal Filter Jadwal: yang tersimpan bila hari ini atau nanti; tanggal yang sudah lewat (state tersimpan dari hari sebelumnya) atau kosong = hari ini
export function filterDate(savedDate, today) {
  return savedDate && savedDate >= today ? savedDate : today;
}

// daftar bookmark baru dengan id ditambah atau dihapus (daftar lama tidak diubah)
export function toggleBookmark(list = [], id) {
  if (list.includes(id)) {
    return list.filter(item => item !== id);
  }
  return [...list, id];
}
