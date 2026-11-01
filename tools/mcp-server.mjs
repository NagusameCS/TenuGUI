#!/usr/bin/env node
/**
 * TenuGUI MCP server: a stdio server over content.json with no npm dependencies.
 *
 * It does not need an account, a hosted service or a running browser. Point an
 * MCP client at this file, inspect the page state, then fill dynamic slots or
 * adjust styles. Reload the page after writing; the editor fetches content.json.
 *
 *   node tools/mcp-server.mjs
 *   node tools/mcp-server.mjs --content path/to/content.json
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROTOCOL = "2024-11-05";

function flag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const contentPath = path.resolve(
  flag("--content") || process.env.TENUGUI_CONTENT || path.join(ROOT, "content.json")
);

const TOOLS = [
  {
    name: "inspect_page",
    description:
      "Read the whole page state: meta, content, theme, styles, node state and dynamic slots. Use it before editing.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "set_style",
    description:
      "Set local style properties for one node at a base, tablet or mobile breakpoint. Use camelCase renderer keys (fontSize, weight, color, background, radius, padding, gap, maxWidth).",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Editable node id, e.g. hero.title or features.card.0.title." },
        breakpoint: { type: "string", enum: ["base", "tablet", "mobile"], default: "base" },
        styles: {
          type: "object",
          description: "Style properties to merge. Set a property to null to remove that override.",
          additionalProperties: true,
        },
      },
      required: ["nodeId", "styles"],
      additionalProperties: false,
    },
  },
  {
    name: "replace_asset",
    description: "Replace one image instance without changing its layout or styles.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Image node id, e.g. header.brandMark." },
        src: { type: "string", description: "Local path or data URL for the replacement image." },
        alt: { type: "string", description: "Optional alternative text." },
      },
      required: ["nodeId", "src"],
      additionalProperties: false,
    },
  },
  {
    name: "fill_dynamic",
    description:
      "Fill a model-defined dynamic slot with sanitised HTML. The slot keeps the position and size chosen in the editor.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Dynamic slot id, with or without the dynamic. prefix." },
        html: { type: "string", description: "HTML to place inside the fixed box. Empty string clears it." },
        description: { type: "string", description: "Optional updated description of what the slot should contain." },
      },
      required: ["id", "html"],
      additionalProperties: false,
    },
  },
  {
    name: "export_content",
    description: "Return the complete portable content.json document for a repo, a build or another model.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

async function readState() {
  const raw = await fs.readFile(contentPath, "utf8");
  const state = JSON.parse(raw);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("content.json must contain a JSON object");
  }
  if (!Array.isArray(state.dynamics)) state.dynamics = [];
  return state;
}

async function writeState(state) {
  // content.json is the published source of truth for the static page.
  const now = Date.now();
  state.publishedAt = now;
  state.updatedAt = now;
  const temp = `${contentPath}.tmp-${process.pid}`;
  await fs.writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(temp, contentPath);
}

const DANGEROUS = "script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option";

/** Conservative server-side pass; the browser sanitises again when rendering. */
function sanitizeHtml(input) {
  if (typeof input !== "string") throw new Error("html must be a string");
  if (input.length > 30000) throw new Error("html is limited to 30,000 characters");
  let html = input;
  html = html.replace(new RegExp(`<(${DANGEROUS})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "");
  html = html.replace(new RegExp(`<\\/?(?:${DANGEROUS})\\b[^>]*>`, "gi"), "");
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(
    /\b(href|src|xlink:href)\s*=\s*(?:"\s*(?:javascript|data:text\/html):[^"]*"|'\s*(?:javascript|data:text\/html):[^']*'|\s*(?:javascript|data:text\/html):[^\s>]+)/gi,
    '$1="#"'
  );
  html = html.replace(/expression\s*\(/gi, "");
  return html.trim();
}

function getDynamic(state, id) {
  const key = String(id || "").replace(/^dynamic\./, "");
  const item = state.dynamics.find((entry) => entry && entry.id === key);
  if (!item) throw new Error(`Unknown dynamic slot: ${id}`);
  return item;
}

async function callTool(name, args = {}) {
  if (name === "inspect_page") {
    const state = await readState();
    return {
      schema: state.schema ?? 1,
      meta: state.meta || {},
      theme: {
        mode: state.theme?.mode || "dark",
        texture: state.theme?.texture || "asanoha",
        tokens: state.theme?.tokens?.[state.theme?.mode || "dark"] || {},
        styles: state.theme?.styles || {},
      },
      content: state.content || {},
      dynamics: state.dynamics.map((item) => ({
        ...item,
        filled: Boolean(item.html && String(item.html).trim()),
      })),
      styles: state.styles || {},
      nodes: state.nodeState || {},
      guide: {
        dynamic:
          "Each dynamics[] entry has fixed position {x,y} and size {width,height}. Fill the empty html with fill_dynamic; do not move the box.",
        style:
          "set_style merges camelCase overrides at base/tablet/mobile. Set a property to null to remove it.",
        export: "export_content returns the same document that the editor downloads.",
        file: contentPath,
      },
    };
  }

  if (name === "set_style") {
    const nodeId = String(args.nodeId || "").trim();
    if (!nodeId) throw new Error("nodeId is required");
    if (!args.styles || typeof args.styles !== "object" || Array.isArray(args.styles)) {
      throw new Error("styles must be an object");
    }
    const breakpoint = ["base", "tablet", "mobile"].includes(args.breakpoint)
      ? args.breakpoint
      : "base";
    const state = await readState();
    state.styles = state.styles || {};
    const entry = state.styles[nodeId] || {};
    entry[breakpoint] = { ...(entry[breakpoint] || {}), ...args.styles };
    for (const [key, value] of Object.entries(entry[breakpoint])) {
      if (value === null) delete entry[breakpoint][key];
    }
    if (!Object.keys(entry[breakpoint]).length) delete entry[breakpoint];
    if (Object.keys(entry).length) state.styles[nodeId] = entry;
    else delete state.styles[nodeId];
    await writeState(state);
    return { nodeId, breakpoint, styles: entry[breakpoint] || {} };
  }

  if (name === "replace_asset") {
    const nodeId = String(args.nodeId || "").trim();
    const src = String(args.src || "").trim();
    if (!nodeId) throw new Error("nodeId is required");
    if (!src) throw new Error("src is required");
    if (src.length > 2_800_000) throw new Error("src is limited to 2.8 MB");
    if (/^javascript:/i.test(src) || /^data:text\/html/i.test(src)) {
      throw new Error("unsupported image source");
    }
    const state = await readState();
    state.assets = state.assets || {};
    state.assets.instances = state.assets.instances || {};
    state.assets.instances[nodeId] = {
      ...(state.assets.instances[nodeId] || {}),
      src,
      ...(typeof args.alt === "string" ? { alt: args.alt } : {}),
    };
    if (typeof args.alt === "string") {
      state.nodeState = state.nodeState || {};
      state.nodeState[nodeId] = state.nodeState[nodeId] || {};
      state.nodeState[nodeId].image = {
        ...(state.nodeState[nodeId].image || {}),
        alt: args.alt,
      };
    }
    await writeState(state);
    return { nodeId, src, alt: args.alt ?? state.assets.instances[nodeId].alt ?? "" };
  }

  if (name === "fill_dynamic") {
    const state = await readState();
    const item = getDynamic(state, args.id);
    item.html = sanitizeHtml(args.html ?? "");
    if (typeof args.description === "string" && args.description.trim()) {
      item.description = args.description.trim();
    }
    await writeState(state);
    return {
      id: item.id,
      section: item.section,
      description: item.description,
      position: item.position,
      size: item.size,
      html: item.html,
      filled: Boolean(item.html),
    };
  }

  if (name === "export_content") {
    return readState();
  }

  throw new Error(`Unknown tool: ${name}`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return;
  const { id, method, params = {} } = message;

  if (method === "initialize") {
    const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL;
    return result(id, {
      protocolVersion: requested,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "tenugui-mcp",
        version: "1.0.0",
        description: "Local MCP server for TenuGUI. Reads and writes content.json.",
      },
    });
  }

  if (method === "ping" || method === "shutdown") return result(id, {});
  if (method.startsWith("notifications/")) return;

  if (method === "tools/list") return result(id, { tools: TOOLS });

  if (method === "tools/call") {
    const name = params.name;
    const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
    try {
      const value = await callTool(name, args);
      return result(id, {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
        isError: false,
      });
    } catch (err) {
      return result(id, {
        content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      });
    }
  }

  if (method === "resources/list") return result(id, { resources: [] });
  if (method === "prompts/list") return result(id, { prompts: [] });
  return error(id, -32601, `Method not found: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let closed = false;
let pending = 0;

function finishIfIdle() {
  if (!closed || pending > 0) return;
  setImmediate(() => process.exit(0));
}

let queue = Promise.resolve();

async function processLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    error(null, -32700, "Parse error");
    return;
  }
  try {
    await handle(message);
  } catch (err) {
    if (message?.id != null) error(message.id, -32603, err?.message || "Internal error");
  }
}

rl.on("line", (line) => {
  pending += 1;
  queue = queue
    .then(() => processLine(line))
    .catch(() => {})
    .finally(() => {
      pending -= 1;
      finishIfIdle();
    });
});
rl.on("close", () => {
  closed = true;
  finishIfIdle();
});
