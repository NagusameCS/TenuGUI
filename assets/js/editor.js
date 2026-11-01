import { store } from "./store.js";
import { icon } from "./icons.js";
import {
  $,
  $$,
  clamp,
  clone,
  debounce,
  isTypingTarget,
  sanitizeHtml,
  plainText,
  contrastRatio,
  nearestBackground,
  throttleRaf,
  sanitizeUrl,
  esc,
  modKey,
  downloadFile,
  readFileAsDataURL,
} from "./utils.js";
import { dialog, confirmDialog, promptDialog, toast } from "./ui.js";
import { Inspector } from "./inspector.js";

const KIND_ICON = {
  text: "type",
  button: "cursor",
  link: "link",
  image: "image",
  icon: "sparkles",
  surface: "layers",
  group: "layers",
  dynamic: "focus",
};

class Editor {
  constructor() {
    this.active = false;
    this.preview = false;
    this.selectedId = null;
    this.hoverId = null;
    this.editingId = null;
    this.editingEl = null;
    this.bp = "desktop";
    this.bpWidth = 0;
    this.bpKey = "base";
    this.hooks = {};
    this.ui = null;
    this.inspector = null;
    this.ctx = null;
    this.hoverLabel = null;
    this._positionRaf = null;
    this._styleClipboard = null;
    this._longPressTimer = null;
    this._promptedDemoHint = false;
    this._revisionPreview = null;
    this._drag = null;
    this._starting = false;
  }

  /* ---------------------------------------------------------------- mounting */
  mount(hooks) {
    this.hooks = hooks || {};
    this.buildUi();
    this.bindBar();
    this.bindSite();
    this.bindStore();
  }

  buildUi() {
    const root = $("#editor-ui");
    root.innerHTML = `
      <div class="editor-bar" id="editor-bar" hidden>
        <div class="eb-left">
          <span class="eb-brand"><span class="eb-mark"><img src="assets/img/brand/mark-dark-512.png" alt="TenuGUI"></span></span>
        </div>
        <div class="eb-center">
          <div class="viewport-switch" role="group" aria-label="Edit at viewport width">
            <button type="button" class="vs-btn" data-ea="bp" data-bp="desktop" aria-pressed="true" aria-label="Desktop width" title="Desktop">${icon(
              "monitor",
              { size: 15 }
            )}</button>
            <button type="button" class="vs-btn" data-ea="bp" data-bp="tablet" aria-pressed="false" aria-label="Tablet width — 820px" title="Tablet · 820px">${icon(
              "tablet",
              { size: 15 }
            )}</button>
            <button type="button" class="vs-btn" data-ea="bp" data-bp="mobile" aria-pressed="false" aria-label="Mobile width — 390px" title="Mobile · 390px">${icon(
              "smartphone",
              { size: 15 }
            )}</button>
            <span class="vs-width" id="vs-width">Auto</span>
            <input type="range" class="vs-slider" id="vs-slider" min="320" max="1500" step="1" value="820" aria-label="Custom viewport width">
          </div>
        </div>
        <div class="eb-right">
          <button type="button" class="eb-btn" data-ea="insert" aria-label="Insert element" title="Insert element">${icon(
            "plus",
            { size: 17 }
          )}<span class="eb-label">Insert</span></button>
          <button type="button" class="eb-btn" data-ea="undo" aria-label="Undo" title="Undo (${modKey()}+Z)" disabled>${icon(
            "undo",
            { size: 17 }
          )}</button>
          <button type="button" class="eb-btn" data-ea="redo" aria-label="Redo" title="Redo (${modKey()}+Shift+Z)" disabled>${icon(
            "redo",
            { size: 17 }
          )}</button>
          <span class="eb-divider"></span>
          <button type="button" class="eb-btn" data-ea="inspector" aria-label="Toggle inspector" aria-pressed="true" title="Inspector">${icon(
            "panel-right",
            { size: 17 }
          )}</button>
          <button type="button" class="eb-btn eb-help" data-ea="help" aria-label="Keyboard shortcuts" title="Shortcuts (?)">${icon(
            "keyboard",
            { size: 17 }
          )}</button>
          <button type="button" class="btn btn-primary btn-sm eb-export" id="export-btn" data-ea="export" title="Export content.json" aria-label="Export content.json">${icon("download", {
            size: 14,
          })} Export</button>
          <button type="button" class="eb-btn eb-exit" data-ea="exit" aria-label="Exit editor" title="Exit editor (Esc)">${icon(
            "close",
            { size: 18 }
          )}</button>
        </div>
      </div>

      <div class="edit-toolbar" id="edit-toolbar" hidden></div>
      <div class="format-bar" id="format-bar" hidden></div>
      <div class="ctx-menu" id="ctx-menu" hidden></div>

      <aside class="inspector" id="inspector" data-open="false" hidden aria-label="Inspector">
        <div class="inspector-head">
          <div class="inspector-tabs" role="tablist" aria-label="Inspector panels">
            <button type="button" class="inspector-tab" role="tab" data-tab="element" aria-selected="true">${icon(
              "cursor",
              { size: 14 }
            )}Element</button>
            <button type="button" class="inspector-tab" role="tab" data-tab="theme" aria-selected="false">${icon(
              "palette",
              { size: 14 }
            )}Theme</button>
            <button type="button" class="inspector-tab" role="tab" data-tab="assets" aria-selected="false">${icon(
              "image",
              { size: 14 }
            )}Assets</button>
          </div>
          <button type="button" class="icon-btn inspector-close" data-ea="close-inspector" aria-label="Hide inspector" title="Hide inspector">${icon(
            "chevron-right",
            { size: 17 }
          )}</button>
        </div>
        <div class="inspector-body" id="inspector-body"></div>
      </aside>
    `;
    this.ui = {
      bar: $("#editor-bar"),
      undo: $('[data-ea="undo"]'),
      redo: $('[data-ea="redo"]'),
      inspectorBtn: $('[data-ea="inspector"]'),
      exportBtn: $("#export-btn"),
      exitBtn: $('[data-ea="exit"]'),
      toolbar: $("#edit-toolbar"),
      format: $("#format-bar"),
      ctx: $("#ctx-menu"),
      inspector: $("#inspector"),
      inspectorBody: $("#inspector-body"),
      width: $("#vs-width"),
      slider: $("#vs-slider"),
    };
    this.inspector = new Inspector(this);
    this.ui.inspectorBody.addEventListener("click", (event) => {
      if (event.target.closest("[data-help]")) this.showShortcuts();
    });
    this.ui.inspector.hidden = true;
  }

