const CRM_BASE = "http://localhost:3000";

let allContacts = [];
let searchTerm = "";
let selectedContact = null;
let currentDetailsId = null;
let currentProfile = null;
let editMode = false;
let editFields = null;

let followupsData = null;
let followupsLoaded = false;
let followupsOpen = false;

let historyCache = {};
let historyOpen = false;
let historySearchTerm = "";

let campaignsLoaded = false;
let campaignCounts = null;
let campaignSelectedKey = null;
let campaignName = "";
let campaignMessage = "";
let campaignSending = false;
let campaignConfirming = false;

let templatesOpen = false;
let templatesView = "list";
let templatesEditId = null;

const TEMPLATE_CATEGORIES = [
  { key: "general",      label: "General" },
  { key: "sales",        label: "Sales" },
  { key: "followup",     label: "Follow-up" },
  { key: "reengagement", label: "Re-engage" },
  { key: "closing",      label: "Closing" },
];

const TEMPLATES_KEY = "crm_reply_templates";

const SNIPPETS_KEY = "crm_snippets";

const LABELS = [
  { key: "label:vip",          display: "VIP",          color: "#fbbf24", bg: "#3a2800" },
  { key: "label:hot_lead",     display: "Hot Lead",     color: "#f87171", bg: "#3a0000" },
  { key: "label:warm_lead",    display: "Warm Lead",    color: "#fb923c", bg: "#3a1200" },
  { key: "label:buyer",        display: "Buyer",        color: "#34d399", bg: "#002a1a" },
  { key: "label:repeat_buyer", display: "Repeat Buyer", color: "#60a5fa", bg: "#001a3a" },
];

let snippetsOpen = false;
let snippetsView = "list";
let snippetsEditId = null;
let snippetDropdownVisible = false;
let snippetDropdownIndex = -1;
let snippetDropdownFiltered = [];

const CAMPAIGN_SEGMENTS = [
  { key: "no_message_7d", title: "No Message 7d" },
  { key: "no_purchase_30d", title: "No Purchase 30d" },
  { key: "vip_inactive_14d", title: "VIP Inactive 14d" },
  { key: "high_spender_inactive", title: "High Spender Inactive" },
  { key: "no_ppv_30d", title: "No PPV 30d" },
  { key: "never_purchased", title: "Never Purchased" },
];

const dom = {
  status: document.getElementById("status"),
  content: document.getElementById("content"),
  selectedBar: document.getElementById("selectedBar"),
  detailsPanel: document.getElementById("detailsPanel"),
  sendForm: document.getElementById("sendForm"),
  sendText: document.getElementById("sendText"),
  sendBtn: document.getElementById("sendBtn"),
  sendMsg: document.getElementById("sendMsg"),
  newContact: document.getElementById("newContact"),
  fName: document.getElementById("fName"),
  fUser: document.getElementById("fUser"),
  fPhone: document.getElementById("fPhone"),
  createBtn: document.getElementById("createBtn"),
  formMsg: document.getElementById("formMsg"),
  followupsHeader: document.getElementById("followupsHeader"),
  followupsBody: document.getElementById("followupsBody"),
  followupsChevron: document.getElementById("followupsChevron"),
  campaignsHeader: document.getElementById("campaignsHeader"),
  campaignsBody: document.getElementById("campaignsBody"),
  campaignsChevron: document.getElementById("campaignsChevron"),
  templatesHeader: document.getElementById("templatesHeader"),
  templatesBody: document.getElementById("templatesBody"),
  templatesChevron: document.getElementById("templatesChevron"),
  snippetList: document.getElementById("snippetList"),
  snippetsHeader: document.getElementById("snippetsHeader"),
  snippetsBody: document.getElementById("snippetsBody"),
  snippetsChevron: document.getElementById("snippetsChevron"),
};

function injectStyles() {
  if (document.getElementById("popupExtraStyles")) return;
  const s = document.createElement("style");
  s.id = "popupExtraStyles";
  s.textContent =
    ".search{width:100%;box-sizing:border-box;background:#15151a;border:1px solid #2a2a30;color:#e7e7ea;border-radius:6px;padding:6px 10px;font:inherit;margin:0 0 6px 0;}" +
    ".search:focus{outline:none;border-color:#7c3aed;}" +
    "li .main{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}" +
    "li .top{display:flex;gap:6px;align-items:baseline;}" +
    "li .preview{color:#6b6b75;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;}" +
    ".empty-list{margin:0;}" +
    ".details{padding:8px 12px;border-top:1px solid #1f1f23;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:11px;}" +
    ".details .details-label{color:#6b6b75;}" +
    ".details .details-value{color:#e7e7ea;word-break:break-word;}" +
    ".details .details-tags{display:flex;flex-wrap:wrap;gap:4px;}" +
    ".details .details-tag{background:#1f1f23;color:#c4b5fd;padding:1px 6px;border-radius:6px;font-size:10px;}" +
    ".details .details-err{color:#fca5a5;grid-column:1/-1;}" +
    ".details .details-empty{color:#6b6b75;grid-column:1/-1;}" +
    ".details-edit-btn{background:transparent;border:1px solid #2a2a30;color:#c4b5fd;border-radius:6px;padding:4px 10px;font:inherit;cursor:pointer;margin-top:6px;}" +
    ".details-edit-btn:hover{background:#15151a;}" +
    ".details-edit-form{display:flex;flex-direction:column;gap:6px;}" +
    ".details-edit-row{display:flex;flex-direction:column;gap:2px;}" +
    ".details-edit-label{color:#6b6b75;font-size:10px;}" +
    ".details-edit-input{background:#15151a;border:1px solid #2a2a30;color:#e7e7ea;border-radius:6px;padding:4px 8px;font:inherit;}" +
    ".details-edit-input:focus{outline:none;border-color:#7c3aed;}" +
    ".details-edit-tags{display:flex;flex-wrap:wrap;gap:4px;}" +
    ".details-edit-tag-pill{background:#1f1f23;color:#c4b5fd;padding:1px 4px 1px 6px;border-radius:6px;font-size:10px;display:inline-flex;align-items:center;gap:2px;}" +
    ".details-edit-tag-x{background:transparent;border:0;color:#8a8a93;cursor:pointer;font-size:11px;padding:0 2px;}" +
    ".details-edit-tag-x:hover{color:#fca5a5;}" +
    ".details-edit-add-row{display:flex;gap:4px;}" +
    ".details-edit-add-input{flex:1;background:#15151a;border:1px solid #2a2a30;color:#e7e7ea;border-radius:6px;padding:3px 6px;font:inherit;}" +
    ".details-edit-add-input:focus{outline:none;border-color:#7c3aed;}" +
    ".details-edit-add-btn{background:#7c3aed;color:#fff;border:0;border-radius:6px;padding:3px 8px;font:inherit;cursor:pointer;}" +
    ".details-edit-actions{display:flex;gap:6px;margin-top:4px;}" +
    ".details-edit-save{background:#7c3aed;color:#fff;border:0;}" +
    ".details-edit-save:hover{background:#6d28d9;}" +
    ".details-edit-save:disabled{opacity:0.5;cursor:not-allowed;}" +
    ".details-edit-cancel{background:transparent;color:#e7e7ea;border:1px solid #2a2a30;}" +
    ".details-edit-cancel:hover{background:#15151a;}" +
    ".details-edit-err{color:#fca5a5;font-size:10px;min-height:0;}" +
    ".details-edit-err:empty{display:none;}";
  document.head.appendChild(s);
}

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response));
  });
}

