import "dotenv/config";

async function testAI() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is missing");
    return;
  }

  console.log("Testing OpenRouter...");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "say hello" }],
        max_tokens: 100,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log("SUCCESS: AI Responded:", data.choices[0].message.content);
    } else {
      console.error("FAILURE: AI Status:", res.status, await res.text());
    }
  } catch (err) {
    console.error("FAILURE: AI Error:", err);
  }
}

testAI();
