// ELIN IDE Plugin
// Provides built-in language extension components for the ELIN programming language.

export const isEnabled = { value: true };

export function getName() {
    return "ELIN Language Support";
}

export function getDescription() {
    return "Provides built-in IDE support for the ELIN programming language. Supports syntax highlighting for .elin files.";
}

export function highlight(code, filename) {
    if (!filename || !filename.endsWith('.elin')) {
        return null; // Not an ELIN file, fallback to default syntax
    }

    if (!code) return '';

    // ELIN Rules:
    // keywords: let, print, halt, if, else, end, while, wend
    // comments: // or #
    // Everything else standard

    const tokenRegex = /(\/\/[^\n]*|#[^\n]*)|(".*?"|'.*?')|\b(let|print|halt|if|else|end|while|wend)\b|\b(\d+)\b|\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()|(\+|\-|\*|\/|=|!|&|\||<|>|\?|:)/g;

    let lastIndex = 0;
    let result = '';
    let match;

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    while ((match = tokenRegex.exec(code)) !== null) {
        const preMatch = code.substring(lastIndex, match.index);
        result += escapeHtml(preMatch);

        const escapedText = escapeHtml(match[0]);

        if (match[1]) {
            result += `<span class="token comment" style="color: #6a9955; font-style: italic;">${escapedText}</span>`;
        } else if (match[2]) {
            result += `<span class="token string" style="color: #ce9178;">${escapedText}</span>`;
        } else if (match[3]) {
            result += `<span class="token keyword" style="color: #c678dd; font-weight: bold;">${escapedText}</span>`;
        } else if (match[4]) {
            result += `<span class="token number" style="color: #d19a66;">${escapedText}</span>`;
        } else if (match[5]) {
            result += `<span class="token function" style="color: #61afef;">${escapedText}</span>`;
        } else if (match[6]) {
            result += `<span class="token operator" style="color: #56b6c2;">${escapedText}</span>`;
        } else {
            result += escapedText;
        }

        lastIndex = tokenRegex.lastIndex;
    }

    result += escapeHtml(code.substring(lastIndex));
    return result;
}