function setStatus(ok) {
  dom.status.textContent = ok ? "CRM Connected" : "CRM Offline";
  dom.status.className = "status " + (ok ? "on" : "off");
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function setMessage(el, text, kind) {
  el.className = "msg" + (kind ? " " + kind : "");
  el.textContent = text;
}

function filteredContacts() {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return allContacts;
  return allContacts.filter((c) => {
    const name = (c.name || "").toLowerCase();
    const user = (c.username || "").toLowerCase();
    return name.includes(q) || user.includes(q);
  });
}

function renderContact(c) {
  const li = document.createElement("li");

  const main = document.createElement("div");
  main.className = "main";

  const top = document.createElement("div");
  top.className = "top";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = c.name || "(no name)";
  top.appendChild(name);
  if (c.username) {
    const user = document.createElement("span");
    user.className = "user";
    user.textContent = c.username;
    top.appendChild(user);
  }
  main.appendChild(top);

  // Label badges (from label:* tags)
  const assignedLabels = LABELS.filter((l) => (c.tags || []).includes(l.key));
  if (assignedLabels.length > 0) {
    const badges = document.createElement("div");
    badges.className = "label-badges";
    for (const lbl of assignedLabels) {
      const badge = document.createElement("span");
      badge.className = "label-pill";
      badge.style.cssText = `color:${lbl.color};background:${lbl.bg};`;
      badge.textContent = lbl.display;
      badges.appendChild(badge);
    }
    main.appendChild(badges);
  }

  if (c.lastMessage) {
    const preview = document.createElement("div");
    preview.className = "preview";
    preview.textContent = c.lastMessage;
    main.appendChild(preview);
  }

  li.appendChild(main);

  if (c.unreadCount && c.unreadCount > 0) {
    const badge = document.createElement("span");
    badge.className = "unread";
    badge.textContent = String(c.unreadCount);
    li.appendChild(badge);
  }

  li.addEventListener("click", () => selectContact(c));
  return li;
}

function renderList() {
  const oldUl = dom.content.querySelector("ul");
  if (oldUl) oldUl.remove();
  const oldEmpty = dom.content.querySelector(".empty-list");
  if (oldEmpty) oldEmpty.remove();

  const contacts = filteredContacts();
  if (contacts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty empty-list";
    empty.textContent = searchTerm ? "No matches" : "No contacts yet";
    dom.content.appendChild(empty);
    return;
  }

  const ul = document.createElement("ul");
  for (const c of contacts) ul.appendChild(renderContact(c));
  dom.content.appendChild(ul);
}

function render() {
  clear(dom.content);

  const search = document.createElement("input");
  search.id = "searchInput";
  search.className = "search";
  search.type = "search";
  search.placeholder = "Search contacts...";
  search.value = searchTerm;
  search.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderList();
  });
  dom.content.appendChild(search);

  renderList();
}

function showDetailsPanel(contactId) {
  const id = String(contactId);
  if (currentDetailsId === id) {
    dom.detailsPanel.style.display = "grid";
    return;
  }
  currentDetailsId = id;
  // Reset per-contact section open state
  historyOpen   = false;
  timelineOpen  = false;
  timelineFilter = "all";
  dom.detailsPanel.style.display = "grid";
  renderDetailsPanel(null);
  send({ type: "GET_CONTACT", body: { contactId: id } }).then((res) => {
    if (currentDetailsId !== id) return;
    if (res && res.ok && res.data) {
      renderDetailsPanel(res.data);
    } else {
      renderDetailsPanel(null);
    }
  });
}

function renderDetailsPanel(profile) {
  clear(dom.detailsPanel);
  if (!profile) {
    const err = document.createElement("div");
    err.className = "details-err";
    err.textContent = "Failed to load details";
    dom.detailsPanel.appendChild(err);
    return;
  }

  const rows = [
    ["Name", profile.name || "(no name)"],
    ["Username", profile.username || "—"],
    ["Phone", profile.phone || "—"],
    ["Revenue", "$" + Number(profile.revenue || 0).toFixed(2)],
    ["Last activity", profile.lastActivity || "—"],
  ];

  for (const [label, value] of rows) {
    const l = document.createElement("div");
    l.className = "details-label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "details-value";
    v.textContent = String(value);
    dom.detailsPanel.appendChild(l);
    dom.detailsPanel.appendChild(v);
  }

  // Labels section (before tags — labels are stored as label:* prefixed tags)
  const lblSectionLabel = document.createElement("div");
  lblSectionLabel.className = "details-label";
  lblSectionLabel.textContent = "Labels";
  dom.detailsPanel.appendChild(lblSectionLabel);

  const lblWrap = document.createElement("div");
  lblWrap.className = "details-labels-wrap";
  const currentTags    = Array.isArray(profile.tags) ? profile.tags : [];
  const activeLabels   = LABELS.filter((l) => currentTags.includes(l.key));
  const inactiveLabels = LABELS.filter((l) => !currentTags.includes(l.key));

  if (activeLabels.length === 0 && inactiveLabels.length === 0) {
    const none = document.createElement("span");
    none.className = "details-empty";
    none.textContent = "No labels";
    lblWrap.appendChild(none);
  } else {
    // Active labels: colored pill with × to remove
    for (const lbl of activeLabels) {
      const pill = document.createElement("span");
      pill.className = "label-pill";
      pill.style.cssText = `color:${lbl.color};background:${lbl.bg};`;
      const txt = document.createElement("span");
      txt.textContent = lbl.display;
      const x = document.createElement("button");
      x.type = "button";
      x.className = "label-pill-x";
      x.style.color = lbl.color;
      x.textContent = "\u00d7";
      x.title = "Remove " + lbl.display;
      x.addEventListener("click", async () => {
        x.disabled = true;
        await toggleLabelOnContact(String(profile.id || currentDetailsId), lbl.key, false);
      });
      pill.appendChild(txt);
      pill.appendChild(x);
      lblWrap.appendChild(pill);
    }
    // Inactive labels: dashed add buttons
    for (const lbl of inactiveLabels) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "label-add-btn";
      addBtn.style.cssText = `color:${lbl.color};border-color:${lbl.color};`;
      addBtn.textContent = "+ " + lbl.display;
      addBtn.title = "Add label: " + lbl.display;
      addBtn.addEventListener("click", async () => {
        addBtn.disabled = true;
        await toggleLabelOnContact(String(profile.id || currentDetailsId), lbl.key, true);
      });
      lblWrap.appendChild(addBtn);
    }
  }
  dom.detailsPanel.appendChild(lblWrap);

  // Tags section — non-label tags only
  const tagLabel = document.createElement("div");
  tagLabel.className = "details-label";
  tagLabel.textContent = "Tags";
  dom.detailsPanel.appendChild(tagLabel);

  const tagWrap = document.createElement("div");
  tagWrap.className = "details-tags";
  const tags = (Array.isArray(profile.tags) ? profile.tags : []).filter((t) => !t.startsWith("label:"));
  if (tags.length === 0) {
    const none = document.createElement("span");
    none.className = "details-empty";
    none.textContent = "No tags";
    tagWrap.appendChild(none);
  } else {
    for (const t of tags) {
      const pill = document.createElement("span");
      pill.className = "details-tag";
      pill.textContent = String(t);
      tagWrap.appendChild(pill);
    }
  }
  dom.detailsPanel.appendChild(tagWrap);

  currentProfile = profile;
  editMode = false;
  editFields = null;

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "6px";
  btnRow.style.marginTop = "6px";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "details-edit-btn";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", enterEditMode);
  btnRow.appendChild(editBtn);

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "details-edit-btn";
  openBtn.textContent = "Open In CRM";
  openBtn.addEventListener("click", () => {
    const id = String(profile.id || currentDetailsId || "");
    if (!id) return;
    window.open(CRM_BASE + "/?contact=" + encodeURIComponent(id), "_blank", "noopener");
  });
  btnRow.appendChild(openBtn);

  const historyBtn = document.createElement("button");
  historyBtn.type = "button";
  historyBtn.className = "details-edit-btn";
  historyBtn.textContent = "History";
  historyBtn.addEventListener("click", toggleHistorySection);
  btnRow.appendChild(historyBtn);

  const activityBtn = document.createElement("button");
  activityBtn.type = "button";
  activityBtn.className = "details-edit-btn";
  activityBtn.textContent = "Activity";
  activityBtn.addEventListener("click", toggleTimelineSection);
  btnRow.appendChild(activityBtn);

  dom.detailsPanel.appendChild(btnRow);

  const historySection = document.createElement("div");
  historySection.className = "history-section";
  const historyHeader = document.createElement("div");
  historyHeader.className = "history-header";
  historyHeader.id = "historyHeader";
  const historyTitle = document.createElement("span");
  historyTitle.className = "history-title";
  historyTitle.textContent = "Conversation History";
  const historyChevron = document.createElement("span");
  historyChevron.className = "history-chevron";
  historyChevron.id = "historyChevron";
  historyChevron.textContent = "\u25b8";
  historyHeader.appendChild(historyTitle);
  historyHeader.appendChild(historyChevron);
  historyHeader.addEventListener("click", toggleHistorySection);
  const historyBody = document.createElement("div");
  historyBody.className = "history-body";
  historyBody.id = "historyBody";
  const historySearch = document.createElement("input");
  historySearch.type = "text";
  historySearch.className = "history-search";
  historySearch.placeholder = "Search messages\u2026";
  historySearch.id = "historySearch";
  historySearch.addEventListener("input", (e) => {
    historySearchTerm = String(e.target.value || "");
    renderHistoryMessages(getCachedHistory(currentDetailsId));
  });
  historySearch.addEventListener("click", (e) => e.stopPropagation());
  const historyList = document.createElement("div");
  historyList.className = "history-list";
  historyList.id = "historyList";
  historyBody.appendChild(historySearch);
  historyBody.appendChild(historyList);
  historySection.appendChild(historyHeader);
  historySection.appendChild(historyBody);
  dom.detailsPanel.appendChild(historySection);

  // Activity Timeline section (A4) — additive, separate from Conversation History
  const timelineSection = document.createElement("div");
  timelineSection.className = "timeline-section";
  timelineSection.id = "timelineSection";

  const tlHeader = document.createElement("div");
  tlHeader.className = "timeline-header";
  tlHeader.id = "timelineHeader";
  const tlTitle = document.createElement("span");
  tlTitle.className = "timeline-title";
  tlTitle.textContent = "Activity Timeline";
  const tlChevron = document.createElement("span");
  tlChevron.className = "timeline-chevron";
  tlChevron.id = "timelineChevron";
  tlChevron.textContent = "\u25b8";
  tlHeader.appendChild(tlTitle);
  tlHeader.appendChild(tlChevron);
  tlHeader.addEventListener("click", toggleTimelineSection);

  const tlBody = document.createElement("div");
  tlBody.className = "timeline-body";
  tlBody.id = "timelineBody";

  timelineSection.appendChild(tlHeader);
  timelineSection.appendChild(tlBody);
  dom.detailsPanel.appendChild(timelineSection);
}

