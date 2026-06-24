import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, Send } from 'lucide-react';
import Live2DAvatar from './components/Live2DAvatar';
import { callGeminiAPI } from './services/gemini';
import { getTTSAudio } from './services/elevenlabs';
import './App.css'; // Let's use some simple CSS

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('ciphra_gemini_key') || '');
  const [elevenLabsKey, setElevenLabsKey] = useState(localStorage.getItem('ciphra_elevenlabs_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sentiment, setSentiment] = useState('neutral');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeakingText, setIsSpeakingText] = useState(false);

  // Audio state
  const audioContextRef = useRef(null);
  const [audioSource, setAudioSource] = useState(null);

  // Speech Recognition
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Initialize Web Audio API on first interaction
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }
    };
    window.addEventListener('click', initAudioContext, { once: true });

    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleSendMessage(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      console.warn("Web Speech API not supported in this browser.");
    }

    return () => {
      window.removeEventListener('click', initAudioContext);
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('ciphra_gemini_key', apiKey);
    localStorage.setItem('ciphra_elevenlabs_key', elevenLabsKey);
    setShowSettings(false);
  };

  const playAudio = async (arrayBuffer) => {
    if (!audioContextRef.current) return;
    const audioContext = audioContextRef.current;
    
    // Stop any existing playing audio
    // (A more robust implementation would use a queue or handle overlaps)
    
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      setAudioSource(source); // Pass to Live2DAvatar for lip sync
      source.start();
    } catch (e) {
      console.error("Error playing audio:", e);
    }
  };

  const handleSendMessage = async (textToUse) => {
    const text = textToUse || inputText;
    if (!text.trim() || !apiKey) return;

    // Optional: Stop current speech synthesis if it's talking
    window.speechSynthesis.cancel();
    setIsSpeakingText(false);

    setInputText('');
    const newMessages = [...messages, { role: 'user', parts: [{ text }] }];
    setMessages(newMessages);
    setIsThinking(true);

    try {
      // 1. Get response from Gemini
      const response = await callGeminiAPI(newMessages, apiKey);
      
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: response.text }] }]);
      setSentiment(response.sentiment);

      // 2. Play TTS Audio (uses ElevenLabs if key exists, otherwise free fallback)
      if (elevenLabsKey) {
        const audioBuffer = await getTTSAudio(response.text, elevenLabsKey);
        await playAudio(audioBuffer);
      } else {
        // Native Web Speech Fallback without APIs
        console.log("No ElevenLabs key provided, using native browser TTS fallback.");
        const utterance = new SpeechSynthesisUtterance(response.text);
        
        // Prioritize natural-sounding cloud voices over robotic local ones
        const voices = window.speechSynthesis.getVoices();
        const preferredVoices = [
            'Microsoft Aria Online', // Extremely realistic female Edge voice
            'Microsoft Jenny Online',
            'Google UK English Female', // Realistic Google voice
            'Google US English', // Realistic Google voice
            'Samantha', // Good macOS voice
            'Microsoft Hazel', // Better Windows voice
            'Microsoft Zira' // Last resort Windows voice
        ];
        
        let selectedVoice = null;
        for (let pref of preferredVoices) {
            selectedVoice = voices.find(v => v.name.includes(pref));
            if (selectedVoice) break;
        }
        
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.name.includes('Female')) || voices[0];
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        // Pitch 1.4 makes it sound like a chipmunk/robot, 1.1 or 1.2 is a natural cute voice
        utterance.pitch = 1.15; 
        utterance.rate = 1.05;

        utterance.onstart = () => setIsSpeakingText(true);
        utterance.onend = () => setIsSpeakingText(false);
        utterance.onerror = () => setIsSpeakingText(false);
        window.speechSynthesis.speak(utterance);
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Oops, something went wrong!" }] }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar / Dock */}
      <div className="sidebar glass">
        <div className="sidebar-header">
          <h2>Ciphra</h2>
        </div>
        <div className="sidebar-content">
          <div className="status-card">
            <div className="avatar-container" style={{ flex: 'none', marginRight: '10px' }}>
              <div className="avatar">C</div>
              <div className={`status-indicator ${elevenLabsKey || apiKey ? 'online' : ''}`}></div>
            </div>
            <div className="status-info">
              <h3>Live2D Engine</h3>
              <p>{elevenLabsKey || apiKey ? 'Connected' : 'Configure API Keys'}</p>
            </div>
          </div>
          <div className="mode-selector">
            <h4>Current Mode</h4>
            <div className="mode-badge">
              <span>⚡ Active Chat</span>
            </div>
            <p className="mode-desc">Native browser TTS with simulated lip-sync enabled.</p>
          </div>
        </div>
        <div className="sidebar-footer">
          <button onClick={() => setShowSettings(!showSettings)} className="icon-btn">
            <Settings size={20} /> Settings
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <main className="chat-area">
        {/* Avatar Area */}
        <div className="avatar-container" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}>
          <Live2DAvatar 
            audioContext={audioContextRef.current} 
            audioSource={audioSource} 
            sentiment={sentiment} 
            isSpeakingText={isSpeakingText}
          />
        </div>

        {/* Header Overlay */}
        <div className="chat-header glass">
          <div className="companion-name">Ciphra Assistant</div>
        </div>

        {/* Messages Container */}
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="system-message">Welcome! Try saying hello to Ciphra.</div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role === 'user' ? 'message-user' : 'message-ciphra'}`}>
              <div className="message-bubble">
                {msg.parts[0].text}
                <span className="message-time">Just now</span>
              </div>
            </div>
          ))}
          {isThinking && <div className="message message-ciphra"><div className="message-bubble typing"><span></span><span></span><span></span></div></div>}
        </div>

        {/* Input Area */}
        <div className="input-area">
          <div className="input-wrapper">
            <button 
              className={`mic-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleListening}
              title="Push to talk"
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <input 
              id="message-input"
              type="text" 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type or speak a message..."
            />
            <button className="send-btn" onClick={() => handleSendMessage()} disabled={!inputText.trim() && !isListening}>
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-modal">
          <div className="settings-content">
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Gemini API Key</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AI Model Key..." />
              </div>
              <div className="form-group">
                <label>ElevenLabs API Key</label>
                <input type="password" value={elevenLabsKey} onChange={e => setElevenLabsKey(e.target.value)} placeholder="Voice Engine Key (Optional)..." />
                <small>Leave blank to use native browser TTS.</small>
              </div>
              <button onClick={saveSettings} className="primary-btn">Save Configuration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
