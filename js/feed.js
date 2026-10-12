/**
 * js/feed.js — Modules 6 + 7: Home feed, search, filters, wishlist hearts
 * One query loads the newest 100 listings (no composite index needed);
 * search / filters / sort / pagination (12 per page) run in the browser.
 */
import { db, auth } from "/js/firebase.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { showToast } from "/js/app.js";
import { CATEGORIES, CONDITIONS, priceLabel, esc } from "/js/listings.js";
import { getWishlistIds, toggleWishlist } from "/js/wishlist.js";
import { currentExamSeason, isHighDemand } from "/js/campus.js";
import { matchesSearch, hasCriteria, listSavedSearches, saveSearch, deleteSavedSearch, MAX_SAVED } from "/js/savedSearches.js";

const PAGE_SIZE = 12;
let all = [], category = "All", sort = "newest", shown = PAGE_SIZE;
let f = { q: "", min: "", max: "", cond: "", dept: "", sem: "" };
let uid = null, wish = new Set(), saved = [], extSearch = null;

const root = document.getElementById("cm-feed") || (() => {
  const d = document.createElement("div");
  d.id = "cm-feed";
  (document.querySelector("main") || document.body).appendChild(d);
  return d;
})();

/** Match the width/margins of the rest of the home page (measured from the "Fresh Campus Listings" heading row). */
function alignFeed() {
  const h = [...document.querySelectorAll("h1,h2,h3,h4,h5")].find(x => /fresh campus listings/i.test(x.textContent));
  const w = h?.parentElement ? h.parentElement.getBoundingClientRect().width : 0;
  const full = document.documentElement.clientWidth;
  root.style.marginInline = "auto";
  root.style.marginBottom = "96px";           // room for the bottom nav and chat button
  if (root.closest(".cm-container")) return;   // already inside the page container: nothing to align
  if (w > 200 && w < full - 8) { root.style.maxWidth = w + "px"; root.style.padding = "0"; }
  else { root.style.maxWidth = "1200px"; root.style.padding = "0 16px"; }
}
alignFeed();
window.addEventListener("resize", alignFeed);

const style = document.createElement("style");
style.textContent = `
  .cmf-chips{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px}
  .cmf-chip{border:1px solid #cfd8e3;background:#fff;border-radius:999px;padding:6px 14px;white-space:nowrap;font-size:.9rem}
  .cmf-chip.active{background:#1a4078;border-color:#1a4078;color:#fff}
  .cmf-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  @media(min-width:992px){.cmf-grid{grid-template-columns:repeat(4,1fr)}}
  .cmf-card{display:block;color:inherit;text-decoration:none;border:1px solid #e5e9ef;border-radius:12px;overflow:hidden;background:#fff}
  .cmf-img{position:relative;aspect-ratio:1/1;background:#f1f3f5}
  .cmf-img img{width:100%;height:100%;object-fit:cover}
  .cmf-price{position:absolute;left:8px;bottom:8px;background:#059669;color:#fff;border-radius:8px;padding:2px 8px;font-weight:600;font-size:.85rem}
  .cmf-heart{position:absolute;right:8px;top:8px;width:34px;height:34px;border:0;border-radius:50%;background:#fffd;color:#dc3545;font-size:1.1rem}
  .cmf-tag{position:absolute;left:8px;top:8px;background:#f59e0b;color:#000;border-radius:8px;padding:2px 8px;font-size:.72rem;font-weight:600}
  .cmf-body{padding:8px 10px}
  .cmf-title{font-weight:600;font-size:.92rem;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .cmf-meta{font-size:.78rem;color:#6b7280}
  .cmf-ss{display:inline-flex;max-width:100%;border:1px solid #cfd8e3;border-radius:999px;background:#fff;overflow:hidden}
  .cmf-ss button{border:0;background:none;padding:5px 10px;font-size:.85rem}
  .cmf-ss .lab{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cmf-ss .del{color:#6b7280;border-left:1px solid #e5e9ef}
`;
document.head.appendChild(style);

