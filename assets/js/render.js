import { DEFAULT_CONTENT, STYLE_META } from "./content.js";
import { icon } from "./icons.js";
import { esc, sanitizeHtml, sanitizeUrl, cssLength, clamp } from "./utils.js";

const textOf = (state, id, fallback = "") =>
  Object.prototype.hasOwnProperty.call(state.text || {}, id) ? state.text[id] : fallback;

const nodeAttrs = (state, id, extra = "") => {
  const ns = (state.nodeState || {})[id] || {};
  return `${ns.hidden ? ' data-hidden="true"' : ""}${
    ns.deleted ? ' data-deleted="true"' : ""
  }${ns.locked ? ' data-locked="true"' : ""}${extra}`;
};

function textNode(state, id, { kind = "text", style = "body", tag = "p", fallback, label, cls = "", attrs = "" }) {
  const html = sanitizeHtml(textOf(state, id, fallback));
  const styleCls = style ? ` ts-${style}` : "";
  return `<${tag} class="${cls}${styleCls}" data-node-id="${esc(id)}" data-node-kind="${kind}" data-node-label="${esc(
    label
  )}" data-node-pickable="true"${nodeAttrs(state, id)}${attrs}>${html}</${tag}>`;
}

function linkData(state, id, fallbackHref = "") {
  const link = (state.nodeState || {})[id]?.link || {};
  const href = sanitizeUrl(link.href ?? fallbackHref);
  const newTab = link.newTab === true || link.target === "_blank";
  return {
    href,
    target: newTab ? '_blank' : "",
    rel: newTab ? "noopener noreferrer" : "",
    aria: link.ariaLabel ? ` aria-label="${esc(link.ariaLabel)}"` : "",
  };
}

function linkAttrs(link) {
  return `${link.href ? ` href="${esc(link.href)}"` : ""}${
    link.target ? ` target="${link.target}" rel="${link.rel}"` : ""
  }${link.aria}`;
}

function buttonNode(state, id, { fallback, label, cls, href, action = "", tag = "a" }) {
  const html = sanitizeHtml(textOf(state, id, fallback));
  const baseAttrs = `data-node-id="${esc(id)}" data-node-kind="button" data-node-label="${esc(
    label
  )}" data-node-pickable="true"${nodeAttrs(state, id)}${
    action ? ` data-node-action="${esc(action)}"` : ""
  }`;
  if (tag === "button") {
    return `<button type="button" class="btn ${cls}" ${baseAttrs}${
      action ? ` data-action="${esc(action)}"` : ""
    }>${html}</button>`;
  }
  const link = linkData(state, id, href);
  return `<a class="btn ${cls}" ${baseAttrs}${linkAttrs(link)}>${html}</a>`;
}

/* ------------------------------------------------------------------ theme */
function safeColor(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (v === "transparent") return v;
  if (/^var\(--[a-z0-9-]+\)$/i.test(v)) return v;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^(rgb|hsl)a?\([0-9.,%\s/]+\)$/i.test(v)) return v;
  return "";
}

function num(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return clamp(n, min, max);
}

