// Lustify CRM — Telegram Web Sidebar
// Injected into web.telegram.org as a content script.
// Communicates with background.js via chrome.runtime.sendMessage.

"use strict";

// ─── Constants ───────────────────────────────────────────────────────────────

const CRM_SIDEBAR_ID = "crm-sidebar-root";
const SIDEBAR_WIDTH = "300px";
const DEBOUNCE_MS = 400;

const LABELS = [
  { key: "label:vip", display: "VIP", color: "#fbbf24", bg: "#3a2800" },
  {
    key: "label:hot_lead",
    display: "Hot Lead",
    color: "#f87171",
    bg: "#3a0000",
  },
  {
    key: "label:warm_lead",
    display: "Warm Lead",
    color: "#fb923c",
    bg: "#3a1200",
  },
  { key: "label:buyer", display: "Buyer", color: "#34d399", bg: "#002a1a" },
  {
    key: "label:repeat_buyer",
    display: "Repeat Buyer",
    color: "#60a5fa",
    bg: "#001a3a",
  },
];

// ─── State ────────────────────────────────────────────────────────────────────

let contactsCache = []; // cached contacts list from CRM
let currentUsername = null; // currently detected @username (lowercased, no @)
let currentProfile = null; // currently displayed ContactProfile
let sidebarVisible = false;
let debounceTimer = null;
let shadowRoot = null; // Shadow DOM root

// ─── Background messaging ─────────────────────────────────────────────────────

function send(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(res);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

// ─── Telegram DOM detection ───────────────────────────────────────────────────

/**
 * Attempt to extract the @username of the currently open conversation.
 * Supports both Telegram Web Z (React) and Web K.
 * Returns lowercase username without @, or null if not detected.
 */
function detectCurrentUsername() {
  // Strategy 1: subtitle element often shows "@username"
  const subtitleSelectors = [
    ".chat-info .status", // Web Z
    ".chat-info-subtitle", // Web Z alt
    ".ChatInfo .status", // Web K
    ".peer-title + .status", // Web K alt
    "[class*='ChatInfo'] .subtitle", // generic
    ".TopBar .subtitle",
    ".right-header .subtitle",
  ];
  for (const sel of subtitleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.textContent.trim();
      const match = text.match(/@([\w.]+)/);
      if (match) return match[1].toLowerCase();
    }
  }

  // Strategy 2: data-peer-id on the chat column
  const peerEl = document.querySelector("[data-peer-id]");
  if (peerEl) {
    // peer-id alone can't give us username, but we store it for possible CRM telegram_id lookup
    // Return null here — we'll try name matching as fallback
  }

  // Strategy 3: title text (use as fallback name)
  return null;
}

/**
 * Attempt to extract the display name of the current conversation.
 */
function detectCurrentName() {
  const nameSelectors = [
    ".chat-info .peer-title", // Web Z
    ".chat-info h3",
    ".ChatInfo .title", // Web K
    ".chat-title .title",
    ".TopBar .title",
    "[class*='ChatInfo'] .title",
  ];
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) {
      return el.textContent.trim();
    }
  }
  return null;
}

/**
 * Attempt to extract data-peer-id from the page.
 */
function detectPeerId() {
  const el = document.querySelector("[data-peer-id]");
  return el ? el.getAttribute("data-peer-id") : null;
}

// ─── Contact lookup ───────────────────────────────────────────────────────────

async function refreshContactsCache() {
  const res = await send({ type: "GET_CONTACTS" });
  if (res && res.ok && Array.isArray(res.data)) {
    contactsCache = res.data;
  }
}

function findContactByUsername(username) {
  if (!username) return null;
  const clean = username.toLowerCase().replace(/^@/, "");
  return (
    contactsCache.find((c) => {
      const u = String(c.username || "")
        .toLowerCase()
        .replace(/^@/, "");
      return u === clean;
    }) || null
  );
}

function findContactByName(name) {
  if (!name) return null;
  const clean = name.toLowerCase().trim();
  return (
    contactsCache.find(
      (c) =>
        String(c.name || "")
          .toLowerCase()
          .trim() === clean,
    ) || null
  );
}

