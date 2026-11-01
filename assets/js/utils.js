export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const clone = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

export const uid = (prefix = "id") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function debounce(fn, ms = 300) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  wrapped.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  return wrapped;
}

export function throttleRaf(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function formatDate(ts, opts = {}) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  });
}

export function relativeTime(ts) {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const units = [
    [60_000, "second", 1000],
    [3_600_000, "minute", 60_000],
    [86_400_000, "hour", 3_600_000],
    [Infinity, "day", 86_400_000],
  ];
  for (const [limit, unit, base] of units) {
    if (abs < limit) {
      const n = Math.max(1, Math.round(abs / base));
      const label = `${n} ${unit}${n === 1 ? "" : "s"}`;
      return future ? `in ${label}` : `${label} ago`;
    }
  }
  return formatDate(ts);
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const ALLOWED_TAGS = new Set(["A", "B", "STRONG", "I", "EM", "U", "BR", "P", "SPAN", "CODE"]);
const ALLOWED_SPAN_STYLES = new Set([
  "color",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
]);
const SAFE_PROTOCOLS = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i;

export function sanitizeUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (!SAFE_PROTOCOLS.test(value)) return "";
  if (/^javascript:/i.test(value) || /^data:/i.test(value) || /^vbscript:/i.test(value)) {
    return "";
  }
  return value;
}

function cleanInlineStyle(style) {
  const out = [];
  for (const chunk of String(style || "").split(";")) {
    const [rawProp, ...rest] = chunk.split(":");
    const prop = (rawProp || "").trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!prop || !value || !ALLOWED_SPAN_STYLES.has(prop)) continue;
    if (/url\(|expression|var\(|@|\\/i.test(value)) continue;
    if (!/^[#a-z0-9(),.%\s-]+$/i.test(value)) continue;
    out.push(`${prop}: ${value}`);
  }
  return out.join("; ");
}

export function sanitizeHtml(input) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(input ?? "");
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE || child.nodeType === Node.DOCUMENT_TYPE_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      if (!ALLOWED_TAGS.has(child.tagName)) {
        const fragment = document.createDocumentFragment();
        // Contenteditable implementations often use <div> for a new line.
        // Keep the visual line break while stripping the block wrapper.
        if (child.tagName === "DIV") fragment.appendChild(document.createElement("br"));
        while (child.firstChild) fragment.appendChild(child.firstChild);
        child.replaceWith(fragment);
        // process the unwrapped content in place
        walk(node);
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (child.tagName === "A" && name === "href") {
          const safe = sanitizeUrl(attr.value);
          if (!safe) child.removeAttribute(attr.name);
          else child.setAttribute("href", safe);
          continue;
        }
        if (child.tagName === "A" && name === "title") continue;
        if (child.tagName === "SPAN" && name === "style") {
          const safeStyle = cleanInlineStyle(attr.value);
          if (safeStyle) child.setAttribute("style", safeStyle);
          else child.removeAttribute("style");
          continue;
        }
        child.removeAttribute(attr.name);
      }
      if (child.tagName === "A") {
        const href = child.getAttribute("href") || "";
        if (/^https?:/i.test(href)) {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
      }
      walk(child);
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

export function plainText(html) {
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html);
  div.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
  div.querySelectorAll("p").forEach((p) => p.appendChild(document.createTextNode(" ")));
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}

export function safeCssValue(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  if (/[;{}<>\\]/.test(v)) return "";
  if (/url\(|expression|@import|javascript:/i.test(v)) return "";
  return v;
}

export function cssLength(value) {
  const v = safeCssValue(value);
  if (!v) return "";
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|%|ch|vw|vh|vmin|vmax)$/.test(v)) return v;
  if (/^clamp\([0-9.+\-*/\s,a-z%()]+\)$/.test(v)) return v;
  return "";
}

export function hexToRgb(hex) {
  let h = String(hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const to = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const COLOR_FN = /^rgba?\(([^)]+)\)$/i;

export function parseColor(input) {
  const value = String(input || "").trim();
  const hex = hexToRgb(value);
  if (hex) return hex;
  const m = value.match(COLOR_FN);
  if (m) {
    const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
  }
  return null;
}

export function luminance(rgb) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(colorA, colorB) {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  if (!a || !b) return null;
  const l1 = luminance(a);
  const l2 = luminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

export function contrastLabel(ratio) {
  if (!ratio) return { grade: "—", tone: "neutral" };
  if (ratio >= 7) return { grade: "AAA", tone: "positive" };
  if (ratio >= 4.5) return { grade: "AA", tone: "positive" };
  if (ratio >= 3) return { grade: "AA Large", tone: "warning" };
  return { grade: "Fail", tone: "destructive" };
}

export function getComputedColor(el, prop) {
  if (!el) return "";
  return getComputedStyle(el).getPropertyValue(prop).trim();
}

export function nearestBackground(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && !/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg) && bg !== "transparent") return bg;
    node = node.parentElement;
  }
  return getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim() || "#000";
}

// Word diff: returns token arrays flagged where changed.
export function wordDiff(original, proposed) {
  const tokenize = (s) => String(s || "").match(/\S+\s*/g) || [];
  const a = tokenize(original);
  const b = tokenize(proposed);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i].trim().toLowerCase() === b[j].trim().toLowerCase()
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left = [];
  const right = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].trim().toLowerCase() === b[j].trim().toLowerCase()) {
      left.push({ text: a[i], changed: false });
      right.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ text: a[i], changed: true, removed: true });
      i++;
    } else {
      right.push({ text: b[j], changed: true, added: true });
      j++;
    }
  }
  while (i < n) left.push({ text: a[i++], changed: true, removed: true });
  while (j < m) right.push({ text: b[j++], changed: true, added: true });
  return { left, right };
}

export function diffHtml(tokens) {
  return tokens
    .map((t) =>
      t.changed
        ? `<mark class="diff-mark ${t.added ? "is-added" : "is-removed"}">${esc(t.text)}</mark>`
        : esc(t.text)
    )
    .join("");
}

export function downloadFile(filename, contents, type = "application/json") {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function imageSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

export function toBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "OPTION"
  );
}

export function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function modKey() {
  return isMac() ? "⌘" : "Ctrl";
}

export function shortTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return clone(patch ?? base);
  if (typeof base === "object" && base && typeof patch === "object" && patch) {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = k in base ? deepMerge(base[k], v) : clone(v);
    }
    return out;
  }
  return patch === undefined ? clone(base) : clone(patch);
}

export function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}
