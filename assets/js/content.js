// Pure data: imported by the browser and by tools/export-content.mjs.
// Keep this module free of DOM access.

export const TOKEN_META = [
  { key: "canvas", label: "Canvas", role: "Primary background" },
  { key: "surface", label: "Surface", role: "Raised content" },
  { key: "elevated", label: "Elevated", role: "Menus and dialogs" },
  { key: "text", label: "Text", role: "Primary readable content" },
  { key: "secondary", label: "Secondary", role: "Supporting content" },
  { key: "border", label: "Border", role: "Nonessential separators" },
  { key: "accent", label: "Accent", role: "Identity and selection" },
  { key: "accentHover", label: "Accent hover", role: "Interactive accent" },
  { key: "accentInk", label: "On accent", role: "Text over accent" },
  { key: "positive", label: "Positive", role: "Successful operations" },
  { key: "warning", label: "Warning", role: "Caution and unresolved" },
  { key: "destructive", label: "Destructive", role: "Errors and deletion" },
  { key: "placeholder", label: "Placeholder", role: "Empty media and hints" },
];

export const TEXTURE_META = [
  { key: "asanoha", label: "Asanoha", note: "Hemp leaf" },
  { key: "seigaiha", label: "Seigaiha", note: "Waves" },
  { key: "kagome", label: "Kagome", note: "Basket weave" },
  { key: "uroko", label: "Uroko", note: "Fish scales" },
  { key: "shippo", label: "Shippo", note: "Seven treasures" },
  { key: "kikko", label: "Kikko", note: "Tortoiseshell" },
  { key: "chidori", label: "Chidori", note: "Plovers" },
  { key: "tatewaku", label: "Tatewaku", note: "Rising steam" },
];

export const STYLE_META = [
  { key: "display", label: "Display", note: "Hero statements" },
  { key: "h1", label: "Heading 1", note: "Page sections" },
  { key: "h2", label: "Heading 2", note: "Section titles" },
  { key: "h3", label: "Heading 3", note: "Cards and groups" },
  { key: "body", label: "Body", note: "Readable paragraphs" },
  { key: "small", label: "Small body", note: "Dense supporting copy" },
  { key: "caption", label: "Caption", note: "Figure captions" },
  { key: "label", label: "Label", note: "Small technical labels" },
  { key: "meta", label: "Technical metadata", note: "Dates, counts, file data" },
  { key: "code", label: "Code", note: "Commands and snippets" },
];

export const THEME_TOKENS = {
  dark: {
    canvas: "#11100E",
    surface: "#191816",
    elevated: "#23211D",
    text: "#F4F0E6",
    secondary: "#B9B2A5",
    border: "#35322C",
    accent: "#E0673F",
    accentHover: "#F07A52",
    accentInk: "#1A0E09",
    positive: "#8FBF8A",
    warning: "#D9B36C",
    destructive: "#E07A7A",
    placeholder: "#9C9588",
  },
  light: {
    canvas: "#F3EEE4",
    surface: "#FBF8F1",
    elevated: "#FFFFFF",
    text: "#211E19",
    secondary: "#6F6659",
    border: "#D8D0C2",
    accent: "#B0442A",
    accentHover: "#8F3520",
    accentInk: "#FFF9F0",
    positive: "#3D7150",
    warning: "#7D5A18",
    destructive: "#9E3B3B",
    placeholder: "#6F6659",
  },
};

export const DEFAULT_STYLES = {
  display: {
    family: "body",
    size: "clamp(3rem, 8.4cqi, 6.4rem)",
    weight: 600,
    lineHeight: 0.98,
    tracking: "-0.045em",
    transform: "none",
  },
  h1: {
    family: "body",
    size: "clamp(2.5rem, 6.8cqi, 4.8rem)",
    weight: 600,
    lineHeight: 1.02,
    tracking: "-0.035em",
    transform: "none",
  },
  h2: {
    family: "body",
    size: "clamp(1.9rem, 4.4cqi, 3.1rem)",
    weight: 600,
    lineHeight: 1.06,
    tracking: "-0.035em",
    transform: "none",
  },
  h3: {
    family: "body",
    size: "clamp(1.14rem, 2.1cqi, 1.4rem)",
    weight: 600,
    lineHeight: 1.3,
    tracking: "-0.012em",
    transform: "none",
  },
  body: {
    family: "body",
    size: "1.02rem",
    weight: 400,
    lineHeight: 1.65,
    tracking: "0",
    transform: "none",
  },
  small: {
    family: "body",
    size: "0.94rem",
    weight: 400,
    lineHeight: 1.55,
    tracking: "0",
    transform: "none",
  },
  caption: {
    family: "body",
    size: "0.84rem",
    weight: 400,
    lineHeight: 1.5,
    tracking: "0.005em",
    transform: "none",
  },
  label: {
    family: "mono",
    size: "0.7rem",
    weight: 500,
    lineHeight: 1.45,
    tracking: "0.16em",
    transform: "uppercase",
  },
  meta: {
    family: "mono",
    size: "0.79rem",
    weight: 400,
    lineHeight: 1.55,
    tracking: "0.015em",
    transform: "none",
  },
  code: {
    family: "mono",
    size: "0.84rem",
    weight: 400,
    lineHeight: 1.7,
    tracking: "0",
    transform: "none",
  },
};

