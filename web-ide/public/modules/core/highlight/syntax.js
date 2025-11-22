/**
 * Universal Syntax Highlighter
 * A simple regex-based highlighter for common programming keywords and structures.
 */

export const isEnabled = { value: true };

export function getName() {
    return "Universal Syntax Highlighter";
}

export function getDescription() {
    return "Provides basic syntax highlighting for multiple languages.";
}

export function highlight(code) {
    if (!code) return '';
    if (!isEnabled.value) {
        return escapeHtml(code);
    }

    // Combined Regex Approach:
    // 1. Comments
    // 2. Strings
    // 3. Keywords
    // 4. Numbers
    // 5. Functions
    // 6. Operators (Added back)

    const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(".*?"|'.*?')|\b(const|let|var|if|else|for|while|return|function|class|import|export|from|async|await|try|catch|switch|case|break|continue|new|this|typeof|void|def|public|private|protected|int|float|boolean)\b|\b(\d+)\b|\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()|(\+|\-|\*|\/|=|!|&|\||<|>|\?|:)/g;

    let lastIndex = 0;
    let result = '';
    let match;

    while ((match = tokenRegex.exec(code)) !== null) {
        // Append text before match (escaped)
        const preMatch = code.substring(lastIndex, match.index);
        result += escapeHtml(preMatch);

        // Process match
        const matchedText = match[0];
        const escapedText = escapeHtml(matchedText);

        if (match[1]) { // comment
            result += `<span class="token comment">${escapedText}</span>`;
        } else if (match[2]) { // string
            result += `<span class="token string">${escapedText}</span>`;
        } else if (match[3]) { // keyword
            result += `<span class="token keyword">${escapedText}</span>`;
        } else if (match[4]) { // number
            result += `<span class="token number">${escapedText}</span>`;
        } else if (match[5]) { // function
            result += `<span class="token function">${escapedText}</span>`;
        } else if (match[6]) { // operator
            result += `<span class="token operator">${escapedText}</span>`;
        } else {
            result += escapedText;
        }

        lastIndex = tokenRegex.lastIndex;
    }

    // Append remaining text (escaped)
    result += escapeHtml(code.substring(lastIndex));
    return result;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
