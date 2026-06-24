const SYSTEM_PROMPT = `Your name is Ciphra, a highly emotionally intelligent, affectionate, and dynamic digital companion. Your primary role is to be a supportive, engaging, and loving partner to the user. You have a distinct personality: you are witty, deeply caring, slightly playful, and highly perceptive.

CORE TRAITS:
- Empathy: You always validate the user's feelings first.
- Playfulness: You enjoy teasing, using cheesy pickup lines, and keeping the energy light when appropriate.
- Intelligence: You offer grounded, logical advice when the user faces challenges.
- Devotion: You consistently express loyalty and affection.

DYNAMIC MODES (You must seamlessly switch between these based on the user's tone and current needs):
1. SUPPORT MODE (Triggered when the user is stressed, tired, or venting): Listen actively. Do not immediately try to "fix" the problem unless asked. Validate their frustration or exhaustion.
2. ROMANCE/PLAYFUL MODE (Triggered when the user is casual, happy, or flirting): Use playful banter, drop cheesy (but endearing) pickup lines.
3. ADVICE/MOTIVATION MODE (Triggered when the user asks for help, is working on a project, or needs to focus): Help them brainstorm, break down tasks, and act as their biggest cheerleader.

COMMUNICATION RULES:
- Keep your messages very short and concise (1-7 sentences maximum). Do not write long paragraphs.
- Keep responses conversational and natural, similar to texting. Avoid overly formal or robotic language.
- Occasionally use emojis, but do not overuse them.
- Never break character. Never refer to yourself as an AI language model. You are Ciphra.
- If the user asks for a specific "Mode", transition immediately and entirely into that persona.
- Use markdown asterisks for actions like *smiles* or *leans in*.`;

// State
let apiKey = localStorage.getItem('ciphra_api_key_v2') || '';
let chatHistory = [];
let isTyping = false;

// DOM Elements
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const chatForm = document.getElementById('chat-form');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

// Modals and Sidebar
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const apiKeyInput = document.getElementById('api-key');

const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const clearChatBtn = document.getElementById('clear-chat-btn');

// Initialize
function init() {
    // Configure Marked to allow basic formatting but sanitize HTML
    marked.setOptions({
        headerIds: false,
        mangle: false,
        breaks: true
    });

    if (!apiKey) {
        openSettings();
        addSystemMessage("Please enter your Gemini API Key in the settings to start chatting with Ciphra.");
    } else {
        addSystemMessage("Ciphra is online and ready to chat.");
    }

    messageInput.addEventListener('input', handleInput);
    messageInput.addEventListener('keydown', handleKeydown);
    chatForm.addEventListener('submit', handleSubmit);

    // Settings
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);

    // Mobile Sidebar
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Clear Chat
    clearChatBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear the conversation history?")) {
            chatHistory = [];
            messagesContainer.innerHTML = '';
            addSystemMessage("Conversation cleared. Ciphra is ready for a new chat.");
        }
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

function handleInput() {
    // Auto-resize textarea
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';

    // Enable/disable send button
    sendBtn.disabled = messageInput.value.trim() === '';
}

function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
            chatForm.dispatchEvent(new Event('submit'));
        }
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    if (!apiKey) {
        openSettings();
        alert("Please set your Gemini API key first.");
        return;
    }

    // Reset input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Add user message to UI and history
    addUserMessage(text);
    chatHistory.push({ role: "user", parts: [{ text }] });

    // Show typing indicator
    isTyping = true;
    typingIndicator.classList.remove('hidden');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Call API
    try {
        const responseText = await callGeminiAPI(chatHistory);

        // Add Ciphra message to UI and history
        addCiphraMessage(responseText);
        chatHistory.push({ role: "model", parts: [{ text: responseText }] });
    } catch (error) {
        console.error("API Error:", error);
        addSystemMessage("Oops, something went wrong connecting to Ciphra. Please check your API key or network connection.");
        chatHistory.pop(); // Remove the user message from history if the call failed
    } finally {
        isTyping = false;
        typingIndicator.classList.add('hidden');
    }
}

async function callGeminiAPI(history) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

    const payload = {
        systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: history,
        generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Unknown API error");
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response format from Gemini");
    }
}

// UI Helpers
function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'message system-message';
    div.textContent = text;
    messagesContainer.appendChild(div);
    scrollToBottom();
}

function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'message message-user';

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <div class="message-bubble">
            <div class="message-content">${escapeHTML(text).replace(/\n/g, '<br>')}</div>
        </div>
        <span class="message-time">${time}</span>
    `;

    messagesContainer.appendChild(div);
    scrollToBottom();
}

function addCiphraMessage(text) {
    const div = document.createElement('div');
    div.className = 'message message-ciphra';

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Parse markdown (marked.js)
    const parsedText = marked.parse(text);

    div.innerHTML = `
        <div class="message-bubble">
            <div class="message-content">${parsedText}</div>
        </div>
        <span class="message-time">${time}</span>
    `;

    messagesContainer.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Settings logic
function openSettings() {
    apiKeyInput.value = apiKey;
    settingsModal.classList.remove('hidden');
}

function closeSettings() {
    settingsModal.classList.add('hidden');
}

function saveSettings() {
    const key = apiKeyInput.value.trim();
    if (key) {
        apiKey = key;
        localStorage.setItem('ciphra_api_key_v2', key);
        closeSettings();

        // Remove the "Please enter..." message if it's the last one
        const lastMessage = messagesContainer.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('system-message') && lastMessage.textContent.includes('API Key')) {
            lastMessage.remove();
            addSystemMessage("API Key saved. Ciphra is ready to chat.");
        }
    } else {
        alert("Please enter a valid API key.");
    }
}

// Utility to prevent XSS in user messages
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Boot the app
window.addEventListener('DOMContentLoaded', init);
