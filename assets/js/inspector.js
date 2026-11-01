import { store } from "./store.js";
import { icon, ICON_NAMES } from "./icons.js";
import { STYLE_META, TOKEN_META, TEXTURE_META, FONT_ROLES, DEFAULT_THEME, DEFAULT_STYLES } from "./content.js";
import { generateThemeTokens } from "./theme-generator.js";
import {
  ASSET_LIBRARY,
  ASSET_GROUPS,
  assetPreview,
  getAsset,
  UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
} from "./assets-registry.js";
import {
  $$,
  esc,
  clone,
  clamp,
  sanitizeHtml,
  plainText,
  safeCssValue,
  cssLength,
  parseColor,
  rgbToHex,
  contrastRatio,
  contrastLabel,
  nearestBackground,
  formatBytes,
  formatDate,
  readFileAsDataURL,
  imageSize,
  uid,
  sanitizeUrl,
  modKey,
  isTypingTarget,
} from "./utils.js";
import { dialog, confirmDialog, toast } from "./ui.js";

const BP_LABEL = { base: "Desktop", tablet: "Tablet", mobile: "Mobile" };
const TARGET_LABELS = {
  "header.brandMark": "Header brand mark",
  "footer.brandMark": "Footer brand mark",
  favicon: "Browser favicon",
  "hero.art": "Hero artwork",
  "identity.artwork": "Identity artwork",
};
const KIND_ICON = {
  text: "type",
  button: "cursor",
  link: "link",
  image: "image",
  icon: "sparkles",
  surface: "layers",
  group: "layers",
};
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9.,%\s/]+\)|hsla?\([0-9.,%\s/]+\)|var\(--[a-z0-9-]+\)|transparent)$/;

function isValidColor(value) {
  return COLOR_RE.test(String(value || "").trim());
}

function toHex(value, fallback = "#000000") {
  if (!value) return fallback;
  const v = String(value).trim();
  const match = v.match(/^var\(--([a-z0-9-]+)\)$/i);
  if (match) {
    const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    value = store.state.theme?.tokens?.[store.mode]?.[key] || fallback;
  }
  const rgb = parseColor(value);
  return rgb ? rgbToHex(rgb) : fallback;
}

function rangeField({ label, prop, value, min = 0, max = 100, step = 1, unit = "px", inherited = false }) {
  const canReset = !inherited && prop && !prop.startsWith("theme-");
  return `<div class="field">
    <div class="field-label"><span>${esc(label)}</span>${
      inherited
        ? ""
        : `<span class="inline-actions"><span class="is-override">Local</span>${
            canReset
              ? `<button type="button" class="mini-btn icon-only" data-reset-prop="${esc(
                  prop
                )}" title="Reset ${esc(label)} to inherited" aria-label="Reset ${esc(label)}">${icon(
                  "reset",
                  { size: 11 }
                )}</button>`
              : ""
          }</span>`
    }</div>
    <div class="range-row">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${esc(value)}" data-live-prop="${esc(
        prop
      )}" aria-label="${esc(label)}">
      <span class="range-value">${esc(value)}${esc(unit)}</span>
    </div>
  </div>`;
}

function imageRangeField({ label, prop, value, min = 0, max = 100, step = 1, unit = "px" }) {
  return `<div class="field">
    <div class="field-label"><span>${esc(label)}</span></div>
    <div class="range-row">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${esc(
        value
      )}" data-image-prop="${esc(prop)}" aria-label="${esc(label)}">
      <span class="range-value">${esc(value)}${esc(unit)}</span>
    </div>
  </div>`;
}

