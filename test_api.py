import urllib.request
import json

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=YOUR_API_KEY_HERE"

payload = {
    "systemInstruction": {
        "parts": [{"text": "SYSTEM_PROMPT"}]
    },
    "contents": [
        {"role": "user", "parts": [{"text": "hey"}]},
        {"role": "model", "parts": [{"text": "Hey there! smiles warmly I was just thinking about you."}]},
        {"role": "user", "parts": [{"text": "ohh very good"}]}
    ],
    "generationConfig": {
        "temperature": 0.9,
        "topK": 40,
        "topP": 0.95,
    }
}
data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    response = urllib.request.urlopen(req)
    print(response.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
