const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

export async function extractTextFromImageUrl(imageUrl: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return "";

  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!imgRes.ok) return "";
    const base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

    const res = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: "TEXT_DETECTION" }],
        }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return "";

    const data = await res.json();
    return data.responses?.[0]?.fullTextAnnotation?.text ?? "";
  } catch {
    return "";
  }
}