async function lookupCRMContact() {
  const gen = ++lookupCRMContact._generation;
  const username = detectCurrentUsername();
  const name = detectCurrentName();
  const peerId = detectPeerId();

  // Skip if nothing changed
  const key = (username || "") + "|" + (name || "") + "|" + (peerId || "");
  if (lookupCRMContact._lastKey === key) return;
  lookupCRMContact._lastKey = key;

  currentProfile = null;
  currentUsername = username;

  if (!username && !name) {
    renderSidebar(null, null);
    return;
  }

  // Refresh cache periodically — but only if it's stale
  if (contactsCache.length === 0) {
    await refreshContactsCache();
    if (gen !== lookupCRMContact._generation) return;
  }

  // Try username first, then name
  let chat = username ? findContactByUsername(username) : null;
  if (!chat && name) chat = findContactByName(name);

  if (!chat) {
    renderSidebar(null, { username, name, peerId });
    return;
  }

  // Fetch full profile
  const res = await send({
    type: "GET_CONTACT",
    body: { contactId: String(chat.id) },
  });
  if (gen !== lookupCRMContact._generation) return;
  if (res && res.ok && res.data) {
    currentProfile = res.data;
    renderSidebar(res.data, null);
  } else {
    renderSidebar(null, { username, name, peerId });
  }
}
lookupCRMContact._lastKey = "";
lookupCRMContact._generation = 0;

// ─── Sidebar Shell ────────────────────────────────────────────────────────────

function ensureSidebarRoot() {
  if (document.getElementById(CRM_SIDEBAR_ID)) return;

  const host = document.createElement("div");
  host.id = CRM_SIDEBAR_ID;
  host.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${SIDEBAR_WIDTH};
    height: 100vh;
    z-index: 99999;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  document.body.appendChild(host);

  shadowRoot = host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = `<style>${getSidebarCSS()}</style><div id="sb-wrap"></div>`;
}

function getSidebarWrap() {
  return shadowRoot ? shadowRoot.getElementById("sb-wrap") : null;
}

// ─── Toggle button ────────────────────────────────────────────────────────────

function ensureToggleBtn() {
  if (document.getElementById("crm-sidebar-toggle")) return;
  const btn = document.createElement("button");
  btn.id = "crm-sidebar-toggle";
  btn.title = "Toggle CRM Sidebar";
  btn.innerHTML = "💼";
  btn.style.cssText = `
    position: fixed;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 100000;
    background: #7c3aed;
    color: #fff;
    border: 0;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(124,58,237,0.5);
    transition: background 0.2s;
    pointer-events: all;
  `;
  btn.addEventListener("click", () => {
    sidebarVisible = !sidebarVisible;
    const wrap = getSidebarWrap();
    if (wrap) {
      wrap.style.display = sidebarVisible ? "flex" : "none";
    }
    btn.style.background = sidebarVisible ? "#6d28d9" : "#7c3aed";
    btn.style.right = sidebarVisible
      ? parseInt(SIDEBAR_WIDTH) + 8 + "px"
      : "8px";
  });
  document.body.appendChild(btn);
}

// ─── CSS (injected into Shadow DOM) ──────────────────────────────────────────

