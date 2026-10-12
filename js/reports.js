/**
 * js/reports.js — Module 10: Reports (FR-026 to FR-028)
 * One report per student per target: the document ID is type_targetId_reporterId.
 */
import { db } from "/js/firebase.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const REASONS = [
  "Fake item", "Scam or wrong price", "Inappropriate content",
  "Prohibited item", "Harassment or abuse", "Other"
];

const reportId = (type, targetId, reporterId) => `${type}_${targetId}_${reporterId}`;

/** True if this user already reported this target. */
export async function hasReported(type, targetId, reporterId) {
  const snap = await getDoc(doc(db, "reports", reportId(type, targetId, reporterId)));
  return snap.exists();
}

/** type = "listing" | "user". For user reports, listingId is the listing they were dealing about. */
export async function submitReport({ type, targetId, targetName, listingId = "", reason, details }, user) {
  if (!REASONS.includes(reason)) throw new Error("Choose a reason");
  const me = (await getDoc(doc(db, "users", user.uid))).data() || {};
  return setDoc(doc(db, "reports", reportId(type, targetId, user.uid)), {
    type, targetId, targetName: targetName || "", listingId,
    reason, details: (details || "").trim().slice(0, 300),
    reporterId: user.uid, reporterName: me.name || "Student",
    status: "open", createdAt: serverTimestamp()
  });
}