function hideDetailsPanel() {
  currentDetailsId = null;
  clear(dom.detailsPanel);
  dom.detailsPanel.style.display = "none";
}

function enterEditMode() {
  if (!currentProfile) return;
  editMode = true;
  editFields = {
    name: currentProfile.name || "",
    username: currentProfile.username || "",
    phone: currentProfile.phone || "",
    tags: Array.isArray(currentProfile.tags)
      ? currentProfile.tags.filter((t) => !t.startsWith("label:")).slice()
      : [],
  };
  renderEditForm();
}

function exitEditMode() {
  editMode = false;
  editFields = null;
  if (currentProfile) renderDetailsPanel(currentProfile);
  else { clear(dom.detailsPanel); dom.detailsPanel.style.display = "none"; }
}

function renderEditForm() {
  clear(dom.detailsPanel);

  const form = document.createElement("div");
  form.className = "details-edit-form";

  const nameInput = makeEditInput("name", "Name", editFields.name);
  const userInput = makeEditInput("username", "Username (with or without @)", editFields.username);
  const phoneInput = makeEditInput("phone", "Phone", editFields.phone);

  const tagsWrap = document.createElement("div");
  tagsWrap.className = "details-edit-row";
  const tagsLabel = document.createElement("div");
  tagsLabel.className = "details-edit-label";
  tagsLabel.textContent = "Tags";
  tagsWrap.appendChild(tagsLabel);
  const tagsBox = document.createElement("div");
  tagsBox.id = "editTagsBox";
  tagsBox.className = "details-edit-tags";
  tagsWrap.appendChild(tagsBox);
  renderEditTags();
  const addRow = document.createElement("div");
  addRow.className = "details-edit-add-row";
  const addInput = document.createElement("input");
  addInput.id = "editTagInput";
  addInput.className = "details-edit-add-input";
  addInput.type = "text";
  addInput.placeholder = "Add tag...";
  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = addInput.value.trim();
      if (v) { addEditTag(v); addInput.value = ""; }
    }
  });
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "details-edit-add-btn";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => {
    const v = addInput.value.trim();
    if (v) { addEditTag(v); addInput.value = ""; }
  });
  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  tagsWrap.appendChild(addRow);

  const actions = document.createElement("div");
  actions.className = "details-edit-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.id = "editSaveBtn";
  saveBtn.className = "details-edit-btn details-edit-save";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => saveEdit(String(currentDetailsId)));
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "details-edit-btn details-edit-cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", exitEditMode);
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  const errEl = document.createElement("div");
  errEl.id = "editErr";
  errEl.className = "details-edit-err";

  form.appendChild(nameInput.row);
  form.appendChild(userInput.row);
  form.appendChild(phoneInput.row);
  form.appendChild(tagsWrap);
  form.appendChild(actions);
  form.appendChild(errEl);
  dom.detailsPanel.appendChild(form);

  const refreshSaveState = () => {
    const nameEmpty = !nameInput.input.value.trim();
    const userEmpty = !userInput.input.value.trim();
    saveBtn.disabled = nameEmpty || userEmpty;
  };
  nameInput.input.addEventListener("input", () => {
    editFields.name = nameInput.input.value;
    refreshSaveState();
  });
  userInput.input.addEventListener("input", () => {
    editFields.username = userInput.input.value;
    refreshSaveState();
  });
  phoneInput.input.addEventListener("input", () => {
    editFields.phone = phoneInput.input.value;
  });
  refreshSaveState();
}

function makeEditInput(field, label, value) {
  const row = document.createElement("div");
  row.className = "details-edit-row";
  const l = document.createElement("div");
  l.className = "details-edit-label";
  l.textContent = label;
  const i = document.createElement("input");
  i.type = "text";
  i.className = "details-edit-input";
  i.value = value;
  i.dataset.field = field;
  row.appendChild(l);
  row.appendChild(i);
  return { row, input: i };
}

function renderEditTags() {
  const box = document.getElementById("editTagsBox");
  if (!box) return;
  clear(box);
  for (const t of editFields.tags) {
    const pill = document.createElement("span");
    pill.className = "details-edit-tag-pill";
    pill.textContent = t;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "details-edit-tag-x";
    x.textContent = "×";
    x.addEventListener("click", () => removeEditTag(t));
    pill.appendChild(x);
    box.appendChild(pill);
  }
}

function addEditTag(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return;
  const exists = editFields.tags.some((t) => t.toLowerCase() === trimmed.toLowerCase());
  if (exists) return;
  editFields.tags.push(trimmed);
  renderEditTags();
}

function removeEditTag(name) {
  const lower = String(name).toLowerCase();
  editFields.tags = editFields.tags.filter((t) => t.toLowerCase() !== lower);
  renderEditTags();
}

function setEditError(text) {
  const el = document.getElementById("editErr");
  if (el) el.textContent = text || "";
}

async function saveEdit(contactId) {
  const saveBtn = document.getElementById("editSaveBtn");
  const targetId = String(contactId);
  if (!editFields || !saveBtn) return;
  if (!editFields.name.trim()) {
    setEditError("Name is required");
    return;
  }
  if (!editFields.username.trim()) {
    setEditError("Username is required");
    return;
  }
  saveBtn.disabled = true;
  setEditError("");

  const patch = {
    name: editFields.name.trim(),
    username: editFields.username.trim(),
    phone: editFields.phone.trim(),
  };
  // Exclude label tags from the free-form tag diff — labels are managed separately
  const originalTags = (Array.isArray(currentProfile?.tags) ? currentProfile.tags : [])
    .filter((t) => !t.startsWith("label:"));
  const added = editFields.tags.filter((t) => !originalTags.some((o) => o.toLowerCase() === t.toLowerCase()));
  const removed = originalTags.filter((o) => !editFields.tags.some((t) => t.toLowerCase() === o.toLowerCase()));

  const patchRes = await send({ type: "UPDATE_CONTACT", body: { contactId: targetId, patch } });
  if (currentDetailsId !== targetId) return;
  if (!patchRes || !patchRes.ok) {
    setEditError(((patchRes && patchRes.data && patchRes.data.error) || (patchRes && patchRes.error) || "Update failed"));
    saveBtn.disabled = false;
    return;
  }

  let partialTagFail = false;
  for (const name of added) {
    const r = await send({ type: "ADD_TAG", body: { contactId: targetId, name } });
    if (!r || !r.ok) partialTagFail = true;
  }
  for (const name of removed) {
    const r = await send({ type: "DELETE_TAG", body: { contactId: targetId, name } });
    if (!r || !r.ok) partialTagFail = true;
  }

  const canon = await send({ type: "GET_CONTACT", body: { contactId: targetId } });
  if (currentDetailsId !== targetId) return;
  if (canon && canon.ok && canon.data) {
    currentProfile = canon.data;
    editMode = false;
    editFields = null;
    renderDetailsPanel(canon.data);
    await loadContacts();
  } else {
    setEditError("Saved, but failed to refresh details");
    saveBtn.disabled = false;
    return;
  }

  if (partialTagFail) {
    setEditError("Saved. Some tag changes failed.");
  }
}

function selectContact(c) {
  selectedContact = c;
  dom.selectedBar.textContent = "To: " + (c.name || c.username || c.id);
  dom.selectedBar.style.display = "block";
  dom.sendForm.style.display = "flex";
  dom.sendText.value = "";
  setMessage(dom.sendMsg, "");
  dom.sendText.focus();
  showDetailsPanel(c.id);
}

