/**
 * CampusMart — Authentication Logic
 * File: js/auth.js
 *
 * Handles:
 *  - User Registration (with student ID image compressed to Base64)
 *  - User Login
 *  - Logout
 *  - Password Reset
 *  - Auth state observer & route protection helpers
 *  - Image compression utility (replaces Firebase Storage)
 */

import { auth, db, COLLECTIONS, APP_CONSTANTS } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast, setLoading } from "./app.js";

// ─── 1. IMAGE COMPRESSION UTILITY ─────────────────────────────
/**
 * Compresses an image File to a Base64 data-URL using HTML Canvas.
 * This replaces Firebase Storage — images are stored in Firestore.
 *
 * @param {File}   file      - The image File object from an <input>.
 * @param {number} maxWidth  - Max width in pixels (default: 800).
 * @param {number} maxHeight - Max height in pixels (default: 800).
 * @param {number} quality   - JPEG quality 0–1 (default: 0.70).
 * @returns {Promise<string>} Compressed Base64 data-URL string.
 */
export function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.70) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions keeping aspect ratio
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to Base64 JPEG
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress a student ID image specifically (smaller size for Firestore doc).
 * Module 16: stored ONLY in users/{uid}/private/studentId (field "image").
 * Firestore rules let just the owner and admins read that document (SRS NFR-010).
 */
export function compressStudentId(file) {
  return compressImage(file, 900, 600, 0.65);
}

/**
 * Compress a listing photo (stored in listings/{id}.photos[] array).
 */
export function compressListingPhoto(file) {
  return compressImage(file, 700, 700, 0.70);
}

/**
 * Compress an avatar/profile photo.
 */
export function compressAvatar(file) {
  return compressImage(file, 300, 300, 0.80);
}

// ─── 2. REGISTER NEW USER ─────────────────────────────────────
/**
 * Registers a new student and creates their Firestore profile.
 *
 * @param {object} formData - Form fields from the register page.
 * @param {File|null} studentIdFile - The uploaded student ID image file.
 * @returns {Promise<void>}
 */
export async function registerUser(formData, studentIdFile) {
  const { name, email, password, department, semester } = formData;

  // Step 1: Create Firebase Auth user
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Step 2: Set display name in Firebase Auth
  await updateProfile(user, { displayName: name });

  // Step 3: Compress & encode student ID image (if provided)
  let studentIdBase64 = null;
  if (studentIdFile) {
    studentIdBase64 = await compressStudentId(studentIdFile);
  }

  // Step 4: Create the public user document in Firestore.
  // Module 16: role/status are fixed by firestore.rules (student + pending). The Trust Score is
  // never stored: it is computed from real ratings and deals when a profile is opened.
  await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
    name:               name.trim(),
    email:              email.toLowerCase().trim(),
    department:         department,
    semester:           Number(semester),
    role:               "student",
    verificationStatus: "pending",   // Admin must approve
    createdAt:          serverTimestamp(),
  });

  // Step 4b: Student ID photo goes to a PRIVATE subdocument (owner + admin only).
  if (studentIdBase64) {
    const idRef = doc(db, COLLECTIONS.USERS, user.uid, "private", "studentId");
    const idData = { image: studentIdBase64, createdAt: serverTimestamp() };
    try {
      await setDoc(idRef, idData);
    } catch (e) {
      console.warn("[REGISTER] ID photo save failed, retrying once:", e.code || e);
      try { await setDoc(idRef, idData); }
      catch (e2) { console.error("[REGISTER] ID photo could not be saved:", e2.code || e2); }
    }
  }

  // Step 5: Redirect to pending verification notice
  window.location.replace("/pending.html");
}

// ─── 3. LOGIN USER ────────────────────────────────────────────
/**
 * Logs in an existing user and redirects based on their status.
 *
 * @param {string} email
 * @param {string} password
 */
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Fetch their Firestore profile
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Account data not found. Please contact support.");
  }

  const userData = snap.data();

  // Route based on role and verification status
  if (userData.role === "admin") {
    window.location.replace("/admin.html");
  } else if (userData.verificationStatus === "verified") {
    window.location.replace("/index.html");
  } else if (userData.verificationStatus === "rejected") {
    window.location.replace("/pending.html?status=rejected");
  } else {
    // pending
    window.location.replace("/pending.html");
  }
}

// ─── 4. LOGOUT USER ───────────────────────────────────────────
/**
 * Signs out the current user and redirects to login.
 */
export async function logoutUser() {
  await signOut(auth);
  window.location.replace("/login.html");
}

// ─── 5. PASSWORD RESET ────────────────────────────────────────
/**
 * Sends a password reset email via Firebase Auth.
 * @param {string} email
 */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ─── 6. GET CURRENT USER PROFILE ──────────────────────────────
/**
 * Returns the Firestore profile of the currently logged-in user.
 * Returns null if not logged in.
 */
export async function getCurrentUserProfile() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) { resolve(null); return; }
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
      resolve(snap.exists() ? { uid: user.uid, ...snap.data() } : null);
    });
  });
}

// ─── 7. PASSWORD STRENGTH CHECKER ─────────────────────────────
/**
 * Returns a strength level for the given password.
 * @param {string} password
 * @returns {{ score: number, label: string, color: string }}
 */
export function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8)              score++;
  if (/[A-Z]/.test(password))           score++;
  if (/[0-9]/.test(password))           score++;
  if (/[^A-Za-z0-9]/.test(password))   score++;

  const levels = [
    { score: 0, label: "",        color: "" },
    { score: 1, label: "Weak",    color: "weak" },
    { score: 2, label: "Fair",    color: "fair" },
    { score: 3, label: "Good",    color: "good" },
    { score: 4, label: "Strong",  color: "strong" },
  ];

  return levels[score] || levels[0];
}