function getSidebarCSS() {
  return `
    :host { all: initial; }
    #sb-wrap {
      display: none;
      flex-direction: column;
      width: ${SIDEBAR_WIDTH};
      height: 100vh;
      background: #0f0f12;
      border-left: 1px solid #1f1f23;
      overflow-y: auto;
      pointer-events: all;
      box-sizing: border-box;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .sb-header {
      padding: 12px 14px;
      background: #13131a;
      border-bottom: 1px solid #1f1f23;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .sb-header-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #7c3aed; }
    .sb-refresh-btn { background: transparent; border: 0; color: #8a8a93; font-size: 14px; cursor: pointer; padding: 0 4px; }
    .sb-refresh-btn:hover { color: #c4b5fd; }
    .sb-card {
      padding: 14px;
      border-bottom: 1px solid #1f1f23;
    }
    .sb-name { font-size: 15px; font-weight: 700; color: #e7e7ea; margin-bottom: 2px; }
    .sb-username { font-size: 12px; color: #8a8a93; margin-bottom: 8px; }
    .sb-stats { display: flex; gap: 10px; margin-top: 8px; }
    .sb-stat { flex: 1; background: #15151a; border-radius: 6px; padding: 6px 8px; }
    .sb-stat-val { font-size: 14px; font-weight: 700; color: #e7e7ea; }
    .sb-stat-label { font-size: 9px; text-transform: uppercase; color: #6b6b75; letter-spacing: 0.5px; }
    .sb-section { padding: 10px 14px; border-bottom: 1px solid #1f1f23; }
    .sb-section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b6b75; margin-bottom: 6px; }
    .sb-row { font-size: 11px; color: #c4c4cc; margin-bottom: 3px; }
    .sb-empty { font-size: 11px; color: #4b4b55; font-style: italic; }
    .label-pill {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;
      margin: 2px;
    }
    .label-pill-x {
      background: transparent; border: 0; cursor: pointer;
      font-size: 12px; padding: 0; opacity: 0.75; color: inherit;
    }
    .label-pill-x:hover { opacity: 1; }
    .label-add-btn {
      display: inline-flex; align-items: center;
      padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 500;
      cursor: pointer; border: 1px dashed; background: transparent;
      margin: 2px; font-family: inherit;
    }
    .label-add-btn:hover { opacity: 0.8; }
    .label-badges { display: flex; flex-wrap: wrap; gap: 2px; }
    .tag-pill { display: inline-block; padding: 1px 6px; background: #1e1b4b; color: #c4b5fd; border-radius: 4px; font-size: 10px; margin: 2px; }
    .sb-actions { padding: 10px 14px; border-bottom: 1px solid #1f1f23; display: flex; flex-direction: column; gap: 6px; }
    .sb-action-btn {
      background: #1a1a24; border: 1px solid #2a2a30; color: #c4c4cc;
      border-radius: 6px; padding: 7px 12px; font-size: 11px; font-weight: 500;
      cursor: pointer; text-align: left; width: 100%; font-family: inherit;
    }
    .sb-action-btn:hover { border-color: #7c3aed; color: #c4b5fd; background: #1e1b4b; }
    .sb-action-btn.primary { background: #7c3aed; border-color: #7c3aed; color: #fff; }
    .sb-action-btn.primary:hover { background: #6d28d9; }
    .sb-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .sb-form { display: flex; flex-direction: column; gap: 6px; padding: 8px 14px; border-bottom: 1px solid #1f1f23; background: #0b0b0e; }
    .sb-form-title { font-size: 10px; font-weight: 600; color: #8a8a93; text-transform: uppercase; letter-spacing: 0.5px; }
    .sb-form-input {
      background: #15151a; border: 1px solid #2a2a30; color: #e7e7ea;
      border-radius: 4px; padding: 6px 8px; font: 11px/1.4 inherit; width: 100%;
    }
    .sb-form-input:focus { outline: none; border-color: #7c3aed; }
    .sb-form-textarea { resize: vertical; min-height: 48px; }
    .sb-form-row { display: flex; gap: 6px; }
    .sb-form-submit {
      background: #7c3aed; color: #fff; border: 0; border-radius: 4px;
      padding: 6px 12px; font: 11px/1 inherit; cursor: pointer;
    }
    .sb-form-submit:hover { background: #6d28d9; }
    .sb-form-cancel { background: transparent; border: 1px solid #2a2a30; color: #8a8a93; border-radius: 4px; padding: 6px 10px; font: 11px/1 inherit; cursor: pointer; }
    .sb-form-cancel:hover { color: #e7e7ea; }
    .sb-form-err { font-size: 10px; color: #f87171; min-height: 0; }
    .sb-form-ok  { font-size: 10px; color: #86efac; min-height: 0; }
    .sb-not-found {
      padding: 20px 14px; text-align: center; display: flex; flex-direction: column;
      align-items: center; gap: 10px;
    }
    .sb-not-found-icon { font-size: 28px; }
    .sb-not-found-name { font-size: 13px; font-weight: 600; color: #e7e7ea; }
    .sb-not-found-sub  { font-size: 11px; color: #6b6b75; }
    .tl-event { display: flex; gap: 6px; padding: 5px 0; border-bottom: 1px solid #1a1a20; font-size: 10px; }
    .tl-event:last-child { border-bottom: 0; }
    .tl-icon { flex-shrink: 0; }
    .tl-meta { color: #6b6b75; }
    .tl-text { color: #c4c4cc; margin-top: 1px; white-space: pre-wrap; word-break: break-word; }
    .sb-purchase-row { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; color: #c4c4cc; }
    .sb-purchase-amount { color: #34d399; font-weight: 600; }
    .sb-loading { padding: 20px 14px; text-align: center; color: #4b4b55; font-size: 12px; }
  `;
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (_) {
    return String(ts);
  }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ─── Main render ──────────────────────────────────────────────────────────────

function renderSidebar(profile, notFound) {
  const wrap = getSidebarWrap();
  if (!wrap) return;
  wrap.innerHTML = "";

  // Header
  const hdr = el("div", "sb-header");
  const htitle = el("span", "sb-header-title", "💼 CRM");
  const refreshBtn = el("button", "sb-refresh-btn", "↺");
  refreshBtn.title = "Refresh";
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.textContent = "⟳";
    refreshBtn.disabled = true;
    contactsCache = [];
    lookupCRMContact._lastKey = "";
    await lookupCRMContact();
    refreshBtn.disabled = false;
    refreshBtn.textContent = "↺";
  });
  hdr.appendChild(htitle);
  hdr.appendChild(refreshBtn);
  wrap.appendChild(hdr);

  if (profile) {
    renderContactCard(wrap, profile);
    renderLabelsSection(wrap, profile);
    renderTagsSection(wrap, profile);
    renderNotesSection(wrap, profile);
    renderRevenueSection(wrap, profile);
    renderPurchasesSection(wrap, profile);
    renderRecentActivitySection(wrap, profile);
    renderQuickActions(wrap, profile);
  } else {
    renderNotFound(wrap, notFound);
  }
}