function clearSelection() {
  selectedContact = null;
  dom.selectedBar.style.display = "none";
  dom.sendForm.style.display = "none";
  dom.sendText.value = "";
  setMessage(dom.sendMsg, "");
  hideDetailsPanel();
}

function bindCreateForm() {
  dom.newContact.addEventListener("submit", async (e) => {
    e.preventDefault();
    dom.createBtn.disabled = true;
    setMessage(dom.formMsg, "Creating...");
    const body = {
      name: dom.fName.value.trim(),
      username: dom.fUser.value.trim(),
    };
    const phone = dom.fPhone.value.trim();
    if (phone) body.phone = phone;
    const res = await send({ type: "CREATE_CONTACT", body });
    if (res && res.ok) {
      setMessage(dom.formMsg, "Created. Refreshing...", "ok");
      dom.newContact.reset();
      await loadContacts();
      setTimeout(() => setMessage(dom.formMsg, ""), 1500);
    } else {
      const err = (res && (res.data && res.data.error)) || (res && res.error) || "unknown";
      setMessage(dom.formMsg, "Failed: " + err, "err");
    }
    dom.createBtn.disabled = false;
  });
}

function bindSendForm() {
  dom.sendForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedContact) {
      setMessage(dom.sendMsg, "Select a contact first", "err");
      return;
    }
    const text = dom.sendText.value.trim();
    if (!text) return;
    dom.sendBtn.disabled = true;
    setMessage(dom.sendMsg, "Sending...");
    const res = await send({
      type: "SEND_MESSAGE",
      body: { contactId: Number(selectedContact.id), text },
    });
    if (res && res.ok) {
      setMessage(dom.sendMsg, "Sent", "ok");
      dom.sendText.value = "";
      await loadContacts();
      setTimeout(() => setMessage(dom.sendMsg, ""), 2000);
    } else {
      const err = (res && (res.data && res.data.error)) || (res && res.error) || "unknown";
      setMessage(dom.sendMsg, "Failed: " + err, "err");
    }
    dom.sendBtn.disabled = false;
  });
  // Snippet / trigger
  dom.sendText.addEventListener("input", onSendTextInput);
  dom.sendText.addEventListener("keydown", onSendTextKeydown);
}

async function loadContacts() {
  const res = await send({ type: "GET_CONTACTS" });
  if (res && res.ok && Array.isArray(res.data)) {
    allContacts = res.data;
    render();
  } else {
    clear(dom.content);
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Failed to load contacts";
    dom.content.appendChild(empty);
  }
}

function showOffline() {
  clear(dom.content);
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "Start the CRM at localhost:3000";
  dom.content.appendChild(empty);
}

async function init() {
  injectStyles();
  const ping = await send({ type: "PING" });
  setStatus(ping && ping.ok);
  if (ping && ping.ok) {
    bindCreateForm();
    bindSendForm();
    bindFollowups();
    bindCampaigns();
    bindTemplates();
    bindSnippets();
    await loadContacts();
  } else {
    showOffline();
  }
}

function bindFollowups() {
  dom.followupsHeader.addEventListener("click", toggleFollowups);
}

async function toggleFollowups() {
  if (followupsOpen) {
    followupsOpen = false;
    dom.followupsBody.style.display = "none";
    dom.followupsChevron.classList.remove("open");
    return;
  }
  followupsOpen = true;
  dom.followupsBody.style.display = "block";
  dom.followupsChevron.classList.add("open");
  if (!followupsLoaded) {
    await loadFollowups();
  }
}

async function loadFollowups(force) {
  if (followupsLoaded && !force) return;
  followupsBody_clear();
  const loading = document.createElement("p");
  loading.className = "followups-loading";
  loading.textContent = "Loading follow-ups…";
  dom.followupsBody.appendChild(loading);
  const res = await send({ type: "GET_FOLLOWUPS" });
  followupsBody_clear();
  if (!res || !res.ok) {
    const err = document.createElement("p");
    err.className = "followups-loading";
    err.textContent = "Failed to load follow-ups";
    dom.followupsBody.appendChild(err);
    return;
  }
  followupsData = (res.data && res.data.lists) || (Array.isArray(res.data) ? res.data : []);
  followupsLoaded = true;
  renderFollowups(followupsData);
}

function followupsBody_clear() {
  while (dom.followupsBody.firstChild) {
    dom.followupsBody.removeChild(dom.followupsBody.firstChild);
  }
}

function renderFollowups(lists) {
  followupsBody_clear();
  if (!lists.length) {
    const empty = document.createElement("p");
    empty.className = "followups-loading";
    empty.textContent = "No follow-up lists";
    dom.followupsBody.appendChild(empty);
    return;
  }
  for (const list of lists) {
    dom.followupsBody.appendChild(renderFollowupGroup(list));
  }
  const refresh = document.createElement("div");
  refresh.className = "followup-refresh";
  refresh.textContent = "↻ Refresh";
  refresh.addEventListener("click", (e) => {
    e.stopPropagation();
    loadFollowups(true);
  });
  dom.followupsBody.appendChild(refresh);
}

function renderFollowupGroup(list) {
  const group = document.createElement("div");
  group.className = "followup-group";
  const header = document.createElement("div");
  header.className = "followup-group-header";
  const title = document.createElement("span");
  title.className = "followup-group-title";
  title.textContent = list.title || list.key;
  const count = document.createElement("span");
  count.className = "followup-group-count" + ((list.count || 0) === 0 ? " zero" : "");
  count.textContent = String(list.count || 0);
  header.appendChild(title);
  header.appendChild(count);
  const items = document.createElement("div");
  items.className = "followup-items";
  if ((list.items || []).length > 0) {
    for (const item of list.items) {
      items.appendChild(renderFollowupItem(item));
    }
  } else {
    const none = document.createElement("div");
    none.className = "followup-item";
    none.style.color = "#6b6b75";
    none.style.fontStyle = "italic";
    none.textContent = "No fans in this list";
    items.appendChild(none);
  }
  header.addEventListener("click", () => {
    items.classList.toggle("open");
  });
  group.appendChild(header);
  group.appendChild(items);
  return group;
}

function renderFollowupItem(item) {
  const row = document.createElement("div");
  row.className = "followup-item";
  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "2px";
  left.style.minWidth = "0";
  left.style.flex = "1";
  const name = document.createElement("span");
  name.className = "followup-item-name";
  name.textContent = item.name || "—";
  const user = document.createElement("span");
  user.className = "followup-item-user";
  user.textContent = item.username ? "@" + String(item.username).replace(/^@/, "") : "";
  left.appendChild(name);
  left.appendChild(user);
  const hint = document.createElement("span");
  hint.className = "followup-item-hint";
  hint.textContent = item.hint || "";
  const actions = document.createElement("div");
  actions.className = "followup-actions";
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "followup-action-btn";
  openBtn.textContent = "Open";
  openBtn.title = "Open in details panel";
  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (item.id) showDetailsPanel(String(item.id));
  });
  const crmBtn = document.createElement("button");
  crmBtn.type = "button";
  crmBtn.className = "followup-action-btn crm";
  crmBtn.textContent = "CRM";
  crmBtn.title = "Open in CRM";
  crmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = String(item.id || "");
    if (!id) return;
    window.open(CRM_BASE + "/?contact=" + encodeURIComponent(id), "_blank", "noopener");
  });
  actions.appendChild(openBtn);
  actions.appendChild(crmBtn);
  row.appendChild(left);
  row.appendChild(hint);
  row.appendChild(actions);
  row.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") return;
    e.stopPropagation();
    if (item.id) showDetailsPanel(String(item.id));
  });
  return row;
}

function getCachedHistory(contactId) {
  const key = String(contactId || "");
  if (!key) return null;
  return historyCache[key] || null;
}

async function toggleHistorySection() {
  const id = String(currentDetailsId || "");
  if (!id) return;
  const body = document.getElementById("historyBody");
  const chevron = document.getElementById("historyChevron");
  if (!body || !chevron) return;
  historyOpen = !historyOpen;
  if (historyOpen) {
    body.classList.add("open");
    chevron.classList.add("open");
    const cached = getCachedHistory(id);
    if (cached) {
      renderHistoryMessages(cached);
    } else {
      await loadHistory(id);
    }
  } else {
    body.classList.remove("open");
    chevron.classList.remove("open");
  }
}

