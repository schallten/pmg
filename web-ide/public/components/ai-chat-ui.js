/**
 * AI Chat UI Component
 * Manages the chat interface for the AI assistant
 */

import * as AIChat from '../modules/core/ai-chat/chat.js';

let chatHistory = [];

export function initAIChatUI() {
    const chatBtn = document.getElementById('ai-chat-btn');
    const chatModal = document.getElementById('ai-chat-modal');
    const closeChatBtn = document.getElementById('close-chat');
    const apiKeyInput = document.getElementById('ai-api-key');
    const saveKeyBtn = document.getElementById('save-api-key');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat');
    const includeCodeCheckbox = document.getElementById('include-code');

    if (!chatBtn || !chatModal) return;

    // Load saved API key
    const savedKey = AIChat.getApiKey();
    if (apiKeyInput && savedKey) {
        apiKeyInput.value = savedKey;
    }

    // Open chat modal
    chatBtn.addEventListener('click', () => {
        if (!AIChat.isEnabled.value) {
            alert('AI Chat plugin is disabled. Enable it in Settings.');
            return;
        }
        chatModal.style.display = 'block';
    });

    // Close chat modal
    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            chatModal.style.display = 'none';
        });
    }

    // Save API key
    if (saveKeyBtn && apiKeyInput) {
        saveKeyBtn.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            if (key) {
                AIChat.setApiKey(key);
                showMessage('API key saved!', 'system');
            }
        });
    }

    // Send message
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        const includeCode = includeCodeCheckbox ? includeCodeCheckbox.checked : false;
        let codeContext = '';

        if (includeCode) {
            const codeEditor = document.getElementById('code-editor');
            if (codeEditor && codeEditor.value) {
                codeContext = codeEditor.value;
            }
        }

        // Add user message to chat
        addMessage(message, 'user');
        chatInput.value = '';

        // Show loading
        const loadingId = addMessage('Thinking...', 'assistant', true);

        try {
            const response = await AIChat.sendMessage(message, codeContext);
            removeMessage(loadingId);
            addMessage(response, 'assistant');
        } catch (error) {
            removeMessage(loadingId);
            addMessage(`Error: ${error.message}`, 'error');
        }
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === chatModal) {
            chatModal.style.display = 'none';
        }
    });
}

function addMessage(text, type, isLoading = false) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return null;

    const messageId = `msg-${Date.now()}`;
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    messageDiv.id = messageId;

    if (isLoading) {
        messageDiv.classList.add('loading');
    }

    // Format message text (preserve code blocks, line breaks)
    const formattedText = formatMessage(text);
    messageDiv.innerHTML = formattedText;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    chatHistory.push({ type, text, id: messageId });
    return messageId;
}

function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
    chatHistory = chatHistory.filter(m => m.id !== messageId);
}

function showMessage(text, type) {
    addMessage(text, type);
}

function formatMessage(text) {
    // Simple markdown-like formatting
    let formatted = text
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    return formatted;
}
