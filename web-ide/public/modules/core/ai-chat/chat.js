/**
 * AI Chat Plugin
 * Provides an AI assistant using Gemini API for code-related questions.
 */

export const isEnabled = { value: false };

let apiKey = localStorage.getItem('gemini-api-key') || '';
let conversationHistory = [];

export function getName() {
    return "AI Chat Assistant";
}

export function getDescription() {
    return "Chat with Gemini AI to get help with your code. Maintains conversation context.";
}

export function getApiKey() {
    return apiKey;
}

export function setApiKey(key) {
    apiKey = key;
    localStorage.setItem('gemini-api-key', key);
}

export function clearHistory() {
    conversationHistory = [];
}

export async function sendMessage(message, codeContext = '') {
    if (!apiKey) {
        throw new Error('API key not set');
    }

    let prompt = message;
    if (codeContext) {
        prompt = `Context: I'm working on this code:\n\`\`\`\n${codeContext}\n\`\`\`\n\nQuestion: ${message}`;
    }

    // Add user message to history
    conversationHistory.push({
        role: "user",
        parts: [{ text: prompt }]
    });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: conversationHistory
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
        }

        const data = await response.json();
        const assistantResponse = data.candidates[0].content.parts[0].text;

        // Add assistant response to history
        conversationHistory.push({
            role: "model",
            parts: [{ text: assistantResponse }]
        });

        return assistantResponse;
    } catch (error) {
        // Remove the failed user message from history so it doesn't break future attempts
        conversationHistory.pop();
        throw new Error(`Failed to get AI response: ${error.message}`);
    }
}
