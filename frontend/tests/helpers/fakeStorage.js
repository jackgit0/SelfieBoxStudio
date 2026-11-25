// localStorage/sessionStorage palsu di memori untuk tes.
export function createFakeStorage(initial = {}) {
  const items = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem: key => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => {
      items.set(key, String(value));
    },
    removeItem: key => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
    get length() {
      return items.size;
    },
  };
}
