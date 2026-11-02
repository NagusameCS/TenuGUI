import { store } from "./store.js";
import { createDefaultState } from "./content.js";
import { applyTheme, renderSite } from "./render.js";
import { toast } from "./ui.js";
import { isTypingTarget } from "./utils.js";
import { editor } from "./editor.js";

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let mounted = false;

const currentState = () =>
  store.previewSnapshot || (store.editorActive ? store.state : store.sitePublished);

function applyMotion() {
  const reduced =
    store.motion === "reduced" || (store.motion !== "full" && motionQuery.matches) || false;
  document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  document.body.classList.toggle("preview-reduced", reduced);
}

function updateThemeImages() {
  const mode = store.mode;
  for (const img of document.querySelectorAll("img[data-theme-img]")) {
    const next = mode === "light" ? img.dataset.light : img.dataset.dark;
    if (next && img.getAttribute("src") !== next) img.setAttribute("src", next);
  }
}

function updateFavicon() {
  const state = currentState();
  const inst = state.assets?.instances?.favicon;
  const set = (rel, sizes, fallback) => {
    const link = document.querySelector(`link[rel="${rel}"]${sizes ? `[sizes="${sizes}"]` : ""}`);
    if (!link) return;
    link.setAttribute("href", inst?.src || fallback);
  };
  set("icon", "32x32", "assets/img/brand/favicon-32.png?v=33");
  set("icon", "16x16", "assets/img/brand/favicon-16.png?v=33");
  set("shortcut icon", "", "assets/img/brand/favicon.ico?v=33");
  set("apple-touch-icon", "180x180", "assets/img/brand/favicon-180.png?v=33");
}

function updateMetaTheme() {
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) {
    const tokens = store.state.theme?.tokens?.[store.mode] || {};
    if (tokens.canvas) meta.setAttribute("content", tokens.canvas);
  }
}

export function renderView() {
  const state = currentState();
  applyTheme(state, store.mode);
  applyMotion();
  renderSite(state, { mode: store.mode });
  updateThemeImages();
  updateFavicon();
  updateMetaTheme();
  if (store.editorActive) editor.onSiteRendered();
}

async function startDemo() {
  if (store.editorActive) {
    toast("You are already editing this page.", { iconName: "pen" });
    return;
  }
  await editor.start({ role: "owner", demo: false });
}

function toggleTheme() {
  store.setMode(store.mode === "dark" ? "light" : "dark");
}

function openMobileNav() {
  const el = document.getElementById("mobile-nav");
  if (el && typeof el.showModal === "function") el.showModal();
}

function closeMobileNav() {
  const el = document.getElementById("mobile-nav");
  try {
    el?.close();
  } catch {}
}

function siteAction(event) {
  if (event.target.closest("#mobile-nav a")) closeMobileNav();
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.closest("#editor-ui, .editor-bar, .inspector, .format-bar, .edit-toolbar, .ctx-menu, .dialog")) {
    return;
  }
  const action = target.dataset.action;
  if (!action) return;
  switch (action) {
    case "start-demo":
      event.preventDefault();
      closeMobileNav();
      startDemo();
      break;
    case "toggle-theme":
      event.preventDefault();
      toggleTheme();
      if (target.closest("#mobile-nav")) closeMobileNav();
      break;
    case "open-mobile-nav":
      event.preventDefault();
      openMobileNav();
      break;
    case "close-mobile-nav":
      event.preventDefault();
      closeMobileNav();
      break;
    default:
      break;
  }
}

function keyboard(event) {
  if (event.defaultPrevented) return;
  if (isTypingTarget(event.target)) return;
  if (event.key === "T" && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const openDialog = document.querySelector("dialog[open]");
    if (openDialog) return;
    event.preventDefault();
    if (store.editorActive) {
      editor.requestExit();
    } else {
      startDemo();
    }
  }
}

function bindStore() {
  store.on("mode", () => {
    renderView();
  });
  store.on("motion", () => applyMotion());
  store.on("live", () => {
    applyTheme(store.state, store.mode);
    updateThemeImages();
    updateMetaTheme();
    if (store.editorActive) editor.onLive();
  });
  store.on("change", () => {
    renderView();
  });
  store.on("session", () => {
    document.body.classList.add("editor-active");
    renderView();
    editor.onSession();
  });
  store.on("session-end", () => {
    document.body.classList.remove("editor-active", "preview-mode", "bp-preview", "inspector-open");
    renderView();
    editor.onSessionEnd();
  });
  store.on("conflict", (conflict) => editor.onConflict(conflict));
  store.on("save-error", (message) => {
    toast(`Save failed: ${message}`, { tone: "destructive", iconName: "warning", timeout: 5000 });
  });
}

function mountEditor() {
  editor.mount({
    renderView,
    startDemo,
    toggleTheme,
    showToast: toast,
    currentState,
  });
}

async function boot() {
  document.body.classList.add("app-loading");
  // Instant paint with bundled defaults.
  store.mode = localStorage.getItem("tenugui:mode") === "dark" ? "dark" : "light";
  const initial = createDefaultState();
  applyTheme(initial, store.mode);
  applyMotion();
  renderSite(initial, { mode: store.mode });
  updateThemeImages();
  updateFavicon();
  updateMetaTheme();

  await store.init();
  renderView();
  bindStore();
  mountEditor();
  document.addEventListener("click", siteAction);
  document.addEventListener("keydown", keyboard);
  motionQuery.addEventListener?.("change", applyMotion);
  document.body.classList.remove("app-loading");
  mounted = true;
}

boot().catch((err) => {
  console.error(err);
  toast("Something went wrong while loading TenuGUI.", {
    tone: "destructive",
    iconName: "warning",
    timeout: 6000,
  });
});

window.addEventListener("pagehide", () => {
  if (store.editorActive) store.saveNow();
});

export { startDemo, toggleTheme };
