// Tiny IndexedDB key-value store for the in-browser server (database file, cookies).
const DB_NAME = 'fdrhs-hub';
const STORE = 'kv';
let dbP: Promise<IDBDatabase> | null = null;

function open() {
  if (!dbP) {
    dbP = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbP;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const kvGet = (key: string) => tx<unknown>('readonly', (s) => s.get(key));
export const kvSet = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key)).then(() => undefined);
export const kvDel = (key: string) => tx('readwrite', (s) => s.delete(key)).then(() => undefined);
