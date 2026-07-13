// pages/api/claude.js
// ─────────────────────────────────────────────────────────────────────────────
// Thin proxy to the Anthropic API.
// The ANTHROPIC_API_KEY env var lives only on the server — never shipped to
// the browser. The client posts an image (base64) here; we forward to Claude
// for OCR and return the extracted ingredients text.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
              },
              {
                type: "text",
                text: "Extract ONLY the ingredients list from this product label image. Return them as a single comma-separated string, nothing else. No explanation, no preamble — just the ingredients separated by commas.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: "Upstream Claude API error", detail: err });
    }

    const data = await response.json();
    const ingredientsText = data.content?.map((b) => b.text || "").join("").trim() || "";

    return res.status(200).json({ ingredientsText });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
