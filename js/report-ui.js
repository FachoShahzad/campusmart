/** js/report-ui.js — reusable "Report" dialog. Usage: openReportDialog({ type, targetId, targetName, listingId }) */
import { auth } from "/js/firebase.js";
import { showToast } from "/js/app.js";
import { REASONS, hasReported, submitReport } from "/js/reports.js";
import { esc } from "/js/listings.js";

let dlg, current;

function build() {
  dlg = document.createElement("div");
  dlg.style.cssText = "display:none;position:fixed;inset:0;background:#0007;z-index:3000;align-items:center;justify-content:center;padding:16px";
  dlg.innerHTML = `<div class="bg-white rounded p-3" style="max-width:420px;width:100%">
    <div class="fw-semibold mb-2" id="rp-title"></div>
    <label class="form-label small mb-1">Reason</label>
    <select id="rp-reason" class="form-select mb-2">${REASONS.map(r => `<option>${r}</option>`).join("")}</select>
    <label class="form-label small mb-1">Details (optional)</label>
    <textarea id="rp-details" class="form-control mb-3" rows="3" maxlength="300" placeholder="Tell the admin what happened"></textarea>
    <div class="d-flex gap-2"><button id="rp-cancel" class="btn btn-outline-secondary flex-fill">Cancel</button>
    <button id="rp-send" class="btn btn-danger flex-fill">Submit report</button></div></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector("#rp-cancel").onclick = () => dlg.style.display = "none";
  dlg.querySelector("#rp-send").onclick = send;
}

async function send() {
  const user = auth.currentUser, btn = dlg.querySelector("#rp-send");
  if (!user) return showToast("Please log in first", "error");
  btn.disabled = true;
  try {
    await submitReport({ ...current, reason: dlg.querySelector("#rp-reason").value, details: dlg.querySelector("#rp-details").value }, user);
    dlg.style.display = "none";
    showToast("Report sent. Thank you, an admin will review it.", "success");
  } catch (err) {
    console.error("[REPORT]", err);
    showToast(err.code === "permission-denied" ? "Only verified students can report" : "Could not send report", "error");
  }
  btn.disabled = false;
}

export async function openReportDialog(target) {
  const user = auth.currentUser;
  if (!user) return showToast("Please log in to report", "error");
  if (target.targetId === user.uid) return showToast("You cannot report yourself", "error");
  try {
    if (await hasReported(target.type, target.targetId, user.uid)) return showToast("You already reported this", "info");
  } catch (e) { console.warn("[REPORT] check skipped", e.code); }
  if (!dlg) build();
  current = target;
  dlg.querySelector("#rp-title").innerHTML = `Report ${target.type === "listing" ? "listing" : "user"}: ${esc(target.targetName)}`;
  dlg.querySelector("#rp-details").value = "";
  dlg.style.display = "flex";
}
