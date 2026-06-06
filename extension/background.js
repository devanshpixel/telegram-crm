const CRM_BASE = "http://localhost:3000";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "PING") {
    fetch(CRM_BASE + "/api/contacts", { method: "GET" })
      .then((r) => sendResponse({ ok: r.ok, status: r.status }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "GET_CONTACTS") {
    fetch(CRM_BASE + "/api/contacts", { method: "GET" })
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "CREATE_CONTACT") {
    fetch(CRM_BASE + "/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.body),
    })
      .then(async (r) => ({ ok: r.ok, status: r.status, data: r.ok ? await r.json() : null }))
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "SEND_MESSAGE") {
    fetch(CRM_BASE + "/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.body),
    })
      .then(async (r) => ({ ok: r.ok, status: r.status, data: r.ok ? await r.json() : null }))
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});