function styleRule(props, theme) {
  if (!props) return "";
  const out = [];
  const fonts = theme.type || {};
  if (props.family && fonts[props.family]) out.push(`font-family:${fonts[props.family]}`);
  if (props.scale != null) {
    const s = num(props.scale, 0.4, 2.4);
    if (s != null) out.push(`--node-scale:${s}`);
  }
  if (props.fontSize) {
    const v = cssLength(props.fontSize);
    if (v) out.push(`font-size:${v}`);
  }
  if (props.weight != null) {
    const w = [300, 400, 500, 600, 700].includes(Number(props.weight)) ? Number(props.weight) : null;
    if (w) out.push(`font-weight:${w}`);
  }
  if (props.lineHeight != null) {
    const v = num(props.lineHeight, 0.7, 3.2);
    if (v != null) out.push(`line-height:${v}`);
  }
  if (props.tracking != null) {
    const v = num(props.tracking, -0.1, 0.4);
    if (v != null) out.push(`letter-spacing:${v}em`);
  }
  if (props.align && ["left", "center", "right", "justify"].includes(props.align)) {
    out.push(`text-align:${props.align}`);
  }
  if (props.maxWidth != null) {
    const v = num(props.maxWidth, 8, 240);
    if (v != null) out.push(`max-width:${v}ch`);
  }
  if (props.underline != null) {
    out.push(`text-decoration:${props.underline ? "underline" : "none"}`);
  }
  if (props.textTransform && ["none", "uppercase", "lowercase"].includes(props.textTransform)) {
    out.push(`text-transform:${props.textTransform}`);
  }
  if (props.color) {
    const c = safeColor(props.color);
    if (c) out.push(`color:${c}`);
  }
  if (props.background) {
    const c = safeColor(props.background);
    if (c) out.push(`background:${c}`);
  }
  if (props.borderColor) {
    const c = safeColor(props.borderColor);
    if (c) out.push(`border-color:${c}`);
  }
  if (props.borderWidth != null) {
    const v = num(props.borderWidth, 0, 8);
    if (v != null) out.push(`border-width:${v}px`);
  }
  if (props.radius != null) {
    const v = num(props.radius, 0, 120);
    if (v != null) out.push(`border-radius:${v}px`);
  }
  if (props.padding != null) {
    const v = num(props.padding, 0, 120);
    if (v != null) out.push(`padding:${v}px`);
  }
  if (props.gap != null) {
    const v = num(props.gap, 0, 80);
    if (v != null) out.push(`gap:${v}px`);
  }
  if (props.objectFit && ["cover", "contain", "fill"].includes(props.objectFit)) {
    out.push(`object-fit:${props.objectFit}`);
  }
  if (props.objectPosition && /^[\d.]+%\s+[\d.]+%$/.test(props.objectPosition)) {
    out.push(`object-position:${props.objectPosition}`);
  }
  if (props.opacity != null) {
    const v = num(props.opacity, 0, 1);
    if (v != null) out.push(`opacity:${v}`);
  }
  return out.join(";");
}

export function buildThemeCss(state) {
  const theme = state.theme || {};
  const styles = theme.styles || {};
  const fonts = theme.type || {};
  const out = [];

  for (const meta of STYLE_META) {
    const s = styles[meta.key];
    if (!s) continue;
    const size = cssLength(s.size) || "1rem";
    const weight = [300, 400, 500, 600, 700].includes(Number(s.weight)) ? Number(s.weight) : 400;
    const lh = num(s.lineHeight, 0.7, 3.2) ?? 1.5;
    const tracking = num(s.tracking, -0.1, 0.4) ?? 0;
    const family = fonts[s.family] || fonts.body || "inherit";
    out.push(
      `.ts-${meta.key}{font-family:${family};font-size:calc(${size} * var(--node-scale, 1));font-weight:${weight};line-height:${lh};letter-spacing:${tracking}em;text-transform:${
        ["none", "uppercase", "lowercase"].includes(s.transform) ? s.transform : "none"
      };--style-size:${size};}`
    );
  }

  const byBp = { base: [], tablet: [], mobile: [] };
  for (const [id, entry] of Object.entries(state.styles || {})) {
    if (!entry) continue;
    for (const bp of ["base", "tablet", "mobile"]) {
      const rule = styleRule(entry[bp], theme);
      if (!rule) continue;
      byBp[bp].push(`[data-node-id="${String(id).replace(/"/g, '\\"')}"]{${rule}}`);
    }
  }
  out.push(...byBp.base);
  if (byBp.tablet.length) out.push(`@container site (max-width: 900px){${byBp.tablet.join("")}}`);
  if (byBp.mobile.length) out.push(`@container site (max-width: 640px){${byBp.mobile.join("")}}`);
  return out.join("\n");
}

export function applyTheme(state, mode) {
  const theme = state.theme || {};
  const tokens = theme.tokens?.[mode] || theme.tokens?.dark || {};
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    if (!value) continue;
    const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    root.style.setProperty(`--${cssKey}`, value);
  }
  root.style.setProperty("--radius-sm", `${theme.radius?.sm ?? 8}px`);
  root.style.setProperty("--radius-md", `${theme.radius?.md ?? 16}px`);
  root.style.setProperty("--radius-lg", `${theme.radius?.lg ?? 28}px`);
  root.style.setProperty("--border-w", `${theme.borderWidth ?? 1}px`);
  for (const role of ["brand", "body", "mono", "serif", "sans"]) {
    const stack = theme.type?.[role];
    if (stack) root.style.setProperty(`--font-${role}`, stack);
  }
  root.dataset.theme = mode;
  root.dataset.siteTexture = [
    "asanoha",
    "seigaiha",
    "kagome",
    "uroko",
    "shippo",
    "kikko",
    "chidori",
    "tatewaku",
  ].includes(theme.texture)
    ? theme.texture
    : "uroko";
  const site = document.getElementById("site");
  if (site) {
    site.dataset.background = theme.background || "none";
    site.dataset.texture = root.dataset.siteTexture;
  }

  let styleEl = document.getElementById("tenugui-theme-styles");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "tenugui-theme-styles";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildThemeCss(state);
}