function renderContactCard(wrap, profile) {
  const card = el("div", "sb-card");

  const name = el("div", "sb-name", profile.name || "Unknown");
  const username = el("div", "sb-username", profile.username || "");
  card.appendChild(name);
  card.appendChild(username);

  // Stats row
  const stats = el("div", "sb-stats");

  const revStat = el("div", "sb-stat");
  revStat.innerHTML = `<div class="sb-stat-val">$${Number(profile.revenue || 0).toFixed(0)}</div><div class="sb-stat-label">Revenue</div>`;

  const ppvStat = el("div", "sb-stat");
  ppvStat.innerHTML = `<div class="sb-stat-val">${profile.ppvCount || 0}</div><div class="sb-stat-label">PPV</div>`;

  const scoreStat = el("div", "sb-stat");
  scoreStat.innerHTML = `<div class="sb-stat-val">${profile.fanScore || 0}</div><div class="sb-stat-label">Score</div>`;

  stats.appendChild(revStat);
  stats.appendChild(ppvStat);
  stats.appendChild(scoreStat);
  card.appendChild(stats);

  wrap.appendChild(card);
}

function renderLabelsSection(wrap, profile) {
  const section = el("div", "sb-section");
  section.appendChild(el("div", "sb-section-title", "Labels"));

  const tags = Array.isArray(profile.tags) ? profile.tags : [];
  const active = LABELS.filter((l) => tags.includes(l.key));
  const inactive = LABELS.filter((l) => !tags.includes(l.key));

  const badges = el("div", "label-badges");

  for (const lbl of active) {
    const pill = document.createElement("span");
    pill.className = "label-pill";
    pill.style.cssText = `color:${lbl.color};background:${lbl.bg};`;
    const txt = document.createElement("span");
    txt.textContent = lbl.display;
    const x = document.createElement("button");
    x.className = "label-pill-x";
    x.style.color = lbl.color;
    x.textContent = "×";
    x.title = "Remove";
    x.addEventListener("click", async () => {
      x.disabled = true;
      await sidebarToggleLabel(profile.id, lbl.key, false);
    });
    pill.appendChild(txt);
    pill.appendChild(x);
    badges.appendChild(pill);
  }

  for (const lbl of inactive) {
    const addBtn = document.createElement("button");
    addBtn.className = "label-add-btn";
    addBtn.style.cssText = `color:${lbl.color};border-color:${lbl.color};`;
    addBtn.textContent = "+ " + lbl.display;
    addBtn.addEventListener("click", async () => {
      addBtn.disabled = true;
      await sidebarToggleLabel(profile.id, lbl.key, true);
    });
    badges.appendChild(addBtn);
  }

  if (active.length === 0 && inactive.length === 0) {
    badges.appendChild(el("span", "sb-empty", "No labels"));
  }

  section.appendChild(badges);
  wrap.appendChild(section);
}