// Static shell: built once so the search box keeps focus while typing
root.innerHTML = `
  <div class="input-group mb-2">
    <input id="cmf-q" class="form-control" placeholder="Search books, notes, electronics..." autocomplete="off">
    <button id="cmf-ftoggle" class="btn btn-outline-secondary" type="button"><i class="bi bi-sliders"></i> Filters</button>
  </div>
  <div id="cmf-filters" class="row g-2 mb-2 d-none">
    <div class="col-6 col-md-2"><input id="cmf-min" type="number" min="0" class="form-control form-control-sm" placeholder="Min price"></div>
    <div class="col-6 col-md-2"><input id="cmf-max" type="number" min="0" class="form-control form-control-sm" placeholder="Max price"></div>
    <div class="col-6 col-md-2"><select id="cmf-cond" class="form-select form-select-sm"><option value="">Any condition</option>${CONDITIONS.map(c => `<option>${c}</option>`).join("")}</select></div>
    <div class="col-6 col-md-3"><input id="cmf-dept" class="form-control form-control-sm" placeholder="Department"></div>
    <div class="col-6 col-md-2"><select id="cmf-sem" class="form-select form-select-sm"><option value="">Any semester</option>${[1,2,3,4,5,6,7,8].map(n => `<option value="${n}">Semester ${n}</option>`).join("")}</select></div>
    <div class="col-6 col-md-1"><button id="cmf-clear" class="btn btn-sm btn-link" type="button">Clear</button></div>
  </div>
  <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
    <h2 class="h5 mb-0" id="cmf-count">Fresh Campus Listings</h2>
    <select id="cmf-sort" class="form-select form-select-sm" style="width:auto">
      <option value="newest">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
    </select>
  </div>
  <div id="cmf-saved" class="d-flex flex-wrap align-items-center gap-2 mb-2"></div>
  <div id="cmf-exam"></div>
  <div id="cmf-chips" class="cmf-chips"></div>
  <div id="cmf-results"><div class="text-center text-muted py-5">Loading items...</div></div>`;
const $ = id => document.getElementById(id);

