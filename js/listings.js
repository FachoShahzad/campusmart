/**
 * js/listings.js — Module 5: Listing service (FR-010 to FR-014)
 * Images are compressed to JPEG Base64 and stored inside the Firestore
 * document (no Firebase Storage needed on the free Spark plan).
 */
import { db } from "/js/firebase.js";
import {
  collection, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Approved categories (SRS FR-014 / BR-005)
export const CATEGORIES = ["Books", "Notes", "Electronics", "Hostel Items", "Stationery", "Lab Equipment", "Other"];
export const CONDITIONS = ["New", "Like New", "Good", "Fair"];
export const MEETUP_POINTS = ["Library", "Cafeteria", "Main Gate", "Department Entrance"];
export const STATUSES = ["available", "reserved", "sold"];
export const MAX_PHOTOS = 3;

/** Escape user text before putting it into innerHTML (prevents XSS). */
export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * Compress an image File to a JPEG data-URL (~80-100 KB).
 * 3 photos stay well below Firestore's 1 MB document limit.
 */
export function compressImage(file, maxSide = 800, maxLen = 110000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      let q = 0.8, out = canvas.toDataURL("image/jpeg", q);
      while (out.length > maxLen && q > 0.3) { q -= 0.1; out = canvas.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = url;
  });
}

/** Create a new listing. `user` = Firebase auth user, `profile` = users/{uid} data. */
export async function createListing(data, user, profile) {
  return addDoc(collection(db, "listings"), {
    ...data,
    sellerId: user.uid,
    sellerName: profile.name || "Student",
    status: "available",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function getListing(id) {
  const snap = await getDoc(doc(db, "listings", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateListing(id, data) {
  return updateDoc(doc(db, "listings", id), { ...data, updatedAt: serverTimestamp() });
}

export async function setListingStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  return updateDoc(doc(db, "listings", id), { status, updatedAt: serverTimestamp() });
}

export async function deleteListing(id) {
  return deleteDoc(doc(db, "listings", id));
}

/** Human label for the price area of a listing. */
export function priceLabel(l) {
  if (l.isGiveaway) return "Free";
  if (l.isBarter) return "Barter";
  return "Rs " + Number(l.price || 0).toLocaleString();
}
