import React from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import App from "./App.tsx";
import "./index.css";
import { captureAppInstallPrompt } from "./lib/app-install";
captureAppInstallPrompt();


// Prevent the service worker from interfering when the app is embedded in an iframe (e.g. dev previews)
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

if (isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// Deploy-safe recovery for occasional chunk load failures.
function installChunkLoadRecovery() {
  if (typeof window === "undefined") return;
  const KEY = "__yamilook_chunk_reload_count__";
  const MAX_RELOADS = 2;

  // Reset the counter once the app has loaded cleanly, so a *future* bad deploy
  // can recover again (the counter only guards against a reload loop).
  window.addEventListener("load", () => {
    setTimeout(() => { try { window.sessionStorage.removeItem(KEY); } catch { /* noop */ } }, 4000);
  });

  const reloadLimited = async (reason: string) => {
    try {
      const current = Number(window.sessionStorage.getItem(KEY) ?? "0") || 0;
      if (current >= MAX_RELOADS) return;
      window.sessionStorage.setItem(KEY, String(current + 1));

      // A stale service worker can keep serving a cached index.html that points
      // at chunk hashes deleted by a newer deploy — reloading alone just re-serves
      // the broken page. Drop the SW + caches first so the reload fetches fresh.
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (typeof window.caches !== "undefined") {
          const keys = await window.caches.keys();
          await Promise.all(keys.map((k) => window.caches.delete(k)));
        }
      } catch { /* best-effort */ }

      const url = new URL(window.location.href);
      url.searchParams.set("__cr", String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target as (Partial<HTMLScriptElement> & Partial<HTMLLinkElement>) | null;
      const src: string | undefined = target?.src || target?.href;

      if (!src) {
        const message = (event as unknown as ErrorEvent).message ?? "";
        if (
          message.includes("Invalid hook call") ||
          message.includes("dispatcher.useEffect") ||
          message.includes("Importing a module script failed") ||
          message.includes("Failed to fetch dynamically imported module")
        ) {
          reloadLimited(`runtime_error:${message}`);
        }
        return;
      }

      if (
        src.includes("/assets/") ||
        src.includes("/node_modules/.vite/") ||
        src.endsWith(".js") ||
        src.endsWith(".mjs")
      ) {
        reloadLimited(`script_error:${src}`);
      }
    },
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    const reasonObj = reason as { message?: unknown; stack?: unknown } | null | undefined;
    const message =
      typeof reasonObj?.message === "string"
        ? reasonObj.message
        : typeof reason === "string"
          ? reason
          : "";

    if (
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed") ||
      message.includes("Loading chunk") ||
      message.includes("chunk-") ||
      message.includes(".vite/deps/") ||
      message.includes("import.meta") ||
      // Safari-specific
      (message.includes("Load failed") && (typeof reasonObj?.stack === "string" ? reasonObj.stack : "").includes("import"))
    ) {
      event.preventDefault();
      reloadLimited(`dynamic_import:${message}`);
    }
  });
}

installChunkLoadRecovery();

// When a newly-deployed service worker takes control (autoUpdate + clientsClaim),
// reload once so the page runs the fresh deploy instead of stale cached chunks.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  let swReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swReloaded) return;
    swReloaded = true;
    window.location.reload();
  });
}

// PWA: regista o service worker (modo autoUpdate) e FORÇA a procura de novas
// versões — à carga, de hora a hora, e sempre que a app volta ao primeiro plano.
// Sem isto, um PWA que fica sempre aberto no telemóvel nunca chama update() e
// fica preso a um build antigo em cache (o autoUpdate/skipWaiting só dispara
// quando um SW novo é detetado). Não corre em iframe (previews de dev).
async function setupPwaAutoUpdate() {
  if (isInIframe) return;
  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, reg) {
        if (!reg) return;
        const check = () => reg.update().catch(() => {});
        setInterval(check, 60 * 60 * 1000); // de hora a hora
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check(); // ao voltar ao 1º plano
        });
      },
    });
  } catch {
    // ambiente sem PWA (ex.: dev sem devOptions) — ignora
  }
}

void setupPwaAutoUpdate();

// Render immediately for instant first paint
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>
);
