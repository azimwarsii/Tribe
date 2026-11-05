/**
 * Speech to text for Ask Chief's mic, done on the server so it works in every browser (Brave ships no built-in speech
 * recognition). The browser records a short WAV and Tribe asks an audio-capable model on the OpenAI-compatible API
 * (OpenRouter) to write down exactly what was said.
 */
export async function transcribe(wavBase64: string): Promise<string> {
  const key = process.env.OPENAI_COMPAT_API_KEY;
  if (!key) throw new Error("Voice needs an AI key on the server (OPENAI_COMPAT_API_KEY).");
  const url = `${(process.env.OPENAI_COMPAT_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "Tribe" },
    body: JSON.stringify({
      model: process.env.TRANSCRIBE_MODEL ?? "google/gemini-2.5-flash-lite",
      temperature: 0,
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Transcribe this voice message exactly as spoken. Reply with only the words, no quotes or notes. If nothing is said, reply with nothing." },
          { type: "input_audio", input_audio: { data: wavBase64, format: "wav" } },
        ],
      }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!r.ok) throw new Error(`Couldn't transcribe that: ${j.error?.message ?? r.status}`);
  return (j.choices?.[0]?.message?.content ?? "").trim().replace(/^["“]|["”]$/g, "");
}
