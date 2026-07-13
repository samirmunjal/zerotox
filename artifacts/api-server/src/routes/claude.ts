import { Router } from "express";

const claudeRouter = Router();

claudeRouter.post("/claude", async (req, res) => {
  const { imageBase64, mediaType } = req.body as { imageBase64?: string; mediaType?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  const allowedMediaTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type AllowedMediaType = typeof allowedMediaTypes[number];
  const resolvedMediaType: AllowedMediaType =
    allowedMediaTypes.includes(mediaType as AllowedMediaType)
      ? (mediaType as AllowedMediaType)
      : "image/jpeg";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    req.log.error("ANTHROPIC_API_KEY is not configured");
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
    return;
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
                source: { type: "base64", media_type: resolvedMediaType, data: imageBase64 },
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
      req.log.error({ status: response.status, err }, "Upstream Claude API error");
      res.status(502).json({ error: "Upstream Claude API error", detail: err });
      return;
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    const ingredientsText = data.content?.map((b) => b.text || "").join("").trim() || "";

    res.status(200).json({ ingredientsText });
  } catch (err) {
    req.log.error({ err }, "Server error in Claude route");
    res.status(500).json({ error: "Server error", detail: (err as Error).message });
  }
});

export default claudeRouter;
