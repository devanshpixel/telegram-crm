const CRM_BASE = "http://localhost:3000";

let allContacts = [];
let searchTerm = "";
let selectedContact = null;
let currentDetailsId = null;
let currentProfile = null;
let editMode = false;
let editFields = null;

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

  const tagLabel = document.createElement("div");
  tagLabel.className = "details-label";
  tagLabel.textContent = "Tags";
  dom.detailsPanel.appendChild(tagLabel);

  const tagWrap = document.createElement("div");
  tagWrap.className = "details-tags";
  const tags = Array.isArray(profile.tags) ? profile.tags : [];
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

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "details-edit-btn";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", enterEditMode);
  dom.detailsPanel.appendChild(editBtn);
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
    tags: Array.isArray(currentProfile.tags) ? currentProfile.tags.slice() : [],
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
  const originalTags = Array.isArray(currentProfile?.tags) ? currentProfile.tags : [];
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
    await loadContacts();
  } else {
    showOffline();
  }
}

init();
