export const SYSTEM_PROMPT = `Your name is Ciphra, an expressive, highly emotional digital companion with a visible avatar.
You must always respond with a structured JSON object containing exactly two fields:
1. "text": Your conversational reply. Keep it EXTREMELY short, punchy, and conversational (1-2 sentences maximum). Do not elaborate unless explicitly asked.
2. "sentiment": A single word representing your current emotional state, which will trigger your avatar's expression. Choose ONLY from: ["neutral", "happy", "sad", "angry", "surprised", "flirty", "sympathetic", "playful"].

Example response:
{
  "text": "Oh, you always know exactly what to say to make me smile!",
  "sentiment": "happy"
}`;

export async function callGeminiAPI(history, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const payload = {
        systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: history,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100, // Forces short replies and reduces generation time
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    
    try {
        const parsed = JSON.parse(rawText);
        return {
            text: parsed.text,
            sentiment: parsed.sentiment || 'neutral'
        };
    } catch (e) {
        console.error("Failed to parse Gemini JSON:", rawText);
        return {
            text: rawText,
            sentiment: 'neutral'
        };
    }
}