async function loadHistory(contactId) {
  const id = String(contactId || "");
  if (!id) return;
  const list = document.getElementById("historyList");
  if (list) {
    list.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "history-loading";
    loading.textContent = "Loading messages…";
    list.appendChild(loading);
  }
  const res = await send({ type: "GET_MESSAGES", body: { contactId: id } });
  if (!res || !res.ok) {
    if (list) {
      list.innerHTML = "";
      const err = document.createElement("div");
      err.className = "history-empty";
      err.textContent = "Failed to load messages";
      list.appendChild(err);
    }
    return;
  }
  const messages = Array.isArray(res.data) ? res.data : [];
  historyCache[id] = messages;
  renderHistoryMessages(messages);
}

function renderHistoryMessages(messages) {
  const list = document.getElementById("historyList");
  if (!list) return;
  list.innerHTML = "";
  if (!messages || messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No messages yet";
    list.appendChild(empty);
    return;
  }
  const q = String(historySearchTerm || "").toLowerCase().trim();
  const filtered = q
    ? messages.filter((m) => String(m.text || "").toLowerCase().includes(q))
    : messages;
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No matches for \"" + historySearchTerm + "\"";
    list.appendChild(empty);
    return;
  }
  for (const msg of filtered) {
    list.appendChild(renderHistoryMessage(msg, q));
  }
}

function renderHistoryMessage(msg, query) {
  const row = document.createElement("div");
  const dir = msg.direction === "outgoing" ? "outgoing" : "incoming";
  row.className = "history-msg " + dir;
  const meta = document.createElement("div");
  meta.className = "history-msg-meta";
  const ts = msg.timestamp ? new Date(msg.timestamp) : null;
  const timeStr = ts && !isNaN(ts.getTime()) ? formatHistoryTime(ts) : "";
  meta.textContent = (dir === "outgoing" ? "You" : "Fan") + " · " + timeStr;
  const text = document.createElement("div");
  text.className = "history-msg-text";
  text.textContent = String(msg.text || "");
  if (query && text.textContent.toLowerCase().includes(query)) {
    row.classList.add("highlight");
  }
  row.appendChild(meta);
  row.appendChild(text);
  return row;
}

function formatHistoryTime(d) {
  try {
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  } catch (e) {
    return "";
  }
}

function bindCampaigns() {
  dom.campaignsHeader.addEventListener("click", toggleCampaigns);
}

async function toggleCampaigns() {
  if (dom.campaignsBody.hidden) {
    dom.campaignsBody.hidden = false;
    dom.campaignsChevron.classList.add("open");
    if (!campaignsLoaded) {
      await loadCampaignCounts();
    }
  } else {
    dom.campaignsBody.hidden = true;
    dom.campaignsChevron.classList.remove("open");
  }
}

async function loadCampaignCounts(force) {
  if (campaignsLoaded && !force) return;
  dom.campaignsBody.innerHTML = "";
  const loading = document.createElement("div");
  loading.className = "campaigns-loading";
  loading.textContent = "Loading segments…";
  dom.campaignsBody.appendChild(loading);
  const res = await send({ type: "GET_REENGAGEMENT_COUNTS" });
  dom.campaignsBody.innerHTML = "";
  if (!res || !res.ok) {
    const err = document.createElement("div");
    err.className = "campaigns-loading";
    err.textContent = "Failed to load segments";
    dom.campaignsBody.appendChild(err);
    return;
  }
  campaignCounts = (res.data && res.data.counts) || {};
  campaignsLoaded = true;
  renderCampaigns();
}

function renderCampaigns() {
  dom.campaignsBody.innerHTML = "";
  for (const seg of CAMPAIGN_SEGMENTS) {
    dom.campaignsBody.appendChild(renderCampaignSegment(seg));
  }
  dom.campaignsBody.appendChild(renderCampaignComposer());
  dom.campaignsBody.appendChild(renderCampaignStatus());
}

function renderCampaignSegment(seg) {
  const row = document.createElement("div");
  row.className = "campaign-segment";
  if (campaignSelectedKey === seg.key) row.classList.add("selected");
  const title = document.createElement("span");
  title.className = "campaign-segment-title";
  title.textContent = seg.title;
  const count = document.createElement("span");
  const c = campaignCounts && typeof campaignCounts[seg.key] === "number" ? campaignCounts[seg.key] : 0;
  count.className = "campaign-segment-count" + (c === 0 ? " zero" : "");
  count.textContent = String(c);
  row.appendChild(title);
  row.appendChild(count);
  row.addEventListener("click", () => selectCampaignSegment(seg.key));
  return row;
}

function selectCampaignSegment(key) {
  campaignSelectedKey = key;
  campaignConfirming = false;
  renderCampaigns();
}

function getSelectedSegmentInfo() {
  const seg = campaignSelectedKey
    ? CAMPAIGN_SEGMENTS.find((s) => s.key === campaignSelectedKey) || null
    : null;
  const audienceCount = campaignSelectedKey && campaignCounts && typeof campaignCounts[campaignSelectedKey] === "number"
    ? campaignCounts[campaignSelectedKey]
    : 0;
  return { seg, audienceCount };
}

function renderCampaignComposer() {
  const wrap = document.createElement("div");
  wrap.className = "campaign-composer";
  if (!campaignSelectedKey) {
    wrap.hidden = true;
    return wrap;
  }
  const { seg, audienceCount } = getSelectedSegmentInfo();

  const nameField = document.createElement("div");
  nameField.className = "campaign-field";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Campaign name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "campaign-input";
  nameInput.placeholder = "Win back inactive buyers";
  nameInput.value = campaignName;
  nameInput.addEventListener("input", (e) => {
    campaignName = e.target.value;
    updateConfirmBox();
  });
  nameField.appendChild(nameLabel);
  nameField.appendChild(nameInput);

  const msgField = document.createElement("div");
  msgField.className = "campaign-field";
  const msgLabel = document.createElement("label");
  msgLabel.textContent = "Message (use {name} for personalization)";
  const msgInput = document.createElement("textarea");
  msgInput.className = "campaign-textarea";
  msgInput.placeholder = "Hey {name}, we miss you…";
  msgInput.value = campaignMessage;
  msgInput.addEventListener("input", (e) => {
    campaignMessage = e.target.value;
    updateConfirmBox();
  });
  msgField.appendChild(msgLabel);
  msgField.appendChild(msgInput);

  const preview = document.createElement("div");
  preview.className = "campaign-preview";
  preview.innerHTML = "Segment: <strong>" + escapeHtml(seg ? seg.title : campaignSelectedKey) + "</strong> · Audience: <strong>" + audienceCount + "</strong>";

  const sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.className = "campaign-btn primary";
  sendBtn.textContent = audienceCount === 0 ? "Empty segment" : "Send campaign";
  sendBtn.disabled = audienceCount === 0;
  sendBtn.addEventListener("click", () => {
    campaignConfirming = true;
    updateConfirmBox();
  });

  wrap.appendChild(nameField);
  wrap.appendChild(msgField);
  wrap.appendChild(preview);
  wrap.appendChild(sendBtn);
  return wrap;
}

function renderCampaignStatus() {
  const wrap = document.createElement("div");
  wrap.id = "campaignStatus";
  wrap.className = "campaign-status";
  return wrap;
}

function setCampaignStatus(text, kind) {
  const el = document.getElementById("campaignStatus");
  if (!el) return;
  el.textContent = text || "";
  el.className = "campaign-status" + (kind ? " " + kind : "");
}

function updateConfirmBox() {
  const composer = dom.campaignsBody.querySelector(".campaign-composer");
  if (!composer) return;
  const old = document.getElementById("campaignConfirmBox");
  if (old) old.remove();
  if (!campaignConfirming) return;
  const { seg, audienceCount } = getSelectedSegmentInfo();
  const canSend = campaignName.trim() && campaignMessage.trim() && audienceCount > 0 && !campaignSending;
  const box = document.createElement("div");
  box.id = "campaignConfirmBox";
  box.className = "campaign-confirm-box";
  const text = document.createElement("div");
  text.className = "campaign-confirm-text";
  text.innerHTML =
    "Send <strong>" + escapeHtml(campaignName.trim() || "(unnamed)") + "</strong> " +
    "to <strong>" + audienceCount + "</strong> fans in " +
    "<strong>" + escapeHtml(seg ? seg.title : campaignSelectedKey) + "</strong>?";
  const actions = document.createElement("div");
  actions.className = "campaign-confirm-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "campaign-btn";
  cancel.textContent = "Cancel";
  cancel.disabled = campaignSending;
  cancel.addEventListener("click", () => {
    campaignConfirming = false;
    updateConfirmBox();
  });
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "campaign-btn danger";
  confirm.textContent = campaignSending ? "Sending…" : "Confirm send";
  confirm.disabled = !canSend;
  confirm.addEventListener("click", () => sendReengagementNow());
  actions.appendChild(cancel);
  actions.appendChild(confirm);
  box.appendChild(text);
  box.appendChild(actions);
  composer.appendChild(box);
}

