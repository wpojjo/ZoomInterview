const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

export async function extractTextFromImageUrl(imageUrl: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return "";

  try {
    const res = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
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
