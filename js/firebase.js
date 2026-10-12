/**
 * CampusMart — Firebase Initialization & Service Exports
 * File: js/firebase.js
 *
 * HOW TO USE:
 * 1. Go to https://console.firebase.google.com
 * 2. Click "Add project" → name it "CampusMart" → Continue
 * 3. Disable Google Analytics (optional for now) → Create project
 * 4. Click the Web icon (</>) → Register app as "campusmart-web"
 * 5. Copy your firebaseConfig object and PASTE IT BELOW
 * 6. Enable: Authentication → Email/Password
 * 7. Enable: Firestore Database → Start in test mode
 * 8. Enable: Storage → Start in test mode
 *
 * IMPORTANT: Replace EVERY placeholder value below with your real config.
 */

// ─── Firebase SDK Imports (v9 modular via CDN ESM) ────────────
// NOTE: Firebase Storage is NOT used — requires paid Blaze plan.
// Images are compressed client-side and stored as Base64 in Firestore.
import { initializeApp }            from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }                  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence
}                                   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Your Firebase Project Configuration ──────────────────────
// ⚠️  REPLACE these placeholder values with your real config from
//     Firebase Console → Project Settings → Your Apps → SDK setup

  const firebaseConfig = {
    apiKey: "AIzaSyAn4aOyhI1zwp-E4awFriS5fC710EnKO6M",
    authDomain: "campusmart-7db5b.firebaseapp.com",
    projectId: "campusmart-7db5b",
    storageBucket: "campusmart-7db5b.firebasestorage.app",
    messagingSenderId: "611722544438",
    appId: "1:611722544438:web:033de9b2e07cb0cf53df97",
    measurementId: "G-6JMGJQ7N0W"
  };

// ─── Initialize Firebase App ───────────────────────────────────
const app = initializeApp(firebaseConfig);

// ─── Initialize & Export Firebase Services ────────────────────
export const auth = getAuth(app);
export const db   = getFirestore(app);
// NOTE: storage export removed — using Base64-in-Firestore instead.

// ─── Enable Offline Persistence (PWA / reliability) ───────────
// This lets Firestore cache data locally so the app works
// even when the student momentarily loses connectivity.
// enableIndexedDbPersistence(db).catch((err) => {
//   if (err.code === 'failed-precondition') {
//     // Multiple tabs open at once — persistence only works in one
//     console.warn("CampusMart: Firestore persistence unavailable (multiple tabs).");
//   } else if (err.code === 'unimplemented') {
//     // Browser doesn't support IndexedDB
//     console.warn("CampusMart: Firestore persistence not supported in this browser.");
//   }
// });

// ─── Collection Name Constants ────────────────────────────────
// Centralizing collection names prevents typos across the codebase.
export const COLLECTIONS = {
  USERS:         "users",
  CATEGORIES:    "categories",
  LISTINGS:      "listings",
  CHAT_THREADS:  "chatThreads",
  RATINGS:       "ratings",
  REPORTS:       "reports",
  REQUEST_BOARD: "requestBoard",
  NOTIFICATIONS: "notifications",
};

// ─── App-Wide Constants ────────────────────────────────────────
export const APP_CONSTANTS = {
  APP_NAME:              "CampusMart",
  UNIVERSITY_NAME:       "University of Azad Jammu & Kashmir",
  MAX_LISTING_PHOTOS:    5,
  MAX_FILE_SIZE_MB:      5,
  TRUST_SCORE_MAX:       100,
  REPORTS_BEFORE_FLAG:   3,    // auto-flag user after 3 upheld reports

  // Item condition options
  CONDITIONS: ["New", "Like New", "Good", "Fair", "For Parts"],

  // Semesters
  SEMESTERS: [1, 2, 3, 4, 5, 6, 7, 8],

  // Default departments (admin can add more)
  DEPARTMENTS: [
    "Computer Science",
    "Software Engineering",
    "Information Technology",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "English",
    "Economics",
    "Business Administration",
  ],

  // Safe Meetup Points on campus
  MEETUP_POINTS: [
    { name: "Main Library",        icon: "📚" },
    { name: "Central Cafeteria",   icon: "☕" },
    { name: "Main Gate",           icon: "🚪" },
    { name: "Admin Block Lobby",   icon: "🏢" },
    { name: "CS Department Block", icon: "💻" },
    { name: "Sports Ground",       icon: "⚽" },
  ],
};

console.log(`%c🛒 ${APP_CONSTANTS.APP_NAME} — Firebase initialized`, "color: #059669; font-weight: bold;");
