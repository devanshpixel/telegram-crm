const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/free";

function buildTranscript(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): string {
  return messages
    .map((m) => (m.direction === "incoming" ? "Fan" : "You") + ": " + m.text)
    .join("\n");
}

export async function suggestReply(
  messages: { text: string; direction: "incoming" | "outgoing" }[],
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const transcript = buildTranscript(messages);

  const systemPrompt =
    "You are writing a natural human reply to continue the conversation.\n" +
    "\n" +
    "Reply only with the message text.\n" +
    "\n" +
    "No explanations.\n" +
    "No quotes.\n" +
    "No prefixes.\n" +
    "No labels.";

  const userPrompt = transcript
    ? "Recent messages:\n" + transcript + "\n\nSuggested reply:"
    : "The conversation is just starting.\n\nSuggested reply:";

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error("OpenRouter request failed: " + res.status + " " + err);
  }

  const body = await res.json();
  const text: string | undefined = body?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenRouter returned empty response");
  }

  return text.trim();
}
