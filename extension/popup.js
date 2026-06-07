const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response));
  });
}

function setStatus(ok) {
  if (ok) {
    statusEl.textContent = "CRM Connected";
    statusEl.className = "status on";
  } else {
    statusEl.textContent = "CRM Offline";
    statusEl.className = "status off";
  }
}

function render(contacts) {
  if (!contacts || contacts.length === 0) {
    contentEl.innerHTML = '<p class="empty">No contacts yet</p>';
    return;
  }
  const ul = document.createElement("ul");
  for (const c of contacts) {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = c.name || "(no name)";
    const user = document.createElement("div");
    user.className = "user";
    user.textContent = c.username || "";
    left.appendChild(name);
    left.appendChild(user);
    li.appendChild(left);
    if (c.unreadCount && c.unreadCount > 0) {
      const badge = document.createElement("span");
      badge.className = "unread";
      badge.textContent = String(c.unreadCount);
      li.appendChild(badge);
    }
    li.addEventListener("click", () => selectContact(c));
    ul.appendChild(li);
  }
  contentEl.innerHTML = "";
  contentEl.appendChild(ul);
}

let selectedContact = null;
const selectedBar = document.getElementById("selectedBar");
const sendForm = document.getElementById("sendForm");
const sendMsg = document.getElementById("sendMsg");

function selectContact(c) {
  selectedContact = c;
  selectedBar.textContent = "To: " + (c.name || c.username || c.id);
  selectedBar.style.display = "block";
  sendForm.style.display = "flex";
  sendMsg.textContent = "";
  sendMsg.className = "msg";
  document.getElementById("sendText").value = "";
  document.getElementById("sendText").focus();
}

async function init() {
  const ping = await send({ type: "PING" });
  setStatus(ping && ping.ok);
  if (ping && ping.ok) {
    await loadContacts();
    bindForm();
    bindSendForm();
  } else {
    contentEl.innerHTML = '<p class="empty">Start the CRM at localhost:3000</p>';
  }
}

function bindSendForm() {
  const form = document.getElementById("sendForm");
  const btn = document.getElementById("sendBtn");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedContact) {
      sendMsg.className = "msg err";
      sendMsg.textContent = "Select a contact first";
      return;
    }
    const text = document.getElementById("sendText").value.trim();
    if (!text) return;
    btn.disabled = true;
    sendMsg.className = "msg";
    sendMsg.textContent = "Sending...";
    const res = await send({ type: "SEND_MESSAGE", body: { contactId: Number(selectedContact.id), text } });
    console.log("[PU] SEND_MESSAGE response", res);
    if (res && res.ok) {
      sendMsg.className = "msg ok";
      sendMsg.textContent = "Sent";
      document.getElementById("sendText").value = "";
      await loadContacts();
      setTimeout(() => { sendMsg.textContent = ""; sendMsg.className = "msg"; }, 2000);
    } else {
      sendMsg.className = "msg err";
      sendMsg.textContent = "Failed: " + ((res && (res.data?.error || res.error)) || "unknown");
    }
    btn.disabled = false;
  });
}

async function loadContacts() {
  const res = await send({ type: "GET_CONTACTS" });
  if (res && res.ok && Array.isArray(res.data)) {
    render(res.data);
  } else {
    contentEl.innerHTML = '<p class="empty">Failed to load contacts</p>';
  }
}

function bindForm() {
  const form = document.getElementById("newContact");
  const msg = document.getElementById("formMsg");
  const btn = document.getElementById("createBtn");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    msg.className = "msg";
    msg.textContent = "Creating...";
    const body = {
      name: document.getElementById("fName").value.trim(),
      username: document.getElementById("fUser").value.trim(),
    };
    const phone = document.getElementById("fPhone").value.trim();
    if (phone) body.phone = phone;
    const res = await send({ type: "CREATE_CONTACT", body });
    if (res && res.ok) {
      msg.className = "msg ok";
      msg.textContent = "Created. Refreshing...";
      form.reset();
      await loadContacts();
      setTimeout(() => { msg.textContent = ""; msg.className = "msg"; }, 1500);
    } else {
      msg.className = "msg err";
      msg.textContent = "Failed: " + ((res && (res.data?.error || res.error)) || "unknown");
    }
    btn.disabled = false;
  });
}

init();