/* ------------------------------------------------------------------ images */
function brandMarkVisual(state, target) {
  const inst = (state.assets?.instances || {})[target];
  return `<img src="${esc(inst?.src || "assets/img/brand/mark-dark-512.png")}" alt="${esc(
    inst?.alt || "TenuGUI mark"
  )}">`;
}

function logoMarkup(state, target, label) {
  return `<span class="brand-mark" data-node-id="${esc(target)}" data-node-kind="image" data-node-label="${esc(
    label
  )}" data-node-pickable="true"${nodeAttrs(state, target)}>${brandMarkVisual(
    state,
    target
  )}</span>`;
}

/* ------------------------------------------------------------------ sections */
function sectionHead(state, key, content) {
  return `<div class="section-head">
    ${textNode(state, `${key}.title`, {
      fallback: content.title,
      label: `${content.title} heading`,
      style: "h2",
      tag: "h2",
      cls: "section-title",
    })}
    ${textNode(state, `${key}.lede`, {
      fallback: content.lede,
      label: `${content.title} introduction`,
      style: "body",
      cls: "section-lede",
    })}
  </div>`;
}

function header(state, mode) {
  const c = state.content;
  const nav = c.nav
    .map((item) => {
      const link = linkData(state, `nav.${item.id}`, item.href);
      const label = sanitizeHtml(textOf(state, `nav.${item.id}`, item.label));
      return `<a class="nav-link ts-small" data-node-id="nav.${esc(item.id)}" data-node-kind="link" data-node-label="Nav link · ${esc(
        item.label
      )}" data-node-pickable="true"${nodeAttrs(state, `nav.${item.id}`)}${linkAttrs(link)}>${label}</a>`;
    })
    .join("");

  const mobileLinks = c.nav
    .map((item) => `<a href="${esc(sanitizeUrl(item.href))}">${sanitizeHtml(textOf(state, `nav.${item.id}`, item.label))}${icon("chevron-right", { size: 15 })}</a>`)
    .join("");

  return `<div class="wrap header-inner">
    <a class="brand-group" href="#top" data-node-id="header.brand" data-node-kind="group" data-node-label="Brand" aria-label="TenuGUI home">
      ${logoMarkup(state, "header.brandMark", "Header brand mark")}
    </a>
    <nav class="nav-primary" aria-label="Primary">${nav}</nav>
    <div class="header-actions">
      <button type="button" class="icon-btn" data-action="toggle-theme" aria-label="Switch to ${
        mode === "dark" ? "light" : "dark"
      } theme" title="Switch theme">${icon(mode === "dark" ? "sun" : "moon", { size: 17 })}</button>
      <button type="button" class="btn btn-primary btn-sm" data-action="start-demo">Try it</button>
      <button type="button" class="icon-btn mobile-menu-btn" data-action="open-mobile-nav" aria-label="Open menu">${icon(
        "menu",
        { size: 19 }
      )}</button>
    </div>
  </div>
  <dialog class="mobile-nav" id="mobile-nav">
    <div class="mobile-nav-inner">
      <div class="mobile-nav-head">
        <span class="brand-group" aria-label="TenuGUI"><span class="brand-mark">${brandMarkVisual(
          state,
          "header.brandMark"
        )}</span></span>
        <button type="button" class="icon-btn" data-action="close-mobile-nav" aria-label="Close menu">${icon(
          "close",
          { size: 18 }
        )}</button>
      </div>
      <div class="mobile-nav-links">${mobileLinks}</div>
      <div class="mobile-nav-foot">
        <button type="button" class="btn btn-primary" data-action="start-demo">Try it here</button>
        <button type="button" class="btn btn-ghost" data-action="toggle-theme">Switch to ${
          mode === "dark" ? "light" : "dark"
        } theme</button>
      </div>
    </div>
  </dialog>`;
}