  bindBar() {
    const { width, slider } = this.ui;
    $("#editor-ui").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-ea]");
      if (!btn) return;
      const action = btn.dataset.ea;
      switch (action) {
        case "undo":
          store.undo();
          break;
        case "redo":
          store.redo();
          break;
        case "bp":
          this.setBreakpoint(btn.dataset.bp);
          break;
        case "inspector":
          this.setInspector(this.ui.inspector.dataset.open !== "true");
          break;
        case "close-inspector":
          this.setInspector(false);
          break;
        case "insert":
          this.openInsertDialog();
          break;
        case "export":
          this.exportJson();
          break;
        case "exit":
          this.requestExit();
          break;
        case "help":
          this.showShortcuts();
          break;
        default:
          break;
      }
    });
    slider.addEventListener("input", () => {
      this.setBreakpoint("custom", Number(slider.value));
    });
    this.ui.inspector.querySelector(".inspector-tabs").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-tab]");
      if (!btn) return;
      this.setTab(btn.dataset.tab);
      this.setInspector(true);
    });
    $("#inspector").addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.setInspector(false);
      }
    });
  }

  bindStore() {
    store.on("history", () => {
      if (this.active) this.updateBar();
    });
    store.on("change", () => {
      if (!this.active) return;
      this.updateBar();
      requestAnimationFrame(() => {
        if (!this.editingId && this.inspector) this.inspector.render();
        this.positionOverlays();
      });
    });
    store.on("live", () => {
      if (!this.active) return;
      this.positionOverlays();
    });
    store.on("mode", () => {
      if (this.active && this.inspector) this.inspector.render();
    });
    store.on("conflict", () => {
      if (!this.active) return;
      this.showConflict();
      if (this.inspector) this.inspector.render();
    });


  }

  /* ---------------------------------------------------------------- session */
  chooseSessionMode() {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const d = dialog({
        title: "Resume this draft?",
        subtitle: "You have changes saved in this browser. Start over to open the published page as it was originally.",
        body: `<div class="notice">${icon("history", { size: 18 })}<div>Continuing keeps your local edits. Starting over discards this draft for the current browser; the published page is not changed.</div></div>`,
        footer: `<button type="button" class="btn btn-ghost btn-sm" data-session-cancel>Cancel</button><button type="button" class="btn btn-ghost btn-sm" data-session-fresh>Start over</button><button type="button" class="btn btn-primary btn-sm" data-session-continue>Continue draft</button>`,
        className: "resume-dialog",
        onClose: () => settle(null),
      });
      d.el.querySelector("[data-session-cancel]").addEventListener("click", () => {
        settle(null);
        d.close();
      });
      d.el.querySelector("[data-session-fresh]").addEventListener("click", () => {
        settle("fresh");
        d.close();
      });
      d.el.querySelector("[data-session-continue]").addEventListener("click", () => {
        settle("continue");
        d.close();
      });
    });
  }

  async start({ role = "owner", demo = false } = {}) {
    if (this.active || this._starting) return;
    this._starting = true;
    this.preview = false;
    let discardDraft = false;
    try {
      if (await store.hasDraft({ demo })) {
        const choice = await this.chooseSessionMode();
        if (!choice) return;
        discardDraft = choice === "fresh";
      }
      this.active = true;
      await store.startSession({ role, demo, discardDraft });
    } catch (err) {
      this.active = false;
      toast("Could not start the editor.", { tone: "destructive", iconName: "warning" });
      console.error(err);
      return;
    } finally {
      this._starting = false;
    }
    this.bpKey = window.innerWidth <= 640 ? "mobile" : window.innerWidth <= 900 ? "tablet" : "base";
    this.setBreakpoint("desktop", 0, { silent: true });
    this.updateBar();
    this.ui.bar.hidden = false;
    this.ui.inspector.hidden = false;
    this.ui.inspector.dataset.open = "false";
    const openInspector = window.innerWidth > 760;
    this.setInspector(openInspector);
    this.inspector.render();
    this.applyFocusable();
    this.updateSelectionUi();
    if (!this._promptedDemoHint) {
      this._promptedDemoHint = true;
      toast("Click to select · drag to move · double-click to edit.", { iconName: "cursor", timeout: 4600 });
    }
    this.announce("Editor mode active. Select an element to begin.");
  }

  onSession() {
    if (!this.ui) return;
    this.active = true;
    this.ui.bar.hidden = false;
    this.ui.inspector.hidden = false;
    this.updateBar();
    this.applyFocusable();
  }

  onSessionEnd() {
    this.active = false;
    this.preview = false;
    this._revisionPreview = null;
    if (this.ui) {
      this.ui.bar.hidden = true;
      this.ui.inspector.hidden = true;
      this.ui.inspector.dataset.open = "false";
      this.ui.toolbar.hidden = true;
      this.ui.format.hidden = true;
      this.ui.ctx.hidden = true;
    }
    this.hideHover();
    this.clearSelection();
    this.editingId = null;
    this.editingEl = null;
    document.body.classList.remove("editing-locked");
    $$("#site [data-tg-focus]").forEach((el) => {
      el.removeAttribute("tabindex");
      el.removeAttribute("data-tg-focus");
    });
    $("#site")?.style.removeProperty("max-width");
    document.body.classList.remove("bp-preview", "preview-mode", "preview-reduced");
  }

  updateBar() {
    if (!this.ui) return;
    this.ui.undo.disabled = !store.canUndo || !store.can("edit");
    this.ui.redo.disabled = !store.canRedo || !store.can("edit");
    this.ui.inspectorBtn.setAttribute("aria-pressed", String(this.ui.inspector.dataset.open === "true"));
  }

  /* ---------------------------------------------------------------- site render hooks */
  onSiteRendered() {
    if (!this.active) return;
    this.applyFocusable();
    if (this.editingId) {
      const el = this.getNode(this.editingId);
      if (el) {
        this.editingEl = el;
        this.setSelectedVisual(this.editingId);
        return;
      }
      this.editingId = null;
      this.editingEl = null;
      this.ui.format.hidden = true;
    }
    if (this.selectedId) {
      const el = this.getNode(this.selectedId);
      if (!el) this.clearSelection();
      else {
        this.updateSelectionUi();
      }
    }
    this.positionOverlays();
  }

  onLive() {
    this.positionOverlays();
  }

  onStatus() {}

  onConflict(conflict) {
    if (this.active) this.showConflict();
  }

  onPublished(detail) {
    if (!this.active) return;
    this.updateBar();
    if (this.inspector) this.inspector.render();
  }

  onThemes() {
    if (this.active && this.inspector) this.inspector.render();
  }

  /* ---------------------------------------------------------------- focusable / selection */
  applyFocusable() {
    if (!this.active) return;
    const nodes = $$('#site [data-node-pickable="true"]');
    for (const el of nodes) {
      const locked = el.getAttribute("data-locked") === "true";
      if (locked) {
        el.removeAttribute("tabindex");
        continue;
      }
      if (!el.hasAttribute("tabindex")) {
        el.setAttribute("tabindex", "0");
        el.setAttribute("data-tg-focus", "1");
      }
    }
    $$("#site [data-tg-focus]").forEach((el) => {
      if (!el.matches('[data-node-pickable="true"]')) {
        el.removeAttribute("tabindex");
        el.removeAttribute("data-tg-focus");
      }
    });
  }

  getNode(id) {
    if (!id) return null;
    try {
      return document.querySelector(`#site [data-node-id="${CSS.escape(id)}"]`);
    } catch {
      return null;
    }
  }

  nodeInfo(id = this.selectedId) {
    const el = this.getNode(id);
    if (!el) return null;
    const ns = store.state.nodeState?.[id] || {};
    return {
      id,
      el,
      kind: el.dataset.nodeKind || "group",
      label: el.dataset.nodeLabel || el.dataset.nodeKind || "Element",
      hidden: !!ns.hidden,
      locked: !!ns.locked,
      offset: ns.offset || null,
      item: el.dataset.nodeItem || null,
      section: el.dataset.nodeSection || null,
      action: el.dataset.nodeAction || null,
      selectable: el.dataset.nodePickable === "true",
    };
  }

  ancestors(node) {
    const out = [];
    let el = node;
    while (el && el !== document.body) {
      if (el.id === "site") break;
      if (el.dataset?.nodeId) out.push(el);
      el = el.parentElement;
    }
    return out.reverse();
  }

  selectNode(id, { focus = false, force = false, scroll = false } = {}) {
    if (!this.active || this.preview) return;
    let el = this.getNode(id);
    if (!el) {
      this.clearSelection();
      return;
    }
    const locked = el.getAttribute("data-locked") === "true";
    if (locked && !force) {
      toast("This element is locked. Unlock it from the outline.", {
        iconName: "lock",
        timeout: 3200,
      });
      return;
    }
    if (this.editingId && this.editingId !== id) this.exitTextEdit(true);
    this.selectedId = id;
    el = this.getNode(id);
    if (!el) {
      this.clearSelection();
      return;
    }
    this.setSelectedVisual(id);
    this.hideHover();
    this.setTab("element");
    this.updateSelectionUi();
    if (this.inspector) this.inspector.render();
    if (scroll) el.scrollIntoView({ block: "center", behavior: "smooth" });
    if (focus) el.focus({ preventScroll: true });
    const info = this.nodeInfo(id);
    this.announce(
      `${info?.label || "Element"} selected${info?.hidden ? ", hidden" : ""}${
        info?.locked ? ", locked" : ""
      }.`
    );
  }

  setSelectedVisual(id) {
    $$('#site [data-tg-selected="true"]').forEach((el) => el.removeAttribute("data-tg-selected"));
    if (id) this.getNode(id)?.setAttribute("data-tg-selected", "true");
  }

  setHoverVisual(id) {
    $$('#site [data-tg-hover="true"]').forEach((el) => el.removeAttribute("data-tg-hover"));
    if (id && id !== this.selectedId) this.getNode(id)?.setAttribute("data-tg-hover", "true");
  }

  clearSelection() {
    this.selectedId = null;
    this.setSelectedVisual(null);
    if (!this.ui) return;
    this.ui.toolbar.hidden = true;
    if (this.inspector) this.inspector.render();
    this.updateBar();
  }

  updateSelectionUi() {
    if (!this.active || this.preview || !this.selectedId) return;
    const info = this.nodeInfo();
    if (!info) {
      this.clearSelection();
      return;
    }
    this.setSelectedVisual(info.id);
    const rect = info.el.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      this.ui.toolbar.hidden = true;
      return;
    }
    this.ui.toolbar.hidden = false;
    this.buildToolbar(info);
    this.positionToolbar(info);
    this.updateBar();
  }

  buildToolbar(info) {
    const crumbs = this.ancestors(info.el)
      .map((el) => {
        const id = el.dataset.nodeId;
        const label = el.dataset.nodeLabel || el.dataset.nodeKind || id;
        return `<button type="button" class="et-crumb" data-crumb="${esc(id)}" title="${esc(label)}">${esc(
          label.length > 22 ? `${label.slice(0, 21)}…` : label
        )}</button>`;
      })
      .join('<span class="et-crumb-sep">›</span>');

    const actions = [];
    const canEdit = store.can("edit");
    if (!canEdit) {
      actions.push(
        `<button type="button" class="et-btn" data-et="panel">${icon("panel-right", {
          size: 15,
        })}<span class="et-label">Inspect</span></button>`
      );
    } else {
      if (["text", "button", "link"].includes(info.kind)) {
        actions.push(
          `<button type="button" class="et-btn" data-et="edit">${icon("pen", {
            size: 15,
          })}<span class="et-label">Edit text</span></button>`
        );
      }
      if (info.kind === "image") {
        actions.push(
          `<button type="button" class="et-btn" data-et="replace">${icon("upload", {
            size: 15,
          })}<span class="et-label">Replace</span></button>`
        );
        actions.push(
          `<button type="button" class="et-btn" data-et="frame" title="Framing">${icon("focus", {
            size: 15,
          })}<span class="et-label">Frame</span></button>`
        );
      }
      if (info.kind === "icon") {
        actions.push(
          `<button type="button" class="et-btn" data-et="icon">${icon("sparkles", {
            size: 15,
          })}<span class="et-label">Change icon</span></button>`
        );
      }
      if (["surface", "group"].includes(info.kind)) {
        actions.push(
          `<button type="button" class="et-btn" data-et="appearance">${icon("palette", {
            size: 15,
          })}<span class="et-label">Appearance</span></button>`
        );
      }
      if (["button", "link"].includes(info.kind) && !info.action) {
        actions.push(
          `<button type="button" class="et-btn" data-et="link">${icon("link", {
            size: 15,
          })}<span class="et-label">Link</span></button>`
        );
      }
      actions.push(`<span class="et-divider"></span>`);
      actions.push(
        `<button type="button" class="et-btn" data-et="hide" title="${info.hidden ? "Show" : "Hide"}">${icon(
          info.hidden ? "eye" : "eye-off",
          { size: 15 }
        )}<span class="et-label">${info.hidden ? "Show" : "Hide"}</span></button>`
      );
      actions.push(
        `<button type="button" class="et-btn" data-et="lock" title="${info.locked ? "Unlock" : "Lock"}">${icon(
          info.locked ? "unlock" : "lock",
          { size: 15 }
        )}<span class="et-label">${info.locked ? "Unlock" : "Lock"}</span></button>`
      );
      if (info.offset) {
        actions.push(
          `<button type="button" class="et-btn" data-et="reset-move" title="Reset position">${icon("reset", {
            size: 15,
          })}<span class="et-label">Reset position</span></button>`
        );
      }
      actions.push(
        `<button type="button" class="et-btn is-danger" data-et="delete" title="Delete element">${icon("trash", {
          size: 15,
        })}<span class="et-label">Delete</span></button>`
      );
      actions.push(
        `<button type="button" class="et-btn et-more" data-et="more" aria-label="More actions">${icon("more", {
          size: 16,
        })}</button>`
      );
    }

    this.ui.toolbar.innerHTML = `<div class="et-crumbs">${crumbs}</div><div class="et-actions">${actions.join(
      ""
    )}</div>`;
    this.ui.toolbar.querySelector(".et-crumbs").addEventListener(
      "click",
      (event) => {
        const b = event.target.closest("[data-crumb]");
        if (b) this.selectNode(b.dataset.crumb, { force: true });
      },
      { once: false }
    );
    this.ui.toolbar.querySelector(".et-actions").addEventListener("click", (event) => {
      const b = event.target.closest("[data-et]");
      if (!b) return;
      this.toolbarAction(b.dataset.et);
    });
  }

  positionToolbar(info) {
    const toolbar = this.ui.toolbar;
    if (toolbar.hidden) return;
    const rect = info.el.getBoundingClientRect();
    const barH =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--editor-bar-h")) || 56;
    const tw = toolbar.offsetWidth;
    const th = toolbar.offsetHeight;
    let top = rect.top - th - 8;
    if (top < barH + 6) top = Math.min(rect.bottom + 8, window.innerHeight - th - 8);
    top = clamp(top, barH + 6, window.innerHeight - th - 6);
    const left = clamp(rect.left, 8, Math.max(8, window.innerWidth - tw - 8));
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
  }

  positionOverlays() {
    if (!this.active || this.preview) return;
    if (this._positionRaf) cancelAnimationFrame(this._positionRaf);
    this._positionRaf = requestAnimationFrame(() => {
      this._positionRaf = null;
      if (!this.active || this.preview || !this.selectedId) return;
      const info = this.nodeInfo();
      if (info) this.positionToolbar(info);
    });
  }

  /* ---------------------------------------------------------------- toolbar actions */
  toolbarAction(action) {
    const info = this.nodeInfo();
    if (!info) return;
    switch (action) {
      case "panel":
        this.setInspector(true);
        break;
      case "edit":
        this.enterTextEdit(info.id);
        break;
      case "replace":
        this.openImageDialog(info.id, "replace");
        break;
      case "frame":
        this.openImageDialog(info.id, "frame");
        break;
      case "icon":
        this.openIconPicker(info.id);
        break;
      case "link":
        this.openLinkDialog(info.id);
        break;
      case "appearance":
        this.setTab("element");
        this.setInspector(true);
        this.inspector.scrollTo("appearance");
        break;
      case "hide":
        this.toggleHide(info.id);
        break;
      case "lock":
        this.toggleLock(info.id);
        break;
      case "reset-move":
        store.setNodeOffset(info.id, 0, 0);
        toast("Position reset.", { iconName: "reset" });
        break;
      case "delete":
        this.deleteSelected();
        break;
      case "more":
        this.showContextMenu(this.ui.toolbar.getBoundingClientRect().left, this.ui.toolbar.getBoundingClientRect().bottom + 4, info);
        break;
      default:
        break;
    }
  }

  toggleHide(id = this.selectedId) {
    if (!store.can("edit")) return;
    const info = this.nodeInfo(id);
    store.toggleNodeFlag(id, "hidden");
    toast(info?.hidden ? "Element will be shown again." : "Element hidden — still visible while editing.", {
      iconName: "eye-off",
    });
    if (this.inspector) this.inspector.render();
  }

  toggleLock(id = this.selectedId) {
    if (!store.can("edit")) return;
    const info = this.nodeInfo(id);
    store.toggleNodeFlag(id, "locked");
    if (!info?.locked) {
      this.clearSelection();
      toast("Element locked. Find it in the outline to unlock.", { iconName: "lock" });
    } else {
      toast("Element unlocked.", { iconName: "unlock" });
      this.selectNode(id, { force: true });
    }
  }

  duplicateSelected() {
    const info = this.nodeInfo();
    if (!info) return;
    const host = this.findItemHost(info.el);
    if (!host) {
      toast("This element doesn’t support duplication.", { iconName: "info" });
      return;
    }
    const newId = store.duplicateItem(host.section, host.item);
    if (newId) {
      toast("Card duplicated.", { iconName: "duplicate" });
      requestAnimationFrame(() => {
        const prefix = host.section === "features" ? "feature" : "step";
        this.selectNode(`${prefix}.${newId}.card`, { scroll: true });
      });
    }
  }

  async deleteSelected() {
    const info = this.nodeInfo();
    if (!info) return;
    const host = this.findItemHost(info.el);
    const isCard = !!host && host.el === info.el;
    const ok = await confirmDialog({
      title: isCard ? "Delete this card?" : "Delete this element?",
      message: isCard
        ? "The card and its content will be removed from the draft and from the exported content.json. Undo is available immediately."
        : "The element will disappear from the page and from the exported content.json. Undo is available immediately.",
      confirmLabel: isCard ? "Delete card" : "Delete element",
      danger: true,
    });
    if (!ok) return;
    if (isCard) {
      store.deleteItem(host.section, host.item);
      this.clearSelection();
      toast(`Card deleted — undo with ${modKey()}+Z.`, { tone: "warning", iconName: "trash" });
      return;
    }
    store.deleteNode(info.id);
    this.clearSelection();
    toast(`Element deleted — undo with ${modKey()}+Z.`, { tone: "warning", iconName: "trash" });
  }

  findItemHost(el) {
    const host = el.closest("[data-node-item][data-node-section]");
    if (!host) return null;
    return { item: host.dataset.nodeItem, section: host.dataset.nodeSection, el: host };
  }

  copyStyle() {
    const info = this.nodeInfo();
    if (!info) return;
    this._styleClipboard = clone(store.state.styles?.[info.id] || {});
    toast("Style copied.", { iconName: "palette" });
  }

  pasteStyle() {
    const info = this.nodeInfo();
    if (!info || !this._styleClipboard) return;
    store.apply("Style pasted", (state) => {
      if (this._styleClipboard && Object.keys(this._styleClipboard).length) {
        state.styles[info.id] = clone(this._styleClipboard);
      } else {
        delete state.styles[info.id];
      }
    });
    toast("Style pasted into the selected element.", { iconName: "palette" });
  }

  resetOverrides() {
    if (!this.selectedId) return;
    store.clearOverrides(this.selectedId);
    toast("Local overrides removed.", { iconName: "reset" });
  }

  /* ---------------------------------------------------------------- context menu */
  showContextMenu(x, y, info = this.nodeInfo()) {
    if (!info) return;
    const canEdit = store.can("edit");
    const itemHost = this.findItemHost(info.el);
    const items = [];
    const add = (action, label, iconName, opts = {}) => {
      items.push(
        `<button type="button" class="ctx-item${opts.danger ? " is-danger" : ""}" data-ctx="${action}" ${
          opts.disabled ? "disabled" : ""
        }>${icon(iconName, { size: 15 })}<span>${esc(label)}</span>${
          opts.key ? `<span class="ctx-key">${esc(opts.key)}</span>` : ""
        }</button>`
      );
    };
    const sep = () => items.push('<div class="ctx-sep"></div>');
    const header = `<div class="ctx-head">${esc(info.label)}</div>`;
    if (canEdit) {
      if (["text", "button", "link"].includes(info.kind)) {
        add("edit", "Edit content", "pen", { key: "F2" });
      }
      if (info.kind === "image") {
        add("replace", "Replace image…", "upload");
        add("frame", "Framing and alt…", "focus");
      }
      if (info.kind === "icon") add("icon", "Change icon…", "sparkles");
      if (["button", "link"].includes(info.kind) && !info.action) {
        add("link", "Edit link…", "link");
        if (info.el.getAttribute("href")) add("open-link", "Open link", "external");
      }
      sep();
      add("appearance", "Edit appearance", "palette");
      add("copy-style", "Copy style", "copy");
      add("paste-style", "Paste style", "layers", { disabled: !this._styleClipboard });
      add("reset", "Reset local overrides", "reset");
      sep();
      if (itemHost) {
        add("duplicate", "Duplicate card", "duplicate");
        add("move-up", "Move card up", "chevron-up", { disabled: this.isFirstItem(itemHost) });
        add("move-down", "Move card down", "chevron-down", { disabled: this.isLastItem(itemHost) });
      }
      if (info.offset) add("reset-move", "Reset position", "reset");
      add(info.hidden ? "show" : "hide", info.hidden ? "Show element" : "Hide element", info.hidden ? "eye" : "eye-off");
      add(info.locked ? "unlock" : "lock", info.locked ? "Unlock element" : "Lock element", info.locked ? "unlock" : "lock");
      sep();
      add("delete", info.item ? "Delete card" : "Delete element", "trash", { danger: true });
    } else {
      add("appearance", "Inspect element", "panel-right");
    }
    this.ui.ctx.innerHTML = header + items.join("");
    this.ui.ctx.hidden = false;
    const rect = this.ui.ctx.getBoundingClientRect();
    const left = clamp(x, 8, Math.max(8, window.innerWidth - rect.width - 8));
    const top = clamp(y, 8, Math.max(8, window.innerHeight - rect.height - 8));
    this.ui.ctx.style.left = `${left}px`;
    this.ui.ctx.style.top = `${top}px`;
    this.ui.ctx.onclick = (event) => {
      const btn = event.target.closest("[data-ctx]");
      if (!btn || btn.disabled) return;
      this.ui.ctx.hidden = true;
      const action = btn.dataset.ctx;
      switch (action) {
        case "edit":
          this.enterTextEdit(info.id);
          break;
        case "replace":
          this.openImageDialog(info.id, "replace");
          break;
        case "frame":
          this.openImageDialog(info.id, "frame");
          break;
        case "icon":
          this.openIconPicker(info.id);
          break;
        case "link":
          this.openLinkDialog(info.id);
          break;
        case "open-link":
          this.openCurrentLink(info);
          break;
        case "appearance":
          this.setTab("element");
          this.setInspector(true);
          this.inspector.scrollTo("appearance");
          break;
        case "copy-style":
          this.copyStyle();
          break;
        case "paste-style":
          this.pasteStyle();
          break;
        case "reset":
          this.resetOverrides();
          break;
        case "duplicate":
          this.duplicateSelected();
          break;
        case "move-up":
          if (itemHost) {
            store.moveItem(itemHost.section, itemHost.item, -1);
            requestAnimationFrame(() => this.selectNode(info.id, { force: true }));
          }
          break;
        case "move-down":
          if (itemHost) {
            store.moveItem(itemHost.section, itemHost.item, 1);
            requestAnimationFrame(() => this.selectNode(info.id, { force: true }));
          }
          break;
        case "hide":
        case "show":
          this.toggleHide(info.id);
          break;
        case "lock":
        case "unlock":
          this.toggleLock(info.id);
          break;
        case "reset-move":
          store.setNodeOffset(info.id, 0, 0);
          toast("Position reset.", { iconName: "reset" });
          break;
        case "delete":
          this.deleteSelected();
          break;
        default:
          break;
      }
    };
  }

  isFirstItem(host) {
    const list = host.el.parentElement?.children;
    return list ? Array.from(list).indexOf(host.el) === 0 : false;
  }

  isLastItem(host) {
    const list = host.el.parentElement?.children;
    return list ? Array.from(list).indexOf(host.el) === list.length - 1 : false;
  }

  openCurrentLink(info) {
    const href = info.el.getAttribute("href");
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  /* ---------------------------------------------------------------- text editing */
  enterTextEdit(id = this.selectedId, point = null) {
    if (!this.active || this.preview) return;
    if (!store.can("edit")) {
      toast("This role can preview the draft but not edit it.", { iconName: "lock" });
      return;
    }
    const info = this.nodeInfo(id);
    if (!info || !["text", "button", "link"].includes(info.kind)) {
      this.setTab("element");
      this.setInspector(true);
      return;
    }
    if (info.locked) {
      toast("This element is locked.", { iconName: "lock" });
      return;
    }
    if (this.editingId && this.editingId !== id) this.exitTextEdit(true);
    if (this.editingId === id) return;
    if (store.status === "conflict") {
      toast("Resolve the edit conflict before editing text.", { tone: "warning", iconName: "warning" });
      return;
    }
    this.editingId = id;
    this.editingEl = info.el;
    document.body.classList.add("editing-locked");
    this._originalHtml = info.el.innerHTML;
    this._formatRange = null;
    store.begin("Text edited");
    info.el.setAttribute("contenteditable", "true");
    info.el.setAttribute("data-editing", "true");
    info.el.setAttribute("spellcheck", "true");
    info.el.focus({ preventScroll: true });
    document.execCommand?.("styleWithCSS", false, true);
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      this.placeCaret(point.x, point.y);
    } else {
      const range = document.createRange();
      range.selectNodeContents(info.el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    this.ui.toolbar.hidden = true;
    this.ui.format.hidden = false;
    if (window.innerWidth <= 760) this.setInspector(false);
    this.buildFormatBar(info);
    this.bindEditingElement();
    this.updateSelectionUi();
    this.announce(`Editing ${info.label}. Press Escape or click away to finish.`);
  }

  placeCaret(x, y) {
    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (range) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  bindEditingElement() {
    const el = this.editingEl;
    if (!el) return;
    this._onEditingInput = () => {
      this.positionOverlays();
      this.updateFormatState();
    };
    this._onEditingKeydown = (event) => this.handleEditingKeydown(event);
    this._onEditingPaste = (event) => {
      event.preventDefault();
      const plain = event.clipboardData?.getData("text/plain") || "";
      const html = event.clipboardData?.getData("text/html") || "";
      if (event.shiftKey || !html) {
        document.execCommand("insertText", false, plain.replace(/\r/g, ""));
      } else {
        const safe = sanitizeHtml(html);
        if (safe) document.execCommand("insertHTML", false, safe);
        else document.execCommand("insertText", false, plain);
      }
      this.updateFormatState();
    };
    this._onEditingBlur = (event) => {
      const next = event.relatedTarget;
      if (next && (this.ui.format.contains(next) || next.closest?.(".dialog"))) return;
      if (this._suppressBlur) return;
      this.exitTextEdit(true);
    };
    el.addEventListener("input", this._onEditingInput);
    el.addEventListener("keydown", this._onEditingKeydown);
    el.addEventListener("paste", this._onEditingPaste);
    el.addEventListener("blur", this._onEditingBlur);
  }

  unbindEditingElement() {
    const el = this.editingEl;
    if (!el) return;
    el.removeEventListener("input", this._onEditingInput);
    el.removeEventListener("keydown", this._onEditingKeydown);
    el.removeEventListener("paste", this._onEditingPaste);
    el.removeEventListener("blur", this._onEditingBlur);
  }

  handleEditingKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.exitTextEdit(true);
      return;
    }
    const el = this.editingEl;
    const singleLine = el && el.tagName !== "P";
    if (event.key === "Enter" && singleLine) {
      event.preventDefault();
      if (event.shiftKey) {
        document.execCommand("insertLineBreak");
      } else {
        this.exitTextEdit(true);
      }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.openLinkDialog(this.editingId);
    }
  }

  exitTextEdit(commit = true) {
    if (!this.editingId || !this.editingEl) return;
    const id = this.editingId;
    const el = this.editingEl;
    this._suppressBlur = true;
    this.unbindEditingElement();
    const html = el.innerHTML;
    el.removeAttribute("contenteditable");
    el.removeAttribute("data-editing");
    document.body.classList.remove("editing-locked");
    this.editingId = null;
    this.editingEl = null;
    this.ui.format.hidden = true;
    const safe = sanitizeHtml(html);
    if (commit) {
      if (!plainText(safe)) {
        el.innerHTML = this._originalHtml;
        toast("Text can’t be empty — previous content restored.", {
          tone: "warning",
          iconName: "warning",
        });
        store.end();
      } else if (safe !== this._originalHtml) {
        store.state.text[id] = safe;
        const changed = store.end();
        if (!changed) {
          this.updateSelectionUi();
        }
      } else {
        store.end();
        this.updateSelectionUi();
      }
    } else {
      el.innerHTML = this._originalHtml;
      store.rollbackTransaction();
    }
    this._suppressBlur = false;
    this.selectNode(id, { force: true });
    this.updateFormatState();
  }

  buildFormatBar(info) {
    const tokens = store.state.theme?.tokens?.[store.mode] || {};
    const overlayPreset = tokens.accent;
    this.ui.format.innerHTML = `
      <span class="fmt-context">${esc(info.label)}</span>
      <button type="button" class="fmt-btn" data-fmt="bold" aria-label="Bold" title="Bold">${icon("bold", {
        size: 15,
      })}</button>
      <button type="button" class="fmt-btn" data-fmt="italic" aria-label="Italic" title="Italic">${icon("italic", {
        size: 15,
      })}</button>
      <button type="button" class="fmt-btn" data-fmt="underline" aria-label="Underline" title="Underline">${icon(
        "underline",
        { size: 15 }
      )}</button>
      <button type="button" class="fmt-btn" data-fmt="link" aria-label="Link" title="Link (${modKey()}+K)">${icon(
        "link",
        { size: 15 }
      )}</button>
      <span class="fmt-sep"></span>
      <span class="fmt-colour" role="group" aria-label="Text colour">
        <button type="button" class="fmt-token" data-fmt="color" data-token="accent" style="background:${esc(
          tokens.accent || overlayPreset || "#E0673F"
        )}" title="Accent text" aria-label="Accent text"></button>
        <button type="button" class="fmt-token" data-fmt="color" data-token="text" style="background:${esc(
          tokens.text || "#F2F2F5"
        )}" title="Primary text" aria-label="Primary text"></button>
        <button type="button" class="fmt-token" data-fmt="color" data-token="secondary" style="background:${esc(
          tokens.secondary || "#A6A6B3"
        )}" title="Secondary text" aria-label="Secondary text"></button>
      </span>
      <span class="fmt-sep"></span>
      <button type="button" class="fmt-btn" data-fmt="align-left" aria-label="Align left" title="Align left">${icon(
        "align-left",
        { size: 15 }
      )}</button>
      <button type="button" class="fmt-btn" data-fmt="align-center" aria-label="Align centre" title="Align centre">${icon(
        "align-center",
        { size: 15 }
      )}</button>
      <button type="button" class="fmt-btn" data-fmt="align-right" aria-label="Align right" title="Align right">${icon(
        "align-right",
        { size: 15 }
      )}</button>
      <span class="fmt-sep"></span>
      <button type="button" class="fmt-btn" data-fmt="clear" aria-label="Clear formatting" title="Clear formatting">${icon(
        "eraser",
        { size: 15 }
      )}</button>
      <button type="button" class="fmt-btn fmt-done" data-fmt="done" aria-label="Finish editing" title="Done">${icon(
        "check",
        { size: 16 }
      )}<span>Done</span></button>
    `;
    this.ui.format.querySelectorAll("[data-fmt]").forEach((btn) => {
      btn.addEventListener("pointerdown", (event) => {
        event.preventDefault();
      });
    });
    this.ui.format.onclick = (event) => {
      const btn = event.target.closest("[data-fmt]");
      if (!btn) return;
      const action = btn.dataset.fmt;
      const el = this.editingEl;
      if (!el) return;
      if (["bold", "italic", "underline"].includes(action)) {
        document.execCommand(action);
      } else if (action === "link") {
        this.openLinkDialog(this.editingId);
      } else if (action === "color") {
        const token = btn.dataset.token;
        const value = store.state.theme?.tokens?.[store.mode]?.[token];
        if (value) {
          document.execCommand("styleWithCSS", false, true);
          document.execCommand("foreColor", false, value);
        }
      } else if (action.startsWith("align-")) {
        const align = action.replace("align-", "");
        store.setStyleProp(this.editingId, this.bpKey, "align", align);
        this.updateFormatState();
      } else if (action === "clear") {
        document.execCommand("removeFormat");
      } else if (action === "done") {
        this.exitTextEdit(true);
      }
      this.updateFormatState();
    };
    document.addEventListener("selectionchange", this._onSelectionChange || (this._onSelectionChange = () => this.updateFormatState()));
    this.updateFormatState();
    setTimeout(() => this.positionOverlays(), 20);
  }

  getSelectionRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) return sel.getRangeAt(0).cloneRange();
    return null;
  }

  updateFormatState() {
    if (!this.editingId || this.ui.format.hidden) return;
    const states = { bold: false, italic: false, underline: false };
    try {
      states.bold = document.queryCommandState("bold");
      states.italic = document.queryCommandState("italic");
      states.underline = document.queryCommandState("underline");
    } catch {}
    for (const [key, on] of Object.entries(states)) {
      this.ui.format.querySelector(`[data-fmt="${key}"]`)?.setAttribute("aria-pressed", String(on));
    }
    const entry = store.state.styles?.[this.editingId]?.[this.bpKey] || {};
    for (const align of ["left", "center", "right"]) {
      this.ui.format
        .querySelector(`[data-fmt="align-${align}"]`)
        ?.setAttribute("aria-pressed", String(entry.align === align));
    }
    this.positionOverlays();
  }

  /* ---------------------------------------------------------------- dialogs from toolbar */
  openImageDialog(id = this.selectedId, focus = "replace") {
    if (!this.active) return;
    this.setTab("element");
    this.setInspector(true);
    if (this.inspector) {
      this.inspector.render();
      this.inspector.focusImage(focus);
    }
  }

  openIconPicker(id = this.selectedId) {
    if (!this.active || !store.can("edit")) return;
    this.setTab("element");
    this.setInspector(true);
    this.inspector.render();
    this.inspector.focusIcon();
  }

  async openLinkDialog(id = this.selectedId) {
    if (!this.active || !store.can("edit")) return;
    if (this.editingId === id && this.editingEl) {
      const range = this.getSelectionRange();
      if (range) this.savedRange = range;
      const url = await promptDialog({
        title: "Insert link",
        label: "Destination",
        placeholder: "https://example.com or #features",
        confirmLabel: "Insert link",
        hint: "Use an anchor (#features), an https URL or mailto:address.",
      });
      if (!url) return;
      const safe = sanitizeUrl(url);
      if (!safe) {
        toast("That link destination is not allowed.", { tone: "destructive", iconName: "warning" });
        return;
      }
      const el = this.editingEl;
      if (!el) return;
      el.focus();
      if (this.savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
      }
      document.execCommand("styleWithCSS", false, true);
      if (window.getSelection()?.isCollapsed) {
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${esc(safe)}">${esc(safe.replace(/^mailto:/, ""))}</a>`
        );
      } else {
        document.execCommand("createLink", false, safe);
      }
      this.updateFormatState();
      return;
    }
    this.setTab("element");
    this.setInspector(true);
    this.inspector.render();
    this.inspector.focusLink();
  }

  /* ---------------------------------------------------------------- insert + export */
  insertTarget() {
    const info = this.nodeInfo();
    const host = info?.el.closest("section[id], footer");
    if (!host || host.id === "site-header") return { section: "page", label: "Page end" };
    const labels = {
      top: "Hero",
      features: "Features",
      install: "Install",
      try: "Try it",
      "site-footer": "Footer",
    };
    return { section: host.id || "page", label: labels[host.id] || "Selected section" };
  }

  openInsertDialog() {
    if (!store.can("edit")) return;
    const target = this.insertTarget();
    const d = dialog({
      title: "Insert element",
      subtitle: `Added at the end of ${target.label}.`,
      body: `<div class="insert-grid">
        <button type="button" class="insert-choice" data-insert-kind="heading">${icon("type", { size: 18 })}<span><strong>Heading</strong><span>Section title</span></span></button>
        <button type="button" class="insert-choice" data-insert-kind="text">${icon("pen", { size: 18 })}<span><strong>Text</strong><span>Body paragraph</span></span></button>
        <button type="button" class="insert-choice" data-insert-kind="image">${icon("image", { size: 18 })}<span><strong>Image</strong><span>Upload a picture</span></span></button>
        <button type="button" class="insert-choice" data-insert-kind="button">${icon("cursor", { size: 18 })}<span><strong>Button</strong><span>Call to action</span></span></button>
        <button type="button" class="insert-choice" data-insert-kind="divider">${icon("minus", { size: 18 })}<span><strong>Divider</strong><span>Horizontal rule</span></span></button>
        <button type="button" class="insert-choice" data-insert-kind="dynamic">${icon("focus", { size: 18 })}<span><strong>Dynamic</strong><span>Model-filled slot</span></span></button>
      </div>`,
      footer: `<button type="button" class="btn btn-ghost btn-sm" data-dialog-close>Cancel</button>`,
    });
    d.el.querySelectorAll("[data-insert-kind]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.insertKind;
        d.close();
        if (kind === "image") this.chooseInsertImage(target.section);
        else if (kind === "dynamic") this.openDynamicDialog(target.section);
        else this.insertBlock(kind, target.section);
      });
    });
  }

  openDynamicDialog(section) {
    const d = dialog({
      title: "Dynamic element",
      subtitle: "Describe what belongs here. X and Y are measured from the selected section's top-left; the model fills the fixed box.",
      body: `<div class="field">
          <label class="field-label" for="dyn-description">Description</label>
          <textarea class="textarea" id="dyn-description" placeholder="e.g. A small annotated diagram showing the editor selecting a headline" autofocus></textarea>
        </div>
        <div class="field-grid">
          <div class="field"><label class="field-label" for="dyn-x">X</label><input class="input" id="dyn-x" type="number" min="0" max="2400" value="40"></div>
          <div class="field"><label class="field-label" for="dyn-y">Y</label><input class="input" id="dyn-y" type="number" min="0" max="4000" value="120"></div>
          <div class="field"><label class="field-label" for="dyn-w">Width</label><input class="input" id="dyn-w" type="number" min="80" max="1600" value="360"></div>
          <div class="field"><label class="field-label" for="dyn-h">Height</label><input class="input" id="dyn-h" type="number" min="40" max="1600" value="180"></div>
        </div>
        <div class="notice">${icon("info", { size: 16 })}<div>In <code>content.json</code> this becomes <code>{ description, position, size, html }</code>. MCP tools can fill <code>html</code>; empty slots stay hidden for visitors.</div></div>`,
      footer: `<button type="button" class="btn btn-ghost btn-sm" data-dialog-close>Cancel</button><button type="button" class="btn btn-primary btn-sm" id="dyn-create">Add dynamic element</button>`,
    });
    d.el.querySelector("#dyn-create").addEventListener("click", () => {
      const description = d.el.querySelector("#dyn-description")?.value.trim();
      if (!description) {
        d.el.querySelector("#dyn-description")?.focus();
        return;
      }
      const id = store.addDynamic({
        section,
        description,
        x: d.el.querySelector("#dyn-x")?.value,
        y: d.el.querySelector("#dyn-y")?.value,
        width: d.el.querySelector("#dyn-w")?.value,
        height: d.el.querySelector("#dyn-h")?.value,
      });
      d.close();
      if (id) requestAnimationFrame(() => this.selectNode(id, { scroll: true, force: true }));
    });
  }

  insertBlock(kind, section) {
    const text = kind === "heading" ? "New heading" : kind === "button" ? "Button" : kind === "text" ? "New text" : "";
    const id = store.addInsertion({ section, kind, text });
    if (!id) return;
    requestAnimationFrame(() => {
      this.selectNode(id, { scroll: true, force: true });
      if (kind === "heading" || kind === "text" || kind === "button") this.enterTextEdit(id);
      else if (kind === "image") this.openImageDialog(id, "replace");
    });
  }

  chooseInsertImage(section) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        toast("Use a PNG, JPEG or WebP image.", { tone: "destructive", iconName: "warning" });
        return;
      }
      if (file.size > 2.5 * 1024 * 1024) {
        toast("That image is larger than 2.5 MB.", { tone: "destructive", iconName: "warning" });
        return;
      }
      const src = await readFileAsDataURL(file);
      const id = store.addInsertion({ section, kind: "image", src, alt: file.name.replace(/\.[^.]+$/, "") });
      if (id) requestAnimationFrame(() => this.selectNode(id, { scroll: true, force: true }));
    });
    input.click();
  }

  exportJson() {
    downloadFile("content.json", store.buildContentJson());
    toast("content.json exported.", { iconName: "download" });
  }

  /* ---------------------------------------------------------------- inspector */
  setInspector(open) {
    if (!this.ui) return;
    this.ui.inspector.dataset.open = String(!!open);
    this.ui.inspectorBtn.setAttribute("aria-pressed", String(!!open));
    document.body.classList.toggle("inspector-open", !!open);
    if (open) this.inspector.render();
  }

  setTab(tab) {
    if (!this.inspector) return;
    this.inspector.setTab(tab);
  }

  setBreakpoint(bp, width = 0, { silent = false } = {}) {
    this.bp = bp;
    const site = $("#site");
    if (!site) return;
    let actualWidth = 0;
    if (bp === "desktop") {
      site.style.removeProperty("max-width");
      document.body.classList.remove("bp-preview");
      this.bpKey = window.innerWidth <= 640 ? "mobile" : window.innerWidth <= 900 ? "tablet" : "base";
      this.ui.width.textContent = "Auto";
    } else {
      actualWidth = bp === "tablet" ? Math.min(820, window.innerWidth) : bp === "mobile" ? Math.min(390, window.innerWidth) : width || Number(this.ui.slider.value);
      site.style.maxWidth = `${actualWidth}px`;
      document.body.classList.add("bp-preview");
      this.bpKey = actualWidth <= 640 ? "mobile" : actualWidth <= 900 ? "tablet" : "base";
      this.ui.width.textContent = `${actualWidth}px`;
      this.ui.slider.value = String(actualWidth);
    }
    this.bpWidth = actualWidth;
    $$(".viewport-switch [data-bp]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.bp === bp))
    );
    if (!silent) {
      this.positionOverlays();
      if (this.inspector) this.inspector.render();
    }
  }

  showShortcuts() {
    const rows = [
      ["Select next element", "Tab"],
      ["Select element under pointer", "Click"],
      ["Move selected element", "Drag"],
      ["Reset moved element", "Reset position (toolbar)"],
      ["Edit text / label", "Double-click · F2"],
      ["Finish text editing", "Escape · Done"],
      ["Bold · Italic · Underline", `${modKey()}+B · ${modKey()}+I · ${modKey()}+U`],
      ["Insert link while editing", `${modKey()}+K`],
      ["Undo · Redo", `${modKey()}+Z · ${modKey()}+Shift+Z`],
      ["Save draft now", `${modKey()}+S`],
      ["Delete selected element", "Delete"],
      ["Open inspector", "I"],
      ["Show shortcuts", "?"],
      ["Exit editor", "Escape (outside editing)"],
      ["Start or stop editing", "T"],
    ];
    dialog({
      title: "Keyboard shortcuts",
      subtitle: "Every pointer action also has a keyboard-accessible control.",
      body: `<div class="shortcut-grid">${rows
        .map(
          ([label, keys]) =>
            `<div class="shortcut-row"><span>${esc(label)}</span><kbd>${esc(keys)}</kbd></div>`
        )
        .join("")}</div>
        <div class="notice" style="margin-top:14px">${icon("info", {
          size: 16,
        })}<div>Pasted HTML is sanitised. Use Shift+V while editing to paste as plain text. Focus outlines and live status messages are available to screen readers.</div></div>`,
      footer: `<button type="button" class="btn btn-primary btn-sm" data-dialog-close>Got it</button>`,
    });
  }

  showConflict() {
    if (!store.conflict) return;
    toast("Another tab saved this draft. Reload this tab to use the latest version.", {
      tone: "warning",
      iconName: "warning",
      timeout: 6000,
    });
  }

  async requestExit() {
    if (!this.active) return;
    if (this.editingId) this.exitTextEdit(true);
    if (store.status === "error") {
      const choice = await confirmDialog({
        title: "Draft save failed",
        message:
          "Your latest changes are still in this tab, but they could not be saved to the browser. Leaving now may lose them.",
        confirmLabel: "Retry save",
        cancelLabel: "Stay here",
        danger: true,
      });
      if (choice) await store.retrySave();
      return;
    }
    if (store.status === "conflict") {
      const leave = await confirmDialog({
        title: "Unresolved conflict",
        message: "Another tab saved a different version. Leaving now keeps the latest saved draft but may discard your unsaved work.",
        confirmLabel: "Leave anyway",
        danger: true,
      });
      if (!leave) return;
      await store.endSession({ discard: true });
      return;
    }
    const ended = await store.endSession();
    if (ended) {
      toast("Editor closed. Reopen to continue the draft or start over.", { iconName: "history" });
    }
  }

  announce(message) {
    const live = document.getElementById("sr-live");
    if (live) live.textContent = message;
  }

  /* ---------------------------------------------------------------- site event binding */
  bindSite() {
    const schedulePosition = throttleRaf(() => this.positionOverlays());
    window.addEventListener("scroll", () => {
      this.hideHover();
      schedulePosition();
    }, { passive: true, capture: true });
    window.addEventListener("resize", schedulePosition);
    document.addEventListener("keydown", (event) => this.handleGlobalKey(event));
    document.addEventListener("pointerdown", (event) => this.handleDragStart(event), true);
    document.addEventListener("pointermove", (event) => this.handleDragMove(event), true);
    document.addEventListener("pointerup", (event) => this.handleDragEnd(event), true);
    document.addEventListener("pointercancel", (event) => this.handleDragEnd(event), true);

    document.addEventListener("pointermove", (event) => {
      if (!this.active || this.preview || this.editingId) return;
      if (event.pointerType === "touch") return;
      if (event.target.closest("#editor-ui, .dialog")) {
        this.hideHover();
        return;
      }
      const node = event.target.closest('#site [data-node-pickable="true"]');
      if (!node || node.getAttribute("data-locked") === "true") {
        this.hideHover();
        return;
      }
      if (node.dataset.nodeId === this.selectedId) {
        this.hideHover();
        return;
      }
      if (this.hoverId !== node.dataset.nodeId) {
        this.hoverId = node.dataset.nodeId;
        this.setHoverVisual(this.hoverId);
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (!this.active || this.preview) return;
      if (event.pointerType !== "touch") return;
      const node = event.target.closest('#site [data-node-pickable="true"]');
      if (!node) return;
      this.clearLongPress();
      const x = event.clientX;
      const y = event.clientY;
      const cancel = () => this.clearLongPress();
      const start = () => {
        this.selectNode(node.dataset.nodeId);
        this.showContextMenu(x, y, this.nodeInfo());
        cancel();
      };
      this._longPressTimer = setTimeout(start, 550);
      const move = () => {
        if (Math.abs(event.clientX - x) > 10 || Math.abs(event.clientY - y) > 10) cancel();
      };
      document.addEventListener("pointermove", move, { once: true });
      document.addEventListener("pointerup", cancel, { once: true });
    });

    document.addEventListener("click", (event) => this.handleClick(event), true);
    document.addEventListener("dblclick", (event) => this.handleDoubleClick(event), true);
    document.addEventListener("contextmenu", (event) => this.handleContext(event), true);
    document.addEventListener("focusin", (event) => {
      if (!this.active || this.preview || this.editingId) return;
      const control = event.target.closest?.("[data-action], [data-tg-site-action]");
      if (control && !control.hasAttribute("data-node-id")) return;
      const node = event.target.closest?.('#site [data-node-pickable="true"]');
      if (node && node.dataset.nodeId !== this.selectedId) this.selectNode(node.dataset.nodeId, { force: true });
    });
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("#ctx-menu")) this.hideContext();
      if (!event.target.closest(".edit-toolbar") && !event.target.closest(".format-bar")) {
        // clicking outside does not deselect here; click handles site interactions
      }
    });
  }

  handleDragStart(event) {
    if (!this.active || this.preview || event.pointerType === "touch" || event.button > 0) return;
    if (event.target.closest("#editor-ui, .dialog")) return;
    if (this.editingEl?.contains(event.target)) return;
    const control = event.target.closest("[data-action], [data-tg-site-action]");
    if (control && !control.hasAttribute("data-node-id")) return;
    const node = event.target.closest('#site [data-node-pickable="true"]');
    if (!node) return;
    const id = node.dataset.nodeId;
    if (!id) return;
    const locked = node.getAttribute("data-locked") === "true";
    event.preventDefault();
    event.stopPropagation();
    if (id !== this.selectedId) this.selectNode(id, { force: locked });
    if (locked) return;
    const offset = store.state.nodeState?.[id]?.offset || {};
    this._drag = {
      id,
      el: this.getNode(id) || node,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: Number(offset.x) || 0,
      baseY: Number(offset.y) || 0,
      moved: false,
    };
  }

  handleDragMove(event) {
    const drag = this._drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) {
      if (!store.begin("Element moved")) {
        this._drag = null;
        return;
      }
      drag.moved = true;
      document.body.classList.add("is-dragging");
    }
    event.preventDefault();
    event.stopPropagation();
    const x = Math.round(drag.baseX + dx);
    const y = Math.round(drag.baseY + dy);
    drag.el.style.translate = `${x}px ${y}px`;
    const ns = store.state.nodeState[drag.id] || (store.state.nodeState[drag.id] = {});
    if (!x && !y) delete ns.offset;
    else ns.offset = { x, y };
    this.positionOverlays();
  }

  handleDragEnd(event) {
    const drag = this._drag;
    if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
    this._drag = null;
    document.body.classList.remove("is-dragging");
    if (!drag.moved) return;
    store.end();
    toast("Element moved — drag again to reposition, Ctrl+Z to undo.", { iconName: "grip" });
  }

  handleGlobalKey(event) {
    if (!this.active) return;
    if (document.querySelector("dialog[open]")) return;
    const typing = isTypingTarget(event.target);
    if (event.key === "Escape") {
      if (!this.ui.ctx.hidden) {
        this.hideContext();
        event.preventDefault();
        return;
      }
      if (this.editingId) {
        event.preventDefault();
        this.exitTextEdit(true);
        return;
      }
      if (this.ui.inspector.dataset.open === "true" && window.innerWidth <= 760) {
        event.preventDefault();
        this.setInspector(false);
        return;
      }
      if (this.selectedId) {
        event.preventDefault();
        this.clearSelection();
      }
      return;
    }
    if (typing) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      store.redo();
      return;
    }
    if (mod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      store.saveNow();
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      this.enterTextEdit(this.selectedId);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (this.selectedId && !this.editingId) {
        event.preventDefault();
        this.deleteSelected();
      }
      return;
    }
    if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      event.preventDefault();
      this.showShortcuts();
      return;
    }
    if (event.key.toLowerCase() === "i" && !mod && !event.altKey) {
      event.preventDefault();
      this.setInspector(this.ui.inspector.dataset.open !== "true");
    }
  }

  handleClick(event) {
    if (!this.active || this.preview) return;
    if (event.target.closest("#editor-ui, .dialog, .toast-region")) return;
    if (this.editingEl && this.editingEl.contains(event.target)) {
      event.preventDefault();
      return;
    }
    const control = event.target.closest("[data-action], [data-tg-site-action]");
    if (control && !control.hasAttribute("data-node-id")) return;
    const node = event.target.closest('#site [data-node-pickable="true"]');
    if (!node) {
      if (!event.target.closest("[data-action]")) {
        if (this.selectedId) this.clearSelection();
        this.hideContext();
      }
      return;
    }
    const id = node.dataset.nodeId;
    const locked = node.getAttribute("data-locked") === "true";
    event.preventDefault();
    event.stopPropagation();
    if (this.editingId) this.exitTextEdit(true);
    this.hideContext();
    if (locked) {
      toast("This element is locked. Open the outline to select or unlock it.", {
        iconName: "lock",
      });
      return;
    }
    // Re-query after a potential re-render from committing text.
    this.selectNode(id);
  }

  handleDoubleClick(event) {
    if (!this.active || this.preview) return;
    if (event.target.closest("#editor-ui, .dialog")) return;
    const node = event.target.closest('#site [data-node-pickable="true"]');
    if (!node) return;
    if (node.getAttribute("data-locked") === "true") return;
    event.preventDefault();
    event.stopPropagation();
    const id = node.dataset.nodeId;
    const kind = node.dataset.nodeKind;
    this.selectNode(id, { force: true });
    if (["text", "button", "link"].includes(kind)) {
      this.enterTextEdit(id, { x: event.clientX, y: event.clientY });
    } else if (kind === "image") {
      this.openImageDialog(id, "replace");
    } else if (kind === "icon") {
      this.openIconPicker(id);
    } else {
      this.setTab("element");
      this.setInspector(true);
      this.inspector.scrollTo("appearance");
    }
  }

  handleContext(event) {
    if (!this.active || this.preview) return;
    if (event.target.closest("#editor-ui, .dialog")) return;
    const node = event.target.closest('#site [data-node-pickable="true"]');
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.editingId) this.exitTextEdit(true);
    if (node.getAttribute("data-locked") === "true") {
      this.selectNode(node.dataset.nodeId, { force: true });
    } else {
      this.selectNode(node.dataset.nodeId);
    }
    this.showContextMenu(event.clientX, event.clientY);
  }

  hideHover() {
    this.hoverId = null;
    this.setHoverVisual(null);
  }

  hideContext() {
    if (this.ui) this.ui.ctx.hidden = true;
  }

  clearLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }
}

export const editor = new Editor();