export const FONT_ROLES = {
  brand: {
    label: "Brand",
    stack: "'Dela Gothic One', 'Hiragino Sans', 'Noto Sans JP', system-ui, sans-serif",
  },
  body: {
    label: "Interface",
    stack: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  mono: {
    label: "Technical",
    stack: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  serif: {
    label: "Serif",
    stack: "Georgia, 'Times New Roman', serif",
  },
  sans: {
    label: "System sans",
    stack: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
};

export const DEFAULT_THEME = {
  name: "TenuGUI",
  defaultMode: "light",
  tokens: THEME_TOKENS,
  styles: DEFAULT_STYLES,
  radius: { sm: 3, md: 6, lg: 10 },
  borderWidth: 1,
  texture: "uroko",
  type: Object.fromEntries(Object.entries(FONT_ROLES).map(([k, v]) => [k, v.stack])),
  background: "none",
};

const NAV = [
  { id: "features", label: "What it does", href: "#features" },
  { id: "install", label: "Use it", href: "#install" },
];

const FEATURES = [
  {
    id: "copy",
    icon: "type",
    title: "Copy",
    body: "Change headlines, body text, labels and links in place. Double-click a heading, retype it, and click somewhere else to finish.",
  },
  {
    id: "style",
    icon: "palette",
    title: "Look",
    body: "Set type, colour, spacing, borders and radius per element or across the theme.",
  },
  {
    id: "media",
    icon: "image",
    title: "Media",
    body: "Replace an image, set its crop and alt text, or swap every linked use at once.",
  },
  {
    id: "export",
    icon: "download",
    title: "Export",
    body: "Export edited HTML from the browser editor, or the site state as content.json. No backend involved.",
  },
];

export const DEFAULT_CONTENT = {
  meta: {
    title: "TenuGUI — Edit in place",
    description:
      "A browser editor for any page. Edit in place, then export the changed HTML. No install or server.",
  },
  brand: {
    name: "TenuGUI",
    kanji: "手拭い",
    descriptor: "Direct editing for static pages",
    href: "#top",
  },
  nav: NAV,
  hero: {
    title: "Edit what<br>you see.",
    lede: "Click any element and change it in place. Or take the editor to any other page.",
    primary: { label: "Get the editor", href: "./bookmarklet.html" },
    secondary: { label: "Try the demo", href: "#try" },
  },
  features: {
    title: "What you can change.",
    lede: "There is no admin screen. You change an element where it sits on the page.",
    items: FEATURES,
  },
  install: {
    title: "Use it on any page.",
    lede: "One bookmark. No install, no local setup, no server.",
    quick: {
      title: "Add the browser editor",
      body: "The editor lives in your bookmarks bar. Open any page, click it, and edit what is in front of you.",
      steps: [
        {
          title: "Open the editor setup",
          body: "Open the browser editor page and make sure the bookmarks bar is visible.",
          command: "",
          commandLabel: "",
        },
        {
          title: "Drag it to your bookmarks bar",
          body: "Drag TenuGUI · edit this page onto the bar. You can also copy it and paste it as a bookmark URL.",
          command: "",
          commandLabel: "",
        },
        {
          title: "Click it on any page",
          body: "The editor opens over the page. Select elements, edit text, change styles, move or delete things.",
          command: "",
          commandLabel: "",
        },
        {
          title: "Export the page",
          body: "Use Export HTML to download the edited page. Close the editor to return to the original.",
          command: "",
          commandLabel: "",
        },
      ],
      cta: { label: "Open the browser editor", href: "./bookmarklet.html" },
      note: "No account, extension or server. Pages with a strict content security policy may block bookmarklets.",
    },
    requirements: ["A browser", "A bookmarks bar"],
  },
  try: {
    title: "Try it here.",
    body: "This page is the demo. Change anything, then export content.json and commit it to update the source.",
    button: "Start editing",
    hint: "Press T to toggle · Esc to exit",
  },
  footer: {
    markKanji: "手拭い",
    statement: "A direct editor for static pages.",
    note: "Vanilla HTML, CSS and JavaScript. No tracking.",
    version: "v1.0.0",
    copyright: "© 2026 TenuGUI",
  },
};

export function createDefaultState(overrides = {}) {
  const now = Date.now();
  return {
    schema: 1,
    publishedAt: null,
    updatedAt: now,
    meta: JSON.parse(JSON.stringify(DEFAULT_CONTENT.meta)),
    theme: JSON.parse(JSON.stringify(DEFAULT_THEME)),
    content: JSON.parse(JSON.stringify(DEFAULT_CONTENT)),
    text: {},
    styles: {},
    nodeState: {},
    insertions: [],
    dynamics: [],
    assets: { instances: {}, uploads: {}, history: [] },
    ...overrides,
  };
}

export const ROLES = {
  owner: { label: "Owner", canEdit: true, canPublish: true, canShared: true, canGithub: true },
  editor: { label: "Editor", canEdit: true, canPublish: true, canShared: true, canGithub: false },
  reviewer: { label: "Reviewer", canEdit: false, canPublish: false, canShared: false, canGithub: false },
  demo: { label: "Owner", canEdit: true, canPublish: true, canShared: true, canGithub: true },
};
