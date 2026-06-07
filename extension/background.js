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
  if (msg?.type === "GET_FOLLOWUPS") {
    fetch(CRM_BASE + "/api/followups?limit=20")
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "GET_REENGAGEMENT_COUNTS") {
    fetch(CRM_BASE + "/api/reengagement/audiences")
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "SEND_REENGAGEMENT") {
    fetch(CRM_BASE + "/api/reengagement/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.body),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "CREATE_CONTACT") {
    fetch(CRM_BASE + "/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.body),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "GET_CONTACT") {
    const contactId = msg?.body?.contactId;
    fetch(CRM_BASE + "/api/contacts/" + encodeURIComponent(String(contactId)), {
      method: "GET",
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "GET_MESSAGES") {
    const contactId = msg?.body?.contactId;
    fetch(CRM_BASE + "/api/contacts/" + encodeURIComponent(String(contactId)) + "/messages", {
      method: "GET",
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "UPDATE_CONTACT") {
    const contactId = msg?.body?.contactId;
    fetch(CRM_BASE + "/api/contacts/" + encodeURIComponent(String(contactId)), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.body.patch || {}),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "ADD_TAG") {
    fetch(CRM_BASE + "/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.body),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "DELETE_TAG") {
    fetch(CRM_BASE + "/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.body),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "SEND_MESSAGE") {
    console.log("[BG] SEND_MESSAGE incoming", msg);
    const url = CRM_BASE + "/api/messages";
    const bodyStr = JSON.stringify(msg.body);
    console.log("[BG] SEND_MESSAGE request", { url, method: "POST", body: bodyStr });
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
    })
      .then(async (r) => {
        console.log("[BG] SEND_MESSAGE status", r.status);
        const body = await r.json().catch(() => null);
        console.log("[BG] SEND_MESSAGE body", body);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => {
        console.log("[BG] SEND_MESSAGE sendResponse", res);
        sendResponse(res);
      })
      .catch((e) => {
        console.log("[BG] SEND_MESSAGE catch", String(e));
        sendResponse({ ok: false, error: String(e) });
      });
    return true;
  }
  if (msg?.type === "GET_TIMELINE") {
    const contactId = msg?.body?.contactId;
    const limit = msg?.body?.limit || 60;
    fetch(CRM_BASE + "/api/contacts/" + encodeURIComponent(String(contactId)) + "/timeline?limit=" + limit, {
      method: "GET",
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});
