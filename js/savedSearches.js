/**
 * js/savedSearches.js — Module 17b: Saved Searches (FR-020) + new-match alerts (FR-043)
 * A saved search is stored in users/{uid}/savedSearches/{id}. Cloud Functions need the paid plan,
 * so new matches are found in the student's own browser (checkSavedSearches, same idea as request matching).
 */
import { db } from "/js/firebase.js";
import {
  collection, doc, getDocs, addDoc, deleteDoc, setDoc, updateDoc, query, orderBy, limit, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const MAX_SAVED = 10;
const EMPTY = { q: "", category: "All", min: "", max: "", cond: "", dept: "", sem: "", sort: "newest" };

/** Clean a criteria object (strings only, trimmed) so equal searches compare equal. */
export function normalize(c = {}) {
  const o = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) if (c[k] !== undefined && c[k] !== null) o[k] = String(c[k]).trim();
  if (!o.category) o.category = "All";
  if (!o.sort) o.sort = "newest";
  return o;
}

/** True when the criteria contain at least one filter or keyword (sorting alone is not a search). */
export function hasCriteria(c) {
  const n = normalize(c);
  return !!(n.q || n.category !== "All" || n.min || n.max || n.cond || n.dept || n.sem);
}

/** Short human label, e.g. "calculator · Electronics · Rs 100-500 · Good · Sem 3". */
export function describeSearch(c) {
  const n = normalize(c), parts = [];
  if (n.q) parts.push(`"${n.q}"`);
  if (n.category !== "All") parts.push(n.category);
  if (n.min || n.max) parts.push(`Rs ${n.min || 0}${n.max ? "-" + n.max : "+"}`);
  if (n.cond) parts.push(n.cond);
  if (n.dept) parts.push(n.dept);
  if (n.sem) parts.push("Sem " + n.sem);
  return (parts.join(" · ") || "All items").slice(0, 100);
}

/** Does a listing match the criteria? Sold listings never match. Used by the feed AND by the alerts. */
export function matchesSearch(l, c) {
  const n = normalize(c);
  if (l.status === "sold") return false;
  if (n.category !== "All" && l.category !== n.category) return false;
  const q = n.q.toLowerCase();
  if (q && !`${l.title} ${l.description} ${l.category} ${l.department}`.toLowerCase().includes(q)) return false;
  if (n.cond && l.condition !== n.cond) return false;
  const dept = n.dept.toLowerCase();
  if (dept && !(l.department || "").toLowerCase().includes(dept)) return false;
  if (n.sem && String(l.semester) !== n.sem) return false;
  if (n.min !== "" || n.max !== "") {
    if (l.isGiveaway || l.isBarter) return false;
    if (n.min !== "" && l.price < Number(n.min)) return false;
    if (n.max !== "" && l.price > Number(n.max)) return false;
  }
  return true;
}

const col = uid => collection(db, "users", uid, "savedSearches");

export async function listSavedSearches(uid) {
  const snap = await getDocs(col(uid));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
}

/** Save a search. Returns { saved, reason, item }. Never saves the same search twice. */
export async function saveSearch(uid, criteria, existing = []) {
  if (!hasCriteria(criteria)) return { saved: false, reason: "empty" };
  const n = normalize(criteria);
  const key = JSON.stringify([n.q.toLowerCase(), n.category, n.min, n.max, n.cond, n.dept.toLowerCase(), n.sem, n.sort]);
  if (existing.some(s => JSON.stringify([ (s.q || "").toLowerCase(), s.category || "All", s.min || "", s.max || "", s.cond || "", (s.dept || "").toLowerCase(), s.sem || "", s.sort || "newest"]) === key))
    return { saved: false, reason: "duplicate" };
  if (existing.length >= MAX_SAVED) return { saved: false, reason: "limit" };
  const data = { ...n, name: describeSearch(n), createdMs: Date.now(), createdAt: serverTimestamp(), notified: [] };
  const ref = await addDoc(col(uid), data);
  return { saved: true, item: { id: ref.id, ...data } };
}

export const deleteSavedSearch = (uid, id) => deleteDoc(doc(db, "users", uid, "savedSearches", id));

/**
 * FR-043: look for listings posted AFTER a search was saved that match it, and create an in-app
 * notification for each (max 5 per search per check). Runs when the student opens the site.
 */
export async function checkSavedSearches(uid) {
  try {
    const searches = await listSavedSearches(uid);
    if (!searches.length) return 0;
    const ls = await getDocs(query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(100)));
    const listings = ls.docs.map(d => ({ id: d.id, ...d.data() }));
    let made = 0;
    for (const s of searches) {
      const seen = new Set(s.notified || []), fresh = [];
      for (const l of listings) {
        if (fresh.length >= 5) break;
        if (l.sellerId === uid || seen.has(l.id)) continue;
        if ((l.createdAt?.toMillis?.() || 0) <= (s.createdMs || 0)) continue;
        if (!matchesSearch(l, s)) continue;
        fresh.push(l);
      }
      for (const l of fresh) {
        await setDoc(doc(db, "users", uid, "notifications", `ss_${s.id}_${l.id}`), {
          type: "saved_search", title: "New match for your saved search",
          message: `"${l.title}" was listed. Saved search: ${s.name}.`,
          link: "/listing.html?id=" + l.id, read: false, createdAt: serverTimestamp()
        });
        made++;
      }
      if (fresh.length) await updateDoc(doc(db, "users", uid, "savedSearches", s.id), { notified: arrayUnion(...fresh.map(l => l.id)) });
    }
    return made;
  } catch (e) { console.warn("[SAVED SEARCH] check skipped:", e.code || e); return 0; }
}
