/**
 * Local-only persistence. IndexedDB, never a server.
 * If you ever find yourself adding a fetch() in this file, the project has lost
 * its point — the confidentiality claim is the product.
 */
import { openDB } from 'idb';

const DB = 'reviewgate';
const VERSION = 1;

const dbp = openDB(DB, VERSION, {
  upgrade(db) {
    db.createObjectStore('manuscript');                       // key: 'current'
    db.createObjectStore('notes',      { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('disclosure', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('grants');                           // key: sentence id
  },
});

export const saveManuscript = async (m) => (await dbp).put('manuscript', m, 'current');
export const loadManuscript = async ()  => (await dbp).get('manuscript', 'current');

/** Closing a manuscript revokes every standing grant. Grants never outlive it. */
export const clearManuscript = async () => {
  const db = await dbp;
  await db.delete('manuscript', 'current');
  await db.clear('grants');
};

export const addNote    = async (n)  => (await dbp).add('notes', { ...n, at: Date.now() });
export const allNotes   = async ()   => (await dbp).getAll('notes');
export const deleteNote = async (id) => (await dbp).delete('notes', id);

export const appendDisclosure = async (e) => (await dbp).add('disclosure', { ...e, at: Date.now() });
export const allDisclosure    = async ()  => (await dbp).getAll('disclosure');

/* --- standing grants -----------------------------------------------------
 * A grant means: this exact passage may be released again without re-asking,
 * for as long as this manuscript stays open. Scoped to the sentence, not the
 * section, so approving one sentence never silently widens to its neighbours.
 * ------------------------------------------------------------------------ */
export const grantSentences = async (ids) => {
  const db = await dbp;
  const tx = db.transaction('grants', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.put(Date.now(), id)), tx.done]);
};
export const allGrants = async () => {
  const db = await dbp;
  return new Set(await db.getAllKeys('grants'));
};
export const revokeGrants = async () => (await dbp).clear('grants');
