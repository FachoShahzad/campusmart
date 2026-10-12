/**
 * CampusMart — Database Service Layer
 * File: js/db.js
 *
 * Responsibilities:
 * - User Profile CRUD operations
 * - Quick Verify shortcut for development/testing
 * - User listings retrieval (Active & Sold)
 * - Wishlist management
 * - Categories fetching
 */

import { db, COLLECTIONS } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── 1. USER PROFILE OPERATIONS ──────────────────────────────

/**
 * Fetch full profile of any user by UID (auto-creates if missing)
 */
export async function getUserProfile(uid, userAuthObj = null) {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { uid: snap.id, ...snap.data() };
    }

    // Auto-create default profile if missing so user is never locked out
    const defaultData = {
      name: userAuthObj?.displayName || userAuthObj?.email?.split("@")[0] || "Student",
      email: userAuthObj?.email || "",
      department: "Computer Science",
      semester: 1,
      role: "student",
      verificationStatus: "pending",
      trustScore: 85,
      completedDeals: 0,
      averageRating: 5.0,
      totalRatings: 0,
      wishlist: [],
      createdAt: serverTimestamp()
    };
    await setDoc(userRef, defaultData);
    return { uid, ...defaultData };
  } catch (err) {
    console.error("Error fetching user profile:", err);
    throw err;
  }
}

/**
 * Update user's profile details (Name, WhatsApp, Bio, Department, Semester, Avatar)
 */
export async function updateUserProfile(uid, updateData) {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error("Error updating profile:", err);
    throw err;
  }
}

/**
 * Quick Verify Shortcut for Testing:
 * Instantly sets student's status to 'verified'
 */
export async function quickVerifyUser(uid) {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      verificationStatus: "verified",
      trustScore: 85, // starting default trust score
      verifiedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error("Error quick-verifying user:", err);
    throw err;
  }
}

// ─── 2. LISTINGS RETRIEVAL FOR PROFILE ────────────────────────

/**
 * Get listings created by a specific user
 * @param {string} sellerId
 * @param {'available'|'sold'|'all'} statusFilter
 */
export async function getUserListings(sellerId, statusFilter = "all") {
  try {
    const listingsRef = collection(db, COLLECTIONS.LISTINGS);
    let q;

    if (statusFilter === "all") {
      q = query(listingsRef, where("sellerId", "==", sellerId));
    } else {
      q = query(
        listingsRef,
        where("sellerId", "==", sellerId),
        where("status", "==", statusFilter)
      );
    }

    const snap = await getDocs(q);
    const listings = [];
    snap.forEach((doc) => {
      listings.push({ id: doc.id, ...doc.data() });
    });

    // Client-side sort by createdAt desc if index not ready
    return listings.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.error("Error fetching user listings:", err);
    return [];
  }
}

// ─── 3. WISHLIST OPERATIONS ───────────────────────────────────

/**
 * Add or remove listing ID from user's wishlist
 */
export async function toggleWishlist(userId, listingId, isSaved) {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    if (isSaved) {
      await updateDoc(userRef, { wishlist: arrayRemove(listingId) });
      return false; // now unsaved
    } else {
      await updateDoc(userRef, { wishlist: arrayUnion(listingId) });
      return true; // now saved
    }
  } catch (err) {
    console.error("Error toggling wishlist:", err);
    throw err;
  }
}

/**
 * Fetch full listing objects for all items in user's wishlist
 */
export async function getUserWishlistItems(wishlistIds = []) {
  if (!wishlistIds || wishlistIds.length === 0) return [];
  try {
    const items = [];
    for (const id of wishlistIds) {
      const snap = await getDoc(doc(db, COLLECTIONS.LISTINGS, id));
      if (snap.exists() && snap.data().status !== "deleted") {
        items.push({ id: snap.id, ...snap.data() });
      }
    }
    return items;
  } catch (err) {
    console.error("Error fetching wishlist items:", err);
    return [];
  }
}

// ─── 4. CATEGORIES SEED & RETRIEVAL ───────────────────────────

const DEFAULT_CATEGORIES = [
  { id: "books",       name: "Books",       icon: "bi-book" },
  { id: "notes",       name: "Notes",       icon: "bi-journal-text" },
  { id: "electronics", name: "Electronics", icon: "bi-laptop" },
  { id: "hostel",      name: "Hostel Items",icon: "bi-house-door" },
  { id: "stationery",  name: "Stationery",  icon: "bi-pencil" },
  { id: "lab",         name: "Lab Equipment", icon: "bi-eyedropper" },
  { id: "other",       name: "Other",       icon: "bi-box-seam" },
];

export async function getCategories() {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.CATEGORIES));
    if (snap.empty) {
      return DEFAULT_CATEGORIES;
    }
    const categories = [];
    snap.forEach((d) => categories.push({ id: d.id, ...d.data() }));
    return categories;
  } catch (err) {
    return DEFAULT_CATEGORIES;
  }
}