function hero(state) {
  const h = state.content.hero;
  return `<section class="section hero" id="top" data-node-id="section.top" data-node-kind="group" data-node-label="Hero section" data-node-pickable="true"${nodeAttrs(
    state,
    "section.top"
  )}>
    <div class="wrap hero-copy">
      ${textNode(state, "hero.title", {
        fallback: h.title,
        label: "Hero title",
        style: "display",
        tag: "h1",
        cls: "hero-title",
      })}
      ${textNode(state, "hero.lede", {
        fallback: h.lede,
        label: "Hero introduction",
        style: "body",
        cls: "hero-lede",
      })}
      <div class="cta-row">
        ${buttonNode(state, "hero.primary", {
          fallback: h.primary.label,
          label: "Editor call to action",
          cls: "btn-primary btn-lg",
          href: h.primary.href,
        })}
        ${buttonNode(state, "hero.secondary", {
          fallback: h.secondary.label,
          label: "Demo call to action",
          cls: "btn-ghost btn-lg",
          href: h.secondary.href,
        })}
      </div>
    </div>
  </section>`;
}

function features(state) {
  const c = state.content.features;
  const items = c.items
    .map((item) => {
      const cardId = `feature.${item.id}.card`;
      return `<article class="feature-card" data-node-id="${esc(cardId)}" data-node-kind="surface" data-node-label="Feature · ${esc(
        item.title
      )}" data-node-pickable="true" data-node-item="${esc(item.id)}" data-node-section="features"${nodeAttrs(
        state,
        cardId
      )}>
        ${textNode(state, `feature.${item.id}.title`, {
          fallback: item.title,
          label: `Feature title · ${item.title}`,
          style: "h3",
          tag: "h3",
          cls: "feature-title",
        })}
        ${textNode(state, `feature.${item.id}.body`, {
          fallback: item.body,
          label: `Feature body · ${item.title}`,
          style: "small",
          cls: "feature-body",
        })}
      </article>`;
    })
    .join("");

  return `<section class="section" id="features" data-node-id="section.features" data-node-kind="group" data-node-label="Features section" data-node-pickable="true"${nodeAttrs(
    state,
    "section.features"
  )}>
    <div class="wrap">
      ${sectionHead(state, "features", c)}
      <div class="feature-grid">${items}</div>
    </div>
  </section>`;
}

function install(state) {
  const c = state.content.install;
  const quick = c.quick || {};
  const reqs = (c.requirements || [])
    .map((req, i) =>
      textNode(state, `install.requirement.${i}`, {
        fallback: req,
        label: `Requirement ${i + 1}`,
        style: "meta",
        tag: "span",
        cls: "tool-chip",
      })
    )
    .join("");
  const steps = (quick.steps || [])
    .map(
      (step, i) => `<li class="install-step">
        <span class="install-step-num" aria-hidden="true">${i + 1}</span>
        <div class="install-step-copy">
          ${textNode(state, `install.quick.step.${i}.title`, {
            fallback: step.title,
            label: `Quick start step ${i + 1} title`,
            style: "h3",
            tag: "h3",
            cls: "install-step-title",
          })}
          ${textNode(state, `install.quick.step.${i}.body`, {
            fallback: step.body,
            label: `Quick start step ${i + 1} description`,
            style: "small",
            tag: "p",
            cls: "install-step-body",
          })}
        </div>
      </li>`
    )
    .join("");
  const cta = quick.cta
    ? `<a class="btn btn-primary install-cta" href="${esc(
        sanitizeUrl(quick.cta.href)
      )}" data-tg-site-action="true">${esc(quick.cta.label)}</a>`
    : "";

  return `<section class="section" id="install" data-node-id="section.install" data-node-kind="group" data-node-label="Install section" data-node-pickable="true"${nodeAttrs(
    state,
    "section.install"
  )}>
    <div class="wrap">
      ${sectionHead(state, "install", c)}
      <div class="requirements"><span class="requirements-label">You need</span>${reqs}</div>
      <div class="install-quick">
        <div class="install-quick-head">
          <span class="install-quick-kicker">Quick start</span>
          ${textNode(state, "install.quick.title", {
            fallback: quick.title,
            label: "Quick start title",
            style: "h3",
            tag: "h3",
            cls: "install-quick-title",
          })}
          ${textNode(state, "install.quick.body", {
            fallback: quick.body,
            label: "Quick start description",
            style: "small",
            tag: "p",
            cls: "install-quick-body",
          })}
        </div>
        <ol class="install-steps">${steps}</ol>
        ${cta}
        ${textNode(state, "install.quick.note", {
          fallback: quick.note,
          label: "Quick start note",
          style: "meta",
          tag: "p",
          cls: "install-quick-note",
        })}
      </div>
    </div>
  </section>`;
}