function ago(ts) {
  if (!ts?.toDate) return "";
  const m = Math.floor((Date.now() - ts.toDate().getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  if (m < 1440) return Math.floor(m / 60) + " h ago";
  return Math.floor(m / 1440) + " d ago";
}

/** Current search box + filters + category as one criteria object (shared with Saved Searches). */
const criteria = () => ({ ...f, category, sort });

/** Apply search, filters and sort. Sold items are hidden. */
function visible() {
  const c = criteria();
  let list = all.filter(l => matchesSearch(l, c));
  if (sort !== "newest") {
    const priced = list.filter(l => !l.isGiveaway && !l.isBarter);
    const others = list.filter(l => l.isGiveaway || l.isBarter);
    priced.sort((a, b) => sort === "low" ? a.price - b.price : b.price - a.price);
    list = [...priced, ...others];
  }
  return list;
}

/** Saved searches row: "Save this search" button + one chip per saved search (tap = re-run, x = delete). */
function renderSaved() {
  if (!uid) { $("cmf-saved").innerHTML = ""; return; }
  const can = hasCriteria(criteria());
  $("cmf-saved").innerHTML =
    (can ? `<button id="cmf-save" class="btn btn-sm btn-outline-secondary" type="button"><i class="bi bi-bookmark-plus"></i> Save this search</button>` : "") +
    (saved.length ? `<span class="small text-muted">Saved:</span>` : "") +
    saved.map(s => `<span class="cmf-ss"><button class="lab" data-ss="${esc(s.id)}" title="Run this search">${esc(s.name)}</button><button class="del" data-ssdel="${esc(s.id)}" aria-label="Delete saved search">&times;</button></span>`).join("");
}

/** Put a saved search back into the search box, filters, category and sort, then show the results. */
function applySearch(c) {
  f = { q: c.q || "", min: c.min || "", max: c.max || "", cond: c.cond || "", dept: c.dept || "", sem: c.sem || "" };
  category = c.category || "All"; sort = c.sort || "newest"; shown = PAGE_SIZE;
  $("cmf-q").value = f.q; if (extSearch) extSearch.value = f.q;
  ["min", "max", "cond", "dept", "sem"].forEach(k => $("cmf-" + k).value = f[k]);
  $("cmf-sort").value = sort;
  if (f.min || f.max || f.cond || f.dept || f.sem) $("cmf-filters").classList.remove("d-none");
  render();
  $("cmf-results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function tagFor(l) {
  if (l.isBundle) return "Bundle";
  return currentExamSeason() && isHighDemand(l) ? "🔥 High demand" : "";
}

function card(l) {
  const on = wish.has(l.id);
  return `<a class="cmf-card" href="/listing.html?id=${encodeURIComponent(l.id)}">
    <div class="cmf-img"><img loading="lazy" src="${l.photos?.[0] || ""}" alt="${esc(l.title)}">
      <span class="cmf-price">${priceLabel(l)}</span>${tagFor(l) ? `<span class="cmf-tag">${tagFor(l)}</span>` : ""}
      <button class="cmf-heart" data-id="${esc(l.id)}" aria-label="Save to wishlist"><i class="bi ${on ? "bi-heart-fill" : "bi-heart"}"></i></button></div>
    <div class="cmf-body">
      <div class="cmf-title">${esc(l.title)}</div>
      <div class="cmf-meta">${esc(l.condition)}${l.status === "reserved" ? " · Reserved" : ""}</div>
      <div class="cmf-meta">${esc(l.sellerName || "Student")} · ${ago(l.createdAt)}</div>
    </div></a>`;
}

function render() {
  const list = visible();
  $("cmf-count").textContent = list.length === all.filter(l => l.status !== "sold").length ? "Fresh Campus Listings" : `${list.length} result${list.length === 1 ? "" : "s"}`;
  const season = currentExamSeason();
  $("cmf-exam").innerHTML = season ? `<div class="alert alert-warning py-2 small mb-2">🔥 <strong>${esc(season.name)}</strong>: books, notes and past papers are in high demand right now.</div>` : "";
  $("cmf-chips").innerHTML = ["All", ...CATEGORIES].map(c =>
    `<button class="cmf-chip ${c === category ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
  document.querySelectorAll("#category-chips [data-cat]").forEach(a => a.classList.toggle("active", a.dataset.cat === category));
  const empty = `<div class="text-center text-muted py-5">No items match your search.<br><a href="/post-listing.html">Post an item</a></div>`;
  renderSaved();
  $("cmf-results").innerHTML = (list.length ? `<div class="cmf-grid">${list.slice(0, shown).map(card).join("")}</div>` : empty) +
    (list.length > shown ? `<div class="text-center mt-3"><button id="cmf-more" class="btn btn-outline-primary">Load more</button></div>` : "");
}

function setFilter(key, val) { f[key] = val; shown = PAGE_SIZE; render(); }
$("cmf-q").addEventListener("input", e => setFilter("q", e.target.value));
$("cmf-min").addEventListener("input", e => setFilter("min", e.target.value));
$("cmf-max").addEventListener("input", e => setFilter("max", e.target.value));
$("cmf-cond").addEventListener("change", e => setFilter("cond", e.target.value));
$("cmf-dept").addEventListener("input", e => setFilter("dept", e.target.value));
$("cmf-sem").addEventListener("change", e => setFilter("sem", e.target.value));
$("cmf-sort").addEventListener("change", e => { sort = e.target.value; shown = PAGE_SIZE; render(); });
$("cmf-ftoggle").addEventListener("click", () => $("cmf-filters").classList.toggle("d-none"));
$("cmf-clear").addEventListener("click", () => {
  f = { q: "", min: "", max: "", cond: "", dept: "", sem: "" };
  ["q", "min", "max", "cond", "dept", "sem"].forEach(k => $("cmf-" + k).value = "");
  shown = PAGE_SIZE; render();
});

root.addEventListener("click", async e => {
  const heart = e.target.closest(".cmf-heart");
  if (heart) {
    e.preventDefault(); e.stopPropagation();   // heart sits inside the card link
    if (!uid) return showToast("Log in to save items", "info");
    const id = heart.dataset.id, on = !wish.has(id);
    on ? wish.add(id) : wish.delete(id);
    heart.innerHTML = `<i class="bi ${on ? "bi-heart-fill" : "bi-heart"}"></i>`;
    try { await toggleWishlist(uid, id, on, all.find(l => l.id === id)); showToast(on ? "Saved to wishlist" : "Removed from wishlist", "success"); }
    catch (err) {
      console.error("[WISHLIST]", err);
      on ? wish.delete(id) : wish.add(id); render();
      showToast("Could not update wishlist", "error");
    }
    return;
  }
  const saveBtn = e.target.closest("#cmf-save");
  if (saveBtn) {
    try {
      const r = await saveSearch(uid, criteria(), saved);
      if (r.saved) { saved = [r.item, ...saved]; renderSaved(); showToast("Search saved. We will alert you about new matches.", "success"); }
      else showToast(r.reason === "duplicate" ? "This search is already saved" : r.reason === "limit" ? `You can save up to ${MAX_SAVED} searches` : "Type a keyword or choose a filter first", "info");
    } catch (err) {
      console.error("[SAVED SEARCH]", err);
      showToast(err.code === "permission-denied" ? "Only verified students can save searches" : "Could not save the search", "error");
    }
    return;
  }
  const runBtn = e.target.closest("[data-ss]");
  if (runBtn) { const s = saved.find(x => x.id === runBtn.dataset.ss); if (s) applySearch(s); return; }
  const delBtn = e.target.closest("[data-ssdel]");
  if (delBtn) {
    const id = delBtn.dataset.ssdel;
    try { await deleteSavedSearch(uid, id); saved = saved.filter(x => x.id !== id); renderSaved(); showToast("Saved search removed", "success"); }
    catch (err) { console.error("[SAVED SEARCH]", err); showToast("Could not remove it", "error"); }
    return;
  }
  const chip = e.target.closest(".cmf-chip");
  if (chip) { category = chip.dataset.cat; shown = PAGE_SIZE; render(); }
  if (e.target.id === "cmf-more") { shown += PAGE_SIZE; render(); }
});

// Connect the original search bar at the top of the page (if present) to the feed search
try {
  const ext = document.querySelector('input[placeholder*="earch" i]:not(#cmf-q)');
  extSearch = ext;
  if (ext) {
    const go = () => $("cmf-results").scrollIntoView({ behavior: "smooth", block: "start" });
    ext.addEventListener("input", () => { $("cmf-q").value = ext.value; setFilter("q", ext.value); });
    ext.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    ext.closest("form")?.addEventListener("submit", e => { e.preventDefault(); go(); });
    ext.parentElement?.querySelector("button")?.addEventListener("click", e => { e.preventDefault(); go(); });
    $("cmf-q").addEventListener("input", e => { ext.value = e.target.value; });
    if (ext.value) setFilter("q", ext.value);
    $("cmf-q").style.display = "none";                 // the top search bar is the search box; keep only the Filters button
    $("cmf-ftoggle").classList.add("rounded");
  }
} catch (e) { console.warn("[FEED] top search not linked:", e); }

// Category chips at the top of the page filter this feed
const topChips = document.getElementById("category-chips");
if (topChips) {
  $("cmf-chips").style.display = "none";
  topChips.addEventListener("click", e => {
    const a = e.target.closest("[data-cat]"); if (!a) return;
    e.preventDefault();
    category = a.dataset.cat; shown = PAGE_SIZE; render();
    $("cmf-results").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

onAuthStateChanged(auth, async user => {
  uid = user ? user.uid : null;
  wish = new Set();
  saved = [];
  if (uid) { try { wish = await getWishlistIds(uid); } catch (e) { console.warn("[WISHLIST] load skipped:", e.code); } }
  if (uid) { try { saved = await listSavedSearches(uid); } catch (e) { console.warn("[SAVED SEARCH] load skipped:", e.code); } }
  if (all.length) render(); else renderSaved();
});

(async () => {
  try {
    const snap = await getDocs(query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(100)));
    all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch (err) {
    console.error("[FEED]", err);
    $("cmf-results").innerHTML = `<div class="alert alert-danger">Could not load items. ${err.code === "permission-denied" ? "Check firestore.rules for listings read access." : "Check your connection."}</div>`;
  }
})();
