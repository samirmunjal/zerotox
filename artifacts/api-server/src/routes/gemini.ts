import { Router } from "express";

const geminiRouter = Router();

geminiRouter.post("/gemini", async (req, res) => {
  const { imageBase64, mediaType, googleApiKey } = req.body as {
    imageBase64?: string;
    mediaType?: string;
    googleApiKey?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  if (!googleApiKey || !googleApiKey.trim()) {
    res.status(400).json({ error: "googleApiKey is required" });
    return;
  }

  const allowedMediaTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type AllowedMediaType = typeof allowedMediaTypes[number];
  const resolvedMediaType: AllowedMediaType =
    allowedMediaTypes.includes(mediaType as AllowedMediaType)
      ? (mediaType as AllowedMediaType)
      : "image/jpeg";

  const model = "gemini-1.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey.trim()}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: resolvedMediaType,
                  data: imageBase64,
                },
              },
              {
                text: "Extract ONLY the ingredients list from this product label image. Return them as a single comma-separated string, nothing else. No explanation, no preamble — just the ingredients separated by commas.",
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      req.log.error({ status: response.status, err }, "Upstream Gemini API error");
      // Surface a clean message for common auth errors
      if (response.status === 400 || response.status === 403) {
        res.status(401).json({ error: "Invalid Google API key or permission denied.", detail: err });
      } else {
        res.status(502).json({ error: "Upstream Gemini API error", detail: err });
      }
      return;
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const ingredientsText =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim() || "";

    res.status(200).json({ ingredientsText });
  } catch (err) {
    req.log.error({ err }, "Server error in Gemini route");
    res.status(500).json({ error: "Server error", detail: (err as Error).message });
  }
});

export default geminiRouter;
