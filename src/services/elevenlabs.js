// ElevenLabs / Free Fallback TTS API
export async function getTTSAudio(text, apiKey, voiceId = "EXAVITQu4vr4xnSDxMaL") {
    let url, options;

    if (!apiKey) {
        // Free Fallback TTS using Google Translate TTS via CORS proxy
        console.log("No ElevenLabs key provided, using free fallback TTS.");
        const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
        url = `https://corsproxy.io/?${targetUrl}`;
        options = { method: 'GET' };
    } else {
        // ElevenLabs API
        url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
        options = {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        };
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`TTS API Error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
}