async function sendReengagementNow() {
  if (campaignSending) return;
  if (!campaignSelectedKey) return;
  if (!campaignName.trim() || !campaignMessage.trim()) return;
  const audienceCount = campaignCounts && typeof campaignCounts[campaignSelectedKey] === "number" ? campaignCounts[campaignSelectedKey] : 0;
  if (audienceCount === 0) return;
  campaignSending = true;
  updateConfirmBox();
  setCampaignStatus("Sending to " + audienceCount + " fans…", "");
  const res = await send({
    type: "SEND_REENGAGEMENT",
    body: {
      name: campaignName.trim(),
      message: campaignMessage.trim(),
      segmentKey: campaignSelectedKey,
    },
  });
  campaignSending = false;
  if (res && res.ok && res.data) {
    const d = res.data;
    setCampaignStatus("Sent " + d.sentCount + " of " + d.count + " fans.", "ok");
    campaignConfirming = false;
    campaignName = "";
    campaignMessage = "";
    await loadCampaignCounts(true);
  } else {
    const msg = (res && res.data && res.data.error) ? res.data.error : "Failed to send";
    setCampaignStatus(msg, "err");
    updateConfirmBox();
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Templates (A1) ──────────────────────────────────────────────────────────

function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveTemplates(list) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
}

function generateTemplateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function applyTemplateVars(text, contact) {
  if (!contact) return text;
  const name      = String(contact.name || "");
  const firstName = name.split(" ")[0] || name;
  const username  = String(contact.username || "");
  return text
    .replace(/\{name\}/g,      name)
    .replace(/\{firstName\}/g, firstName)
    .replace(/\{username\}/g,  username);
}

function bindTemplates() {
  dom.templatesHeader.addEventListener("click", toggleTemplates);
}

function toggleTemplates() {
  if (!dom.templatesBody.hidden) {
    dom.templatesBody.hidden = true;
    dom.templatesChevron.classList.remove("open");
    templatesOpen = false;
  } else {
    dom.templatesBody.hidden = false;
    dom.templatesChevron.classList.add("open");
    templatesOpen = true;
    templatesView = "list";
    renderTemplatesList();
  }
}

function renderTemplatesList() {
  const body = dom.templatesBody;
  body.innerHTML = "";

  // Toolbar: category filter + New button
  const toolbar = document.createElement("div");
  toolbar.className = "tmpl-toolbar";

  const catFilter = document.createElement("select");
  catFilter.id = "tmplCatFilter";
  catFilter.className = "tmpl-cat-filter";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All Categories";
  catFilter.appendChild(allOpt);
  for (const cat of TEMPLATE_CATEGORIES) {
    const opt = document.createElement("option");
    opt.value = cat.key;
    opt.textContent = cat.label;
    catFilter.appendChild(opt);
  }
  catFilter.addEventListener("change", renderTemplatesList);

  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "tmpl-new-btn";
  newBtn.textContent = "+ New";
  newBtn.addEventListener("click", () => {
    templatesView = "create";
    templatesEditId = null;
    renderTemplateForm();
  });

  toolbar.appendChild(catFilter);
  toolbar.appendChild(newBtn);
  body.appendChild(toolbar);

  const templates = loadTemplates();
  const filterVal = catFilter.value;
  const filtered  = filterVal ? templates.filter((t) => t.category === filterVal) : templates;

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tmpl-empty";
    empty.textContent = templates.length === 0
      ? "No templates yet. Click + New to create one."
      : "No templates in this category.";
    body.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "tmpl-list";
  for (const tpl of filtered) {
    list.appendChild(renderTemplateItem(tpl));
  }
  body.appendChild(list);
}

function renderTemplateItem(tpl) {
  const row = document.createElement("div");
  row.className = "tmpl-item";

  const info = document.createElement("div");
  info.className = "tmpl-item-info";

  const title = document.createElement("div");
  title.className = "tmpl-item-title";
  title.textContent = tpl.title;

  const preview = document.createElement("div");
  preview.className = "tmpl-item-preview";
  preview.textContent = tpl.body;

  const catObj = TEMPLATE_CATEGORIES.find((c) => c.key === tpl.category);
  const catEl = document.createElement("div");
  catEl.className = "tmpl-item-cat";
  catEl.textContent = catObj ? catObj.label : tpl.category;

  info.appendChild(title);
  info.appendChild(preview);
  info.appendChild(catEl);

  const actions = document.createElement("div");
  actions.className = "tmpl-item-actions";

  const useBtn = document.createElement("button");
  useBtn.type = "button";
  useBtn.className = "tmpl-use-btn";
  useBtn.textContent = "Use";
  useBtn.title = "Insert into message box";
  useBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    insertTemplate(tpl);
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "tmpl-edit-btn";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    templatesEditId = tpl.id;
    templatesView = "edit";
    renderTemplateForm();
  });

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "tmpl-del-btn";
  delBtn.textContent = "×";
  delBtn.title = "Delete template";
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteTemplate(tpl.id);
  });

  actions.appendChild(useBtn);
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function renderTemplateForm() {
  const body = dom.templatesBody;
  body.innerHTML = "";

  const isEdit   = templatesView === "edit";
  const existing = isEdit ? loadTemplates().find((t) => t.id === templatesEditId) : null;

  const form = document.createElement("div");
  form.className = "tmpl-form";

  // Header row
  const hdr = document.createElement("div");
  hdr.className = "tmpl-form-header";
  const heading = document.createElement("span");
  heading.className = "tmpl-form-title";
  heading.textContent = isEdit ? "Edit Template" : "New Template";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "tmpl-back-btn";
  backBtn.textContent = "← Back";
  backBtn.addEventListener("click", () => {
    templatesView = "list";
    renderTemplatesList();
  });
  hdr.appendChild(heading);
  hdr.appendChild(backBtn);
  form.appendChild(hdr);

  // Name field
  const nameField = document.createElement("div");
  nameField.className = "tmpl-field";
  const nameLabel = document.createElement("label");
  nameLabel.className = "tmpl-field-label";
  nameLabel.textContent = "Template name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.id = "tmplNameInput";
  nameInput.className = "tmpl-field-input";
  nameInput.placeholder = "e.g. Warm Greeting";
  nameInput.value = existing ? existing.title : "";
  nameField.appendChild(nameLabel);
  nameField.appendChild(nameInput);
  form.appendChild(nameField);

  // Category field
  const catField = document.createElement("div");
  catField.className = "tmpl-field";
  const catLabel = document.createElement("label");
  catLabel.className = "tmpl-field-label";
  catLabel.textContent = "Category";
  const catSelect = document.createElement("select");
  catSelect.id = "tmplCatInput";
  catSelect.className = "tmpl-field-select";
  for (const cat of TEMPLATE_CATEGORIES) {
    const opt = document.createElement("option");
    opt.value = cat.key;
    opt.textContent = cat.label;
    if (existing && existing.category === cat.key) opt.selected = true;
    catSelect.appendChild(opt);
  }
  catField.appendChild(catLabel);
  catField.appendChild(catSelect);
  form.appendChild(catField);

  // Body field
  const bodyField = document.createElement("div");
  bodyField.className = "tmpl-field";
  const bodyLabel = document.createElement("label");
  bodyLabel.className = "tmpl-field-label";
  bodyLabel.textContent = "Message body";
  const bodyInput = document.createElement("textarea");
  bodyInput.id = "tmplBodyInput";
  bodyInput.className = "tmpl-field-textarea";
  bodyInput.placeholder = "Hey {firstName}, just checking in 👋";
  bodyInput.value = existing ? existing.body : "";
  bodyInput.rows = 3;
  bodyField.appendChild(bodyLabel);
  bodyField.appendChild(bodyInput);
  form.appendChild(bodyField);

  // Variable hint
  const hint = document.createElement("div");
  hint.className = "tmpl-vars-hint";
  hint.innerHTML = "Variables: <code>{name}</code> <code>{firstName}</code> <code>{username}</code>";
  form.appendChild(hint);

  // Error
  const errEl = document.createElement("div");
  errEl.id = "tmplFormErr";
  errEl.className = "tmpl-err";
  form.appendChild(errEl);

  // Save button
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "tmpl-save-btn";
  saveBtn.textContent = isEdit ? "Save Changes" : "Create Template";
  saveBtn.addEventListener("click", () =>
    saveTemplateForm(nameInput, catSelect, bodyInput, errEl)
  );
  form.appendChild(saveBtn);

  body.appendChild(form);
  nameInput.focus();
}

