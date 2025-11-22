import * as SyntaxHighlighter from '../modules/core/highlight/syntax.js';
import * as AIChat from '../modules/core/ai-chat/chat.js';
import { initStatusBar } from '../components/status-bar.js';
import { isMediaFile, displayMedia, hideMedia } from '../components/media-viewer.js';
import { initAIChatUI } from '../components/ai-chat-ui.js';
import { initBrowserModal } from '../components/browser-modal.js';

// ==========================================
// PMG - WEB IDE Client Side Logic
// ==========================================

// --- 1. Select DOM Elements ---
const welcomeScreen = document.getElementById('welcome-screen');
const ideScreen = document.getElementById('ide-screen');
const workspaceInput = document.getElementById('workspace-path');
const openBtn = document.getElementById('open-btn');
const errorMsg = document.getElementById('error-msg');
const fileTree = document.getElementById('file-tree');
const codeEditor = document.getElementById('code-editor');
const highlighting = document.getElementById('highlighting');
const highlightingContent = document.getElementById('highlighting-content');
const lineNumbers = document.getElementById('line-numbers');
const currentFilename = document.getElementById('current-filename');
const saveBtn = document.getElementById('save-btn');
const terminalBtn = document.getElementById('terminal-btn');
const refreshBtn = document.getElementById('refresh-btn');
const wrapBtn = document.getElementById('wrap-btn');
const projectName = document.getElementById('project-name');
const pluginCountEl = document.getElementById('plugin-count');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const pluginListEl = document.getElementById('plugin-list');

// --- 2. State Variables ---
let currentFilePath = null;
let plugins = [];
let isWordWrapEnabled = false;

// --- 3. Plugin System ---

function loadPlugins() {
    plugins = [
        SyntaxHighlighter,
        AIChat
    ];

    if (pluginCountEl) {
        pluginCountEl.textContent = plugins.length;
    }
}

function renderSettings() {
    pluginListEl.innerHTML = '';

    plugins.forEach((plugin, index) => {
        const item = document.createElement('div');
        item.className = 'plugin-item';

        const name = plugin.getName ? plugin.getName() : 'Unknown Plugin';
        const desc = plugin.getDescription ? plugin.getDescription() : 'No description available.';
        const enabled = plugin.isEnabled ? plugin.isEnabled.value : false;

        item.innerHTML = `
            <div class="plugin-info">
                <h4>${name}</h4>
                <p>${desc}</p>
            </div>
            <label class="switch">
                <input type="checkbox" ${enabled ? 'checked' : ''} data-index="${index}">
                <span class="slider"></span>
            </label>
        `;

        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            if (plugin.isEnabled) {
                plugin.isEnabled.value = isChecked;
                if (currentFilePath) {
                    updateHighlighting();
                }
            }
        });

        pluginListEl.appendChild(item);
    });
}

// --- 4. Event Listeners ---

loadPlugins();

// Initialize components
initStatusBar();
initAIChatUI();
initBrowserModal();

// Settings Modal
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        renderSettings();
        settingsModal.style.display = 'block';
    });
}

if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

openBtn.addEventListener('click', openWorkspace);

const browseBtn = document.getElementById('browse-btn');
if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/browse');
            const data = await response.json();

            if (data.path) {
                workspaceInput.value = data.path;
                workspaceInput.focus();
            } else if (data.error) {
                if (data.error !== 'Selection cancelled') {
                    errorMsg.textContent = data.error;
                }
            }
        } catch (err) {
            errorMsg.textContent = 'Failed to open file picker';
        }
    });
}

workspaceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') openWorkspace();
});

// Toolbar buttons
saveBtn.addEventListener('click', saveFile);
terminalBtn.addEventListener('click', openTerminal);
refreshBtn.addEventListener('click', loadFileTree);

// Word wrap toggle
if (wrapBtn) {
    wrapBtn.addEventListener('click', toggleWordWrap);
}

// Editor interactions
codeEditor.addEventListener('input', () => {
    updateLineNumbers();
    updateHighlighting();
});
codeEditor.addEventListener('scroll', syncScroll);
codeEditor.addEventListener('keydown', handleEditorKeys);

// --- 5. Functions ---