function trySection(state) {
  const c = state.content.try;
  return `<section class="section" id="try" data-node-id="section.try" data-node-kind="group" data-node-label="Try section" data-node-pickable="true"${nodeAttrs(
    state,
    "section.try"
  )}>
    <div class="wrap">
      <div class="try-panel">
        ${textNode(state, "try.title", {
          fallback: c.title,
          label: "Demo title",
          style: "h1",
          tag: "h2",
          cls: "try-title",
        })}
        ${textNode(state, "try.body", {
          fallback: c.body,
          label: "Demo description",
          style: "body",
          cls: "try-body",
        })}
        <div class="try-actions">
          ${buttonNode(state, "try.button", {
            fallback: c.button,
            label: "Demo button",
            cls: "btn-primary btn-lg",
            action: "start-demo",
            tag: "button",
          })}
          ${textNode(state, "try.hint", {
            fallback: c.hint,
            label: "Demo hint",
            style: "meta",
            tag: "span",
            cls: "try-hint",
          })}
        </div>
      </div>
    </div>
  </section>`;
}

function footer(state) {
  const c = state.content.footer;
  const links = [
    { id: "features", label: "What it does", href: "#features" },
    { id: "install", label: "Use it", href: "#install" },
    { id: "try", label: "Try it", href: "#try" },
  ]
    .map((l) => {
      const link = linkData(state, `footer.link.${l.id}`, l.href);
      return `<a data-node-id="footer.link.${l.id}" data-node-kind="link" data-node-label="Footer link · ${esc(
        l.label
      )}" data-node-pickable="true"${nodeAttrs(state, `footer.link.${l.id}`)}${linkAttrs(link)}>${sanitizeHtml(
        textOf(state, `footer.link.${l.id}`, l.label)
      )}</a>`;
    })
    .join("");

  return `<div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        ${logoMarkup(state, "footer.brandMark", "Footer brand mark")}
        <div>
          <div class="brand-text" style="margin-bottom:8px">
            ${textNode(state, "footer.wordmark", {
              fallback: state.content.brand.name,
              label: "Footer wordmark",
              style: "body",
              tag: "span",
              cls: "brand-word",
            })}
            ${textNode(state, "footer.kanji", {
              fallback: c.markKanji,
              label: "Footer kanji",
              style: "meta",
              tag: "span",
              cls: "brand-kanji",
            })}
          </div>
          ${textNode(state, "footer.statement", {
            fallback: c.statement,
            label: "Footer statement",
            style: "small",
            cls: "footer-statement",
          })}
        </div>
      </div>
      <div class="footer-links">${links}</div>
    </div>
    <div class="footer-bottom">
      ${textNode(state, "footer.note", {
        fallback: c.note,
        label: "Colophon",
        style: "meta",
        tag: "p",
        cls: "footer-note",
      })}
      <div class="footer-meta">
        <span>${esc(c.version)}</span>
        <span class="sep"></span>
        ${textNode(state, "footer.copyright", {
          fallback: c.copyright,
          label: "Copyright",
          style: "meta",
          tag: "span",
        })}
      </div>
    </div>
  </div>`;
}