function renderTagsSection(wrap, profile) {
  const section = el("div", "sb-section");
  section.appendChild(el("div", "sb-section-title", "Tags"));

  const tags = (Array.isArray(profile.tags) ? profile.tags : []).filter(
    (t) => !t.startsWith("label:"),
  );

  if (tags.length === 0) {
    section.appendChild(el("span", "sb-empty", "No tags"));
  } else {
    for (const t of tags) {
      section.appendChild(el("span", "tag-pill", t));
    }
  }
  wrap.appendChild(section);
}

function renderNotesSection(wrap, profile) {
  const section = el("div", "sb-section");
  section.appendChild(el("div", "sb-section-title", "Notes"));
  const notes = String(profile.notes || "").trim();
  if (notes) {
    const noteEl = el("div", "sb-row");
    noteEl.style.whiteSpace = "pre-wrap";
    noteEl.style.fontSize = "11px";
    noteEl.style.color = "#c4c4cc";
    noteEl.style.maxHeight = "80px";
    noteEl.style.overflow = "hidden auto";
    noteEl.textContent = notes;
    section.appendChild(noteEl);
  } else {
    section.appendChild(el("span", "sb-empty", "No notes"));
  }
  wrap.appendChild(section);
}

function renderRevenueSection(wrap, profile) {
  const section = el("div", "sb-section");
  section.appendChild(el("div", "sb-section-title", "Revenue"));

  const rows = [
    ["Total Spent", "$" + Number(profile.totalSpent || 0).toFixed(2)],
    ["Revenue", "$" + Number(profile.revenue || 0).toFixed(2)],
    ["Fan Status", profile.fanStatus || "—"],
    ["VIP Level", profile.vipLevel || "—"],
    [
      "Last Purchase",
      profile.lastPurchaseDate ? formatDate(profile.lastPurchaseDate) : "—",
    ],
  ];

  for (const [label, value] of rows) {
    const row = el("div", "sb-row");
    const labelSpan = document.createElement("span");
    labelSpan.style.color = "#6b6b75";
    labelSpan.textContent = `${label}: `;
    row.appendChild(labelSpan);
    row.appendChild(document.createTextNode(value));
    section.appendChild(row);
  }
  wrap.appendChild(section);
}

function renderPurchasesSection(wrap, profile) {
  const section = el("div", "sb-section");
  section.appendChild(el("div", "sb-section-title", "Purchases"));

  const purchases = Array.isArray(profile.purchases)
    ? profile.purchases.slice(0, 5)
    : [];
  if (purchases.length === 0) {
    section.appendChild(el("span", "sb-empty", "No purchases"));
  } else {
    for (const p of purchases) {
      const row = el("div", "sb-purchase-row");
      const dateSpan = document.createElement("span");
      dateSpan.textContent = formatDate(p.purchaseDate);
      const amountSpan = document.createElement("span");
      amountSpan.className = "sb-purchase-amount";
      amountSpan.textContent = "$" + Number(p.amount).toFixed(2);
      row.appendChild(dateSpan);
      row.appendChild(amountSpan);
      section.appendChild(row);
    }
  }
  wrap.appendChild(section);
}