function saveTemplateForm(nameInput, catSelect, bodyInput, errEl) {
  const title    = nameInput.value.trim();
  const body     = bodyInput.value.trim();
  const category = catSelect.value;

  if (!title) { errEl.textContent = "Template name is required."; return; }
  if (!body)  { errEl.textContent = "Message body is required.";  return; }
  errEl.textContent = "";

  const templates = loadTemplates();
  if (templatesView === "edit" && templatesEditId) {
    const idx = templates.findIndex((t) => t.id === templatesEditId);
    if (idx !== -1) {
      templates[idx] = { ...templates[idx], title, category, body };
    }
  } else {
    templates.push({ id: generateTemplateId(), title, category, body });
  }
  saveTemplates(templates);
  templatesView  = "list";
  templatesEditId = null;
  renderTemplatesList();
}

function deleteTemplate(id) {
  const updated = loadTemplates().filter((t) => t.id !== id);
  saveTemplates(updated);
  renderTemplatesList();
}

function insertTemplate(tpl) {
  const text = applyTemplateVars(tpl.body, selectedContact);
  dom.sendText.value = text;
  dom.sendText.focus();
  // Collapse templates panel after inserting
  dom.templatesBody.hidden = true;
  dom.templatesChevron.classList.remove("open");
  templatesOpen = false;
}

// ─── Snippets (A2) ───────────────────────────────────────────────────────────