function toggleWordWrap() {
    isWordWrapEnabled = !isWordWrapEnabled;

    if (isWordWrapEnabled) {
        codeEditor.classList.add('word-wrap');
        highlighting.classList.add('word-wrap');
        wrapBtn.textContent = 'Unwrap';
    } else {
        codeEditor.classList.remove('word-wrap');
        highlighting.classList.remove('word-wrap');
        wrapBtn.textContent = 'Word Wrap';
    }
}

function syncScroll() {
    lineNumbers.scrollTop = codeEditor.scrollTop;
    highlighting.scrollTop = codeEditor.scrollTop;
    highlighting.scrollLeft = codeEditor.scrollLeft;
}

function updateHighlighting() {
    let text = codeEditor.value;

    if (text[text.length - 1] === "\n") {
        text += " ";
    }

    highlightingContent.innerHTML = SyntaxHighlighter.highlight(text);
}

function handleEditorKeys(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = codeEditor.selectionStart;
        const end = codeEditor.selectionEnd;

        codeEditor.value = codeEditor.value.substring(0, start) + '    ' + codeEditor.value.substring(end);

        codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
        updateLineNumbers();
        updateHighlighting();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
}

function updateLineNumbers() {
    const content = codeEditor.value;
    const numberOfLines = content.split('\n').length;

    lineNumbers.innerHTML = Array(numberOfLines)
        .fill(0)
        .map((_, index) => index + 1)
        .join('<br>');
}

async function openWorkspace() {
    const path = workspaceInput.value.trim();
    if (!path) return;

    try {
        const response = await fetch('/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
        });
        const data = await response.json();

        if (data.success) {
            welcomeScreen.classList.remove('active');
            ideScreen.classList.add('active');

            projectName.textContent = path.split('/').pop();

            loadFileTree();
        } else {
            errorMsg.textContent = data.error;
        }
    } catch (err) {
        errorMsg.textContent = 'Failed to connect to server';
    }
}

async function loadFileTree() {
    try {
        const response = await fetch('/files');
        const data = await response.json();

        if (data.files) {
            fileTree.innerHTML = '';
            const listContainer = document.createElement('ul');
            renderTreeNodes(data.files, listContainer);
            fileTree.appendChild(listContainer);
        }
    } catch (err) {
        console.error('Failed to load files', err);
    }
}

function renderTreeNodes(items, container) {
    items.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
    });

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = item.type;

        if (item.type === 'directory') {
            li.textContent = '📁 ' + item.name;

            const childUl = document.createElement('ul');
            childUl.style.display = 'none';

            if (item.children) {
                renderTreeNodes(item.children, childUl);
            }

            li.addEventListener('click', (e) => {
                e.stopPropagation();
                childUl.style.display = childUl.style.display === 'none' ? 'block' : 'none';
            });

            container.appendChild(li);
            container.appendChild(childUl);
        } else {
            li.textContent = '📄 ' + item.name;

            li.addEventListener('click', (e) => {
                e.stopPropagation();

                document.querySelectorAll('.file-tree li.active').forEach(el => el.classList.remove('active'));
                li.classList.add('active');

                loadFile(item.path);
            });

            container.appendChild(li);
        }
    });
}

async function loadFile(path) {
    try {
        const response = await fetch(`/file?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.content !== undefined) {
            currentFilePath = path;
            currentFilename.textContent = path;

            // Check if it's a media file
            const filename = path.split('/').pop();
            if (isMediaFile(filename)) {
                displayMedia(path, filename);
            } else {
                hideMedia();
                codeEditor.value = data.content;
                updateLineNumbers();
                updateHighlighting();
            }
        }
    } catch (err) {
        alert('Error loading file');
    }
}

async function saveFile() {
    if (!currentFilePath) return;

    try {
        const response = await fetch('/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentFilePath,
                content: codeEditor.value
            })
        });
        const data = await response.json();

        if (data.success) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            setTimeout(() => saveBtn.textContent = originalText, 2000);
        } else {
            alert('Failed to save: ' + data.error);
        }
    } catch (err) {
        alert('Error saving file');
    }
}

async function openTerminal() {
    try {
        const response = await fetch('/terminal', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            console.log('Terminal opened on server');
        }
    } catch (err) {
        console.error('Failed to open terminal', err);
    }
}
