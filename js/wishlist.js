/**
 * js/wishlist.js — Module 7: Wishlist service (FR-017)
 * Saved items live in users/{uid}/wishlist/{listingId}.
 */
import { db } from "/js/firebase.js";
import { notify } from "/js/notifications.js";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Returns a Set of listing IDs the user has saved. */
export async function getWishlistIds(uid) {
  const snap = await getDocs(collection(db, "users", uid, "wishlist"));
  return new Set(snap.docs.map(d => d.id));
}

/** on = true saves the listing, on = false removes it. */
export async function toggleWishlist(uid, listingId, on, listing = null) {
  const ref = doc(db, "users", uid, "wishlist", listingId);
  if (on) {
    await setDoc(ref, { listingId, addedAt: serverTimestamp() });
    if (listing && listing.sellerId && listing.sellerId !== uid) {
      notify(listing.sellerId, { type: "wishlist", id: `wish_${listingId}_${uid}`, title: "Someone saved your item",
        message: `Your listing "${listing.title}" was added to a wishlist.`, link: "/listing.html?id=" + listingId });
    }
  }
  else await deleteDoc(ref);
}
