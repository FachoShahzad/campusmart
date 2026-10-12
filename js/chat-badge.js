/** js/chat-badge.js — floating 💬 button with unread count. Add to index.html / listing.html / profile.html. */
import { auth, db } from "/js/firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { watchUnreadTotal } from "/js/chat.js";
import { checkRequestMatches } from "/js/requests.js";
import { checkSavedSearches } from "/js/savedSearches.js";

/** Admins: jump to the admin panel after login, and show an "Admin Panel" button on every page. */
async function adminTools(user) {
  try {
    const p = (await getDoc(doc(db, "users", user.uid))).data() || {};
    if (p.role !== "admin") return;
    const path = location.pathname;
    const last = +sessionStorage.getItem("cmAdminAt") || 0;
    if ((path === "/" || path.endsWith("/index.html")) && Date.now() - last > 600000) {   // once per 10 minutes
      sessionStorage.setItem("cmAdminAt", Date.now());
      return location.replace("/admin.html");
    }
    if (document.getElementById("cm-admin-fab")) return;
    const a = document.createElement("a");
    a.id = "cm-admin-fab"; a.href = "/admin.html"; a.textContent = "🛠 Admin Panel";
    a.style.cssText = "position:fixed;left:16px;bottom:90px;z-index:1030;padding:10px 14px;border-radius:999px;background:#f59e0b;color:#000;font-weight:600;font-size:.9rem;box-shadow:0 4px 12px #0004;text-decoration:none";
    document.body.appendChild(a);
  } catch (e) { console.warn("[ADMIN] check skipped:", e.code || e); }
}

onAuthStateChanged(auth, user => {
  if (user) { checkRequestMatches(user.uid); checkSavedSearches(user.uid); adminTools(user); }
  if (!user || document.getElementById("cm-chat-fab")) return;
  const a = document.createElement("a");
  a.id = "cm-chat-fab"; a.href = "/chat.html"; a.setAttribute("aria-label", "Messages");
  a.style.cssText = "position:fixed;right:16px;bottom:90px;z-index:1030;width:52px;height:52px;border-radius:50%;background:#1a4078;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;box-shadow:0 4px 12px #0004;text-decoration:none";
  a.innerHTML = `💬<span id="cm-chat-count" style="display:none;position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#dc3545;font-size:.75rem;line-height:20px;text-align:center"></span>`;
  document.body.appendChild(a);
  watchUnreadTotal(user.uid, n => {
    const b = document.getElementById("cm-chat-count");
    b.style.display = n ? "block" : "none";
    b.textContent = n > 9 ? "9+" : n;
  });
});
