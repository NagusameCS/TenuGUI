import { createDefaultState, DEFAULT_THEME, ROLES } from "./content.js";
import { clone, deepMerge, uid, debounce, sha256Hex, sanitizeHtml, clamp } from "./utils.js";

const DB_NAME = "tenugui-studio";
const DB_STORE = "kv";
const SALT = "tenugui/v1";
const ROLE_HASHES = {
  owner: "964817416ac9ef6980ed89df33617b93feaa747be20a2623b65facaa8154be82",
  editor: "d0fec638a9aa1415e6e53862417d20440c21b9abeaa9f653a55ba10f07dd8350",
  reviewer: "b53672af6c67c1d6bb0d5bbcae39e2944e717cf464d91f4c53fa17c5a5421a88",
};

const ITEM_SECTIONS = {
  features: { path: ["content", "features", "items"], prefix: "feature" },
  how: { path: ["content", "how", "steps"], prefix: "step" },
};

/* ------------------------------------------------------------------ storage */
let dbPromise = null;
function openDb() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }
  return dbPromise;
}

async function storageGet(key) {
  const db = await openDb();
  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }
  try {
    const raw = localStorage.getItem(`tenugui:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function storageSet(key, value) {
  const db = await openDb();
  if (db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error("Storage write failed"));
      tx.onabort = () => reject(tx.error || new Error("Storage write aborted"));
    });
  }
  localStorage.setItem(`tenugui:${key}`, JSON.stringify(value));
  return true;
}

async function storageDelete(key) {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
  localStorage.removeItem(`tenugui:${key}`);
  return true;
}

/* ------------------------------------------------------------------ helpers */
export function hydrate(raw) {
  if (!raw || typeof raw !== "object" || !raw.content || !raw.theme) return createDefaultState();
  const base = createDefaultState();
  const merged = deepMerge(base, raw);
  merged.schema = 1;
  return merged;
}

function getPath(obj, path) {
  return path.reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function summarizeChanges(a, b) {
  const counts = { text: 0, styles: 0, theme: 0, assets: 0, visibility: 0, structure: 0 };
  if (!a) a = createDefaultState();
  if (JSON.stringify(a.insertions || []) !== JSON.stringify(b.insertions || [])) counts.structure++;
  if (JSON.stringify(a.dynamics || []) !== JSON.stringify(b.dynamics || [])) counts.structure++;
  const textKeys = new Set([...Object.keys(a.text || {}), ...Object.keys(b.text || {})]);
  for (const key of textKeys) {
    if (JSON.stringify((a.text || {})[key]) !== JSON.stringify((b.text || {})[key])) counts.text++;
  }
  const styleKeys = new Set([...Object.keys(a.styles || {}), ...Object.keys(b.styles || {})]);
  for (const key of styleKeys) {
    if (JSON.stringify((a.styles || {})[key]) !== JSON.stringify((b.styles || {})[key])) counts.styles++;
  }
  if (JSON.stringify(a.theme) !== JSON.stringify(b.theme)) counts.theme = 1;
  if (
    JSON.stringify(a.assets?.instances || {}) !== JSON.stringify(b.assets?.instances || {}) ||
    JSON.stringify(a.assets?.uploads || {}) !== JSON.stringify(b.assets?.uploads || {})
  ) {
    counts.assets = 1;
  }
  const nodeKeys = new Set([...Object.keys(a.nodeState || {}), ...Object.keys(b.nodeState || {})]);
  for (const key of nodeKeys) {
    const na = a.nodeState?.[key] || {};
    const nb = b.nodeState?.[key] || {};
    if (
      na.hidden !== nb.hidden ||
      na.locked !== nb.locked ||
      JSON.stringify(na.link) !== JSON.stringify(nb.link) ||
      JSON.stringify(na.image) !== JSON.stringify(nb.image) ||
      na.icon !== nb.icon
    ) {
      counts.visibility++;
    }
  }
  const arrays = [
    a.content?.features?.items,
    a.content?.how?.steps,
    a.content?.nav,
    b.content?.features?.items,
    b.content?.how?.steps,
    b.content?.nav,
  ];
  const ids = (arr) => (arr || []).map((x) => x?.id).join(",");
  if (ids(arrays[0]) !== ids(arrays[3]) || ids(arrays[1]) !== ids(arrays[4]) || ids(arrays[2]) !== ids(arrays[5])) {
    counts.structure = 1;
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { ...counts, total };
}

function summaryText(changes) {
  const bits = [];
  if (changes.text) bits.push(`${changes.text} text ${changes.text === 1 ? "edit" : "edits"}`);
  if (changes.styles) bits.push(`${changes.styles} style ${changes.styles === 1 ? "change" : "changes"}`);
  if (changes.visibility) bits.push(`${changes.visibility} element ${changes.visibility === 1 ? "change" : "changes"}`);
  if (changes.structure) bits.push("structure");
  if (changes.theme) bits.push("theme");
  if (changes.assets) bits.push("assets");
  return bits.length ? bits.join(" · ") : "No changes";
}

/* ------------------------------------------------------------------ store */
class Store {
  constructor() {
    this.listeners = new Map();
    this.state = createDefaultState();
    this.sitePublished = createDefaultState();
    this.basePublished = createDefaultState();
    this.mode = "dark";
    this.role = null;
    this.demo = false;
    this.sessionKey = "owner";
    this.editorActive = false;
    this.preview = false;
    this.status = "published";
    this.lastSavedAt = null;
    this.saveError = null;
    this.history = { entries: [], index: -1 };
    this._tx = null;
    this._stamp = 0;
    this._savedStamp = 0;
    this._saving = null;
    this.revisions = [];
    this.customThemes = [];
    this.conflict = null;
    this.channel = null;
    this.tabId = uid("tab");
    this.ready = false;
    this.remoteLoaded = false;
    this.onLocalSaved = null;
    this._queueSave = debounce(() => this.saveNow(), 900);
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  emit(event, detail) {
    if (event !== "live") {
      this.listeners.get("any")?.forEach((cb) => cb({ event, detail }));
    }
    this.listeners.get(event)?.forEach((cb) => cb(detail));
  }

  getSetting(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`tenugui:${key}`);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  setSetting(key, value) {
    try {
      localStorage.setItem(`tenugui:${key}`, JSON.stringify(value));
    } catch {
      /* storage may be disabled */
    }
  }

  async init() {
    this.setStatus("published");
    const storedMode = localStorage.getItem("tenugui:mode");
    this.mode = storedMode === "light" ? "light" : storedMode === "dark" ? "dark" : null;
    this.motion = this.getSetting("motion", "system");
    if (!this.mode) {
      this.mode = "dark";
    }

    let remote = null;
    if (location.protocol === "file:") {
      // A double-clicked index.html has no HTTP origin to fetch content.json.
      // The bundled defaults are the same published content, so the editor still works.
      this.remoteLoaded = false;
    } else {
      try {
        const res = await fetch("content.json", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json && json.content && json.theme) remote = hydrate(json);
          this.remoteLoaded = true;
        }
      } catch {
        this.remoteLoaded = false;
      }
    }

    let local = null;
    try {
      local = await storageGet("published:owner");
    } catch {
      local = null;
    }
    const remoteAt = Number(remote?.publishedAt || 0);
    const localAt = Number(local?.publishedAt || 0);
    this.sitePublished = local && localAt >= remoteAt ? hydrate(local) : remote || createDefaultState();
    this.basePublished = this.sitePublished;
    this.state = clone(this.sitePublished);
    if (!storedMode) this.mode = this.state.theme?.defaultMode === "light" ? "light" : "dark";
    try {
      this.customThemes = (await storageGet("themes")) || [];
    } catch {
      this.customThemes = [];
    }
    this.ready = true;
    this.emit("ready");
  }

  async hasDraft({ demo = false } = {}) {
    const key = demo ? "demo" : "owner-v3";
    try {
      return Boolean(await storageGet(`draft:${key}`));
    } catch {
      return false;
    }
  }

  async startSession({ role = "demo", demo = false, discardDraft = false } = {}) {
    this.role = role;
    this.demo = demo || role === "demo";
    this.sessionKey = this.demo ? "demo" : "owner-v3";
    this.editorActive = true;
    this.preview = false;
    this.conflict = null;
    this.history = { entries: [], index: -1 };
    if (discardDraft) {
      try {
        await storageDelete(`draft:${this.sessionKey}`);
      } catch {}
    }

    let draft = null;
    let sessionPublished = null;
    try {
      draft = await storageGet(`draft:${this.sessionKey}`);
    } catch {
      draft = null;
    }
    if (discardDraft) draft = null;
    try {
      sessionPublished = await storageGet(`published:${this.sessionKey}`);
    } catch {
      sessionPublished = null;
    }
    const localSessionAt = Number(sessionPublished?.publishedAt || 0);
    const siteAt = Number(this.sitePublished?.publishedAt || 0);
    this.basePublished =
      sessionPublished && localSessionAt >= siteAt ? hydrate(sessionPublished) : clone(this.sitePublished);
    this.state = draft ? hydrate(draft) : clone(this.basePublished);
    this.status = draft ? "saved" : "published";
    this.lastSavedAt = draft ? Date.now() : null;
    this.saveError = null;
    this._stamp = 0;
    this._savedStamp = 0;
    this.history.entries = [{ state: clone(this.state), label: draft ? "Resumed draft" : "Opened" }];
    this.history.index = 0;
    try {
      this.revisions = (await storageGet(`revisions:${this.sessionKey}`)) || [];
    } catch {
      this.revisions = [];
    }
    this.connectChannel();
    this.emit("session", { role, demo: this.demo, key: this.sessionKey });
    this.emit("history");
    this.emit("status", this.status);
    return this.state;
  }

  async endSession({ discard = false } = {}) {
    if (this.editorActive && !discard) {
      if (this.status === "dirty" || this.status === "error" || this.status === "saving") {
        const ok = await this.saveNow();
        if (!ok) {
          return false;
        }
      }
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
    this.editorActive = false;
    this.preview = false;
    this.role = null;
    this.demo = false;
    this.state = clone(this.sitePublished);
    this.status = "published";
    this.emit("session-end");
    return true;
  }

  connectChannel() {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
    if (typeof BroadcastChannel === "undefined") return;
    try {
      this.channel = new BroadcastChannel(`tenugui-editor:${this.sessionKey}`);
      this.channel.onmessage = (event) => {
        const msg = event.data || {};
        if (msg.tabId === this.tabId) return;
        if (msg.type === "saved" && !this.conflict) {
          this.conflict = { at: msg.at, otherTab: msg.tabId };
          this.setStatus("conflict");
          this.emit("conflict", this.conflict);
        }
      };
    } catch {
      this.channel = null;
    }
  }

  can(action = "edit") {
    const role = ROLES[this.role];
    if (!role) return false;
    if (action === "preview") return true;
    if (action === "edit") return this.editorActive && !this.preview && role.canEdit;
    if (action === "publish") return this.editorActive && role.canPublish;
    if (action === "shared") return this.editorActive && role.canShared;
    if (action === "github") return this.editorActive && role.canGithub;
    if (action === "revisions") return true;
    return this.editorActive;
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.emit("status", status);
  }

  setMode(mode) {
    if (!["dark", "light"].includes(mode)) return;
    this.mode = mode;
    this.setSetting("mode", mode);
    localStorage.setItem("tenugui:mode", mode);
    this.emit("mode", mode);
  }

  setMotion(motion) {
    this.motion = motion;
    this.setSetting("motion", motion);
    this.emit("motion", motion);
  }

  begin(label = "Edit") {
    if (!this.can("edit")) return false;
    if (this._tx) return true;
    this._tx = { label, before: clone(this.state) };
    return true;
  }

  end() {
    if (!this._tx) return false;
    const tx = this._tx;
    this._tx = null;
    if (JSON.stringify(tx.before) === JSON.stringify(this.state)) {
      this.emit("history");
      return false;
    }
    this.pushHistory(tx.label);
    this.emit("change", { label: tx.label });
    return true;
  }

  pushHistory(label) {
    const entries = this.history.entries.slice(0, this.history.index + 1);
    entries.push({ state: clone(this.state), label });
    let approxBytes = 0;
    try {
      approxBytes = JSON.stringify(this.state).length;
    } catch {
      approxBytes = 0;
    }
    const maxEntries = approxBytes > 1_500_000 ? 8 : 30;
    while (entries.length > maxEntries) entries.shift();
    this.history.entries = entries;
    this.history.index = entries.length - 1;
    this.touch();
    this.emit("history");
  }

  apply(label, fn) {
    if (!this.can("edit")) return false;
    this.begin(label);
    fn(this.state);
    return this.end();
  }

  rollbackTransaction() {
    if (!this._tx) return;
    this.state = this._tx.before;
    this._tx = null;
    this.emit("live", { reason: "rollback" });
    this.emit("change", { reason: "rollback" });
  }

  touch() {
    this._stamp++;
    this.saveError = null;
    if (this.status !== "saving" && this.status !== "saving-error") this.setStatus("dirty");
    this._queueSave();
  }

  async saveNow() {
    if (!this.editorActive || !this.can("edit")) return true;
    if (this._saving) return this._saving;
    const stamp = this._stamp;
    this.setStatus("saving");
    this._saving = (async () => {
      try {
        await storageSet(`draft:${this.sessionKey}`, clone(this.state));
        this.lastSavedAt = Date.now();
        this._savedStamp = stamp;
        this.saveError = null;
        this.setStatus(this._stamp > stamp ? "dirty" : this.conflict ? "conflict" : "saved");
        if (this._stamp > stamp) this._queueSave();
        this.channel?.postMessage({ type: "saved", tabId: this.tabId, at: this.lastSavedAt });
        this.emit("saved", { at: this.lastSavedAt });
        return true;
      } catch (err) {
        this.saveError = err?.message || "Could not save";
        this.setStatus("error");
        this.emit("save-error", this.saveError);
        return false;
      } finally {
        this._saving = null;
      }
    })();
    return this._saving;
  }

  retrySave() {
    return this.saveNow();
  }

  undo() {
    if (!this.can("edit")) return false;
    if (this.history.index <= 0) return false;
    this._tx = null;
    this.history.index--;
    this.state = clone(this.history.entries[this.history.index].state);
    this.touch();
    this.emit("history");
    this.emit("change", { reason: "undo" });
    return true;
  }

  redo() {
    if (!this.can("edit")) return false;
    if (this.history.index >= this.history.entries.length - 1) return false;
    this._tx = null;
    this.history.index++;
    this.state = clone(this.history.entries[this.history.index].state);
    this.touch();
    this.emit("history");
    this.emit("change", { reason: "redo" });
    return true;
  }

  get canUndo() {
    return this.history.index > 0;
  }

  get canRedo() {
    return this.history.index < this.history.entries.length - 1;
  }

  /* ---------------------------------------------------------------- content */
  setText(id, html) {
    if (!this.can("edit")) return false;
    const safe = sanitizeHtml(html);
    this.apply("Text edited", (state) => {
      if (!safe.trim()) delete state.text[id];
      else state.text[id] = safe;
    });
    return true;
  }

  setStyleProp(id, bp, prop, value) {
    if (!this.can("edit")) return false;
    const state = this.state;
    state.styles[id] = state.styles[id] || {};
    const entry = state.styles[id];
    entry[bp] = entry[bp] || {};
    if (value === "" || value == null) delete entry[bp][prop];
    else entry[bp][prop] = value;
    if (!Object.keys(entry[bp]).length) delete entry[bp];
    if (!Object.keys(entry).length) delete state.styles[id];
    this.emit("live", { id, prop, bp });
    return true;
  }

  setStyleName(id, style) {
    if (!this.can("edit")) return false;
    return this.apply("Text style changed", (state) => {
      state.styles[id] = state.styles[id] || {};
      if (style) state.styles[id].style = style;
      else delete state.styles[id].style;
      if (!Object.keys(state.styles[id]).length) delete state.styles[id];
    });
  }

  clearStyleProp(id, bp, prop) {
    if (!this.can("edit")) return false;
    const entry = this.state.styles?.[id];
    if (!entry?.[bp] || !(prop in entry[bp])) return false;
    return this.apply("Override removed", (state) => {
      delete state.styles[id][bp][prop];
      if (!Object.keys(state.styles[id][bp]).length) delete state.styles[id][bp];
      if (!Object.keys(state.styles[id]).length) delete state.styles[id];
    });
  }

  clearOverrides(id) {
    if (!this.can("edit")) return false;
    if (!this.state.styles?.[id]) return false;
    return this.apply("Local overrides removed", (state) => {
      delete state.styles[id];
    });
  }

  setNodeState(id, patch, { label = "Element changed", render = true } = {}) {
    if (!this.can("edit")) return false;
    return this.apply(label, (state) => {
      state.nodeState[id] = { ...(state.nodeState[id] || {}), ...patch };
      if (!Object.keys(state.nodeState[id]).length) delete state.nodeState[id];
    });
  }

  toggleNodeFlag(id, flag) {
    if (!this.can("edit")) return false;
    const current = !!this.state.nodeState?.[id]?.[flag];
    return this.setNodeState(id, { [flag]: !current }, { label: current ? `${flag} removed` : `Element ${flag}` });
  }

  deleteNode(id) {
    if (!this.can("edit")) return false;
    if (String(id).startsWith("insert.")) return this.deleteInsertion(id);
    if (String(id).startsWith("dynamic.")) return this.deleteDynamic(id);
    return this.apply("Element deleted", (state) => {
      state.nodeState[id] = { ...(state.nodeState[id] || {}), deleted: true, hidden: false };
      delete state.text[id];
      delete state.styles[id];
    });
  }

  addInsertion({ section = "page", kind = "text", text = "", src = "", alt = "", href = "" } = {}) {
    if (!this.can("edit")) return null;
    const item = {
      id: uid("ins"),
      section,
      kind,
      text,
      src,
      alt,
      href,
      at: Date.now(),
    };
    const nodeId = `insert.${item.id}`;
    const ok = this.apply("Element inserted", (state) => {
      state.insertions = state.insertions || [];
      state.insertions.push(item);
      if (text && ["heading", "text", "button"].includes(kind)) {
        state.text[nodeId] = sanitizeHtml(text);
      }
      if (src) {
        state.assets = state.assets || { instances: {}, uploads: {}, history: [] };
        state.assets.instances = state.assets.instances || {};
        state.assets.instances[nodeId] = {
          src,
          alt: alt || "Inserted image",
          name: "Inserted image",
          type: "image",
          updatedAt: Date.now(),
        };
      }
    });
    return ok ? nodeId : null;
  }

  deleteInsertion(nodeId) {
    if (!this.can("edit")) return false;
    if (!String(nodeId).startsWith("insert.")) return false;
    return this.apply("Element deleted", (state) => {
      state.insertions = (state.insertions || []).filter((entry) => `insert.${entry.id}` !== nodeId);
      delete state.text[nodeId];
      delete state.styles[nodeId];
      delete state.nodeState[nodeId];
      if (state.assets?.instances) delete state.assets.instances[nodeId];
    });
  }

  addDynamic({ section = "page", description = "", x = 40, y = 100, width = 360, height = 180 } = {}) {
    if (!this.can("edit")) return null;
    const item = {
      id: uid("dyn"),
      section,
      description: String(description || "").trim(),
      position: {
        x: clamp(Number(x) || 0, 0, 2400),
        y: clamp(Number(y) || 0, 0, 4000),
      },
      size: {
        width: clamp(Number(width) || 360, 80, 1600),
        height: clamp(Number(height) || 180, 40, 1600),
      },
      html: "",
      at: Date.now(),
    };
    const nodeId = `dynamic.${item.id}`;
    const ok = this.apply("Dynamic element added", (state) => {
      state.dynamics = state.dynamics || [];
      state.dynamics.push(item);
    });
    return ok ? nodeId : null;
  }

  updateDynamic(nodeId, patch = {}) {
    if (!this.can("edit")) return false;
    if (!String(nodeId).startsWith("dynamic.")) return false;
    return this.apply("Dynamic element updated", (state) => {
      const item = (state.dynamics || []).find((entry) => `dynamic.${entry.id}` === nodeId);
      if (!item) return;
      if ("description" in patch) item.description = String(patch.description || "").trim();
      if ("html" in patch) item.html = sanitizeHtml(String(patch.html || ""));
      if ("x" in patch) item.position.x = clamp(Number(patch.x) || 0, 0, 2400);
      if ("y" in patch) item.position.y = clamp(Number(patch.y) || 0, 0, 4000);
      if ("width" in patch) item.size.width = clamp(Number(patch.width) || 80, 80, 1600);
      if ("height" in patch) item.size.height = clamp(Number(patch.height) || 40, 40, 1600);
    });
  }

  deleteDynamic(nodeId) {
    if (!this.can("edit")) return false;
    if (!String(nodeId).startsWith("dynamic.")) return false;
    return this.apply("Dynamic element deleted", (state) => {
      state.dynamics = (state.dynamics || []).filter((entry) => `dynamic.${entry.id}` !== nodeId);
      delete state.nodeState[nodeId];
    });
  }

  setIcon(id, name) {
    return this.setNodeState(id, { icon: name }, { label: "Icon replaced" });
  }

  setImage(id, patch) {
    if (!this.can("edit")) return false;
    return this.apply("Image updated", (state) => {
      state.nodeState[id] = state.nodeState[id] || {};
      state.nodeState[id].image = { ...(state.nodeState[id].image || {}), ...patch };
    });
  }

  setLink(id, link) {
    if (!this.can("edit")) return false;
    return this.apply("Link updated", (state) => {
      state.nodeState[id] = state.nodeState[id] || {};
      state.nodeState[id].link = { ...(state.nodeState[id].link || {}), ...link };
    });
  }

  setNodeOffset(id, x, y) {
    if (!this.can("edit")) return false;
    return this.apply("Element moved", (state) => {
      const px = clamp(Math.round(Number(x) || 0), -4000, 4000);
      const py = clamp(Math.round(Number(y) || 0), -4000, 4000);
      const ns = state.nodeState[id] || (state.nodeState[id] = {});
      if (!px && !py) delete ns.offset;
      else ns.offset = { x: px, y: py };
      if (!Object.keys(ns).length) delete state.nodeState[id];
    });
  }

  /* structural items */
  itemInfo(section) {
    return ITEM_SECTIONS[section] || null;
  }

  findItem(section, itemId) {
    const info = ITEM_SECTIONS[section];
    if (!info) return null;
    const arr = getPath(this.state, info.path);
    return Array.isArray(arr) ? arr.find((x) => x.id === itemId) || null : null;
  }

  duplicateItem(section, itemId) {
    if (!this.can("edit")) return false;
    const info = ITEM_SECTIONS[section];
    if (!info) return false;
    const arr = getPath(this.state, info.path);
    const idx = arr.findIndex((x) => x.id === itemId);
    if (idx < 0) return false;
    const newId = `${itemId}-${Math.random().toString(36).slice(2, 5)}`;
    const ok = this.apply("Card duplicated", (state) => {
      const list = getPath(state, info.path);
      const source = list[idx];
      const copy = clone(source);
      copy.id = newId;
      list.splice(idx + 1, 0, copy);
      const oldPrefix = `${info.prefix}.${itemId}.`;
      const newPrefix = `${info.prefix}.${newId}.`;
      for (const mapName of ["text", "styles", "nodeState"]) {
        const map = state[mapName] || {};
        for (const [key, value] of Object.entries(map)) {
          if (key.startsWith(oldPrefix)) map[newPrefix + key.slice(oldPrefix.length)] = clone(value);
        }
      }
    });
    return ok ? newId : null;
  }

  deleteItem(section, itemId) {
    if (!this.can("edit")) return false;
    const info = ITEM_SECTIONS[section];
    if (!info) return false;
    const arr = getPath(this.state, info.path);
    if (!arr?.some((x) => x.id === itemId)) return false;
    return this.apply("Card deleted", (state) => {
      const list = getPath(state, info.path);
      const idx = list.findIndex((x) => x.id === itemId);
      if (idx >= 0) list.splice(idx, 1);
      const prefix = `${info.prefix}.${itemId}.`;
      for (const key of Object.keys(state.text || {})) if (key.startsWith(prefix)) delete state.text[key];
      for (const key of Object.keys(state.styles || {})) if (key.startsWith(prefix)) delete state.styles[key];
      for (const key of Object.keys(state.nodeState || {})) if (key.startsWith(prefix)) delete state.nodeState[key];
    });
  }

  moveItem(section, itemId, direction) {
    if (!this.can("edit")) return false;
    const info = ITEM_SECTIONS[section];
    if (!info) return false;
    const arr = getPath(this.state, info.path);
    const idx = arr?.findIndex((x) => x.id === itemId) ?? -1;
    if (idx < 0) return false;
    const target = idx + direction;
    if (target < 0 || target >= arr.length) return false;
    return this.apply("Card reordered", (state) => {
      const list = getPath(state, info.path);
      const [item] = list.splice(idx, 1);
      list.splice(target, 0, item);
    });
  }

  /* theme */
  updateTheme(patch, label = "Theme updated") {
    if (!this.can("shared")) return false;
    return this.apply(label, (state) => {
      state.theme = deepMerge(state.theme, patch);
    });
  }

  applyThemePreset(theme, label) {
    if (!this.can("shared")) return false;
    return this.apply(label || "Theme applied", (state) => {
      state.theme = clone(theme);
    });
  }

  async saveCustomTheme(name) {
    if (!this.can("shared")) return false;
    const item = {
      id: uid("theme"),
      name: name || `Custom ${this.customThemes.length + 1}`,
      at: Date.now(),
      theme: clone(this.state.theme),
    };
    this.customThemes = [item, ...this.customThemes].slice(0, 24);
    await storageSet("themes", this.customThemes);
    this.emit("themes");
    return item;
  }

  async deleteCustomTheme(id) {
    this.customThemes = this.customThemes.filter((t) => t.id !== id);
    await storageSet("themes", this.customThemes);
    this.emit("themes");
  }

  resetTheme() {
    return this.applyThemePreset(DEFAULT_THEME, "Theme restored");
  }

  /* assets */
  replaceAssetTarget(target, upload, label) {
    if (!this.can("shared")) return false;
    return this.apply(label || "Asset replaced", (state) => {
      state.assets = state.assets || {};
      state.assets.instances = state.assets.instances || {};
      state.assets.uploads = state.assets.uploads || {};
      state.assets.history = state.assets.history || [];
      if (upload.id && upload.src) state.assets.uploads[upload.id] = upload;
      state.assets.instances[target] = {
        src: upload.src,
        alt: upload.alt || "",
        name: upload.name || "",
        type: upload.type || "",
        width: upload.width || null,
        height: upload.height || null,
        updatedAt: Date.now(),
      };
      state.assets.history.unshift({
        target,
        at: Date.now(),
        by: ROLES[this.role]?.label || "Editor",
        name: upload.name || "Uploaded image",
      });
      state.assets.history = state.assets.history.slice(0, 40);
    });
  }

  replaceAssetAll(assetId, targets, upload, label) {
    if (!this.can("shared")) return false;
    return this.apply(label || "Linked asset replaced", (state) => {
      state.assets = state.assets || {};
      state.assets.instances = state.assets.instances || {};
      state.assets.uploads = state.assets.uploads || {};
      state.assets.history = state.assets.history || [];
      if (upload.id && upload.src) state.assets.uploads[upload.id] = upload;
      for (const target of targets) {
        state.assets.instances[target] = {
          src: upload.src,
          alt: upload.alt || "",
          name: upload.name || "",
          type: upload.type || "",
          width: upload.width || null,
          height: upload.height || null,
          updatedAt: Date.now(),
        };
      }
      state.assets.history.unshift({
        target: targets.join(", "),
        at: Date.now(),
        by: ROLES[this.role]?.label || "Editor",
        name: upload.name || "Uploaded image",
      });
      state.assets.history = state.assets.history.slice(0, 40);
    });
  }

  resetAssetTarget(target) {
    if (!this.can("shared")) return false;
    return this.apply("Asset reset", (state) => {
      if (state.assets?.instances) delete state.assets.instances[target];
    });
  }

  async deleteUpload(id) {
    if (!this.can("shared")) return false;
    const used = Object.values(this.state.assets?.instances || {}).some((inst) =>
      Object.values(this.state.assets?.uploads || {}).some((up) => up.id === id && up.src === inst.src)
    );
    if (used) return false;
    this.apply("Upload deleted", (state) => {
      delete state.assets.uploads[id];
    });
    return true;
  }

  /* revisions */
  async addRevision({ label = "", status = "draft", snapshot = null } = {}) {
    const state = snapshot || clone(this.state);
    state.updatedAt = Date.now();
    const changes = summarizeChanges(this.basePublished, state);
    const revision = {
      id: uid("rev"),
      at: Date.now(),
      by: ROLES[this.role]?.label || "Editor",
      role: this.role,
      label: label || summaryText(changes),
      status,
      summary: summaryText(changes),
      changes,
      state,
    };
    this.revisions = [revision, ...(this.revisions || [])].slice(0, 16);
    try {
      await storageSet(`revisions:${this.sessionKey}`, this.revisions);
    } catch {
      /* revision history is best-effort but surface the failure */
      this.emit("save-error", "Could not store revision");
    }
    this.emit("revisions");
    return revision;
  }

  async saveManualRevision(label) {
    if (!this.can("edit")) return false;
    const saved = await this.saveNow();
    if (!saved) return false;
    const rev = await this.addRevision({ label: label || "Manual save", status: "draft" });
    return rev;
  }

  async restoreRevision(id) {
    if (!this.can("edit")) return false;
    const rev = this.revisions.find((r) => r.id === id);
    if (!rev) return false;
    this.begin(`Restored revision · ${rev.label || rev.id}`);
    this.state = hydrate(rev.state);
    this.end();
    return true;
  }

  async publish({ label = "", snapshot = null } = {}) {
    if (!this.can("publish")) throw new Error("You do not have permission to publish");
    const now = Date.now();
    const published = snapshot ? hydrate(snapshot) : hydrate(this.state);
    published.publishedAt = now;
    published.updatedAt = now;
    this.state.publishedAt = now;
    this.state.updatedAt = now;
    this.setStatus("publishing");
    // Persist the public snapshot before mutating in-memory live state.
    if (this.demo) {
      await storageSet("published:demo", published);
    } else {
      await storageSet("published:owner", published);
    }
    // previous published revisions become superseded
    this.revisions = (this.revisions || []).map((r) =>
      r.status === "published" ? { ...r, status: "superseded" } : r
    );
    const rev = await this.addRevision({ label: label || "Published revision", status: "published", snapshot: published });
    this.basePublished = hydrate(published);
    if (!this.demo) this.sitePublished = hydrate(published);
    await storageSet(`draft:${this.sessionKey}`, clone(this.state));
    this.lastSavedAt = Date.now();
    this._savedStamp = this._stamp;
    this.setStatus("saved");
    this.emit("published", { revision: rev, at: now });
    return rev;
  }

  buildContentJson() {
    const snapshot = clone(this.state);
    snapshot.updatedAt = Date.now();
    return JSON.stringify(snapshot, null, 2);
  }

  async rollbackToRevision(id) {
    if (!this.can("publish")) throw new Error("You do not have permission to publish");
    const rev = this.revisions.find((r) => r.id === id);
    if (!rev) throw new Error("Revision not found");
    const snapshot = hydrate(rev.state);
    this.begin(`Rollback to ${rev.label || rev.at}`);
    this.state = snapshot;
    this.end();
    return this.publish({ label: `Rollback · ${rev.label || new Date(rev.at).toLocaleString()}` });
  }

  get changeSummary() {
    return summarizeChanges(this.basePublished, this.state);
  }

  async unlock(passphrase) {
    const hash = await sha256Hex(`${SALT}:${String(passphrase || "")}`);
    const match = Object.entries(ROLE_HASHES).find(([, h]) => h === hash);
    return match ? match[0] : null;
  }

  async loadLatestDraft() {
    const draft = await storageGet(`draft:${this.sessionKey}`);
    if (!draft) return false;
    this._tx = null;
    this.state = hydrate(draft);
    this.history.entries = [{ state: clone(this.state), label: "Loaded from another tab" }];
    this.history.index = 0;
    this.conflict = null;
    this.setStatus("saved");
    this.lastSavedAt = Date.now();
    this.emit("history");
    this.emit("change", { reason: "conflict-load" });
    return true;
  }

  keepMyDraft() {
    this.conflict = null;
    this.touch();
    this.saveNow();
    this.emit("conflict-resolved");
  }

  async resetDraft() {
    this.begin("Draft reset");
    this.state = clone(this.basePublished);
    this.history = { entries: [{ state: clone(this.state), label: "Draft reset" }], index: 0 };
    this.end();
    await storageSet(`draft:${this.sessionKey}`, clone(this.state));
    this.emit("change", { reason: "draft-reset" });
    this.emit("history");
  }

  /* validation helpers used by publish UI */
  getRoles() {
    return ROLES;
  }
}

export const store = new Store();
export { summarizeChanges, summaryText, ROLE_HASHES };
