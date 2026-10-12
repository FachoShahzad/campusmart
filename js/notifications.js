/**
 * js/notifications.js — Module 13: in-app notifications (FR-043 to FR-046)
 * Stored in users/{uid}/notifications. Push notifications need a server (paid plan),
 * so alerts appear on the bell badge / notifications page when the student opens the site.
 */
import { db, auth } from "/js/firebase.js";
import {
  collection, doc, setDoc, addDoc, updateDoc, writeBatch, query, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Send a notification to another user. Never throws (a failed alert must not break the main action). */
export async function notify(toUid, { type, title, message, link = "", id = null }) {
  try {
    const me = auth.currentUser;
    if (!me || !toUid || toUid === me.uid) return;
    const data = { type, title, message, link, read: false, fromUid: me.uid, createdAt: serverTimestamp() };
    const col = collection(db, "users", toUid, "notifications");
    if (id) await setDoc(doc(col, id), data); else await addDoc(col, data);
  } catch (e) { console.warn("[NOTIFY] skipped:", e.code || e); }
}

export function watchNotifications(uid, onData, onError) {
  const q = query(collection(db, "users", uid, "notifications"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error("[NOTIFY] watch", err); onError?.(err); });
}

export const markRead = (uid, id) => updateDoc(doc(db, "users", uid, "notifications", id), { read: true });

export async function markAllRead(uid, list) {
  const batch = writeBatch(db);
  list.filter(n => !n.read).forEach(n => batch.update(doc(db, "users", uid, "notifications", n.id), { read: true }));
  return batch.commit();
}
