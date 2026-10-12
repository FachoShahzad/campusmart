/** js/pwa-install.js — shows an "Install CampusMart" button when the browser allows installing the app. */
let deferred = null;
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferred = e;
  if (standalone || document.getElementById("cm-install")) return;
  const b = document.createElement("div");
  b.id = "cm-install";
  b.style.cssText = "position:fixed;left:16px;bottom:150px;z-index:1030;display:flex;align-items:center;gap:6px;background:#059669;color:#fff;border-radius:999px;padding:4px 6px 4px 14px;box-shadow:0 4px 12px #0004;font-weight:600;font-size:.9rem";
  b.innerHTML = `<span style="cursor:pointer" id="cm-install-go">📲 Install CampusMart</span><button id="cm-install-x" aria-label="Dismiss" style="border:0;background:#0003;color:#fff;border-radius:50%;width:26px;height:26px">×</button>`;
  document.body.appendChild(b);
  b.querySelector("#cm-install-go").onclick = async () => {
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null; b.remove();
  };
  b.querySelector("#cm-install-x").onclick = () => b.remove();
});
window.addEventListener("appinstalled", () => document.getElementById("cm-install")?.remove());
