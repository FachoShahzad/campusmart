/**
 * js/chat.js — Module 8: Chat service (FR-018 to FR-021)
 * chatThreads/{listingId_buyerId}  -> thread info, last message, unread counts
 * chatThreads/{id}/messages/{mid}  -> individual text messages
 */
import { db } from "/js/firebase.js";
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const MAX_LEN = 1000;
export const threadIdFor = (listingId, buyerId) => `${listingId}_${buyerId}`;

/** Get or create the chat thread between the current buyer and the listing's seller. */
export async function ensureThread(listing, user, profile) {
  const id = threadIdFor(listing.id, user.uid);
  const ref = doc(db, "chatThreads", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      listingId: listing.id, listingTitle: listing.title,
      buyerId: user.uid, buyerName: profile.name || "Student",
      sellerId: listing.sellerId, sellerName: listing.sellerName || "Student",
      participants: [user.uid, listing.sellerId],
      lastMessage: "", lastMessageAt: serverTimestamp(),
      unread: { [user.uid]: 0, [listing.sellerId]: 0 },
      createdAt: serverTimestamp()
    });
  }
  return id;
}

export async function getThread(id) {
  const snap = await getDoc(doc(db, "chatThreads", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Live list of the user's threads (sorted newest first in the browser: no index needed). */
export function watchThreads(uid, onData, onError) {
  const q = query(collection(db, "chatThreads"), where("participants", "array-contains", uid));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
    onData(list);
  }, err => { console.error("[CHAT] threads", err); onError?.(err); });
}

/** Live messages of one thread (oldest first). */
export function watchMessages(threadId, onData, onError) {
  const q = query(collection(db, "chatThreads", threadId, "messages"), orderBy("createdAt", "asc"), limit(300));
  return onSnapshot(q, snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
    err => { console.error("[CHAT] messages", err); onError?.(err); });
}

export async function sendMessage(threadId, user, otherUid, text) {
  text = text.trim().slice(0, MAX_LEN);
  if (!text) return;
  await addDoc(collection(db, "chatThreads", threadId, "messages"), {
    senderId: user.uid, text, createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "chatThreads", threadId), {
    lastMessage: text.slice(0, 80), lastMessageAt: serverTimestamp(),
    [`unread.${otherUid}`]: increment(1)
  });
}

export function markRead(threadId, uid) {
  return updateDoc(doc(db, "chatThreads", threadId), { [`unread.${uid}`]: 0 }).catch(e => console.warn("[CHAT] markRead", e.code));
}

/** Total unread messages across all threads (for the badge). */
export function watchUnreadTotal(uid, cb) {
  return watchThreads(uid, list => cb(list.reduce((n, t) => n + (t.unread?.[uid] || 0), 0)));
}
