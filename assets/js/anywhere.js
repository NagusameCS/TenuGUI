/*
 * TenuGUI Anywhere — a self-contained direct editor for the page you are on.
 *
 * Loaded by the browser button in bookmarklet.html. It intentionally does not
 * load site-specific CSS, textures, content.json or MCP state: it edits the
 * actual page in front of you and exports the actual page back out.
 */
(() => {
  "use strict";

  const KEY = "__tenuguiAnywhere";
  if (window[KEY]) {
    window[KEY].close();
    return;
  }
  if (!document.body) return;

  const ROOT_ID = "tenugui-anywhere-root";
  const STYLE_ID = "tenugui-anywhere-style";
  const SKIP = "SCRIPT,STYLE,LINK,META,TITLE,HEAD,BASE,NOSCRIPT,TEMPLATE";
  const TEXT_TAGS = "P,H1,H2,H3,H4,H5,H6,SPAN,A,BUTTON,LI,LABEL,FIGCAPTION,BLOCKQUOTE,TD,TH,SMALL,STRONG,EM,DIV";

  let selected = null;
  let hovered = null;
  let editing = null;
  let dragging = null;
  let undoStack = [];
  let redoStack = [];
  let closed = false;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
  const shadow = root.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>
    :host { all: initial; color-scheme: light dark; }
    * { box-sizing: border-box; }
    button, input, select, textarea { font: inherit; }
    .tgx-bar {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 4px; max-width: calc(100vw - 20px);
      padding: 5px; border: 1px solid #3a352d; border-radius: 10px;
      background: #171512; color: #f4f0e6; box-shadow: 0 12px 36px rgba(0,0,0,.35);
      font: 12px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      pointer-events: auto; white-space: nowrap;
    }
    .tgx-brand { display: flex; align-items: center; gap: 7px; padding: 0 8px 0 4px; }
    .tgx-mark { display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid #f4f0e6; border-radius: 2px; font-size: 13px; }
    .tgx-brand b { font-weight: 600; letter-spacing: .02em; }
    .tgx-brand span { color: #b9b2a5; font-size: 11px; }
    .tgx-sep { width: 1px; height: 20px; margin: 0 2px; background: #3a352d; }
    .tgx-btn {
      display: inline-grid; place-items: center; min-width: 29px; height: 29px;
      padding: 0 8px; border: 1px solid transparent; border-radius: 6px;
      background: transparent; color: #b9b2a5; cursor: pointer;
    }
    .tgx-btn:hover { color: #f4f0e6; background: #27231d; }
    .tgx-btn:disabled { opacity: .35; cursor: default; background: transparent; }
    .tgx-btn.primary { background: #e0673f; color: #1a0e09; border-color: #e0673f; }
    .tgx-btn.primary:hover { background: #f07a52; }
    .tgx-panel {
      position: fixed; top: 68px; right: 12px; bottom: 12px; width: 292px;
      overflow: auto; padding: 14px; border: 1px solid #3a352d; border-radius: 12px;
      background: #191816; color: #f4f0e6; box-shadow: 0 16px 48px rgba(0,0,0,.35);
      font: 12px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      pointer-events: auto;
    }
    .tgx-panel[hidden] { display: none; }
    .tgx-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
    .tgx-kicker { color: #e0673f; font: 10px/1.2 ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase; }
    .tgx-title { margin-top: 5px; font-size: 15px; line-height: 1.25; overflow-wrap: anywhere; }
    .tgx-sub { margin-top: 3px; color: #9c9588; font: 10px/1.4 ui-monospace, monospace; overflow-wrap: anywhere; }
    .tgx-close { width: 26px; height: 26px; padding: 0; border: 1px solid #3a352d; border-radius: 6px; background: #23211d; color: #b9b2a5; cursor: pointer; }
    .tgx-field { display: grid; gap: 5px; margin-top: 12px; }
    .tgx-field label { color: #b9b2a5; font: 10px/1.2 ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; }
    .tgx-input, .tgx-select {
      width: 100%; min-height: 30px; padding: 5px 7px; border: 1px solid #3a352d;
      border-radius: 5px; background: #23211d; color: #f4f0e6; outline: none;
    }
    .tgx-input:focus, .tgx-select:focus { border-color: #e0673f; }
    .tgx-color-row { display: flex; gap: 6px; }
    .tgx-color-row .tgx-input { min-width: 0; }
    .tgx-color-row input[type="color"] { width: 34px; height: 30px; padding: 2px; border: 1px solid #3a352d; border-radius: 5px; background: #23211d; }
    .tgx-range { width: 100%; accent-color: #e0673f; }
    .tgx-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #35322c; }
    .tgx-action {
      min-height: 29px; padding: 0 9px; border: 1px solid #3a352d; border-radius: 5px;
      background: #23211d; color: #f4f0e6; cursor: pointer; font-size: 11px;
    }
    .tgx-action:hover { border-color: #e0673f; color: #f07a52; }
    .tgx-action.danger:hover { border-color: #e07a7a; color: #e07a7a; }
    .tgx-empty { padding: 18px 0; color: #9c9588; }
    .tgx-insert {
      position: fixed; top: 56px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 4px; padding: 5px; border: 1px solid #3a352d; border-radius: 9px;
      background: #171512; box-shadow: 0 12px 36px rgba(0,0,0,.35); pointer-events: auto;
    }
    .tgx-insert[hidden] { display: none; }
    .tgx-insert button { min-height: 28px; padding: 0 9px; border: 1px solid #3a352d; border-radius: 5px; background: #23211d; color: #f4f0e6; cursor: pointer; font-size: 11px; }
    .tgx-insert button:hover { border-color: #e0673f; }
    @media (max-width: 720px) {
      .tgx-bar { top: 8px; left: 8px; right: 8px; transform: none; overflow-x: auto; }
      .tgx-panel { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 56vh; }
    }
  </style>
  <div class="tgx-bar" role="toolbar" aria-label="TenuGUI anywhere editor">
    <div class="tgx-brand"><span class="tgx-mark">手</span><b>TenuGUI</b><span>anywhere</span></div>
    <span class="tgx-sep"></span>
    <button class="tgx-btn" data-tgx="undo" title="Undo (Ctrl/Cmd+Z)" disabled>↶</button>
    <button class="tgx-btn" data-tgx="redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled>↷</button>
    <button class="tgx-btn" data-tgx="insert" title="Insert an element">+ Insert</button>
    <button class="tgx-btn" data-tgx="panel" title="Toggle inspector">Inspector</button>
    <button class="tgx-btn primary" data-tgx="export" title="Download the edited page as HTML">Export HTML</button>
    <button class="tgx-btn" data-tgx="close" title="Close the editor">Done</button>
  </div>
  <div class="tgx-insert" hidden>
    <button data-tgx-insert="heading">Heading</button>
    <button data-tgx-insert="text">Text</button>
    <button data-tgx-insert="button">Button</button>
    <button data-tgx-insert="divider">Divider</button>
    <button data-tgx-insert="image">Image</button>
  </div>
  <aside class="tgx-panel" hidden aria-label="Element inspector">
    <div class="tgx-panel-head">
      <div><div class="tgx-kicker">Element</div><div class="tgx-title">Nothing selected</div><div class="tgx-sub">Click any element to begin.</div></div>
      <button class="tgx-close" data-tgx="panel-close" title="Close inspector">×</button>
    </div>
    <div class="tgx-body"></div>
  </aside>`;
  document.documentElement.appendChild(root);

  const hostStyle = document.createElement("style");
  hostStyle.id = STYLE_ID;
  hostStyle.textContent = `
    [data-tgx-selected="true"] { outline: 2px solid #e0673f !important; outline-offset: 2px !important; box-shadow: 0 0 0 3px rgba(224,103,63,.22) !important; }
    [data-tgx-hover="true"] { outline: 1px dashed #e0673f !important; outline-offset: 2px !important; }
    [data-tgx-editing="true"] { cursor: text !important; }
  `;
  document.head.appendChild(hostStyle);

  const bar = shadow.querySelector(".tgx-bar");
  const panel = shadow.querySelector(".tgx-panel");
  const panelBody = shadow.querySelector(".tgx-body");
  const panelTitle = shadow.querySelector(".tgx-title");
  const panelSub = shadow.querySelector(".tgx-sub");
  const insertMenu = shadow.querySelector(".tgx-insert");
  const undoBtn = shadow.querySelector('[data-tgx="undo"]');
  const redoBtn = shadow.querySelector('[data-tgx="redo"]');
  let fileInput = null;

  const uiPath = (event) => {
    const path = event.composedPath ? event.composedPath() : [];
    return path.includes(root);
  };

  const isTyping = (event) => {
    const target = event.composedPath?.()[0] || event.target;
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  };

  const elementAt = (event) => {
    if (uiPath(event)) return null;
    let el = event.target instanceof Element ? event.target : null;
    if (!el || el === document.documentElement || el === document.body) return null;
    if (el.closest(SKIP)) return null;
    return el;
  };

  const labelFor = (el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.classList.length ? `.${[...el.classList].slice(0, 2).join(".")}` : "";
    return `${tag}${id}${cls}`;
  };

  const canEditText = (el) => {
    if (!el || !el.matches(TEXT_TAGS)) return false;
    if (["IMG", "PICTURE", "SVG", "VIDEO", "IFRAME", "INPUT", "TEXTAREA", "SELECT", "HR"].includes(el.tagName)) return false;
    return el.children.length === 0 || !el.querySelector(":scope > :is(div,section,article,nav,header,footer,main,ul,ol,table)");
  };

  const styleOf = (el) => el.getAttribute("style") || "";

  const mark = (el, attr, on) => {
    if (!el) return;
    if (on) el.setAttribute(attr, "true");
    else el.removeAttribute(attr);
  };

  const selectElement = (el, { scroll = false } = {}) => {
    if (selected && selected !== el) mark(selected, "data-tgx-selected", false);
    selected = el || null;
    mark(selected, "data-tgx-selected", true);
    mark(selected, "data-tgx-hover", false);
    hovered = null;
    panel.hidden = false;
    if (scroll && selected) selected.scrollIntoView({ block: "center", behavior: "smooth" });
    renderInspector();
  };

  const clearSelection = () => {
    if (selected) mark(selected, "data-tgx-selected", false);
    selected = null;
    renderInspector();
  };

  const commit = (label, undo, redo) => {
    undoStack.push({ label, undo, redo });
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
    updateBar();
  };

  const updateBar = () => {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  };

  const undo = () => {
    const entry = undoStack.pop();
    if (!entry) return;
    entry.undo();
    redoStack.push(entry);
    updateBar();
    renderInspector();
  };

  const redo = () => {
    const entry = redoStack.pop();
    if (!entry) return;
    entry.redo();
    undoStack.push(entry);
    updateBar();
    renderInspector();
  };

  const applyStyle = (el, mutate, label) => {
    const before = styleOf(el);
    mutate(el);
    const after = styleOf(el);
    if (before === after) return;
    commit(label, () => el.setAttribute("style", before), () => el.setAttribute("style", after));
  };

  const setField = (el, prop, value, label) => {
    if (!el || value == null || value === "") return;
    applyStyle(el, (node) => {
      node.style[prop] = value;
    }, label);
    renderInspector(false);
  };

  const hex = (value) => {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/);
    if (!match) return /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
    const parts = match[1].split(",").map((n) => Number.parseFloat(n));
    if (parts.length > 3 && parts[3] === 0) return "#ffffff";
    return `#${parts.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("")}`;
  };

  const renderInspector = (values = true) => {
    if (!selected) {
      panelTitle.textContent = "Nothing selected";
      panelSub.textContent = "Click any element to begin.";
      panelBody.innerHTML = `<div class="tgx-empty">Click text, images, buttons or sections on the page. Links and controls select instead of activating while the editor is open.</div>`;
      return;
    }
    const el = selected;
    const computed = getComputedStyle(el);
    panelTitle.textContent = labelFor(el);
    panelSub.textContent = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70) || "No text";
    panelBody.innerHTML = `
      <div class="tgx-field">
        <label>Text / content</label>
        <button class="tgx-action" data-tgx-action="edit">Edit text inline</button>
      </div>
      <div class="tgx-field">
        <label>Font size</label>
        <input class="tgx-input" type="number" min="8" max="160" step="1" value="${Math.round(Number.parseFloat(computed.fontSize) || 16)}" data-tgx-field="fontSize">
      </div>
      <div class="tgx-field">
        <label>Font weight</label>
        <select class="tgx-select" data-tgx-field="fontWeight">
          ${[300, 400, 500, 600, 700].map((w) => `<option value="${w}" ${String(computed.fontWeight) === String(w) ? "selected" : ""}>${w}</option>`).join("")}
        </select>
      </div>
      <div class="tgx-field">
        <label>Line height</label>
        <input class="tgx-input" type="number" min="0.8" max="3" step="0.05" value="${Number.parseFloat(computed.lineHeight) || 1.5}" data-tgx-field="lineHeight">
      </div>
      <div class="tgx-field">
        <label>Text colour</label>
        <div class="tgx-color-row"><input class="tgx-input" type="text" value="${hex(computed.color)}" data-tgx-field="color"><input type="color" value="${hex(computed.color)}" data-tgx-color="color"></div>
      </div>
      <div class="tgx-field">
        <label>Background</label>
        <div class="tgx-color-row"><input class="tgx-input" type="text" value="${hex(computed.backgroundColor)}" data-tgx-field="backgroundColor"><input type="color" value="${hex(computed.backgroundColor)}" data-tgx-color="backgroundColor"></div>
      </div>
      <div class="tgx-field">
        <label>Padding</label>
        <input class="tgx-range" type="range" min="0" max="80" value="${Math.round(Number.parseFloat(computed.paddingTop) || 0)}" data-tgx-field="padding">
      </div>
      <div class="tgx-field">
        <label>Corner radius</label>
        <input class="tgx-range" type="range" min="0" max="80" value="${Math.round(Number.parseFloat(computed.borderTopLeftRadius) || 0)}" data-tgx-field="borderRadius">
      </div>
      <div class="tgx-field">
        <label>Opacity</label>
        <input class="tgx-range" type="range" min="0.1" max="1" step="0.05" value="${Number.parseFloat(computed.opacity) || 1}" data-tgx-field="opacity">
      </div>
      <div class="tgx-field">
        <label>Alignment</label>
        <select class="tgx-select" data-tgx-field="textAlign">
          ${["left", "center", "right", "justify"].map((a) => `<option value="${a}" ${computed.textAlign === a ? "selected" : ""}>${a}</option>`).join("")}
        </select>
      </div>
      ${el.matches("a[href], button, area") ? `<div class="tgx-field"><label>Link target</label><input class="tgx-input" type="text" value="${(el.getAttribute("href") || "").replace(/"/g, "&quot;")}" data-tgx-field="href"></div>` : ""}
      ${el.matches("img") ? `<div class="tgx-field"><label>Image</label><button class="tgx-action" data-tgx-action="image">Replace image</button></div>
        <div class="tgx-field"><label>Image fit</label><select class="tgx-select" data-tgx-field="objectFit">${["cover", "contain", "fill", "none"].map((v) => `<option value="${v}" ${computed.objectFit === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div class="tgx-field"><label>Alt text</label><input class="tgx-input" type="text" value="${(el.getAttribute("alt") || "").replace(/"/g, "&quot;")}" data-tgx-field="alt"></div>` : ""}
      <div class="tgx-actions">
        <button class="tgx-action" data-tgx-action="duplicate">Duplicate</button>
        <button class="tgx-action" data-tgx-action="hide">Hide</button>
        ${el.style.translate ? `<button class="tgx-action" data-tgx-action="reset-move">Reset position</button>` : ""}
        <button class="tgx-action danger" data-tgx-action="delete">Delete</button>
      </div>`;
    if (!values) {
      // Keep focus while a slider or text field is being edited.
      const active = shadow.activeElement;
      if (active?.dataset?.tgxField) {
        const input = panelBody.querySelector(`[data-tgx-field="${active.dataset.tgxField}"]`);
        if (input) input.focus();
      }
    }
  };

  const editText = (el = selected) => {
    if (!el || !canEditText(el)) return;
    finishEditing();
    editing = { el, before: el.innerHTML, original: el.getAttribute("contenteditable") };
    el.setAttribute("contenteditable", "true");
    el.setAttribute("data-tgx-editing", "true");
    el.spellcheck = false;
    el.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    el.addEventListener("blur", onEditingBlur, true);
  };

  const finishEditing = (save = true) => {
    if (!editing) return;
    const { el, before, original } = editing;
    editing = null;
    el.removeEventListener("blur", onEditingBlur, true);
    el.removeAttribute("data-tgx-editing");
    if (original == null) el.removeAttribute("contenteditable");
    else el.setAttribute("contenteditable", original);
    if (!save) el.innerHTML = before;
    const after = el.innerHTML;
    if (save && before !== after) {
      commit("Text changed", () => { el.innerHTML = before; }, () => { el.innerHTML = after; });
    }
    renderInspector();
  };

  const onEditingBlur = () => finishEditing(true);

  const deleteSelected = () => {
    if (!selected) return;
    const el = selected;
    const parent = el.parentElement;
    const next = el.nextSibling;
    const clone = el.cloneNode(true);
    el.remove();
    clearSelection();
    commit("Element deleted", () => {
      if (next && next.parentNode === parent) parent.insertBefore(clone, next);
      else if (parent) parent.appendChild(clone);
    }, () => clone.remove());
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const source = selected;
    const clone = source.cloneNode(true);
    source.after(clone);
    selectElement(clone);
    commit("Element duplicated", () => clone.remove(), () => source.after(clone));
  };

  const resetMove = () => {
    if (!selected) return;
    applyStyle(selected, (el) => { el.style.translate = ""; }, "Position reset");
    renderInspector();
  };

  const replaceImage = () => {
    if (!selected || !selected.matches("img")) return;
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/png,image/jpeg,image/webp,image/gif";
      fileInput.style.display = "none";
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file || !selected) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          const el = selected;
          const before = el.getAttribute("src") || "";
          const after = String(reader.result || "");
          el.setAttribute("src", after);
          commit("Image replaced", () => el.setAttribute("src", before), () => el.setAttribute("src", after));
        });
        reader.readAsDataURL(file);
        fileInput.value = "";
      });
      shadow.appendChild(fileInput);
    }
    fileInput.click();
  };

  const insert = (kind) => {
    insertMenu.hidden = true;
    const host = selected && selected !== document.body ? selected : document.body;
    const parent = host.parentElement || document.body;
    let el;
    if (kind === "divider") {
      el = document.createElement("hr");
    } else if (kind === "button") {
      el = document.createElement("button");
      el.type = "button";
      el.textContent = "Button";
    } else if (kind === "heading") {
      el = document.createElement("h2");
      el.textContent = "New heading";
    } else if (kind === "image") {
      replaceImageFromNew();
      return;
    } else {
      el = document.createElement("p");
      el.textContent = "New text";
    }
    if (host === document.body) document.body.appendChild(el);
    else host.after(el);
    selectElement(el, { scroll: true });
    if (el.matches("p,h2,h3,button")) editText(el);
    commit("Element inserted", () => el.remove(), () => {
      if (host === document.body) document.body.appendChild(el);
      else if (host.parentNode) host.after(el);
    });
    insertMenu.hidden = true;
  };

  const replaceImageFromNew = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const anchor = selected && selected !== document.body ? selected : null;
        const parent = anchor?.parentElement || document.body;
        const el = document.createElement("img");
        el.src = String(reader.result || "");
        el.alt = file.name.replace(/\.[^.]+$/, "");
        if (anchor) anchor.after(el);
        else parent.appendChild(el);
        selectElement(el, { scroll: true });
        commit("Image inserted", () => el.remove(), () => {
          if (anchor?.parentNode) anchor.after(el);
          else parent.appendChild(el);
        });
      });
      reader.readAsDataURL(file);
    });
    input.click();
  };

  const exportPage = () => {
    finishEditing(true);
    const clone = document.documentElement.cloneNode(true);
    clone.querySelector(`#${ROOT_ID}`)?.remove();
    clone.querySelector(`#${STYLE_ID}`)?.remove();
    clone.querySelectorAll("[data-tgx-selected], [data-tgx-hover], [data-tgx-editing]").forEach((el) => {
      el.removeAttribute("data-tgx-selected");
      el.removeAttribute("data-tgx-hover");
      el.removeAttribute("data-tgx-editing");
      if (el.getAttribute("contenteditable") === "true" && !el.dataset.tgxOriginalEditable) {
        el.removeAttribute("contenteditable");
      }
    });
    const blob = new Blob([`<!doctype html>\n${clone.outerHTML}`], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${location.hostname || "page"}-edited.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    finishEditing(true);
    if (selected) mark(selected, "data-tgx-selected", false);
    if (hovered) mark(hovered, "data-tgx-hover", false);
    root.remove();
    hostStyle.remove();
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("dblclick", onDoubleClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    delete window[KEY];
  };

  const onPointerDown = (event) => {
    if (event.button > 0 || uiPath(event)) return;
    if (editing && editing.el.contains(event.target)) return;
    const el = elementAt(event);
    if (!el) {
      if (event.target === document.body) clearSelection();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selectElement(el);
    if (event.pointerType === "touch") return;
    const before = el.style.translate || "";
    dragging = { el, x: event.clientX, y: event.clientY, before, pointerId: event.pointerId, moved: false };
  };

  const onPointerMove = (event) => {
    if (!dragging) {
      if (uiPath(event) || editing) {
        if (hovered) mark(hovered, "data-tgx-hover", false);
        hovered = null;
        return;
      }
      const next = elementAt(event);
      if (next !== hovered) {
        if (hovered) mark(hovered, "data-tgx-hover", false);
        hovered = next;
        if (hovered && hovered !== selected) mark(hovered, "data-tgx-hover", true);
      }
      return;
    }
    if (event.pointerId !== dragging.pointerId) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    if (!dragging.moved && Math.hypot(dx, dy) < 4) return;
    if (!dragging.moved) {
      dragging.moved = true;
      dragging.el.style.cursor = "grabbing";
    }
    event.preventDefault();
    event.stopPropagation();
    dragging.el.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
  };

  const onPointerUp = (event) => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const drag = dragging;
    dragging = null;
    drag.el.style.cursor = "";
    if (!drag.moved) return;
    const after = drag.el.style.translate || "";
    commit("Position changed", () => { drag.el.style.translate = drag.before; }, () => { drag.el.style.translate = after; });
    renderInspector();
  };

  const onClick = (event) => {
    if (uiPath(event)) return;
    if (editing && editing.el.contains(event.target)) return;
    const el = elementAt(event);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(el);
  };

  const onDoubleClick = (event) => {
    if (uiPath(event)) return;
    const el = elementAt(event);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(el);
    if (canEditText(el)) editText(el);
  };

  const onKeyDown = (event) => {
    if (uiPath(event)) return;
    if (event.key === "Escape" && editing) {
      event.preventDefault();
      finishEditing(true);
      return;
    }
    if (isTyping(event)) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (editing) finishEditing(true);
      else if (selected) clearSelection();
      else close();
      return;
    }
    if (event.key === "F2" && selected) {
      event.preventDefault();
      editText();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selected) {
      event.preventDefault();
      deleteSelected();
      return;
    }
    if (event.key.toLowerCase() === "i" && !mod && !event.altKey) {
      event.preventDefault();
      togglePanel();
    }
  };

  const togglePanel = () => {
    panel.hidden = !panel.hidden;
  };

  bar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tgx]");
    if (!button) return;
    switch (button.dataset.tgx) {
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "insert": insertMenu.hidden = !insertMenu.hidden; break;
      case "panel": togglePanel(); break;
      case "export": exportPage(); break;
      case "close": close(); break;
      case "panel-close": panel.hidden = true; break;
      default: break;
    }
  });

  insertMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tgx-insert]");
    if (button) insert(button.dataset.tgxInsert);
  });

  panelBody.addEventListener("click", (event) => {
    const action = event.target.closest("[data-tgx-action]");
    if (!action) return;
    switch (action.dataset.tgxAction) {
      case "edit": editText(); break;
      case "image": replaceImage(); break;
      case "duplicate": duplicateSelected(); break;
      case "hide":
        if (selected) {
          const el = selected;
          const before = el.style.display;
          el.style.display = "none";
          clearSelection();
          commit("Element hidden", () => { el.style.display = before; }, () => { el.style.display = "none"; });
        }
        break;
      case "reset-move": resetMove(); break;
      case "delete": deleteSelected(); break;
      default: break;
    }
  });

  panelBody.addEventListener("change", (event) => {
    const color = event.target.closest("[data-tgx-color]");
    if (color && selected) {
      const key = color.dataset.tgxColor;
      const text = panelBody.querySelector(`[data-tgx-field="${key}"]`);
      if (text) text.value = color.value;
      setField(selected, key, color.value, key === "color" ? "Text colour changed" : "Background changed");
      return;
    }
    const field = event.target.closest("[data-tgx-field]");
    if (!field || !selected) return;
    const key = field.dataset.tgxField;
    if (key === "href") {
      const el = selected;
      const before = el.getAttribute("href") || "";
      const after = field.value.trim();
      el.setAttribute("href", after);
      commit("Link updated", () => el.setAttribute("href", before), () => el.setAttribute("href", after));
      return;
    }
    if (key === "fontSize") setField(selected, "fontSize", `${Number(field.value) || 16}px`, "Font size changed");
    if (key === "fontWeight") setField(selected, "fontWeight", field.value, "Font weight changed");
    if (key === "lineHeight") setField(selected, "lineHeight", String(Number(field.value) || 1.5), "Line height changed");
    if (key === "padding") setField(selected, "padding", `${Number(field.value) || 0}px`, "Padding changed");
    if (key === "borderRadius") setField(selected, "borderRadius", `${Number(field.value) || 0}px`, "Radius changed");
    if (key === "opacity") setField(selected, "opacity", String(Number(field.value) || 1), "Opacity changed");
    if (key === "textAlign") setField(selected, "textAlign", field.value, "Alignment changed");
    if (key === "objectFit") setField(selected, "objectFit", field.value, "Image fit changed");
    if (key === "color") setField(selected, "color", field.value, "Text colour changed");
    if (key === "backgroundColor") setField(selected, "backgroundColor", field.value, "Background changed");
    if (key === "alt") {
      const el = selected;
      const before = el.getAttribute("alt") || "";
      const after = field.value;
      el.setAttribute("alt", after);
      commit("Alt text changed", () => el.setAttribute("alt", before), () => el.setAttribute("alt", after));
    }
  });

  panelBody.addEventListener("input", (event) => {
    const color = event.target.closest("[data-tgx-color]");
    if (!color || !selected) return;
    const text = panelBody.querySelector(`[data-tgx-field="${color.dataset.tgxColor}"]`);
    if (text) text.value = color.value;
  });

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("dblclick", onDoubleClick, true);
  document.addEventListener("keydown", onKeyDown, true);

  window[KEY] = { close, export: exportPage };
  renderInspector();
})();