function colorField({ label, prop, value, computed, tokens, inherited = false, swatchesOnly = false }) {
  const initial = toHex(value || computed, tokens.canvas || "#000000");
  return `<div class="field">
    <div class="field-label"><span>${esc(label)}</span>${
      inherited ? '<span class="inherited-note">Inherited</span>' : '<span class="is-override">Local</span>'
    }</div>
    <div class="color-row">
      <label class="color-well" style="background:${esc(initial)}">
        <input type="color" value="${esc(initial)}" data-color-prop="${esc(prop)}" aria-label="${esc(label)} swatch">
      </label>
      <input class="input" data-color-hex="${esc(prop)}" value="${esc(value || "")}" placeholder="Inherited — enter a hex value or token" spellcheck="false" aria-label="${esc(
        label
      )} value">
      <button type="button" class="mini-btn icon-only" data-reset-prop="${esc(prop)}" title="Reset to inherited" aria-label="Reset ${esc(
        label
      )}">${icon("reset", { size: 13 })}</button>
    </div>
    <div class="swatch-grid">
      ${["text", "secondary", "accent", "accentHover", "surface", "border", "destructive"]
        .map(
          (token) =>
            `<button type="button" class="swatch-btn" data-swatch-prop="${esc(prop)}" data-swatch-token="${token}" style="--swatch:${
              tokens[token] || "transparent"
            }" title="${token}" aria-label="Use ${token} token"></button>`
        )
        .join("")}
    </div>
  </div>`;
}

export class Inspector {
  constructor(editor) {
    this.editor = editor;
    this.tab = "element";
    this.el = document.getElementById("inspector-body");
    this._liveTx = null;
    this._liveKind = null;
    this._openStyle = null;
    this._uploadError = "";
    this._assetQuery = "";
    this._navQuery = "";
    if (this.el) {
      this.el.addEventListener("click", (event) => this.onClick(event));
      this.el.addEventListener("input", (event) => this.onInput(event));
      this.el.addEventListener("change", (event) => this.onChange(event));
      this.el.addEventListener("keydown", (event) => this.onKeydown(event));
    }
  }

  setTab(tab) {
    if (!["element", "theme", "assets"].includes(tab)) return;
    const changed = this.tab !== tab;
    this.tab = tab;
    if (changed && this.el) this.el.scrollTop = 0;
    document.querySelectorAll(".inspector-tab").forEach((btn) => {
      btn.setAttribute("aria-selected", String(btn.dataset.tab === tab));
    });
    this.render();
  }

  render() {
    if (!this.el || !this.editor.active) return;
    const scroll = this.el.scrollTop;
    let html = "";
    if (this.tab === "element") html = this.renderElement();
    else if (this.tab === "theme") html = this.renderTheme();
    else html = this.renderAssets();
    this.el.innerHTML = html;
    this.el.scrollTop = scroll;
    document.querySelectorAll(".inspector-tab").forEach((btn) => {
      btn.setAttribute("aria-selected", String(btn.dataset.tab === this.tab));
    });
    if (this._openStyle) {
      const details = this.el.querySelector(`[data-style-details="${this._openStyle}"]`);
      if (details) {
        details.open = true;
        requestAnimationFrame(() => details.scrollIntoView({ block: "center" }));
      }
      this._openStyle = null;
    }
  }

  scrollTo(section) {
    const target = this.el?.querySelector(`[data-section="${section}"]`);
    if (!target) return;
    if (target.tagName === "DETAILS") target.open = true;
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    const focusable = target.querySelector("input, select, textarea, button");
    if (section !== "outline") setTimeout(() => focusable?.focus({ preventScroll: true }), 320);
  }

  focusImage(mode = "replace") {
    this.render();
    const section = this.el?.querySelector('[data-section="image"]');
    if (!section) return;
    section.scrollIntoView({ block: "start", behavior: "smooth" });
    if (mode === "replace") {
      const input = section.querySelector("[data-image-upload]");
      setTimeout(() => input?.click(), 260);
    } else {
      setTimeout(() => section.querySelector("[data-image-field='aspect']")?.focus(), 260);
    }
  }

  focusIcon() {
    this.render();
    const section = this.el?.querySelector('[data-section="icon"]');
    section?.scrollIntoView({ block: "start", behavior: "smooth" });
    setTimeout(() => section?.querySelector("[data-icon-choice]")?.focus(), 260);
  }

  focusLink() {
    this.render();
    const section = this.el?.querySelector('[data-section="link"]');
    section?.scrollIntoView({ block: "start", behavior: "smooth" });
    setTimeout(() => section?.querySelector("[data-link-field='url']")?.focus(), 260);
  }

  /* ================================================================ ELEMENT */
  renderElement() {
    const id = this.editor.selectedId;
    const info = this.editor.nodeInfo(id);
    const mode = store.mode;
    const tokens = store.state.theme?.tokens?.[mode] || {};
    const canEdit = store.can("edit");
    if (!info) {
      return `<div class="empty-panel">
          <h3>Select something to edit</h3>
          <p>Click any text, card, image or icon on the page. Hover to identify, double-click to edit. Or pick an element from the outline.</p>
          <div class="inline-actions" style="justify-content:center">
            <button type="button" class="mini-btn" data-act="open-outline">${icon("layers", {
              size: 14,
            })} Outline</button>
            <button type="button" class="mini-btn" data-help>${icon("keyboard", {
              size: 14,
            })} Shortcuts</button>
          </div>
        </div>
        <div class="panel">${this.navigatorHtml()}</div>`;
    }
    const entry = store.state.styles?.[id] || {};
    const bpEntry = entry[this.editor.bpKey] || {};
    const el = info.el;
    const computed = getComputedStyle(el);
    const styleKey =
      entry.style ||
      Array.from(el.classList)
        .find((c) => c.startsWith("ts-"))
        ?.slice(3) ||
      "body";
    const styleDef = store.state.theme?.styles?.[styleKey] || DEFAULT_STYLES.body;
    const isText = ["text", "button", "link"].includes(info.kind);
    const itemHost = this.editor.findItemHost(el);

    const breadcrumbs = this.editor
      .ancestors(el)
      .map((node) => {
        const nid = node.dataset.nodeId;
        const label = node.dataset.nodeLabel || node.dataset.nodeKind || nid;
        return `<button type="button" data-crumb-inspector="${esc(nid)}">${esc(
          label.length > 26 ? `${label.slice(0, 25)}…` : label
        )}</button>`;
      })
      .join('<span class="sep">›</span>');

    const quick = [];
    if (canEdit) {
      if (isText) {
        quick.push(
          `<button type="button" class="mini-btn" data-act="edit-text">${icon("pen", {
            size: 13,
          })} Edit text</button>`
        );
      }
      if (info.kind === "image") {
        quick.push(
          `<button type="button" class="mini-btn" data-act="replace-image">${icon("upload", {
            size: 13,
          })} Replace</button>`,
          `<button type="button" class="mini-btn" data-act="reset-image">${icon("reset", {
            size: 13,
          })} Reset</button>`
        );
      }
      if (itemHost) {
        quick.push(
          `<button type="button" class="mini-btn" data-act="duplicate">${icon("duplicate", {
            size: 13,
          })} Duplicate</button>`,
          `<button type="button" class="mini-btn is-danger" data-act="delete">${icon("trash", {
            size: 13,
          })} Delete</button>`
        );
      }
    }

    let html = `<div class="panel">
      <div class="node-head">
        <span class="node-head-icon">${icon(KIND_ICON[info.kind] || "layers", { size: 18 })}</span>
        <div class="node-head-text">
          <div class="node-title">${esc(info.label)}</div>
          <div class="node-sub">${esc(info.kind)} · ${esc(info.id)}</div>
        </div>
      </div>
      <div class="breadcrumbs">${breadcrumbs}</div>
      <div class="node-badges">
        ${info.hidden ? '<span class="chip is-warning">Hidden</span>' : ""}
        ${info.locked ? '<span class="chip is-warning">Locked</span>' : ""}
        ${Object.keys(entry).length ? '<span class="chip is-accent">Local overrides</span>' : '<span class="chip">Inherited style</span>'}
        ${styleKey ? `<span class="chip">Style · ${esc(styleKey)}</span>` : ""}
        <span class="chip">${esc(BP_LABEL[this.editor.bpKey] || "Desktop")}</span>
      </div>
      ${quick.length ? `<div class="inline-actions">${quick.join("")}</div>` : ""}
    `;

    if (info.kind === "text" || info.kind === "button" || info.kind === "link") {
      const text = plainText(el.innerHTML);
      html += `<div class="panel-block" data-section="content">
        <div class="panel-block-head"><span class="panel-block-title">Content</span></div>
        <div class="notice">${icon("type", { size: 16 })}<div>${esc(
          text.length > 180 ? `${text.slice(0, 179)}…` : text || "Empty text"
        )}</div></div>
        ${
          canEdit
            ? `<div class="inline-actions">
                <button type="button" class="mini-btn" data-act="edit-text">${icon("pen", {
                  size: 13,
                })} Edit inline</button>
              </div>`
            : ""
        }
      </div>`;
    }

    if (info.kind === "dynamic") {
      const item = (store.state.dynamics || []).find((entry) => `dynamic.${entry.id}` === info.id);
      if (item) {
        html += `<div class="panel-block" data-section="dynamic">
          <div class="panel-block-head"><span class="panel-block-title">Dynamic element</span><span class="field-hint">${esc(
            item.section
          )}</span></div>
          <div class="field"><label class="field-label" for="dynamic-description">Description</label><textarea class="textarea" id="dynamic-description" data-dynamic-field="description">${esc(
            item.description || ""
          )}</textarea></div>
          <div class="field-grid">
            <div class="field"><label class="field-label" for="dynamic-x">X</label><input class="input" id="dynamic-x" type="number" min="0" max="2400" value="${esc(
              item.position?.x ?? 0
            )}" data-dynamic-field="x"></div>
            <div class="field"><label class="field-label" for="dynamic-y">Y</label><input class="input" id="dynamic-y" type="number" min="0" max="4000" value="${esc(
              item.position?.y ?? 0
            )}" data-dynamic-field="y"></div>
            <div class="field"><label class="field-label" for="dynamic-w">Width</label><input class="input" id="dynamic-w" type="number" min="80" max="1600" value="${esc(
              item.size?.width ?? 360
            )}" data-dynamic-field="width"></div>
            <div class="field"><label class="field-label" for="dynamic-h">Height</label><input class="input" id="dynamic-h" type="number" min="40" max="1600" value="${esc(
              item.size?.height ?? 180
            )}" data-dynamic-field="height"></div>
          </div>
          <div class="notice">${icon("info", { size: 16 })}<div>Exported as <code>description</code>, <code>position</code>, <code>size</code> and <code>html</code>. A model or MCP client can fill the HTML without touching the box geometry.</div></div>
          <div class="field"><label class="field-label" for="dynamic-html">Filled HTML <span class="field-hint">optional</span></label><textarea class="textarea" id="dynamic-html" data-dynamic-field="html" placeholder="Leave empty until a model fills it">${esc(
            item.html || ""
          )}</textarea></div>
        </div>`;
      }
    }

    if (isText) {
      html += `<div class="panel-block" data-section="typography">
        <div class="panel-block-head">
          <span class="panel-block-title">Typography</span>
          ${
            canEdit
              ? `<button type="button" class="mini-btn" data-act="edit-shared-style" data-style="${esc(
                  styleKey
                )}">${icon("layers", { size: 12 })} Shared style</button>`
              : ""
          }
        </div>
        <div class="field">
          <label class="field-label" for="style-select">Named style</label>
          <select class="select" id="style-select" data-select-style ${canEdit ? "" : "disabled"}>
            ${STYLE_META.map(
              (s) =>
                `<option value="${s.key}" ${s.key === styleKey ? "selected" : ""}>${esc(s.label)} — ${esc(
                  s.note
                )}</option>`
            ).join("")}
          </select>
          <div class="field-hint">Semantic level stays the same. Style changes only affect appearance.</div>
        </div>
        <div class="field-grid">
          <div class="field">
            <label class="field-label">Family</label>
            <select class="select" data-select-prop="family" ${canEdit ? "" : "disabled"}>
              ${Object.entries(FONT_ROLES).map(
                ([key, f]) =>
                  `<option value="${key}" ${
                    (bpEntry.family || styleDef.family) === key ? "selected" : ""
                  }>${esc(f.label)}</option>`
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label class="field-label">Weight</label>
            <select class="select" data-select-prop="weight" ${canEdit ? "" : "disabled"}>
              ${[300, 400, 500, 600, 700].map(
                (w) =>
                  `<option value="${w}" ${
                    Number(bpEntry.weight || styleDef.weight) === w ? "selected" : ""
                  }>${w}</option>`
              ).join("")}
            </select>
          </div>
        </div>
        <div class="field">
          <div class="field-label"><span>Size scale</span>${
            bpEntry.scale != null ? '<span class="is-override">Local</span>' : ""
          }</div>
          <div class="range-row">
            <input type="range" min="0.6" max="1.8" step="0.01" value="${
              bpEntry.scale ?? 1
            }" data-live-prop="scale" aria-label="Text size scale" ${canEdit ? "" : "disabled"}>
            <span class="range-value">${Math.round((bpEntry.scale ?? 1) * 100)}%</span>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="custom-size">Custom size <span class="field-hint">optional</span></label>
          <input class="input" id="custom-size" data-text-prop="fontSize" value="${esc(
            bpEntry.fontSize || ""
          )}" placeholder="${esc(styleDef.size)}" spellcheck="false" ${canEdit ? "" : "disabled"}>
          <div class="field-hint">A CSS length such as 2.5rem or clamp(2rem, 5cqi, 4rem).</div>
        </div>
        ${rangeField({
          label: "Line height",
          prop: "lineHeight",
          value: bpEntry.lineHeight ?? Number(styleDef.lineHeight || 1.5),
          min: 0.8,
          max: 2.2,
          step: 0.01,
          unit: "",
          inherited: bpEntry.lineHeight == null,
        })}
        ${rangeField({
          label: "Letter spacing",
          prop: "tracking",
          value: bpEntry.tracking ?? Number.parseFloat(styleDef.tracking || "0"),
          min: -0.06,
          max: 0.24,
          step: 0.001,
          unit: "em",
          inherited: bpEntry.tracking == null,
        })}
        <div class="field">
          <div class="field-label"><span>Alignment</span>${
            bpEntry.align ? '<span class="is-override">Local</span>' : ""
          }</div>
          <div class="segmented" role="group" aria-label="Text alignment">
            ${["left", "center", "right"]
              .map(
                (align) =>
                  `<button type="button" data-align="${align}" aria-pressed="${
                    (bpEntry.align || computed.textAlign) === align
                  }" ${canEdit ? "" : "disabled"}>${icon(`align-${align}`, { size: 14 })}</button>`
              )
              .join("")}
          </div>
        </div>
        <div class="field">
          <div class="field-label"><span>Maximum width</span>${
            bpEntry.maxWidth != null ? '<span class="is-override">Local</span>' : ""
          }</div>
          <div class="range-row">
            <input type="range" min="12" max="90" step="1" value="${
              bpEntry.maxWidth ?? 72
            }" data-live-prop="maxWidth" aria-label="Maximum text width" ${canEdit ? "" : "disabled"}>
            <span class="range-value">${bpEntry.maxWidth != null ? `${bpEntry.maxWidth}ch` : "auto"}</span>
          </div>
        </div>
        <div class="inline-actions">
          <button type="button" class="mini-btn" data-toggle-prop="underline" aria-pressed="${
            bpEntry.underline === true
          }" ${canEdit ? "" : "disabled"}>${icon("underline", { size: 13 })} Underline</button>
          <button type="button" class="mini-btn icon-only" data-reset-prop="underline" title="Reset underline" ${
            canEdit ? "" : "disabled"
          }>${icon("reset", { size: 13 })}</button>
        </div>
        ${colorField({
          label: "Text colour",
          prop: "color",
          value: bpEntry.color || "",
          computed: computed.color,
          tokens,
          inherited: !bpEntry.color,
        })}
        ${(() => {
          const ratio = contrastRatio(computed.color, nearestBackground(el));
          if (!ratio) return "";
          const grade = contrastLabel(ratio);
          return `<div class="contrast-row"><span>Contrast on this surface</span><span class="contrast-badge is-${grade.tone}">${ratio.toFixed(
            2
          )}:1 · ${grade.grade}</span></div>`;
        })()}
      </div>`;
    }

    const canAppearance = ["surface", "group", "button", "icon", "link"].includes(info.kind);
    if (canAppearance) {
      html += `<div class="panel-block" data-section="appearance">
        <div class="panel-block-head"><span class="panel-block-title">Appearance</span>${
          bpEntry.background || bpEntry.borderColor || bpEntry.radius != null
            ? '<span class="is-override">Local</span>'
            : ""
        }</div>
        ${colorField({
          label: "Background",
          prop: "background",
          value: bpEntry.background || "",
          computed: computed.backgroundColor,
          tokens,
          inherited: !bpEntry.background,
        })}
        ${colorField({
          label: "Border colour",
          prop: "borderColor",
          value: bpEntry.borderColor || "",
          computed: computed.borderColor,
          tokens,
          inherited: !bpEntry.borderColor,
        })}
        ${rangeField({
          label: "Border width",
          prop: "borderWidth",
          value: bpEntry.borderWidth ?? 0,
          min: 0,
          max: 6,
          step: 1,
          unit: "px",
          inherited: bpEntry.borderWidth == null,
        })}
        ${rangeField({
          label: "Corner radius",
          prop: "radius",
          value: bpEntry.radius ?? 0,
          min: 0,
          max: 72,
          step: 1,
          unit: "px",
          inherited: bpEntry.radius == null,
        })}
        ${rangeField({
          label: "Padding",
          prop: "padding",
          value: bpEntry.padding ?? 0,
          min: 0,
          max: 80,
          step: 1,
          unit: "px",
          inherited: bpEntry.padding == null,
        })}
        ${
          ["surface", "group"].includes(info.kind)
            ? rangeField({
                label: "Gap",
                prop: "gap",
                value: bpEntry.gap ?? 0,
                min: 0,
                max: 60,
                step: 1,
                unit: "px",
                inherited: bpEntry.gap == null,
              })
            : ""
        }
      </div>`;
    }

    if (info.kind === "image") {
      const img = el.querySelector("img");
      const nsImage = store.state.nodeState?.[id]?.image || {};
      const inst = store.state.assets?.instances?.[id];
      const previewSrc =
        img?.getAttribute("src") ||
        inst?.src ||
        `assets/img/brand/signature-${mode}.png`;
      const fit = nsImage.fit || "cover";
      const fx = nsImage.focalX ?? 50;
      const fy = nsImage.focalY ?? 50;
      const radius = nsImage.radius ?? 0;
      const aspect = nsImage.aspect || "auto";
      const alt = nsImage.alt ?? inst?.alt ?? "";
      html += `<div class="panel-block" data-section="image">
        <div class="panel-block-head"><span class="panel-block-title">Image</span><span class="field-hint">${esc(
          img ? "Uploaded or static image" : "Inline signature artwork"
        )}</span></div>
        <div class="image-editor">
          <div class="image-frame" style="aspect-ratio:${aspect === "auto" ? "4 / 3" : esc(aspect)}">
            <img src="${esc(previewSrc)}" alt="">
            <span class="focal-dot" id="focal-dot" style="left:${esc(fx)}%;top:${esc(fy)}%"></span>
            <span class="frame-label">${esc(fit)} · ${esc(fx)}% ${esc(fy)}%</span>
          </div>
          <div class="image-fields">
            <label class="upload-zone" tabindex="0" role="button">
              ${icon("upload", { size: 22 })}
              <span>Replace image</span>
              <span class="field-hint">PNG, JPEG or WebP · up to 2.5 MB</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" data-image-upload ${
                canEdit ? "" : "disabled"
              }>
            </label>
            <div class="field">
              <label class="field-label" for="image-alt">Alternative text</label>
              <input class="input" id="image-alt" data-image-field="alt" value="${esc(alt)}" placeholder="Describe the image" ${
                canEdit ? "" : "disabled"
              }>
            </div>
            <label class="check-row"><input type="checkbox" data-image-field="decorative" ${
              nsImage.decorative ? "checked" : ""
            } ${canEdit ? "" : "disabled"}> Decorative image (no alt text needed)</label>
            <div class="field-grid">
              <div class="field">
                <label class="field-label">Aspect ratio</label>
                <select class="select" data-image-field="aspect" ${canEdit ? "" : "disabled"}>
                  ${["auto", "1 / 1", "4 / 3", "16 / 9", "3 / 2"].map(
                    (a) =>
                      `<option value="${a}" ${a === aspect ? "selected" : ""}>${
                        a === "auto" ? "Natural" : a
                      }</option>`
                  ).join("")}
                </select>
              </div>
              <div class="field">
                <label class="field-label">Fit</label>
                <select class="select" data-image-field="fit" ${canEdit ? "" : "disabled"}>
                  ${["cover", "contain", "fill"].map(
                    (f) => `<option value="${f}" ${f === fit ? "selected" : ""}>${f}</option>`
                  ).join("")}
                </select>
              </div>
            </div>
            ${imageRangeField({
              label: "Focal point X",
              prop: "focalX",
              value: fx,
              min: 0,
              max: 100,
              step: 1,
              unit: "%",
            })}
            ${imageRangeField({
              label: "Focal point Y",
              prop: "focalY",
              value: fy,
              min: 0,
              max: 100,
              step: 1,
              unit: "%",
            })}
            ${imageRangeField({
              label: "Image radius",
              prop: "radius",
              value: radius,
              min: 0,
              max: 120,
              step: 1,
              unit: "px",
            })}
            <div class="inline-actions">
              <button type="button" class="mini-btn" data-act="open-assets">${icon("image", {
                size: 13,
              })} Asset library</button>
              <button type="button" class="mini-btn is-danger" data-act="reset-image">${icon("reset", {
                size: 13,
              })} Use original</button>
            </div>
            ${
              this._uploadError
                ? `<div class="upload-error" role="alert">${esc(this._uploadError)}</div>`
                : ""
            }
          </div>
        </div>
      </div>`;
    }

    if (info.kind === "icon") {
      const current = store.state.nodeState?.[id]?.icon || "sparkles";
      html += `<div class="panel-block" data-section="icon">
        <div class="panel-block-head"><span class="panel-block-title">Icon</span><span class="field-hint">One stroke library</span></div>
        <div class="icon-grid">
          ${ICON_NAMES.map(
              (name) =>
                `<button type="button" class="icon-choice" data-icon-choice="${name}" aria-pressed="${
                  name === current
                }" title="${name}" aria-label="${name}" ${canEdit ? "" : "disabled"}>${icon(name, {
                  size: 17,
                })}</button>`
            ).join("")}
        </div>
      </div>`;
    }

    if (["button", "link"].includes(info.kind)) {
      const link = store.state.nodeState?.[id]?.link || {};
      const href = sanitizeUrl(link.href ?? (el.getAttribute("href") || ""));
      const type = href.startsWith("#")
        ? "internal"
        : href.startsWith("mailto:")
        ? "email"
        : href
        ? "external"
        : "none";
      const newTab = link.newTab === true;
      html += `<div class="panel-block" data-section="link">
        <div class="panel-block-head"><span class="panel-block-title">Link</span><span class="field-hint">First click selects; use Open to test</span></div>
        ${
          info.action
            ? `<div class="notice">${icon("info", {
                size: 16,
              })}<div>This button runs the editor action “${esc(info.action)}”. Its destination is fixed.</div></div>`
            : `<div class="field">
                <label class="field-label" for="link-type">Destination type</label>
                <select class="select" id="link-type" data-link-field="type" ${canEdit ? "" : "disabled"}>
                  <option value="none" ${type === "none" ? "selected" : ""}>No link</option>
                  <option value="internal" ${type === "internal" ? "selected" : ""}>Internal section</option>
                  <option value="external" ${type === "external" ? "selected" : ""}>External URL</option>
                  <option value="email" ${type === "email" ? "selected" : ""}>Email address</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label" for="link-internal">Internal destination</label>
                <select class="select" id="link-internal" data-link-field="internal" ${canEdit ? "" : "disabled"}>
                  ${["#top", "#features", "#how", "#install", "#identity", "#try"].map(
                    (anchor) =>
                      `<option value="${anchor}" ${
                        href === anchor ? "selected" : ""
                      }>${anchor}</option>`
                  ).join("")}
                </select>
              </div>
              <div class="field">
                <label class="field-label" for="link-url">External URL</label>
                <input class="input" id="link-url" data-link-field="url" value="${esc(
                  href && !href.startsWith("#") && !href.startsWith("mailto:") ? href : ""
                )}" placeholder="https://example.com" ${canEdit ? "" : "disabled"}>
              </div>
              <div class="field">
                <label class="field-label" for="link-email">Email</label>
                <input class="input" id="link-email" data-link-field="email" value="${esc(
                  href.startsWith("mailto:") ? href.slice(7) : ""
                )}" placeholder="hello@example.com" ${canEdit ? "" : "disabled"}>
              </div>
              <div class="field">
                <label class="field-label" for="link-aria">Accessible label <span class="field-hint">optional</span></label>
                <input class="input" id="link-aria" data-link-field="aria" value="${esc(
                  link.ariaLabel || ""
                )}" placeholder="Describe the destination if the label is ambiguous" ${
                  canEdit ? "" : "disabled"
                }>
              </div>
              <label class="check-row"><input type="checkbox" data-link-field="newTab" ${
                newTab ? "checked" : ""
              } ${canEdit ? "" : "disabled"}> Open in a new tab</label>
              <div class="inline-actions">
                <button type="button" class="mini-btn" data-act="save-link">${icon("check", {
                  size: 13,
                })} Save link</button>
                <button type="button" class="mini-btn" data-act="open-link">${icon("external", {
                  size: 13,
                })} Open link</button>
                <button type="button" class="mini-btn is-danger" data-act="remove-link">${icon("trash", {
                  size: 13,
                })} Remove</button>
              </div>`
        }
      </div>`;
    }

    const bpCounts = ["base", "tablet", "mobile"].map((bp) => ({
      bp,
      count: Object.keys(entry[bp] || {}).length,
    }));
    html += `<div class="panel-block" data-section="responsive">
      <div class="panel-block-head"><span class="panel-block-title">Responsive</span><span class="chip">${esc(
        BP_LABEL[this.editor.bpKey]
      )} edits</span></div>
      <div class="segmented is-wide" role="group" aria-label="Edit breakpoint">
        ${["base", "tablet", "mobile"]
          .map(
            (bp) =>
              `<button type="button" data-bp-inspector="${bp}" aria-pressed="${
                this.editor.bpKey === bp
              }">${BP_LABEL[bp]}${
                bpCounts.find((x) => x.bp === bp)?.count
                  ? ` · ${bpCounts.find((x) => x.bp === bp).count}`
                  : ""
              }</button>`
          )
          .join("")}
      </div>
      <div class="field-hint">Base styles apply everywhere. Tablet and mobile overrides are explicit and independently resettable.</div>
      <div class="inline-actions">
        <button type="button" class="mini-btn" data-act="reset-bp">${icon("reset", {
          size: 13,
        })} Reset ${esc(BP_LABEL[this.editor.bpKey])}</button>
        <button type="button" class="mini-btn is-danger" data-act="clear-overrides">${icon("trash", {
          size: 13,
        })} Remove all local overrides</button>
      </div>
    </div>`;

    html += this.navigatorHtml();

    html += `<div class="panel-block" data-section="actions">
      <div class="panel-block-head"><span class="panel-block-title">Actions</span></div>
      <div class="inline-actions">
        <button type="button" class="mini-btn" data-act="copy-style">${icon("copy", {
          size: 13,
        })} Copy style</button>
        <button type="button" class="mini-btn" data-act="paste-style" ${
          this.editor._styleClipboard ? "" : "disabled"
        }>${icon("layers", { size: 13 })} Paste style</button>
        ${itemHost ? `<button type="button" class="mini-btn" data-act="move-up">${icon("chevron-up", { size: 13 })} Move up</button>
        <button type="button" class="mini-btn" data-act="move-down">${icon("chevron-down", { size: 13 })} Move down</button>` : ""}
      </div>
    </div>`;

    html += `</div>`;
    return html;
  }

  navigatorHtml() {
    const groups = [];
    const nodes = $$("#site [data-node-id][data-node-label]");
    const used = new Set();
    for (const el of nodes) {
      const id = el.dataset.nodeId;
      if (used.has(id)) continue;
      used.add(id);
      let groupEl = el.closest("section[data-node-id]");
      let groupLabel = groupEl?.dataset.nodeLabel || "";
      let groupId = groupEl?.dataset.nodeId || "";
      if (el.closest("#site-header")) {
        groupEl = null;
        groupLabel = "Header";
        groupId = "header.brand";
      } else if (el.closest("#site-footer")) {
        groupEl = null;
        groupLabel = "Footer";
        groupId = "footer.wordmark";
      }
      let group = groups.find((g) => g.id === groupId && g.label === groupLabel);
      if (!group) {
        group = { id: groupId, label: groupLabel, nodes: [] };
        groups.push(group);
      }
      let depth = 0;
      let p = el.parentElement;
      while (p && p !== groupEl && p.id !== "site") {
        if (p.dataset?.nodeId) depth++;
        p = p.parentElement;
      }
      if (el === groupEl) depth = 0;
      const hidden = el.getAttribute("data-hidden") === "true";
      const locked = el.getAttribute("data-locked") === "true";
      group.nodes.push({
        id,
        label: el.dataset.nodeLabel,
        kind: el.dataset.nodeKind,
        depth: Math.min(depth, 5),
        hidden,
        locked,
      });
    }
    const total = groups.reduce((n, g) => n + g.nodes.length, 0);
    return `<details class="panel-block" data-section="outline" ${this.editor.selectedId ? "" : "open"}>
      <summary class="panel-block-head" style="cursor:pointer;list-style:none">
        <span class="panel-block-title">Outline</span>
        <span class="field-hint">${total} elements</span>
      </summary>
      <div class="asset-search-row">
        <input class="input" data-nav-search placeholder="Filter the outline" aria-label="Filter the outline">
      </div>
      <div class="navigator" data-nav-list>
        ${groups
          .map(
            (g) => `<div class="nav-tree-group">${esc(g.label || "Page")}</div>
              ${g.nodes
                .map(
                  (n) =>
                    `<button type="button" class="nav-tree-item ${
                      n.id === this.editor.selectedId ? "is-selected" : ""
                    }" data-nav-id="${esc(n.id)}" data-nav-text="${esc(
                      `${n.label} ${n.id} ${n.kind}`
                    ).toLowerCase()}">
                      <span class="nav-depth" style="--depth:${n.depth}">
                        ${icon(KIND_ICON[n.kind] || "layers", { size: 12 })}
                        <span class="nav-label">${esc(n.label)}</span>
                      </span>
                      <span class="nav-kind">${esc(n.kind)}</span>
                      ${n.hidden ? `<span class="nav-flag">${icon("eye-off", { size: 11 })}</span>` : ""}
                      ${n.locked ? `<span class="nav-flag">${icon("lock", { size: 11 })}</span>` : ""}
                    </button>`
                )
                .join("")}`
          )
          .join("")}
      </div>
    </details>`;
  }

  /* ================================================================ THEME */
  renderTheme() {
    const theme = store.state.theme;
    const mode = store.mode;
    const tokens = theme.tokens[mode];
    const canEdit = store.can("shared");
    const usageCount = (styleKey) =>
      $$("#site [data-node-id]").filter((el) => {
        const entry = store.state.styles?.[el.dataset.nodeId] || {};
        const key =
          entry.style ||
          Array.from(el.classList)
            .find((c) => c.startsWith("ts-"))
            ?.slice(3);
        return key === styleKey;
      }).length;

    return `<div class="panel">
      <div class="panel-block">
        <div class="panel-block-head">
          <span class="panel-block-title">Theme</span>
        </div>
        <div class="segmented is-wide" role="group" aria-label="Theme mode">
          <button type="button" data-theme-mode="dark" aria-pressed="${
            mode === "dark"
          }">${icon("moon", { size: 13 })} Dark variant</button>
          <button type="button" data-theme-mode="light" aria-pressed="${
            mode === "light"
          }">${icon("sun", { size: 13 })} Light variant</button>
        </div>
        <div class="scope-banner">${icon("info", {
          size: 15,
        })}<div>Theme tokens and named styles affect the whole site. Changes preview in the draft and can be undone.</div></div>
        <div class="inline-actions">
          <button type="button" class="mini-btn" data-act="reset-theme" ${
            canEdit ? "" : "disabled"
          }>${icon("reset", { size: 13 })} Restore original</button>
        </div>
      </div>

      <div class="panel-block" data-section="texture">
        <div class="panel-block-head">
          <span class="panel-block-title">Page background</span>
          <span class="field-hint">local SVG</span>
        </div>
        <div class="texture-grid">
          ${TEXTURE_META.map(
            (texture) => `<button type="button" class="texture-choice" data-act="set-texture" data-texture="${esc(
              texture.key
            )}" aria-pressed="${(theme.texture || "uroko") === texture.key}" ${
              canEdit ? "" : "disabled"
            } title="${esc(texture.note)}"><span class="texture-swatch" data-texture-key="${esc(
              texture.key
            )}"></span><span>${esc(texture.label)}</span></button>`
          ).join("")}
        </div>
        <div class="field-hint">Drawn once behind the whole page from a bundled texture SVG.</div>
      </div>

      <div class="panel-block">
        <div class="panel-block-head">
          <span class="panel-block-title">Colour tokens · ${esc(mode)}</span>
          <button type="button" class="mini-btn icon-only" data-act="generate-theme" ${
            canEdit ? "" : "disabled"
          } title="Generate a new accessible palette" aria-label="Generate a new accessible palette">${icon(
            "swap",
            { size: 16 }
          )}</button>
        </div>
        <div class="token-list">
          ${TOKEN_META.map((token) => {
            const value = tokens[token.key] || "#000000";
            return `<div class="token-item">
              <label class="token-color" style="background:${esc(value)}">
                <input type="color" value="${esc(toHex(value))}" data-theme-token="${token.key}" aria-label="${esc(
                  token.label
                )} colour" ${canEdit ? "" : "disabled"}>
              </label>
              <span class="token-name" title="${esc(token.role)}">${esc(token.label)}</span>
              <input class="input token-hex" value="${esc(value)}" data-theme-token-hex="${token.key}" spellcheck="false" aria-label="${esc(
                token.label
              )} hex" ${canEdit ? "" : "disabled"}>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div class="panel-block">
        <div class="panel-block-head"><span class="panel-block-title">Named text styles</span></div>
        ${STYLE_META.map((style) => {
          const def = theme.styles[style.key] || DEFAULT_STYLES[style.key];
          const count = usageCount(style.key);
          return `<details class="style-editor" data-style-details="${style.key}">
            <summary>${esc(style.label)}<span class="style-note">${esc(style.note)}</span><span class="usage-badge">${count} use${
            count === 1 ? "" : "s"
          }</span></summary>
            <div class="style-body">
              <div class="field-grid">
                <div class="field">
                  <label class="field-label">Family</label>
                  <select class="select" data-theme-style="${style.key}" data-theme-prop="family" ${
            canEdit ? "" : "disabled"
          }>
                    ${Object.entries(FONT_ROLES).map(
                      ([k, f]) =>
                        `<option value="${k}" ${
                          def.family === k ? "selected" : ""
                        }>${esc(f.label)}</option>`
                    ).join("")}
                  </select>
                </div>
                <div class="field">
                  <label class="field-label">Weight</label>
                  <select class="select" data-theme-style="${style.key}" data-theme-prop="weight" ${
            canEdit ? "" : "disabled"
          }>
                    ${[300, 400, 500, 600, 700].map(
                      (w) =>
                        `<option value="${w}" ${
                          Number(def.weight) === w ? "selected" : ""
                        }>${w}</option>`
                    ).join("")}
                  </select>
                </div>
              </div>
              <div class="field">
                <label class="field-label">Size</label>
                <input class="input" data-theme-style="${style.key}" data-theme-prop="size" value="${esc(
            def.size
          )}" spellcheck="false" ${canEdit ? "" : "disabled"}>
              </div>
              <div class="field-grid">
                <div class="field">
                  <label class="field-label">Line height</label>
                  <input class="input" type="number" step="0.01" min="0.8" max="3" data-theme-style="${style.key}" data-theme-prop="lineHeight" value="${esc(
            def.lineHeight
          )}" ${canEdit ? "" : "disabled"}>
                </div>
                <div class="field">
                  <label class="field-label">Tracking</label>
                  <input class="input" data-theme-style="${style.key}" data-theme-prop="tracking" value="${esc(
            def.tracking
          )}" spellcheck="false" ${canEdit ? "" : "disabled"}>
                </div>
              </div>
              <div class="field">
                <label class="field-label">Text transform</label>
                <select class="select" data-theme-style="${style.key}" data-theme-prop="transform" ${
            canEdit ? "" : "disabled"
          }>
                  ${["none", "uppercase", "lowercase"].map(
                    (t) =>
                      `<option value="${t}" ${
                        (def.transform || "none") === t ? "selected" : ""
                      }>${t}</option>`
                  ).join("")}
                </select>
              </div>
              <div class="inline-actions">
                <button type="button" class="mini-btn" data-theme-style-reset="${style.key}" ${
            canEdit ? "" : "disabled"
          }>${icon("reset", { size: 12 })} Reset style</button>
              </div>
            </div>
          </details>`;
        }).join("")}
      </div>

      <div class="panel-block">
        <div class="panel-block-head"><span class="panel-block-title">Shape & type system</span></div>
        ${rangeField({
          label: "Small radius",
          prop: "theme-radius-sm",
          value: theme.radius.sm,
          min: 0,
          max: 24,
          step: 1,
          unit: "px",
          inherited: false,
        }).replace("data-live-prop", "data-theme-radius=\"sm\" data-ignore")}
        ${rangeField({
          label: "Medium radius",
          prop: "theme-radius-md",
          value: theme.radius.md,
          min: 0,
          max: 40,
          step: 1,
          unit: "px",
          inherited: false,
        }).replace("data-live-prop", "data-theme-radius=\"md\" data-ignore")}
        ${rangeField({
          label: "Large radius",
          prop: "theme-radius-lg",
          value: theme.radius.lg,
          min: 0,
          max: 64,
          step: 1,
          unit: "px",
          inherited: false,
        }).replace("data-live-prop", "data-theme-radius=\"lg\" data-ignore")}
        ${rangeField({
          label: "Border width",
          prop: "theme-border",
          value: theme.borderWidth ?? 1,
          min: 0,
          max: 4,
          step: 1,
          unit: "px",
          inherited: false,
        }).replace("data-live-prop", "data-theme-border data-ignore")}
        ${Object.entries(FONT_ROLES)
          .map(
            ([role, meta]) => `<div class="field">
              <label class="field-label">${esc(meta.label)} family</label>
              <select class="select" data-theme-type="${role}" ${canEdit ? "" : "disabled"}>
                ${Object.entries(FONT_ROLES)
                  .map(
                    ([key, f]) =>
                      `<option value="${key}" ${
                        theme.type[role] === f.stack ? "selected" : ""
                      }>${esc(f.label)}</option>`
                  )
                  .join("")}
              </select>
            </div>`
          )
          .join("")}
        <div class="field">
          <label class="field-label">Background treatment</label>
          <select class="select" data-theme-background ${canEdit ? "" : "disabled"}>
            <option value="none" ${theme.background === "none" ? "selected" : ""}>None</option>
            <option value="grid" ${theme.background === "grid" ? "selected" : ""}>Fine grid</option>
          </select>
        </div>
      </div>
    </div>`;
  }

  /* ================================================================ ASSETS */
  renderAssets() {
    const mode = store.mode;
    const uploads = Object.values(store.state.assets?.uploads || {});
    const selected = this.editor.nodeInfo();
    const canUseOnSelected = selected?.kind === "image";
    const usedUpload = (upload) =>
      Object.values(store.state.assets?.instances || {}).filter((inst) => inst.src === upload.src)
        .length;
    return `<div class="panel">
      <div class="panel-block">
        <div class="panel-block-head"><span class="panel-block-title">Asset library</span><span class="field-hint">${ASSET_LIBRARY.length} shipped</span></div>
        <div class="asset-search-row">
          <input class="input" data-asset-search placeholder="Search assets" aria-label="Search assets">
        </div>
        ${ASSET_GROUPS.map((group) => {
          const assets = ASSET_LIBRARY.filter((a) => a.group === group.id);
          if (!assets.length) return "";
          return `<div class="asset-group-title">${esc(group.label)}</div>
            <div class="asset-grid">
              ${assets
                .map(
                  (asset) => `<button type="button" class="asset-card" data-asset-id="${esc(
                    asset.id
                  )}" data-asset-text="${esc(`${asset.name} ${asset.description} ${asset.type}`).toLowerCase()}">
                    <img src="${esc(assetPreview(asset, mode))}" alt="" loading="lazy">
                    <span class="asset-name">${esc(asset.name)}</span>
                    <span class="asset-meta"><span>${esc(asset.type.split("·")[0].trim())}</span><span>${esc(
                    asset.dims
                  )}</span></span>
                    <span class="asset-usage">${esc(
                      asset.replaceable
                        ? `${asset.targets?.length || 0} linked uses`
                        : asset.usage?.[0] || "Library"
                    )}</span>
                  </button>`
                )
                .join("")}
            </div>`;
        }).join("")}
      </div>

      <div class="panel-block">
        <div class="panel-block-head"><span class="panel-block-title">Uploads</span><span class="field-hint">${uploads.length} file${
      uploads.length === 1 ? "" : "s"
    }</span></div>
        ${
          uploads.length
            ? `<div class="revision-list">
                ${uploads
                  .map(
                    (u) => `<div class="revision-item">
                      <div class="revision-top">
                        <span class="revision-label">${esc(u.name)}</span>
                        <span class="revision-meta">${formatBytes(u.size || 0)}</span>
                      </div>
                      <div class="revision-meta">Used ${usedUpload(u)} time${usedUpload(u) === 1 ? "" : "s"} · ${
                      u.width || "?"
                    }×${u.height || "?"}</div>
                      <div class="revision-actions">
                        <button type="button" class="mini-btn" data-upload-use="${esc(
                          u.id
                        )}" ${canUseOnSelected ? "" : "disabled"} title="${
                      canUseOnSelected ? `Apply to ${esc(selected.label)}` : "Select an image element first"
                    }">${icon("image", { size: 12 })} Use on selected image</button>
                        <button type="button" class="mini-btn" data-upload-delete="${esc(
                          u.id
                        )}">${icon("trash", {
                      size: 12,
                    })} Delete</button>
                      </div>
                    </div>`
                  )
                  .join("")}
              </div>`
            : `<div class="history-empty">Images you upload are stored in this browser’s draft. They appear here so you can reuse or remove them.</div>`
        }
      </div>
      <div class="panel-block">
        <div class="notice">${icon("info", {
          size: 16,
        })}<div>Replacing a linked asset changes every use, or only one instance. Deleting a referenced asset first shows where it is used.</div></div>
      </div>
    </div>`;
  }

  /* ================================================================ events */
  onClick(event) {
    const navBtn = event.target.closest("[data-nav-id]");
    if (navBtn) {
      this.editor.selectNode(navBtn.dataset.navId, { force: true, scroll: true });
      return;
    }
    const crumb = event.target.closest("[data-crumb-inspector]");
    if (crumb) {
      this.editor.selectNode(crumb.dataset.crumbInspector, {
        force: true,
        scroll: true,
      });
      return;
    }
    const assetBtn = event.target.closest("[data-asset-id]");
    if (assetBtn) {
      this.openAssetDialog(assetBtn.dataset.assetId);
      return;
    }
    const iconBtn = event.target.closest("[data-icon-choice]");
    if (iconBtn) {
      if (!store.can("edit")) return;
      store.setIcon(this.editor.selectedId, iconBtn.dataset.iconChoice);
      toast("Icon updated.", { iconName: "sparkles" });
      return;
    }
    const swatch = event.target.closest("[data-swatch-prop]");
    if (swatch) {
      if (!store.can("edit")) return;
      this.quickApply("Colour linked to token", (state) => {
        const id = this.editor.selectedId;
        state.styles[id] = state.styles[id] || {};
        state.styles[id][this.editor.bpKey] = state.styles[id][this.editor.bpKey] || {};
        state.styles[id][this.editor.bpKey][swatch.dataset.swatchProp] = `var(--${swatch.dataset.swatchToken
          .replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`;
      });
      return;
    }
    const resetProp = event.target.closest("[data-reset-prop]");
    if (resetProp) {
      store.clearStyleProp(this.editor.selectedId, this.editor.bpKey, resetProp.dataset.resetProp);
      return;
    }
    const bpBtn = event.target.closest("[data-bp-inspector]");
    if (bpBtn) {
      const bp = bpBtn.dataset.bpInspector;
      this.editor.setBreakpoint(bp === "base" ? "desktop" : bp);
      return;
    }
    const align = event.target.closest("[data-align]");
    if (align) {
      this.quickApply("Alignment changed", (state) => {
        const id = this.editor.selectedId;
        state.styles[id] = state.styles[id] || {};
        state.styles[id][this.editor.bpKey] = state.styles[id][this.editor.bpKey] || {};
        state.styles[id][this.editor.bpKey].align = align.dataset.align;
      });
      return;
    }
    const toggle = event.target.closest("[data-toggle-prop]");
    if (toggle) {
      const prop = toggle.dataset.toggleProp;
      const current = store.state.styles?.[this.editor.selectedId]?.[this.editor.bpKey]?.[prop];
      this.quickApply("Text decoration changed", (state) => {
        const id = this.editor.selectedId;
        state.styles[id] = state.styles[id] || {};
        state.styles[id][this.editor.bpKey] = state.styles[id][this.editor.bpKey] || {};
        if (prop === "underline") {
          if (current) delete state.styles[id][this.editor.bpKey][prop];
          else state.styles[id][this.editor.bpKey][prop] = true;
        }
      });
      return;
    }
    const themeMode = event.target.closest("[data-theme-mode]");
    if (themeMode) {
      store.setMode(themeMode.dataset.themeMode);
      return;
    }
    const styleReset = event.target.closest("[data-theme-style-reset]");
    if (styleReset) {
      const key = styleReset.dataset.themeStyleReset;
      this.quickApply("Shared style reset", (state) => {
        state.theme.styles[key] = clone(DEFAULT_STYLES[key]);
      });
      toast(`${key} style reset to the original.`, { iconName: "reset" });
      return;
    }
    const uploadUse = event.target.closest("[data-upload-use]");
    if (uploadUse) {
      const upload = store.state.assets?.uploads?.[uploadUse.dataset.uploadUse];
      const selected = this.editor.nodeInfo();
      if (!upload || selected?.kind !== "image") {
        toast("Select an image element first.", { iconName: "image" });
        return;
      }
      const ok = store.replaceAssetTarget(selected.id, upload, "Upload applied");
      if (ok) toast(`Applied ${upload.name} to ${selected.label}.`, { iconName: "image" });
      return;
    }
    const uploadDelete = event.target.closest("[data-upload-delete]");
    if (uploadDelete) {
      this.deleteUpload(uploadDelete.dataset.uploadDelete);
      return;
    }
    const act = event.target.closest("[data-act]");
    if (!act) return;
    const action = act.dataset.act;
    switch (action) {
      case "edit-text":
        this.editor.enterTextEdit(this.editor.selectedId);
        break;
      case "replace-image":
        this.editor.openImageDialog(this.editor.selectedId, "replace");
        break;
      case "reset-image":
        this.resetImage();
        break;
      case "duplicate":
        this.editor.duplicateSelected();
        break;
      case "delete":
        this.editor.deleteSelected();
        break;
      case "open-assets":
        this.setTab("assets");
        this.editor.setInspector(true);
        break;
      case "open-outline":
        this.scrollTo("outline");
        break;
      case "copy-style":
        this.editor.copyStyle();
        break;
      case "paste-style":
        this.editor.pasteStyle();
        break;
      case "move-up":
      case "move-down": {
        const info = this.editor.nodeInfo();
        const host = info && this.editor.findItemHost(info.el);
        if (host) {
          store.moveItem(host.section, host.item, action === "move-up" ? -1 : 1);
          requestAnimationFrame(() => this.editor.selectNode(this.editor.selectedId, { force: true }));
        }
        break;
      }
      case "reset-bp": {
        const id = this.editor.selectedId;
        const entry = store.state.styles?.[id];
        if (entry?.[this.editor.bpKey]) {
          quickApplyDirect("Breakpoint overrides reset", (state) => {
            delete state.styles[id][this.editor.bpKey];
            if (!Object.keys(state.styles[id]).length) delete state.styles[id];
          });
        }
        break;
      }
      case "clear-overrides":
        this.editor.resetOverrides();
        break;
      case "save-link":
        this.saveLink();
        break;
      case "remove-link":
        this.saveLink(true);
        break;
      case "open-link": {
        const info = this.editor.nodeInfo();
        const href = info?.el.getAttribute("href");
        if (href && sanitizeUrl(href)) window.open(href, "_blank", "noopener,noreferrer");
        break;
      }
      case "set-texture":
        if (store.can("shared")) {
          store.updateTheme({ texture: act.dataset.texture }, "Texture changed");
          this.render();
        }
        break;
      case "generate-theme":
        this.generateTheme();
        break;
      case "reset-theme":
        this.restoreTheme();
        break;
      case "undo":
        store.undo();
        break;
      case "redo":
        store.redo();
        break;
      default:
        break;
    }
  }

  onInput(event) {
    const live = event.target.closest("[data-live-prop]");
    if (live) {
      const prop = live.dataset.liveProp;
      const value = live.type === "range" ? Number(live.value) : live.value;
      this.liveStyle(prop, value);
      const row = live.closest(".range-row");
      const readout = row?.querySelector(".range-value");
      if (readout) {
        const unit =
          prop === "maxWidth"
            ? "ch"
            : ["scale", "lineHeight"].includes(prop)
            ? ""
            : prop === "tracking"
            ? "em"
            : "px";
        readout.textContent =
          prop === "scale" ? `${Math.round(Number(value) * 100)}%` : `${value}${unit}`;
      }
      return;
    }
    const color = event.target.closest("[data-color-prop]");
    if (color) {
      this.liveStyleColor(color.dataset.colorProp, color.value);
      const hex = this.el.querySelector(`[data-color-hex="${color.dataset.colorProp}"]`);
      if (hex) hex.value = color.value;
      return;
    }
    const token = event.target.closest("[data-theme-token]");
    if (token) {
      this.liveThemeToken(token.dataset.themeToken, token.value);
      const hex = this.el.querySelector(`[data-theme-token-hex="${token.dataset.themeToken}"]`);
      if (hex) hex.value = token.value;
      return;
    }
    const radius = event.target.closest("[data-theme-radius]");
    if (radius) {
      this.liveTheme((state) => {
        state.theme.radius[radius.dataset.themeRadius] = Number(radius.value);
      });
      radius.closest(".range-row")?.querySelector(".range-value") &&
        (radius.closest(".range-row").querySelector(".range-value").textContent = `${radius.value}px`);
      return;
    }
    const border = event.target.closest("[data-theme-border]");
    if (border) {
      this.liveTheme((state) => {
        state.theme.borderWidth = Number(border.value);
      });
      border.closest(".range-row")?.querySelector(".range-value") &&
        (border.closest(".range-row").querySelector(".range-value").textContent = `${border.value}px`);
      return;
    }
    const image = event.target.closest("[data-image-prop]");
    if (image) {
      this.liveImage(image.dataset.imageProp, Number(image.value));
      const row = image.closest(".range-row");
      const readout = row?.querySelector(".range-value");
      if (readout) {
        const unit = ["focalX", "focalY"].includes(image.dataset.imageProp) ? "%" : "px";
        readout.textContent = `${image.value}${unit}`;
      }
      const dot = this.el.querySelector("#focal-dot");
      if (dot) {
        const x = store.state.nodeState?.[this.editor.selectedId]?.image?.focalX ?? 50;
        const y = store.state.nodeState?.[this.editor.selectedId]?.image?.focalY ?? 50;
        dot.style.left = `${x}%`;
        dot.style.top = `${y}%`;
      }
      return;
    }
    const navSearch = event.target.closest("[data-nav-search]");
    if (navSearch) {
      this._navQuery = navSearch.value.trim().toLowerCase();
      this.el.querySelectorAll("[data-nav-id]").forEach((btn) => {
        btn.style.display = !this._navQuery || btn.dataset.navText.includes(this._navQuery) ? "" : "none";
      });
      return;
    }
    const assetSearch = event.target.closest("[data-asset-search]");
    if (assetSearch) {
      const q = assetSearch.value.trim().toLowerCase();
      this.el.querySelectorAll("[data-asset-id]").forEach((btn) => {
        btn.style.display = !q || btn.dataset.assetText.includes(q) ? "" : "none";
      });
    }
  }

  onChange(event) {
    const dynamicField = event.target.closest("[data-dynamic-field]");
    if (dynamicField) {
      const field = dynamicField.dataset.dynamicField;
      store.updateDynamic(this.editor.selectedId, { [field]: dynamicField.value });
      return;
    }
    const live = event.target.closest("[data-live-prop]");
    if (live || event.target.closest("[data-color-prop]") || event.target.closest("[data-theme-token]") || event.target.closest("[data-theme-radius]") || event.target.closest("[data-theme-border]")) {
      this.commitLive();
      return;
    }
    const imageRange = event.target.closest("[data-image-prop]");
    if (imageRange) {
      this.commitLive();
      return;
    }
    const colorHex = event.target.closest("[data-color-hex]");
    if (colorHex) {
      const prop = colorHex.dataset.colorHex;
      const value = colorHex.value.trim();
      if (!value) {
        store.clearStyleProp(this.editor.selectedId, this.editor.bpKey, prop);
      } else if (!isValidColor(value)) {
        toast("Use a hex value, rgb() or a theme token like var(--accent).", {
          tone: "destructive",
          iconName: "warning",
        });
      } else {
        quickApplyDirect("Colour changed", (state) => {
          const id = this.editor.selectedId;
          state.styles[id] = state.styles[id] || {};
          state.styles[id][this.editor.bpKey] = state.styles[id][this.editor.bpKey] || {};
          state.styles[id][this.editor.bpKey][prop] = value;
        });
      }
      return;
    }
    const tokenHex = event.target.closest("[data-theme-token-hex]");
    if (tokenHex) {
      const key = tokenHex.dataset.themeTokenHex;
      const value = tokenHex.value.trim();
      if (!isValidColor(value) || value.startsWith("var(")) {
        toast("Enter a hex, rgb() or hsl() colour for theme tokens.", {
          tone: "destructive",
          iconName: "warning",
        });
        return;
      }
      quickApplyDirect("Theme token updated", (state) => {
        state.theme.tokens[store.mode][key] = value;
      });
      return;
    }
    const selectProp = event.target.closest("[data-select-prop]");
    if (selectProp) {
      const prop = selectProp.dataset.selectProp;
      let value = selectProp.value;
      if (prop === "weight") value = Number(value);
      quickApplyDirect("Typography changed", (state) => {
        const id = this.editor.selectedId;
        state.styles[id] = state.styles[id] || {};
        state.styles[id][this.editor.bpKey] = state.styles[id][this.editor.bpKey] || {};
        state.styles[id][this.editor.bpKey][prop] = value;
      });
      return;
    }
    const styleSelect = event.target.closest("[data-select-style]");
    if (styleSelect) {
      store.setStyleName(this.editor.selectedId, styleSelect.value);
      return;
    }
    const textProp = event.target.closest("[data-text-prop]");
    if (textProp) {
      const prop = textProp.dataset.textProp;
      const value = textProp.value.trim();
      if (prop === "fontSize" && value && !cssLength(value)) {
        toast("Enter a valid CSS length, or leave the field empty to inherit.", {
          tone: "destructive",
          iconName: "warning",
        });
        return;
      }
      quickApplyDirect("Typography changed", (state) => {
        const id = this.editor.selectedId;
        state.styles[id] = state.styles[id] || {};
        state.styles[id][this.editor.bpKey] = state.styles[id][this.editor.bpKey] || {};
        if (value) state.styles[id][this.editor.bpKey][prop] = value;
        else delete state.styles[id][this.editor.bpKey][prop];
      });
      return;
    }
    const imageField = event.target.closest("[data-image-field]");
    if (imageField) {
      const field = imageField.dataset.imageField;
      let value = imageField.type === "checkbox" ? imageField.checked : imageField.value;
      if (field === "alt") value = value;
      if (field === "decorative" && value) {
        store.setImage(this.editor.selectedId, { decorative: true });
      } else {
        store.setImage(this.editor.selectedId, { [field]: value });
      }
      return;
    }
    const themeStyle = event.target.closest("[data-theme-style]");
    if (themeStyle) {
      const key = themeStyle.dataset.themeStyle;
      const prop = themeStyle.dataset.themeProp;
      let value = themeStyle.value;
      if (["weight", "lineHeight"].includes(prop)) value = Number(value);
      quickApplyDirect("Shared style updated", (state) => {
        state.theme.styles[key] = state.theme.styles[key] || clone(DEFAULT_STYLES[key]);
        state.theme.styles[key][prop] = value;
      });
      return;
    }
    const typeSelect = event.target.closest("[data-theme-type]");
    if (typeSelect) {
      const role = typeSelect.dataset.themeType;
      const chosen = FONT_ROLES[typeSelect.value];
      if (chosen) {
        quickApplyDirect("Type family updated", (state) => {
          state.theme.type[role] = chosen.stack;
        });
      }
      return;
    }
    const background = event.target.closest("[data-theme-background]");
    if (background) {
      quickApplyDirect("Background treatment updated", (state) => {
        state.theme.background = background.value;
      });
      return;
    }
    const imageUpload = event.target.closest("[data-image-upload]");
    if (imageUpload?.files?.[0]) {
      this.replaceImage(imageUpload.files[0]);
      imageUpload.value = "";
    }
  }

  onKeydown(event) {
    const upload = event.target.closest(".upload-zone");
    if (upload && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      upload.querySelector('input[type="file"]')?.click();
      return;
    }
    if (event.target.closest("[data-nav-list]") && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(this.el.querySelectorAll("[data-nav-id]")).filter(
        (el) => el.offsetParent !== null
      );
      const idx = items.indexOf(document.activeElement);
      let next = idx;
      if (event.key === "ArrowDown") next = Math.min(items.length - 1, idx + 1);
      if (event.key === "ArrowUp") next = Math.max(0, idx - 1);
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = items.length - 1;
      items[next]?.focus();
    }
  }

  /* ================================================================ helpers */
  quickApply(label, fn, quiet = false) {
    if (!store.can("edit")) return;
    store.begin(label);
    fn(store.state);
    const changed = store.end();
    if (changed && !quiet) this.render();
  }

  beginLive(kind, label) {
    if (!store.can("edit") && !store.can("shared")) return false;
    if (!this._liveTx) {
      store.begin(label);
      this._liveTx = kind;
    }
    return true;
  }

  commitLive() {
    if (!this._liveTx) return;
    this._liveTx = null;
    store.end();
  }

  liveStyle(prop, value) {
    if (!this.beginLive("style", "Style edited")) return;
    store.setStyleProp(this.editor.selectedId, this.editor.bpKey, prop, value);
  }

  liveStyleColor(prop, value) {
    if (!this.beginLive("style", "Colour edited")) return;
    store.setStyleProp(this.editor.selectedId, this.editor.bpKey, prop, value);
  }

  liveTheme(fn) {
    if (!this.beginLive("theme", "Theme edited")) return;
    fn(store.state);
    store.emit("live");
  }

  liveThemeToken(key, value) {
    if (!this.beginLive("theme", "Theme token edited")) return;
    if (!isValidColor(value)) return;
    store.state.theme.tokens[store.mode][key] = value;
    store.emit("live");
  }

  liveImage(field, value) {
    if (!this.beginLive("image", "Image framing edited")) return;
    const id = this.editor.selectedId;
    store.state.nodeState[id] = store.state.nodeState[id] || {};
    store.state.nodeState[id].image = store.state.nodeState[id].image || {};
    store.state.nodeState[id].image[field] = value;
    store.emit("live");
  }

  async saveLink(remove = false) {
    const id = this.editor.selectedId;
    const el = this.editor.getNode(id);
    if (!el || !store.can("edit")) return;
    if (remove) {
      store.setLink(id, { href: "", type: "none", newTab: false, ariaLabel: "" });
      toast("Link removed.", { iconName: "link" });
      return;
    }
    const type = this.el.querySelector('[data-link-field="type"]')?.value || "none";
    const internal = this.el.querySelector('[data-link-field="internal"]')?.value || "#top";
    const url = this.el.querySelector('[data-link-field="url"]')?.value.trim() || "";
    const email = this.el.querySelector('[data-link-field="email"]')?.value.trim() || "";
    const newTab = this.el.querySelector('[data-link-field="newTab"]')?.checked || false;
    const ariaLabel = this.el.querySelector('[data-link-field="aria"]')?.value.trim() || "";
    let href = "";
    if (type === "internal") href = internal;
    else if (type === "external") href = sanitizeUrl(url);
    else if (type === "email") href = email ? `mailto:${email.replace(/^mailto:/i, "")}` : "";
    if (["external", "email"].includes(type) && !href) {
      toast("Enter a valid destination first.", { tone: "destructive", iconName: "warning" });
      return;
    }
    store.setLink(id, { href, type, newTab, ariaLabel });
    toast("Link saved.", { tone: "positive", iconName: "check" });
  }

  resetImage() {
    const id = this.editor.selectedId;
    if (!store.can("edit")) return;
    quickApplyDirect("Artwork reset", (state) => {
      if (state.assets?.instances?.[id]) delete state.assets.instances[id];
      if (state.nodeState?.[id]?.image) delete state.nodeState[id].image;
    });
    toast("Image reset to the original asset.", { iconName: "reset" });
  }

  async replaceImage(file) {
    const id = this.editor.selectedId;
    const error = await this.uploadToTarget(file, id);
    if (error) {
      this._uploadError = error;
      toast(error, { tone: "destructive", iconName: "warning" });
      this.render();
    } else {
      this._uploadError = "";
      toast("Image replaced. Surrounding styles preserved.", { tone: "positive", iconName: "image" });
      this.render();
    }
  }

  async validateFile(file) {
    if (!UPLOAD_TYPES.has(file.type)) {
      return { error: "Unsupported file type. Use PNG, JPEG or WebP. SVG uploads are rejected for safety." };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: `That file is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.` };
    }
    try {
      const src = await readFileAsDataURL(file);
      const dims = await imageSize(src);
      if (!dims.width || !dims.height) return { error: "The image could not be decoded. The previous asset is unchanged." };
      return {
        upload: {
          id: uid("upload"),
          name: file.name,
          type: file.type,
          size: file.size,
          src,
          width: dims.width,
          height: dims.height,
          alt: "",
        },
      };
    } catch (err) {
      return { error: "The file could not be read. The previous asset is unchanged." };
    }
  }

  async uploadToTarget(file, target) {
    const result = await this.validateFile(file);
    if (result.error) return result.error;
    const ok = store.replaceAssetTarget(target, result.upload, "Asset replaced");
    return ok ? "" : "The asset could not be replaced.";
  }

  async openAssetDialog(assetId) {
    const asset = getAsset(assetId);
    if (!asset) return;
    const mode = store.mode;
    const targets = asset.targets || [];
    const selectedTarget = targets.includes(this.editor.selectedId) ? this.editor.selectedId : targets[0] || "";
    const currentInstances = targets.map((t) => store.state.assets?.instances?.[t]).filter(Boolean);
    const history = (store.state.assets?.history || []).filter(
      (h) => !targets.length || targets.some((t) => (h.target || "").includes(t))
    );
    const usage = asset.usage || [];
    const d = dialog({
      title: asset.name,
      subtitle: `${asset.type} · ${asset.dims}`,
      className: "sheet",
      body: `<div class="asset-detail">
        <div class="asset-detail-preview">
          <img src="${esc(assetPreview(asset, mode))}" alt="${esc(asset.alt || "")}">
          <dl class="asset-meta-list">
            <dt>Description</dt><dd>${esc(asset.description)}</dd>
            <dt>Alternative text</dt><dd>${esc(asset.alt || "—")}</dd>
            <dt>Type / dimensions</dt><dd>${esc(asset.type)} · ${esc(asset.dims)}</dd>
            <dt>Usage</dt><dd>${esc(usage.join(" · ") || "Asset library")}</dd>
            <dt>Hosted at</dt><dd><code>${esc(asset.files?.dark || "")}</code></dd>
          </dl>
        </div>
        ${
          asset.replaceable
            ? `<div class="notice">${icon("info", {
                size: 16,
              })}<div>Choose an explicit scope. A linked replacement updates every use; an instance replacement touches one location only.</div></div>
              <div class="field">
                <label class="field-label" for="asset-target">Instance target</label>
                <select class="select" id="asset-target">
                  ${targets
                    .map(
                      (t) =>
                        `<option value="${t}" ${t === selectedTarget ? "selected" : ""}>${esc(
                          TARGET_LABELS[t] || t
                        )}</option>`
                    )
                    .join("")}
                </select>
              </div>
              <label class="upload-zone" data-asset-upload-zone tabindex="0" role="button">
                ${icon("upload", { size: 22 })}
                <span>Choose a replacement image</span>
                <span class="field-hint">PNG, JPEG or WebP · up to 2.5 MB</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" data-asset-upload>
              </label>
              <div class="inline-actions">
                <button type="button" class="mini-btn" data-asset-replace-all>${icon("layers", {
                  size: 13,
                })} Replace every linked use (${targets.length})${
                targets.length > 1 ? " — uploads" : ""
              }</button>
                ${
                  currentInstances.length
                    ? `<button type="button" class="mini-btn is-danger" data-asset-reset>${icon("reset", {
                        size: 13,
                      })} Reset to original</button>`
                    : ""
                }
              </div>
              <div class="upload-error" id="asset-error" role="alert"></div>`
            : `<div class="notice">${icon("lock", {
                size: 16,
              })}<div>This shipped asset is part of the identity system. Replace an image from its element controls instead.</div></div>`
        }
        <div class="field">
          <div class="field-label"><span>Usage locations</span></div>
          <div class="usage-list">
            ${targets
              .map(
                (t) => `<div class="usage-item"><span>${esc(TARGET_LABELS[t] || t)}</span>${
                  t === "favicon"
                    ? '<span class="chip">Browser</span>'
                    : `<button type="button" class="mini-btn" data-usage-target="${esc(
                        t
                      )}">Reveal</button>`
                }</div>`
              )
              .join("") || `<div class="history-empty">${esc(usage.join(" · "))}</div>`}
          </div>
        </div>
        <div class="field">
          <div class="field-label"><span>Replacement history</span><span class="field-hint">${history.length}</span></div>
          <div class="asset-history">
            ${
              history.length
                ? history
                    .slice(0, 8)
                    .map(
                      (h) =>
                        `<div class="asset-history-row"><span>${esc(h.name || "Upload")}</span><span>${formatDate(
                          h.at,
                          { dateStyle: "medium", timeStyle: "short" }
                        )}</span></div>`
                    )
                    .join("")
                : '<div class="history-empty">No replacements yet.</div>'
            }
          </div>
        </div>
      </div>`,
      footer: `<button type="button" class="btn btn-ghost btn-sm" data-dialog-close>Close</button>`,
    });
    const errorEl = d.el.querySelector("#asset-error");
    const fileInput = d.el.querySelector("[data-asset-upload]");
    d.el.querySelector("[data-asset-upload-zone]")?.addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key)) {
        event.preventDefault();
        fileInput?.click();
      }
    });
    let replaceAll = false;
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      fileInput.value = "";
      const result = await this.validateFile(file);
      if (result.error) {
        if (errorEl) errorEl.textContent = result.error;
        toast(result.error, { tone: "destructive", iconName: "warning" });
        return;
      }
      const target = d.el.querySelector("#asset-target")?.value || selectedTarget;
      const ok = replaceAll
        ? store.replaceAssetAll(asset.id, targets, result.upload, `Linked asset replaced · ${asset.name}`)
        : store.replaceAssetTarget(target, result.upload, `Asset replaced · ${asset.name}`);
      if (!ok) {
        if (errorEl) errorEl.textContent = "The replacement could not be saved. The previous asset is unchanged.";
        return;
      }
      d.close();
      toast(
        replaceAll
          ? `Replaced ${targets.length} linked use${targets.length === 1 ? "" : "s"} of ${asset.name}.`
          : `Replaced ${TARGET_LABELS[target] || asset.name}.`,
        { tone: "positive", iconName: "image" }
      );
    });
    d.el.querySelector("[data-asset-replace-all]")?.addEventListener("click", () => {
      if (!fileInput) return;
      replaceAll = true;
      fileInput.click();
    });
    d.el.querySelector("[data-asset-reset]")?.addEventListener("click", () => {
      confirmDialog({
        title: "Reset to the original asset?",
        message: "Every custom replacement for this asset will be removed from the draft. Undo remains available.",
        confirmLabel: "Reset asset",
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        store.begin("Asset reset");
        for (const target of targets) {
          if (store.state.assets?.instances?.[target]) delete store.state.assets.instances[target];
        }
        store.end();
        d.close();
        toast("Asset reset to the original.", { iconName: "reset" });
      });
    });
    d.el.querySelectorAll("[data-usage-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.usageTarget;
        d.close();
        this.editor.selectNode(target, { force: true, scroll: true });
      });
    });
  }

  async deleteUpload(id) {
    const upload = store.state.assets?.uploads?.[id];
    if (!upload) return;
    const uses = Object.entries(store.state.assets?.instances || {})
      .filter(([, inst]) => inst.src === upload.src)
      .map(([target]) => TARGET_LABELS[target] || target);
    if (uses.length) {
      dialog({
        title: "Asset is in use",
        body: `<div class="notice is-warning">${icon("warning", {
          size: 18,
        })}<div>This upload is used in ${uses.length} place${uses.length === 1 ? "" : "s"}: ${esc(
          uses.join(", ")
        )}. Replace those uses before deleting the file.</div></div>`,
        footer: `<button type="button" class="btn btn-primary btn-sm" data-dialog-close>Understood</button>`,
      });
      return;
    }
    const ok = await confirmDialog({
      title: "Delete upload?",
      message: `“${esc(upload.name)}” is not referenced by the site. This cannot be undone beyond the current draft history.`,
      confirmLabel: "Delete upload",
      danger: true,
    });
    if (ok) {
      await store.deleteUpload(id);
      toast("Upload deleted.", { iconName: "trash" });
    }
  }

  generateTheme() {
    if (!store.can("shared")) return;
    store.updateTheme({ tokens: generateThemeTokens() }, "Palette generated");
    toast("New accessible palette generated.", { iconName: "palette" });
    this.render();
  }

  restoreTheme() {
    confirmDialog({
      title: "Restore the original theme?",
      message:
        "Colours, type families, named styles, radii and background treatment return to the shipped theme. Your content stays intact.",
      confirmLabel: "Restore theme",
      danger: true,
    }).then((ok) => {
      if (ok) {
        store.resetTheme();
        toast("Original theme restored.", { iconName: "reset" });
      }
    });
  }

  openStyleInTheme(styleKey) {
    this._openStyle = styleKey;
    this.setTab("theme");
    this.editor.setInspector(true);
  }
}

function quickApplyDirect(label, fn) {
  if (!store.can("edit")) return false;
  store.begin(label);
  fn(store.state);
  const changed = store.end();
  return changed;
}
