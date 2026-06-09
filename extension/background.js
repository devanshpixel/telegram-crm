const CRM_BASE = "http://localhost:3000";
const CRM_KEY = "16be7932a405cf8d";

function crmFetch(url, options) {
  const headers = new Headers(options?.headers);
  headers.set("X-API-Key", CRM_KEY);
  return fetch(url, { ...options, headers });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "PING") {
    crmFetch(CRM_BASE + "/api/contacts", { method: "GET" })
      .then((r) => sendResponse({ ok: r.ok, status: r.status }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "GET_CONTACTS") {
    crmFetch(CRM_BASE + "/api/contacts", { method: "GET" })
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "GET_FOLLOWUPS") {
    crmFetch(CRM_BASE + "/api/followups?limit=20")
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "GET_REENGAGEMENT_COUNTS") {
    crmFetch(CRM_BASE + "/api/reengagement/audiences")
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "SEND_REENGAGEMENT") {
    crmFetch(CRM_BASE + "/api/reengagement/send", {
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
    crmFetch(CRM_BASE + "/api/contacts", {
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
    crmFetch(CRM_BASE + "/api/contacts/" + encodeURIComponent(String(contactId)), {
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
  if (msg?.type === "GET_CONTACT_MEDIA") {
    const contactId = msg?.body?.contactId;
    crmFetch(CRM_BASE + "/api/media?contactId=" + encodeURIComponent(String(contactId)), {
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
  if (msg?.type === "CREATE_MEDIA_UNLOCK_CHECKOUT") {
    crmFetch(CRM_BASE + "/api/checkout/create-session", {
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
  if (msg?.type === "UPLOAD_MEDIA") {
    (async () => {
      try {
        const { contactId, price, fileName, fileData } = msg.body;
        // Convert base64 Data URL to Blob
        const fetchRes = await fetch(fileData);
        const blob = await fetchRes.blob();
        
        const formData = new FormData();
        formData.append("contactId", contactId);
        formData.append("price", price);
        formData.append("file", blob, fileName);

        const r = await crmFetch(CRM_BASE + "/api/media/upload", {
          method: "POST",
          body: formData, // fetch will set multipart/form-data with boundary
        });
        
        const body = await r.json().catch(() => null);
        sendResponse({ ok: r.ok, status: r.status, data: body });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg?.type === "GET_MESSAGES") {
    const contactId = msg?.body?.contactId;
    crmFetch(CRM_BASE + "/api/contacts/" + encodeURIComponent(String(contactId)) + "/messages", {
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
    crmFetch(CRM_BASE + "/api/contacts/" + encodeURIComponent(String(contactId)), {
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
    crmFetch(CRM_BASE + "/api/tags", {
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
    crmFetch(CRM_BASE + "/api/tags", {
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
    const url = CRM_BASE + "/api/telegram/send";
    const bodyStr = JSON.stringify(msg.body);
    console.log("[BG] SEND_MESSAGE request", { url, method: "POST", body: bodyStr });
    crmFetch(url, {
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
  if (msg?.type === "GENERATE_REPLY") {
    const contactId = msg?.body?.contactId;
    crmFetch(CRM_BASE + "/api/ai/suggest-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "GET_TIMELINE") {
    const contactId = msg?.body?.contactId;
    const limit = msg?.body?.limit || 60;
    crmFetch(CRM_BASE + "/api/contacts/" + encodeURIComponent(String(contactId)) + "/timeline?limit=" + limit, {
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
  if (msg?.type === "ADD_NOTE") {
    crmFetch(CRM_BASE + "/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: msg?.body?.contactId, content: msg?.body?.content }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        return { ok: r.ok, status: r.status, data: body };
      })
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "CREATE_FOLLOWUP") {
    // No dedicated followup schedule table exists — store as a note with [FOLLOWUP] prefix.
    const { contactId, message, scheduledAt } = msg?.body || {};
    const content = "[FOLLOWUP " + (scheduledAt || "TBD") + "] " + (message || "");
    crmFetch(CRM_BASE + "/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, content }),
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