function insertionMarkup(state, item) {
  const id = `insert.${item.id}`;
  const label = `Inserted ${item.kind}`;
  const attrs = `data-node-id="${esc(id)}" data-node-kind="${
    item.kind === "image" ? "image" : item.kind === "button" ? "button" : item.kind === "divider" ? "surface" : "text"
  }" data-node-label="${esc(label)}" data-node-pickable="true"${nodeAttrs(state, id)}`;
  const text = sanitizeHtml(textOf(state, id, item.text || ""));
  if (item.kind === "heading") {
    return `<h2 class="inserted-heading ts-h2" ${attrs}>${text || "New heading"}</h2>`;
  }
  if (item.kind === "button") {
    return `<button type="button" class="btn btn-primary inserted-button" ${attrs}>${text || "Button"}</button>`;
  }
  if (item.kind === "image") {
    const src = state.assets?.instances?.[id]?.src || item.src || "";
    const alt = state.assets?.instances?.[id]?.alt || item.alt || "";
    return `<img class="inserted-image" src="${esc(src)}" alt="${esc(alt)}" ${attrs}>`;
  }
  if (item.kind === "divider") {
    return `<hr class="inserted-divider" ${attrs}>`;
  }
  return `<p class="inserted-text ts-body" ${attrs}>${text || "New text"}</p>`;
}

export function renderDynamics(state) {
  const site = document.getElementById("site");
  if (!site) return;
  const editing = document.body.classList.contains("editor-active");
  for (const item of state.dynamics || []) {
    const nodeId = `dynamic.${item.id}`;
    if (state.nodeState?.[nodeId]?.deleted) continue;
    const html = sanitizeHtml(item.html || "");
    const empty = !html.trim();
    if (empty && !editing) continue;
    const host =
      item.section && item.section !== "page"
        ? site.querySelector(`#${CSS.escape(item.section)}`)
        : document.getElementById("main");
    if (!host) continue;
    let layer = host.querySelector(":scope > .dynamic-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "dynamic-layer";
      host.append(layer);
    }
    const x = clamp(Number(item.position?.x) || 0, 0, 2400);
    const y = clamp(Number(item.position?.y) || 0, 0, 4000);
    const width = clamp(Number(item.size?.width) || 360, 80, 1600);
    const height = clamp(Number(item.size?.height) || 180, 40, 1600);
    const description = esc(item.description || "Dynamic element");
    layer.insertAdjacentHTML(
      "beforeend",
      `<div class="dynamic-slot${empty ? " is-empty" : ""}" data-node-id="${esc(
        nodeId
      )}" data-node-kind="dynamic" data-node-label="Dynamic · ${description}" data-node-pickable="true"${nodeAttrs(
        state,
        nodeId
      )} style="left:${x}px;top:${y}px;width:${width}px;height:${height}px">${
        empty
          ? `<span class="dynamic-kicker">Dynamic element</span><p>${description}</p>`
          : html
      }</div>`
    );
  }
}

export function renderInsertions(state) {
  const site = document.getElementById("site");
  if (!site) return;
  for (const item of state.insertions || []) {
    const id = `insert.${item.id}`;
    if (state.nodeState?.[id]?.deleted) continue;
    const host =
      item.section && item.section !== "page"
        ? site.querySelector(`#${CSS.escape(item.section)}`)
        : document.getElementById("main");
    if (!host) continue;
    let stack = host.querySelector(":scope > .section-inserts");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "section-inserts wrap";
      host.append(stack);
    }
    stack.insertAdjacentHTML("beforeend", insertionMarkup(state, item));
  }
}

export function applyNodeOffsets(state) {
  const site = document.getElementById("site");
  if (!site) return;
  for (const [id, ns] of Object.entries(state.nodeState || {})) {
    const el = site.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    if (!el) continue;
    if (ns.offset) {
      const x = Number(ns.offset.x) || 0;
      const y = Number(ns.offset.y) || 0;
      el.style.translate = `${x}px ${y}px`;
    }
    if (ns.size?.width) {
      el.style.width = `${Number(ns.size.width)}px`;
      el.style.maxWidth = "none";
    }
    if (ns.size?.height) el.style.height = `${Number(ns.size.height)}px`;
  }
}

export function renderSite(state, { mode = "dark" } = {}) {
  const headerEl = document.getElementById("site-header");
  const mainEl = document.getElementById("main");
  const footerEl = document.getElementById("site-footer");
  if (headerEl) headerEl.innerHTML = header(state, mode);
  if (mainEl) {
    mainEl.innerHTML = hero(state) + features(state) + install(state) + trySection(state);
  }
  if (footerEl) footerEl.innerHTML = footer(state);
  renderInsertions(state);
  renderDynamics(state);
  applyNodeOffsets(state);
  document.title = state.meta?.title || DEFAULT_CONTENT.meta.title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && state.meta?.description) desc.setAttribute("content", state.meta.description);
}
