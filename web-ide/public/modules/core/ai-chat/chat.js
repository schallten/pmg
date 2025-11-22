/**
 * AI Chat Plugin
 * Provides an AI assistant using Gemini API for code-related questions.
 */

export const isEnabled = { value: false };

let apiKey = localStorage.getItem('gemini-api-key') || '';

export function getName() {
    return "AI Chat Assistant";
}

export function getDescription() {
    return "Chat with Gemini AI to get help with your code. Requires API key.";
}

export function getApiKey() {
    return apiKey;
}

export function setApiKey(key) {
    apiKey = key;
    localStorage.setItem('gemini-api-key', key);
}

export async function sendMessage(message, codeContext = '') {
    if (!apiKey) {
        throw new Error('API key not set');
    }

    const prompt = codeContext
        ? `Context: I'm working on this code:\n\`\`\`\n${codeContext}\n\`\`\`\n\nQuestion: ${message}`
        : message;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        throw new Error(`Failed to get AI response: ${error.message}`);
    }
}
