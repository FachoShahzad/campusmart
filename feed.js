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

const PAGE_SIZE = 12;
let all = [], category = "All", sort = "newest", shown = PAGE_SIZE;
let f = { q: "", min: "", max: "", cond: "", dept: "", sem: "" };
let uid = null, wish = new Set();

const root = document.getElementById("cm-feed") || (() => {
  const d = document.createElement("div");
  d.id = "cm-feed";
  (document.querySelector("main") || document.body).appendChild(d);
  return d;
})();

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
  .cmf-body{padding:8px 10px}
  .cmf-title{font-weight:600;font-size:.92rem;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .cmf-meta{font-size:.78rem;color:#6b7280}
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
    <h2 class="h5 mb-0" id="cmf-count">Latest items</h2>
    <select id="cmf-sort" class="form-select form-select-sm" style="width:auto">
      <option value="newest">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
    </select>
  </div>
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

/** Apply search, filters and sort. Sold items are hidden. */
function visible() {
  const q = f.q.trim().toLowerCase(), dept = f.dept.trim().toLowerCase();
  const priceOn = f.min !== "" || f.max !== "";
  let list = all.filter(l => {
    if (l.status === "sold") return false;
    if (category !== "All" && l.category !== category) return false;
    if (q && !`${l.title} ${l.description} ${l.category} ${l.department}`.toLowerCase().includes(q)) return false;
    if (f.cond && l.condition !== f.cond) return false;
    if (dept && !(l.department || "").toLowerCase().includes(dept)) return false;
    if (f.sem && String(l.semester) !== f.sem) return false;
    if (priceOn) {
      if (l.isGiveaway || l.isBarter) return false;
      if (f.min !== "" && l.price < Number(f.min)) return false;
      if (f.max !== "" && l.price > Number(f.max)) return false;
    }
    return true;
  });
  if (sort !== "newest") {
    const priced = list.filter(l => !l.isGiveaway && !l.isBarter);
    const others = list.filter(l => l.isGiveaway || l.isBarter);
    priced.sort((a, b) => sort === "low" ? a.price - b.price : b.price - a.price);
    list = [...priced, ...others];
  }
  return list;
}

function card(l) {
  const on = wish.has(l.id);
  return `<a class="cmf-card" href="/listing.html?id=${encodeURIComponent(l.id)}">
    <div class="cmf-img"><img loading="lazy" src="${l.photos?.[0] || ""}" alt="${esc(l.title)}">
      <span class="cmf-price">${priceLabel(l)}</span>
      <button class="cmf-heart" data-id="${esc(l.id)}" aria-label="Save to wishlist"><i class="bi ${on ? "bi-heart-fill" : "bi-heart"}"></i></button></div>
    <div class="cmf-body">
      <div class="cmf-title">${esc(l.title)}</div>
      <div class="cmf-meta">${esc(l.condition)}${l.status === "reserved" ? " · Reserved" : ""}</div>
      <div class="cmf-meta">${esc(l.sellerName || "Student")} · ${ago(l.createdAt)}</div>
    </div></a>`;
}

function render() {
  const list = visible();
  $("cmf-count").textContent = list.length === all.filter(l => l.status !== "sold").length ? "Latest items" : `${list.length} result${list.length === 1 ? "" : "s"}`;
  $("cmf-chips").innerHTML = ["All", ...CATEGORIES].map(c =>
    `<button class="cmf-chip ${c === category ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
  const empty = `<div class="text-center text-muted py-5">No items match your search.<br><a href="/post-listing.html">Post an item</a></div>`;
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
    try { await toggleWishlist(uid, id, on); showToast(on ? "Saved to wishlist" : "Removed from wishlist", "success"); }
    catch (err) {
      console.error("[WISHLIST]", err);
      on ? wish.delete(id) : wish.add(id); render();
      showToast("Could not update wishlist", "error");
    }
    return;
  }
  const chip = e.target.closest(".cmf-chip");
  if (chip) { category = chip.dataset.cat; shown = PAGE_SIZE; render(); }
  if (e.target.id === "cmf-more") { shown += PAGE_SIZE; render(); }
});

// Connect the original search bar at the top of the page (if present) to the feed search
try {
  const ext = document.querySelector('input[placeholder*="earch" i]:not(#cmf-q)');
  if (ext) {
    const go = () => $("cmf-results").scrollIntoView({ behavior: "smooth", block: "start" });
    ext.addEventListener("input", () => { $("cmf-q").value = ext.value; setFilter("q", ext.value); });
    ext.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    ext.closest("form")?.addEventListener("submit", e => { e.preventDefault(); go(); });
    ext.parentElement?.querySelector("button")?.addEventListener("click", e => { e.preventDefault(); go(); });
    $("cmf-q").addEventListener("input", e => { ext.value = e.target.value; });
    if (ext.value) setFilter("q", ext.value);
  }
} catch (e) { console.warn("[FEED] top search not linked:", e); }

onAuthStateChanged(auth, async user => {
  uid = user ? user.uid : null;
  wish = new Set();
  if (uid) { try { wish = await getWishlistIds(uid); } catch (e) { console.warn("[WISHLIST] load skipped:", e.code); } }
  if (all.length) render();
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