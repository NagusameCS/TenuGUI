import { esc } from "./utils.js";
import { icon } from "./icons.js";

export function toast(message, { tone = "accent", iconName = "info", timeout = 3200 } = {}) {
  const region = document.getElementById("toast-region");
  if (!region) return () => {};
  const el = document.createElement("div");
  el.className = `toast${tone ? ` is-${tone}` : ""}`;
  el.innerHTML = `${icon(iconName, { size: 16 })}<span>${esc(message)}</span>`;
  region.appendChild(el);
  while (region.children.length > 3) region.firstElementChild?.remove();
  let gone = false;
  const remove = () => {
    if (gone) return;
    gone = true;
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 150);
  };
  const timer = setTimeout(remove, timeout);
  el.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
  return remove;
}

export function dialog({
  title = "",
  subtitle = "",
  body = "",
  footer = "",
  className = "",
  closable = true,
  onMount,
  onClose,
} = {}) {
  const el = document.createElement("dialog");
  el.className = `dialog ${className}`.trim();
  el.innerHTML = `
    <div class="dialog-head">
      <div>
        <div class="dialog-title">${esc(title)}</div>
        ${subtitle ? `<div class="dialog-subtitle">${esc(subtitle)}</div>` : ""}
      </div>
      ${
        closable
          ? `<button type="button" class="icon-btn dialog-close" aria-label="Close dialog">${icon("close", {
              size: 18,
            })}</button>`
          : ""
      }
    </div>
    <div class="dialog-body">${body}</div>
    ${footer ? `<div class="dialog-foot">${footer}</div>` : ""}
  `;
  const root = document.getElementById("dialog-root") || document.body;
  root.appendChild(el);
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    try {
      el.close?.();
    } catch {}
    el.remove();
    onClose?.();
  };
  const close = () => cleanup();
  el.addEventListener("click", (event) => {
    if (event.target.closest("[data-dialog-close]")) {
      event.preventDefault();
      close();
    }
  });
  el.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  el.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  el.addEventListener("close", cleanup);
  try {
    el.showModal();
  } catch {
    el.setAttribute("open", "");
  }
  const first = el.querySelector(
    "input:not([type=hidden]):not([type=file]), textarea, select, button:not(.dialog-close), [contenteditable]"
  );
  setTimeout(() => first?.focus(), 30);
  onMount?.(el, close);
  return { el, close, bodyEl: el.querySelector(".dialog-body"), footEl: el.querySelector(".dialog-foot") };
}

export function confirmDialog({
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  iconName = "warning",
  extra = "",
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const d = dialog({
      title,
      body: `<div class="notice ${danger ? "is-danger" : ""}">${icon(iconName, {
        size: 18,
      })}<div>${message}</div></div>${extra}`,
      footer: `<button type="button" class="btn btn-ghost btn-sm" data-cancel>${esc(
        cancelLabel
      )}</button><button type="button" class="btn ${
        danger ? "btn-danger" : "btn-primary"
      } btn-sm" data-confirm>${esc(confirmLabel)}</button>`,
      className: "confirm-dialog",
      onClose: () => settle(false),
    });
    d.el.querySelector("[data-cancel]").addEventListener("click", () => {
      settle(false);
      d.close();
    });
    d.el.querySelector("[data-confirm]").addEventListener("click", () => {
      settle(true);
      d.close();
    });
    setTimeout(() => d.el.querySelector("[data-confirm]")?.focus(), 40);
  });
}

export function promptDialog({
  title = "Enter a value",
  label = "Value",
  value = "",
  placeholder = "",
  confirmLabel = "Save",
  hint = "",
}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const d = dialog({
      title,
      body: `<div class="field">
        <label class="field-label" for="prompt-input">${esc(label)}</label>
        <input class="input" id="prompt-input" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
        ${hint ? `<div class="field-hint">${esc(hint)}</div>` : ""}
      </div>`,
      footer: `<button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancel</button><button type="button" class="btn btn-primary btn-sm" data-confirm>${esc(
        confirmLabel
      )}</button>`,
      onClose: () => settle(null),
      onMount: (el) => {
        const input = el.querySelector("#prompt-input");
        const submit = () => {
          const v = input.value.trim();
          settle(v || null);
          d.close();
        };
        el.querySelector("[data-confirm]").addEventListener("click", submit);
        el.querySelector("[data-cancel]").addEventListener("click", () => {
          settle(null);
          d.close();
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        });
        setTimeout(() => {
          input.focus();
          input.select();
        }, 40);
      },
    });
  });
}

export function dialogFormRow(label, control, hint = "") {
  return `<div class="field"><label class="field-label">${esc(label)}</label>${control}${
    hint ? `<div class="field-hint">${esc(hint)}</div>` : ""
  }</div>`;
}
