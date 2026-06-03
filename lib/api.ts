import type {
  Chat,
  ContactProfile,
  DashboardStats,
  Message,
  MessageDirection,
} from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data as T;
}

function reviveChat(chat: Chat): Chat {
  return { ...chat, lastMessageTime: new Date(chat.lastMessageTime) };
}

function reviveMessage(m: Message): Message {
  return { ...m, timestamp: new Date(m.timestamp) };
}

export async function fetchChats(): Promise<Chat[]> {
  const data = await parseJson<Chat[]>(await fetch("/api/contacts"));
  return data.map(reviveChat);
}

export async function fetchStats(): Promise<DashboardStats> {
  return parseJson<DashboardStats>(await fetch("/api/stats"));
}

export async function fetchContact(id: string): Promise<ContactProfile> {
  return parseJson<ContactProfile>(await fetch(`/api/contacts/${id}`));
}

export async function fetchMessages(contactId: string): Promise<Message[]> {
  const data = await parseJson<Message[]>(
    await fetch(`/api/contacts/${contactId}/messages`),
  );
  return data.map(reviveMessage);
}

export async function createContactApi(body: {
  name: string;
  username: string;
  phone?: string;
  email?: string;
  company?: string;
  location?: string;
  revenue?: number;
}): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function updateContactApi(
  id: string,
  body: Record<string, unknown>,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteContactApi(id: string): Promise<void> {
  await parseJson<{ success: boolean }>(
    await fetch(`/api/contacts/${id}`, { method: "DELETE" }),
  );
}

export async function addNoteApi(
  contactId: string,
  content: string,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: Number(contactId), content }),
    }),
  );
}

export async function addTagApi(
  contactId: string,
  name: string,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: Number(contactId), name }),
    }),
  );
}

export async function deleteTagApi(
  contactId: string,
  name: string,
): Promise<ContactProfile> {
  return parseJson<ContactProfile>(
    await fetch("/api/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: Number(contactId), name }),
    }),
  );
}

export async function createMessageApi(
  contactId: string,
  text: string,
  direction: MessageDirection = "outgoing",
): Promise<Message> {
  const data = await parseJson<Message>(
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: Number(contactId),
        text,
        direction,
      }),
    }),
  );
  return reviveMessage(data);
}
