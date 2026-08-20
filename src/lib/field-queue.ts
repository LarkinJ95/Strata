/**
 * Durable queue for Field Mode edits.
 *
 * Field work happens in boiler rooms and crawlspaces where the connection dies
 * mid-inspection. Writes are recorded here first and drained opportunistically,
 * so a tap is never lost to a dropped request and never reported as saved when
 * it was not.
 *
 * One record per inspection item, keyed by `itemId`: every edit sends the item's
 * full merged state, so the newest write supersedes the older one and a long
 * offline stretch drains in a single request per item rather than one per tap.
 */

const DB_NAME = "strata-field";
const DB_VERSION = 1;
const STORE = "pending";

export type QueuedEdit = {
  itemId: string;
  inspectionId: string;
  payload: Record<string, unknown>;
  updatedAt: number;
};

function supported() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!supported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "itemId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T | null>((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function enqueue(edit: QueuedEdit) {
  const db = await openDb();
  if (!db) return false;
  const result = await tx(db, "readwrite", (store) => store.put(edit) as IDBRequest<IDBValidKey>);
  db.close();
  return result !== null;
}

export async function dequeue(itemId: string) {
  const db = await openDb();
  if (!db) return;
  await tx(db, "readwrite", (store) => store.delete(itemId) as unknown as IDBRequest<undefined>);
  db.close();
}

export async function listPending(): Promise<QueuedEdit[]> {
  const db = await openDb();
  if (!db) return [];
  const rows = await tx<QueuedEdit[]>(db, "readonly", (store) => store.getAll() as IDBRequest<QueuedEdit[]>);
  db.close();
  return rows ?? [];
}

export async function countPending() {
  return (await listPending()).length;
}

/**
 * Sends every queued edit. A record is only dropped once the server has
 * acknowledged it; anything still failing stays queued for the next attempt.
 * Returns how many remain so the UI can show an honest count.
 */
export async function drain(send: (edit: QueuedEdit) => Promise<boolean>) {
  const rows = await listPending();
  if (!rows.length) return { sent: 0, remaining: 0 };
  let sent = 0;
  for (const row of rows.sort((a, b) => a.updatedAt - b.updatedAt)) {
    let ok = false;
    try {
      ok = await send(row);
    } catch {
      ok = false;
    }
    if (!ok) break;
    await dequeue(row.itemId);
    sent += 1;
  }
  return { sent, remaining: await countPending() };
}
