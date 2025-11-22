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

    // Escape HTML characters first to prevent XSS and rendering issues
    let html = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    if (!isEnabled.value) {
        return html;
    }

    // Define token patterns
    const patterns = [
        // Comments (Single line //... and Multi line /*...*/)
        { regex: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, class: 'comment' },

        // Strings ("..." or '...')
        { regex: /(".*?"|'.*?')/g, class: 'string' },

        // Numbers
        { regex: /\b(\d+)\b/g, class: 'number' },

        // Keywords (Common JS/C/Java/Python keywords)
        {
            regex: /\b(const|let|var|if|else|for|while|return|function|class|import|export|from|async|await|try|catch|switch|case|break|continue|new|this|typeof|void|def|class|public|private|protected|int|float|string|boolean)\b/g,
            class: 'keyword'
        },

        // Operators
        { regex: /(\+|\-|\*|\/|=|!|&|\||<|>|\?|:)/g, class: 'operator' },

        // Function calls (word followed by ()
        { regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()/g, class: 'function' }
    ];


    // Combined Regex Approach:
    // 1. Comments
    // 2. Strings
    // 3. Keywords
    // 4. Numbers
    // 5. Functions

    const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(".*?"|'.*?')|\b(const|let|var|if|else|for|while|return|function|class|import|export|from|async|await|try|catch|switch|case|break|continue|new|this|typeof|void|def|public|private|protected|int|float|boolean)\b|\b(\d+)\b|\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()/g;

    return html.replace(tokenRegex, (match, comment, string, keyword, number, func) => {
        if (comment) return `<span class="token comment">${comment}</span>`;
        if (string) return `<span class="token string">${string}</span>`;
        if (keyword) return `<span class="token keyword">${keyword}</span>`;
        if (number) return `<span class="token number">${number}</span>`;
        if (func) return `<span class="token function">${func}</span>`;
        return match;
    });
}
