const CRM_BASE = "http://localhost:3000";

let allContacts = [];
let searchTerm = "";
let selectedContact = null;

const dom = {
  status: document.getElementById("status"),
  content: document.getElementById("content"),
  selectedBar: document.getElementById("selectedBar"),
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
    ".empty-list{margin:0;}";
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

function selectContact(c) {
  selectedContact = c;
  dom.selectedBar.textContent = "To: " + (c.name || c.username || c.id);
  dom.selectedBar.style.display = "block";
  dom.sendForm.style.display = "flex";
  dom.sendText.value = "";
  setMessage(dom.sendMsg, "");
  dom.sendText.focus();
}

function clearSelection() {
  selectedContact = null;
  dom.selectedBar.style.display = "none";
  dom.sendForm.style.display = "none";
  dom.sendText.value = "";
  setMessage(dom.sendMsg, "");
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
