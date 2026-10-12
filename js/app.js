document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="/css/brand.css">');
/**
 * CampusMart — Global Application Bootstrap
 * File: js/app.js
 *
 * Responsibilities:
 * - Registers the PWA Service Worker
 * - Provides global UI utilities (Toast, Loading, etc.)
 * - Route guard: redirects unauthenticated / unverified users
 * - Initializes the bottom navigation active state
 */

import { auth, db, COLLECTIONS }           from "./firebase.js";
import { onAuthStateChanged }               from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot
}                                           from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── 1. SERVICE WORKER REGISTRATION ──────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

// ─── 2. ROUTE GUARD ───────────────────────────────────────────
/**
 * Pages that do NOT require authentication.
 * Everyone else is redirected to login if not logged in.
 */
const PUBLIC_PAGES = ["/login.html", "/register.html", "/index.html", "/"];

/**
 * Pages that require VERIFIED status.
 * Pending users are sent to a "pending approval" notice.
 */
const VERIFIED_ONLY_PAGES = [
  "/post-listing.html",
  "/chat-list.html",
  "/chat-thread.html",
  "/wishlist.html",
  "/request-board.html",
];

const currentPath = window.location.pathname;
const isAdminPage = currentPath.startsWith("/admin");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not logged in — redirect to login unless already on a public page
    if (!PUBLIC_PAGES.some((p) => currentPath.endsWith(p))) {
      window.location.replace("/login.html");
    }
    return;
  }

    // Fetch user profile from Firestore
  let userSnap;
  try {
    userSnap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
  } catch (err) {
    console.error("[GUARD] Profile read failed:", err.code, err.message);
    return; // redirect nahi karna, sirf error dikhana
  }

  if (!userSnap.exists()) {
    console.warn("[GUARD] No profile found in", COLLECTIONS.USERS, "for uid", user.uid);
    showToast("Profile not found for this account.", "error");
    return; // pehle yahan signOut + login redirect hota tha
  }

  const userData = userSnap.data();
  window.__currentUser = { uid: user.uid, ...userData };

  // Admin page guard
  if (isAdminPage && userData.role !== "admin") {
    window.location.replace("/index.html");
    return;
  }

  // Verified-only pages guard
  if (
    VERIFIED_ONLY_PAGES.some((p) => currentPath.endsWith(p)) &&
    userData.verificationStatus !== "verified"
  ) {
    showToast("Your account is pending verification by admin.", "warning");
    setTimeout(() => window.location.replace("/index.html"), 1500);
    return;
  }

  // Update notification badge count
  initNotificationBadge(user.uid);
});

// ─── 3. BOTTOM NAV ACTIVE STATE ───────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const navItems = document.querySelectorAll(".cm-bottom-nav__item, .cm-bottom-nav__post");
  navItems.forEach((item) => {
    const href = item.getAttribute("href");
    if (href && window.location.pathname.endsWith(href)) {
      item.classList.add("active");
    }
  });
});

// ─── 4. NOTIFICATION BADGE ────────────────────────────────────
function initNotificationBadge(userId) {
  const q = query(
    collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.NOTIFICATIONS),
    where("read", "==", false)
  );

  onSnapshot(q, (snap) => {
    const badge = document.getElementById("notif-badge");
    if (!badge) return;
    const count = snap.size;
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  });
}

// ─── 5. TOAST NOTIFICATION UTILITY ───────────────────────────
/**
 * Show a toast message at the bottom of the screen.
 * @param {string} message  - The text to display.
 * @param {'success'|'error'|'info'|'warning'} type - Toast style.
 * @param {number} duration - Auto-dismiss after ms (default: 3000).
 */
export function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("cm-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "cm-toast-container";
    container.className = "cm-toast-container";
    document.body.appendChild(container);
  }

  const icons = {
    success: "✅",
    error:   "❌",
    warning: "⚠️",
    info:    "ℹ️",
  };

  const toast = document.createElement("div");
  toast.className = `cm-toast cm-toast--${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── 6. GLOBAL LOADING OVERLAY ────────────────────────────────
/**
 * Show or hide a full-screen loading spinner.
 * @param {boolean} show - true to show, false to hide.
 * @param {string}  text - Optional label under the spinner.
 */
export function setLoading(show, text = "Loading...") {
  let overlay = document.getElementById("cm-loading-overlay");

  if (show) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "cm-loading-overlay";
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(255,255,255,0.85);
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 16px; z-index: 9999;
        backdrop-filter: blur(4px);
      `;
      overlay.innerHTML = `
        <div style="width:48px;height:48px;border:4px solid #e5e7eb;
          border-top-color:#059669;border-radius:50%;
          animation:cm-spin 0.7s linear infinite;"></div>
        <p style="font-size:0.875rem;color:#4b5563;font-weight:500;">${text}</p>
      `;
      document.body.appendChild(overlay);
    }
  } else {
    if (overlay) overlay.remove();
  }
}

// ─── 7. FORMAT UTILITIES ──────────────────────────────────────
/**
 * Format a Firestore Timestamp or JS Date to a relative time string.
 * e.g. "2 hours ago", "3 days ago"
 */
export function timeAgo(date) {
  const now = Date.now();
  const ts  = date?.toDate ? date.toDate().getTime() : new Date(date).getTime();
  const diff = Math.floor((now - ts) / 1000);

  if (diff < 60)         return "just now";
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000)    return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

/**
 * Format a price number to PKR currency string.
 * @param {number} price
 * @param {boolean} isFree
 * @param {boolean} isBarter
 */
export function formatPrice(price, isFree = false, isBarter = false) {
  if (isFree)   return "FREE 🎁";
  if (isBarter) return "Barter 🔄";
  return `Rs. ${Number(price).toLocaleString("en-PK")}`;
}

/**
 * Generate initials from a name for avatar placeholder.
 */
export function getInitials(name = "") {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

/**
 * Truncate a string to a max length.
 */
export function truncate(str, len = 60) {
  return str?.length > len ? str.substring(0, len) + "…" : str;
}