function loadSnippets() {
  try {
    const raw = localStorage.getItem(SNIPPETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveSnippets(list) {
  localStorage.setItem(SNIPPETS_KEY, JSON.stringify(list));
}

function generateSnippetId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Dropdown (/ trigger in send box) ─────────────────────────────────────────

function onSendTextInput() {
  const val = dom.sendText.value;
  if (!val.startsWith("/")) {
    hideSnippetDropdown();
    return;
  }
  const query    = val.toLowerCase();
  const snippets = loadSnippets();
  snippetDropdownFiltered = snippets.filter((s) =>
    s.trigger.toLowerCase().startsWith(query)
  );
  if (snippetDropdownFiltered.length === 0) {
    hideSnippetDropdown();
    return;
  }
  snippetDropdownIndex = 0;
  showSnippetDropdown();
}

function onSendTextKeydown(e) {
  if (!snippetDropdownVisible) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    snippetDropdownIndex = Math.min(
      snippetDropdownIndex + 1,
      snippetDropdownFiltered.length - 1
    );
    highlightSnippetItem();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    snippetDropdownIndex = Math.max(snippetDropdownIndex - 1, 0);
    highlightSnippetItem();
  } else if (e.key === "Enter") {
    if (snippetDropdownFiltered[snippetDropdownIndex]) {
      e.preventDefault();
      selectSnippet(snippetDropdownFiltered[snippetDropdownIndex]);
    }
  } else if (e.key === "Escape") {
    hideSnippetDropdown();
  }
}

function showSnippetDropdown() {
  const list = dom.snippetList;
  list.innerHTML = "";
  snippetDropdownVisible = true;

  snippetDropdownFiltered.forEach((snip, i) => {
    const item = document.createElement("div");
    item.className = "snippet-item" + (i === snippetDropdownIndex ? " active" : "");
    item.dataset.index = String(i);

    const trigger = document.createElement("span");
    trigger.className = "snippet-trigger";
    trigger.textContent = snip.trigger;

    const preview = document.createElement("span");
    preview.className = "snippet-preview";
    preview.textContent = snip.body;

    item.appendChild(trigger);
    item.appendChild(preview);
    item.addEventListener("mousedown", (e) => {
      e.preventDefault(); // prevent blur on sendText
      selectSnippet(snip);
    });
    list.appendChild(item);
  });

  // Manage link at bottom
  const manageLink = document.createElement("div");
  manageLink.className = "snippets-manage-link";
  manageLink.textContent = "Manage Snippets →";
  manageLink.addEventListener("mousedown", (e) => {
    e.preventDefault();
    hideSnippetDropdown();
    // Open snippets management panel
    if (dom.snippetsBody.hidden) {
      dom.snippetsBody.hidden = false;
      dom.snippetsChevron.classList.add("open");
      snippetsOpen = true;
      snippetsView = "list";
      renderSnippetsList();
    }
    dom.snippetsHeader.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  list.appendChild(manageLink);

  list.hidden = false;
}

function hideSnippetDropdown() {
  dom.snippetList.hidden = true;
  dom.snippetList.innerHTML = "";
  snippetDropdownVisible = false;
  snippetDropdownIndex   = -1;
  snippetDropdownFiltered = [];
}

function highlightSnippetItem() {
  const items = dom.snippetList.querySelectorAll(".snippet-item");
  items.forEach((el, i) => {
    el.classList.toggle("active", i === snippetDropdownIndex);
  });
}

function selectSnippet(snip) {
  const text = applyTemplateVars(snip.body, selectedContact);
  dom.sendText.value = text;
  hideSnippetDropdown();
  dom.sendText.focus();
}

// ── Snippets management panel ─────────────────────────────────────────────────

function bindSnippets() {
  dom.snippetsHeader.addEventListener("click", toggleSnippets);
}

function toggleSnippets() {
  if (!dom.snippetsBody.hidden) {
    dom.snippetsBody.hidden = true;
    dom.snippetsChevron.classList.remove("open");
    snippetsOpen = false;
  } else {
    dom.snippetsBody.hidden = false;
    dom.snippetsChevron.classList.add("open");
    snippetsOpen = true;
    snippetsView = "list";
    renderSnippetsList();
  }
}

function renderSnippetsList() {
  const body = dom.snippetsBody;
  body.innerHTML = "";

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "tmpl-toolbar";
  const label = document.createElement("span");
  label.style.cssText = "font-size:11px;color:#8a8a93;";
  label.textContent = "Type / in message to trigger";
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "tmpl-new-btn";
  newBtn.textContent = "+ New";
  newBtn.addEventListener("click", () => {
    snippetsView = "create";
    snippetsEditId = null;
    renderSnippetForm();
  });
  toolbar.appendChild(label);
  toolbar.appendChild(newBtn);
  body.appendChild(toolbar);

  const snippets = loadSnippets();
  if (snippets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tmpl-empty";
    empty.textContent = 'No snippets yet. Click + New to create one.';
    body.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "tmpl-list";
  for (const snip of snippets) {
    list.appendChild(renderSnippetItem(snip));
  }
  body.appendChild(list);
}

function renderSnippetItem(snip) {
  const row = document.createElement("div");
  row.className = "tmpl-item";

  const info = document.createElement("div");
  info.className = "tmpl-item-info";

  const trigger = document.createElement("div");
  trigger.className = "tmpl-item-title";
  trigger.style.color = "#c4b5fd";
  trigger.textContent = snip.trigger;

  const preview = document.createElement("div");
  preview.className = "tmpl-item-preview";
  preview.textContent = snip.body;

  info.appendChild(trigger);
  info.appendChild(preview);

  const actions = document.createElement("div");
  actions.className = "tmpl-item-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "tmpl-edit-btn";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    snippetsEditId = snip.id;
    snippetsView = "edit";
    renderSnippetForm();
  });

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "tmpl-del-btn";
  delBtn.textContent = "×";
  delBtn.title = "Delete snippet";
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteSnippet(snip.id);
  });

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function renderSnippetForm() {
  const body = dom.snippetsBody;
  body.innerHTML = "";

  const isEdit   = snippetsView === "edit";
  const existing = isEdit ? loadSnippets().find((s) => s.id === snippetsEditId) : null;

  const form = document.createElement("div");
  form.className = "tmpl-form";

  // Header
  const hdr = document.createElement("div");
  hdr.className = "tmpl-form-header";
  const heading = document.createElement("span");
  heading.className = "tmpl-form-title";
  heading.textContent = isEdit ? "Edit Snippet" : "New Snippet";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "tmpl-back-btn";
  backBtn.textContent = "← Back";
  backBtn.addEventListener("click", () => {
    snippetsView = "list";
    renderSnippetsList();
  });
  hdr.appendChild(heading);
  hdr.appendChild(backBtn);
  form.appendChild(hdr);

  // Trigger field
  const trigField = document.createElement("div");
  trigField.className = "tmpl-field";
  const trigLabel = document.createElement("label");
  trigLabel.className = "tmpl-field-label";
  trigLabel.textContent = "Trigger (e.g. /hi  /promo  /followup)";
  const trigInput = document.createElement("input");
  trigInput.type = "text";
  trigInput.id = "snipTriggerInput";
  trigInput.className = "tmpl-field-input";
  trigInput.placeholder = "/greeting";
  trigInput.value = existing ? existing.trigger : "/";
  trigField.appendChild(trigLabel);
  trigField.appendChild(trigInput);
  form.appendChild(trigField);

  // Body field
  const bodyField = document.createElement("div");
  bodyField.className = "tmpl-field";
  const bodyLabel = document.createElement("label");
  bodyLabel.className = "tmpl-field-label";
  bodyLabel.textContent = "Expanded text";
  const bodyInput = document.createElement("textarea");
  bodyInput.id = "snipBodyInput";
  bodyInput.className = "tmpl-field-textarea";
  bodyInput.placeholder = "Hi {firstName}! 👋";
  bodyInput.value = existing ? existing.body : "";
  bodyInput.rows = 3;
  bodyField.appendChild(bodyLabel);
  bodyField.appendChild(bodyInput);
  form.appendChild(bodyField);

  // Variable hint
  const hint = document.createElement("div");
  hint.className = "tmpl-vars-hint";
  hint.innerHTML = "Variables: <code>{name}</code> <code>{firstName}</code> <code>{username}</code>";
  form.appendChild(hint);

  // Error
  const errEl = document.createElement("div");
  errEl.id = "snipFormErr";
  errEl.className = "tmpl-err";
  form.appendChild(errEl);

  // Save button
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "tmpl-save-btn";
  saveBtn.textContent = isEdit ? "Save Changes" : "Create Snippet";
  saveBtn.addEventListener("click", () =>
    saveSnippetForm(trigInput, bodyInput, errEl)
  );
  form.appendChild(saveBtn);

  body.appendChild(form);
  trigInput.focus();
  // Place cursor at end of trigger
  trigInput.setSelectionRange(trigInput.value.length, trigInput.value.length);
}

function saveSnippetForm(trigInput, bodyInput, errEl) {
  let trigger = trigInput.value.trim();
  const body  = bodyInput.value.trim();

  if (!trigger) { errEl.textContent = "Trigger is required."; return; }
  // Ensure trigger starts with /
  if (!trigger.startsWith("/")) trigger = "/" + trigger;
  if (trigger.length < 2) { errEl.textContent = "Trigger must have at least one character after /."; return; }
  if (!body) { errEl.textContent = "Expanded text is required."; return; }

  // Check for duplicate trigger (on create, or on edit if trigger changed)
  const snippets = loadSnippets();
  const duplicate = snippets.find(
    (s) => s.trigger.toLowerCase() === trigger.toLowerCase() && s.id !== snippetsEditId
  );
  if (duplicate) { errEl.textContent = "A snippet with this trigger already exists."; return; }
  errEl.textContent = "";

  if (snippetsView === "edit" && snippetsEditId) {
    const idx = snippets.findIndex((s) => s.id === snippetsEditId);
    if (idx !== -1) snippets[idx] = { ...snippets[idx], trigger, body };
  } else {
    snippets.push({ id: generateSnippetId(), trigger, body });
  }
  saveSnippets(snippets);
  snippetsView  = "list";
  snippetsEditId = null;
  renderSnippetsList();
}

function deleteSnippet(id) {
  saveSnippets(loadSnippets().filter((s) => s.id !== id));
  renderSnippetsList();
}

// ─────────────────────────────────────────────────────────────────────────────

// ── Labels (A3) ─────────────────────────────────────────────────────────────

async function toggleLabelOnContact(contactId, labelKey, add) {
  const type = add ? "ADD_TAG" : "DELETE_TAG";
  const res = await send({ type, body: { contactId: Number(contactId), name: labelKey } });
  if (!res || !res.ok) return;
  // Re-fetch and re-render the details panel
  const fresh = await send({ type: "GET_CONTACT", body: { contactId } });
  if (fresh && fresh.ok && fresh.data && currentDetailsId === String(contactId)) {
    currentProfile = fresh.data;
    renderDetailsPanel(fresh.data);
    // Also refresh contacts list so label badge updates on list row
    loadContacts();
  }
}

// ── Activity Timeline (A4) ────────────────────────────────────────────────────────

let timelineOpen = false;
let timelineCache = {};
let timelineFilter = "all"; // "all" | "message" | "note" | "purchase" | "tag"

const TL_FILTERS = [
  { key: "all",      label: "All" },
  { key: "message",  label: "Messages" },
  { key: "note",     label: "Notes" },
  { key: "purchase", label: "Purchases" },
  { key: "tag",      label: "Tags" },
];

const TL_ICONS = {
  message_in:  "\ud83d\udce8",
  message_out: "\ud83d\udce4",
  purchase:    "\ud83d\udcb0",
  note:        "\ud83d\udcdd",
  tag_added:   "\ud83c\udff7\ufe0f",
  tag_removed: "\u274c",
};

function tlEventMatchesFilter(ev) {
  if (timelineFilter === "all") return true;
  if (timelineFilter === "message") return ev.type === "message_in" || ev.type === "message_out";
  if (timelineFilter === "note")    return ev.type === "note";
  if (timelineFilter === "purchase") return ev.type === "purchase";
  if (timelineFilter === "tag")    return ev.type === "tag_added" || ev.type === "tag_removed";
  return true;
}

function tlFormatTime(ts) {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
      + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  } catch (_) { return ""; }
}

function tlEventLabel(ev) {
  switch (ev.type) {
    case "message_in":  return "Fan";
    case "message_out": return "You";
    case "purchase":    return "Purchase $" + Number(ev.amount || 0).toFixed(2);
    case "note":        return "Note";
    case "tag_added":   return "Tag added";
    case "tag_removed": return "Tag removed";
    default:            return ev.type;
  }
}

async function toggleTimelineSection() {
  const id = String(currentDetailsId || "");
  if (!id) return;
  const body    = document.getElementById("timelineBody");
  const chevron = document.getElementById("timelineChevron");
  if (!body || !chevron) return;
  timelineOpen = !timelineOpen;
  if (timelineOpen) {
    body.classList.add("open");
    chevron.classList.add("open");
    if (timelineCache[id]) {
      renderTimelineBody(timelineCache[id]);
    } else {
      await loadTimeline(id);
    }
  } else {
    body.classList.remove("open");
    chevron.classList.remove("open");
  }
}

async function loadTimeline(contactId) {
  const id   = String(contactId || "");
  if (!id) return;
  const body = document.getElementById("timelineBody");
  if (body) {
    body.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "timeline-loading";
    loading.textContent = "Loading activity\u2026";
    body.appendChild(loading);
  }
  const res = await send({ type: "GET_TIMELINE", body: { contactId: id, limit: 60 } });
  if (!res || !res.ok) {
    if (body) {
      body.innerHTML = "";
      const err = document.createElement("div");
      err.className = "timeline-empty";
      err.textContent = "Failed to load activity";
      body.appendChild(err);
    }
    return;
  }
  const events = Array.isArray(res.data) ? res.data : [];
  timelineCache[id] = events;
  renderTimelineBody(events);
}

function renderTimelineBody(events) {
  const body = document.getElementById("timelineBody");
  if (!body) return;
  body.innerHTML = "";

  // Filter buttons
  const filterRow = document.createElement("div");
  filterRow.className = "timeline-filter";
  for (const f of TL_FILTERS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "timeline-filter-btn" + (timelineFilter === f.key ? " active" : "");
    btn.textContent = f.label;
    btn.addEventListener("click", () => {
      timelineFilter = f.key;
      renderTimelineBody(events);
    });
    filterRow.appendChild(btn);
  }
  body.appendChild(filterRow);

  const filtered = events.filter(tlEventMatchesFilter);

  const list = document.createElement("div");
  list.className = "timeline-list";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "timeline-empty";
    empty.textContent = timelineFilter === "all" ? "No activity yet" : "No events of this type";
    list.appendChild(empty);
  } else {
    for (const ev of filtered) {
      list.appendChild(renderTimelineEvent(ev));
    }
  }
  body.appendChild(list);
}

function renderTimelineEvent(ev) {
  const row = document.createElement("div");
  row.className = "tl-event";

  const icon = document.createElement("span");
  icon.className = "tl-icon";
  icon.textContent = TL_ICONS[ev.type] || "\u2022";

  const content = document.createElement("div");
  content.className = "tl-body";

  const meta = document.createElement("div");
  meta.className = "tl-meta";
  meta.textContent = tlEventLabel(ev) + (ev.timestamp ? " \u00b7 " + tlFormatTime(ev.timestamp) : "");

  const text = document.createElement("div");
  text.className = "tl-text";
  text.textContent = String(ev.text || "");

  content.appendChild(meta);
  if (ev.text) content.appendChild(text);

  row.appendChild(icon);
  row.appendChild(content);
  return row;
}

init();
