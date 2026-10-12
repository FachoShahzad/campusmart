/**
 * js/requests.js — Module 11: Request Board (FR-037, FR-038, FR-044)
 * Matching runs in the REQUESTER'S browser (no Cloud Functions on the free plan):
 * when they open the site, new listings that match their open requests create a
 * notification in their own users/{uid}/notifications (shown on the bell badge).
 */
import { db } from "/js/firebase.js";
import {
  collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, limit,
  where, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function listOpenRequests() {
  const snap = await getDocs(query(collection(db, "requestBoard"), orderBy("createdAt", "desc"), limit(100)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === "open");
}

export function createRequest(data, user, profile) {
  return addDoc(collection(db, "requestBoard"), {
    ...data, requesterId: user.uid, requesterName: profile.name || "Student",
    status: "open", notifiedListingIds: [], createdAt: serverTimestamp()
  });
}
export const closeRequest = id => updateDoc(doc(db, "requestBoard", id), { status: "fulfilled" });
export const deleteRequest = id => deleteDoc(doc(db, "requestBoard", id));

const words = t => (t || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);

export async function checkRequestMatches(uid) {
  try {
    const mine = await getDocs(query(collection(db, "requestBoard"), where("requesterId", "==", uid)));
    const open = mine.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === "open");
    if (!open.length) return;
    const ls = await getDocs(query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(100)));
    const listings = ls.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const r of open) {
      const ws = words(r.title), seen = new Set(r.notifiedListingIds || []);
      for (const l of listings) {
        if (l.sellerId === uid || l.status !== "available" || l.category !== r.category || seen.has(l.id)) continue;
        if ((l.createdAt?.toMillis?.() || 0) < (r.createdAt?.toMillis?.() || 0)) continue;
        const text = `${l.title} ${l.description || ""}`.toLowerCase();
        if (!ws.some(w => text.includes(w))) continue;
        await setDoc(doc(db, "users", uid, "notifications", `match_${r.id}_${l.id}`), {
          type: "request_match", title: "Match found for your request",
          message: `"${l.title}" was listed. You asked for "${r.title}".`,
          link: "/listing.html?id=" + l.id, read: false, createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, "requestBoard", r.id), { notifiedListingIds: arrayUnion(l.id) });
        seen.add(l.id);
      }
    }
  } catch (e) { console.warn("[REQUESTS] match check skipped:", e.code || e); }
}
