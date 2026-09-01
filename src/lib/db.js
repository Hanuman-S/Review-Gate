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

/**
 * Saving a manuscript also records which review the draft and log belong to.
 * Without that, closing one manuscript and opening another silently merges two
 * reviews into one disclosure log — and an audit trail that attributes passages
 * to the wrong paper is worse than no audit trail.
 */
export const saveManuscript = async (m) => {
  const db = await dbp;
  await db.put('manuscript', m, 'current');
  await db.put('manuscript', m.title, 'reviewOf');
};

/** Which manuscript the current draft and disclosure log describe. */
export const loadReviewTitle = async () => (await dbp).get('manuscript', 'reviewOf');
export const loadManuscript = async ()  => (await dbp).get('manuscript', 'current');

/**
 * Closing a manuscript drops the text and revokes every standing grant, but
 * deliberately keeps the draft and the disclosure log.
 *
 * The draft is the reviewer's work product and the log is their evidence for the
 * editor. Destroying either on a routine "close" would lose work and, worse,
 * destroy the record of what the agent was shown. Use eraseAll() to wipe.
 */
export const clearManuscript = async () => {
  const db = await dbp;
  await db.delete('manuscript', 'current');
  await db.clear('grants');
};

/** Whether there is review work that would be lost by starting a new review. */
export const hasReviewWork = async () => {
  const db = await dbp;
  return (await db.count('notes')) + (await db.count('disclosure')) > 0;
};

/**
 * Erase everything this app holds. A tool whose promise is "your document stays
 * on your machine" must also answer "how do I get rid of it?".
 */
export const eraseAll = async () => {
  const db = await dbp;
  await Promise.all([
    db.clear('manuscript'), db.clear('notes'),
    db.clear('disclosure'), db.clear('grants'),
  ]);
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
