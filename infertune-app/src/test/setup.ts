// The stores persist to localStorage; give the node test environment a tiny one.
const data = new Map<string, string>();

const storage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => void data.set(key, String(value)),
  removeItem: (key: string) => void data.delete(key),
  clear: () => data.clear(),
  key: (index: number) => Array.from(data.keys())[index] ?? null,
  get length() {
    return data.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
});

// zustand's persist middleware reads `window.localStorage`.
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  configurable: true,
});