function renderRecentActivitySection(wrap, profile) {
  // We'll load timeline lazily when section is visible
  const section = el("div", "sb-section");
  section.appendChild(el("div", "sb-section-title", "Recent Activity"));

  const loading = el("div", "sb-loading", "Loading…");
  section.appendChild(loading);
  wrap.appendChild(section);

  // Async load
  send({
    type: "GET_TIMELINE",
    body: { contactId: String(profile.id), limit: 5 },
  }).then((res) => {
    const events =
      res && res.ok && Array.isArray(res.data) ? res.data.slice(0, 5) : [];
    section.removeChild(loading);
    if (events.length === 0) {
      section.appendChild(el("span", "sb-empty", "No activity yet"));
    } else {
      const TL_ICONS = {
        message_in: "📨",
        message_out: "📤",
        purchase: "💰",
        note: "📝",
        tag_added: "🏷️",
        tag_removed: "❌",
      };
      for (const ev of events) {
        const row = el("div", "tl-event");
        const icon = el("span", "tl-icon", TL_ICONS[ev.type] || "•");
        const body = el("div");
        const meta = el(
          "div",
          "tl-meta",
          (ev.type || "") +
            (ev.timestamp ? " · " + formatDate(ev.timestamp) : ""),
        );
        body.appendChild(meta);
        if (ev.text)
          body.appendChild(el("div", "tl-text", String(ev.text).slice(0, 80)));
        row.appendChild(icon);
        row.appendChild(body);
        section.appendChild(row);
      }
    }
  });
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function renderQuickActions(wrap, profile) {
  const section = el("div", "sb-actions");
  section.appendChild(el("div", "sb-section-title", "Quick Actions"));

  const addNoteBtn = el("button", "sb-action-btn", "📝 Add Note");
  addNoteBtn.addEventListener("click", () => renderAddNoteForm(wrap, profile));
  section.appendChild(addNoteBtn);

  const addFollowupBtn = el("button", "sb-action-btn", "📅 Add Follow-up");
  addFollowupBtn.addEventListener("click", () =>
    renderAddFollowupForm(wrap, profile),
  );
  section.appendChild(addFollowupBtn);

  const openBtn = el("button", "sb-action-btn primary", "↗ Open in CRM");
  openBtn.addEventListener("click", () => {
    window.open(
      "http://localhost:3000/?contact=" +
        encodeURIComponent(String(profile.id)),
      "_blank",
      "noopener",
    );
  });
  section.appendChild(openBtn);

  wrap.appendChild(section);
}

function renderAddNoteForm(wrap, profile) {
  const existing = shadowRoot.getElementById("sb-add-note-form");
  if (existing) {
    existing.remove();
    return;
  }

  const form = el("div", "sb-form");
  form.id = "sb-add-note-form";
  form.appendChild(el("div", "sb-form-title", "Add Note"));

  const textarea = document.createElement("textarea");
  textarea.className = "sb-form-input sb-form-textarea";
  textarea.placeholder = "Write a note…";
  form.appendChild(textarea);

  const errEl = el("div", "sb-form-err");
  const okEl = el("div", "sb-form-ok");
  form.appendChild(errEl);
  form.appendChild(okEl);

  const btnRow = el("div", "sb-form-row");
  const submit = el("button", "sb-form-submit", "Save");
  const cancel = el("button", "sb-form-cancel", "Cancel");
  cancel.addEventListener("click", () => form.remove());
  submit.addEventListener("click", async () => {
    const content = textarea.value.trim();
    if (!content) {
      errEl.textContent = "Note cannot be empty.";
      return;
    }
    errEl.textContent = "";
    submit.disabled = true;
    const res = await send({
      type: "ADD_NOTE",
      body: { contactId: String(profile.id), content },
    });
    submit.disabled = false;
    if (res && res.ok) {
      okEl.textContent = "Note saved!";
      textarea.value = "";
      // Refresh profile
      refreshSidebarProfile(profile.id);
      setTimeout(() => form.remove(), 1200);
    } else {
      errEl.textContent = "Failed to save note.";
    }
  });
  btnRow.appendChild(submit);
  btnRow.appendChild(cancel);
  form.appendChild(btnRow);

  // Insert after actions section
  wrap.appendChild(form);
  textarea.focus();
}

function renderAddFollowupForm(wrap, profile) {
  const existing = shadowRoot.getElementById("sb-add-followup-form");
  if (existing) {
    existing.remove();
    return;
  }

  const form = el("div", "sb-form");
  form.id = "sb-add-followup-form";
  form.appendChild(el("div", "sb-form-title", "Add Follow-up"));

  const msgInput = document.createElement("textarea");
  msgInput.className = "sb-form-input sb-form-textarea";
  msgInput.placeholder = "Follow-up message…";
  form.appendChild(msgInput);

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "sb-form-input";
  dateInput.value = new Date().toISOString().slice(0, 10);
  form.appendChild(dateInput);

  const errEl = el("div", "sb-form-err");
  const okEl = el("div", "sb-form-ok");
  form.appendChild(errEl);
  form.appendChild(okEl);

  const btnRow = el("div", "sb-form-row");
  const submit = el("button", "sb-form-submit", "Schedule");
  const cancel = el("button", "sb-form-cancel", "Cancel");
  cancel.addEventListener("click", () => form.remove());
  submit.addEventListener("click", async () => {
    const message = msgInput.value.trim();
    const scheduledAt = dateInput.value;
    if (!message) {
      errEl.textContent = "Message is required.";
      return;
    }
    if (!scheduledAt) {
      errEl.textContent = "Date is required.";
      return;
    }
    errEl.textContent = "";
    submit.disabled = true;
    const res = await send({
      type: "CREATE_FOLLOWUP",
      body: { contactId: String(profile.id), message, scheduledAt },
    });
    submit.disabled = false;
    if (res && res.ok) {
      okEl.textContent = "Follow-up scheduled!";
      setTimeout(() => form.remove(), 1200);
    } else {
      errEl.textContent = "Failed to schedule.";
    }
  });
  btnRow.appendChild(submit);
  btnRow.appendChild(cancel);
  form.appendChild(btnRow);

  wrap.appendChild(form);
  msgInput.focus();
}

// ─── Not Found state ──────────────────────────────────────────────────────────

function renderNotFound(wrap, info) {
  const section = el("div", "sb-not-found");
  section.appendChild(el("div", "sb-not-found-icon", "👤"));
  if (info && (info.name || info.username)) {
    section.appendChild(
      el("div", "sb-not-found-name", info.name || "@" + info.username),
    );
    section.appendChild(el("div", "sb-not-found-sub", "Not found in CRM"));
  } else {
    section.appendChild(
      el("div", "sb-not-found-sub", "Open a conversation to see CRM data"),
    );
  }
  wrap.appendChild(section);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function sidebarToggleLabel(contactId, labelKey, add) {
  const type = add ? "ADD_TAG" : "DELETE_TAG";
  const res = await send({
    type,
    body: { contactId: String(contactId), name: labelKey },
  });
  if (res && res.ok) {
    await refreshSidebarProfile(contactId);
  }
}

async function refreshSidebarProfile(contactId) {
  // Verify the current conversation still matches this contact
  const curName = detectCurrentName();
  const curUser = detectCurrentUsername();
  const curPeerId = detectPeerId();
  const curKey = (curUser || "") + "|" + (curName || "") + "|" + (curPeerId || "");
  if (lookupCRMContact._lastKey && lookupCRMContact._lastKey !== curKey) return;
  const res = await send({
    type: "GET_CONTACT",
    body: { contactId: String(contactId) },
  });
  if (lookupCRMContact._lastKey && lookupCRMContact._lastKey !== curKey) return;
  if (res && res.ok && res.data) {
    currentProfile = res.data;
    // Refresh contacts cache entry too
    const idx = contactsCache.findIndex(
      (c) => String(c.id) === String(contactId),
    );
    if (idx !== -1)
      contactsCache[idx] = { ...contactsCache[idx], tags: res.data.tags };
    renderSidebar(res.data, null);
  }
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

function onDOMChange() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    await lookupCRMContact();
  }, DEBOUNCE_MS);
}

function startObserver() {
  const observer = new MutationObserver(onDOMChange);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: false,
    attributes: false,
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  // Pre-load contacts cache
  await refreshContactsCache();

  ensureSidebarRoot();
  ensureToggleBtn();

  // Initial lookup
  await lookupCRMContact();

  // Watch for DOM changes (chat navigation)
  startObserver();
}

// Defer until DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
