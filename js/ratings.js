/**
 * js/ratings.js — Module 9 + 16: Ratings + Trust Score (FR-022 to FR-025)
 * Cloud Functions need the paid Blaze plan, so the Trust Score is computed
 * in the browser at READ time from real ratings and real sold listings
 * (see getTrustStats). It is never stored on the user document, so nobody can
 * fake it by editing their own profile.
 */
import { db } from "/js/firebase.js";
import { notify } from "/js/notifications.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Trust Score (0-100) = 60% rating + 25% completed deals + 15% verified. */
export function computeTrust({ avg, count, deals, verified }) {
  const ratingPart = count ? (avg / 5) * 100 : 50;          // no reviews yet = neutral 50
  const dealsPart = Math.min(deals || 0, 10) / 10 * 100;    // 10+ deals = full marks
  const verifiedPart = verified ? 100 : 0;
  return Math.round(0.6 * ratingPart + 0.25 * dealsPart + 0.15 * verifiedPart);
}

export async function getSellerRatings(sellerId) {
  const snap = await getDocs(query(collection(db, "ratings"), where("sellerId", "==", sellerId), limit(50)));
  return snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

/** Buyers who chatted with the seller about this listing (filtered in the browser: no index needed). */
export async function getBuyersForListing(sellerId, listingId) {
  const snap = await getDocs(query(collection(db, "chatThreads"), where("participants", "array-contains", sellerId)));
  return snap.docs.map(d => d.data()).filter(t => t.listingId === listingId && t.sellerId === sellerId)
    .map(t => ({ id: t.buyerId, name: t.buyerName || "Student" }));
}

/** Mark a listing sold to a buyer (or null = sold outside CampusMart). Deals are counted at read time from sold listings. */
export async function markSold(listing, buyer) {
  await updateDoc(doc(db, "listings", listing.id), {
    status: "sold", soldTo: buyer ? buyer.id : null, soldToName: buyer ? buyer.name : "",
    soldAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
}

export async function getMyRating(listingId, buyerId) {
  const snap = await getDoc(doc(db, "ratings", `${listingId}_${buyerId}`));
  return snap.exists() ? snap.data() : null;
}

export async function submitRating(listing, user, stars, comment) {
  const me = (await getDoc(doc(db, "users", user.uid))).data() || {};
  const data = {
    listingId: listing.id, listingTitle: listing.title, sellerId: listing.sellerId,
    buyerId: user.uid, buyerName: me.name || "Student",
    stars, comment: (comment || "").trim().slice(0, 300), createdAt: serverTimestamp()
  };
  await setDoc(doc(db, "ratings", `${listing.id}_${user.uid}`), data);
  notify(listing.sellerId, {
    type: "rating", id: `rating_${listing.id}_${user.uid}`, title: "You received a new rating",
    message: `${data.buyerName} rated you ${stars} star${stars > 1 ? "s" : ""} for "${listing.title}".`, link: "/profile.html"
  });
  return data;
}

/**
 * Trust stats for any student, computed live (Module 16).
 *  - ratings : real docs in /ratings where sellerId == uid
 *  - deals   : sold listings of this seller that were sold to a real, different buyer on CampusMart
 *  - verified: pass true when the student's verificationStatus is "verified"
 * Returns { trust, avg, count, deals }.
 */
export async function getTrustStats(uid, verified = false) {
  try {
    const [ratings, lSnap] = await Promise.all([
      getSellerRatings(uid),
      getDocs(query(collection(db, "listings"), where("sellerId", "==", uid)))
    ]);
    const count = ratings.length;
    const avg = count ? ratings.reduce((sum, r) => sum + (Number(r.stars) || 0), 0) / count : 0;
    const deals = lSnap.docs.map(d => d.data()).filter(l => l.status === "sold" && l.soldTo && l.soldTo !== uid).length;
    const trust = computeTrust({ avg, count, deals, verified });
    return { trust, avg: Math.round(avg * 10) / 10, count, deals };
  } catch (e) {
    console.warn("[TRUST] could not compute:", e.code || e);
    return { trust: computeTrust({ avg: 0, count: 0, deals: 0, verified }), avg: 0, count: 0, deals: 0 };
  }
}

/** @deprecated Module 16: the Trust Score is no longer stored. Kept as a no-op so old imports do not break. */
export async function refreshTrustScore() { /* no-op */ }
