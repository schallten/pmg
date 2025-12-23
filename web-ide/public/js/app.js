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
const newFileBtn = document.getElementById('new-file-btn');
const refreshBtn = document.getElementById('refresh-btn');
const wrapBtn = document.getElementById('wrap-btn');
const projectName = document.getElementById('project-name');
const pluginCountEl = document.getElementById('plugin-count');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const pluginListEl = document.getElementById('plugin-list');
const vcsHistoryBtn = document.getElementById('vcs-history-btn');
const vcsModal = document.getElementById('vcs-modal');
const closeVcsBtn = document.getElementById('close-vcs');
const vcsHistoryList = document.getElementById('vcs-history-list');

// --- 2. State Variables ---
let currentFilePath = null;
let plugins = [];
let customPlugins = [];
let isWordWrapEnabled = false;

// --- 3. Plugin System ---

const CUSTOM_PLUGINS_KEY = 'pmg-ide-custom-plugins';

function loadPlugins() {
    // Load built-in plugins
    plugins = [
        SyntaxHighlighter,
        AIChat
    ];

    // Load custom plugins from localStorage
    loadCustomPluginsFromStorage();

    updatePluginCount();
}

function updatePluginCount() {
    if (pluginCountEl) {
        pluginCountEl.textContent = plugins.length + customPlugins.length;
    }
}

async function loadCustomPluginsFromStorage() {
    const stored = localStorage.getItem(CUSTOM_PLUGINS_KEY);
    if (!stored) return;

    try {
        const urls = JSON.parse(stored);
        for (const url of urls) {
            await loadPluginFromURL(url, false); // false = don't save again
        }
    } catch (err) {
        console.error('Failed to load custom plugins from storage:', err);
    }
}

async function loadPluginFromURL(url, saveToStorage = true) {
    // Validate URL
    if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL');
    }

    if (!url.endsWith('.js')) {
        throw new Error('URL must end with .js');
    }

    try {
        // Dynamically import the module
        const module = await import(url);

        // Validate plugin interface
        if (!module.getName || typeof module.getName !== 'function') {
            throw new Error('Plugin must export a getName() function');
        }

        if (!module.getDescription || typeof module.getDescription !== 'function') {
            throw new Error('Plugin must export a getDescription() function');
        }

        // Check if plugin already loaded
        const name = module.getName();
        const alreadyLoaded = customPlugins.some(p => p.getName() === name);
        if (alreadyLoaded) {
            throw new Error('Plugin already loaded');
        }

        // Add to custom plugins
        const pluginObj = {
            ...module,
            url: url,
            isCustom: true
        };
        customPlugins.push(pluginObj);

        // Call initialize if it exists
        if (module.initialize && typeof module.initialize === 'function') {
            try {
                module.initialize();
            } catch (e) {
                console.error(`Error initializing plugin ${name}:`, e);
            }
        }

        // Save to localStorage if requested
        if (saveToStorage) {
            saveCustomPluginURL(url);
        }

        updatePluginCount();
        return { success: true, name: name };
    } catch (err) {
        throw new Error(`Failed to load plugin: ${err.message}`);
    }
}

function saveCustomPluginURL(url) {
    const stored = localStorage.getItem(CUSTOM_PLUGINS_KEY);
    let urls = [];

    if (stored) {
        try {
            urls = JSON.parse(stored);
        } catch (err) {
            urls = [];
        }
    }

    if (!urls.includes(url)) {
        urls.push(url);
        localStorage.setItem(CUSTOM_PLUGINS_KEY, JSON.stringify(urls));
    }
}

function removeCustomPlugin(url) {
    // Remove from customPlugins array
    customPlugins = customPlugins.filter(p => p.url !== url);

    // Remove from localStorage
    const stored = localStorage.getItem(CUSTOM_PLUGINS_KEY);
    if (stored) {
        try {
            let urls = JSON.parse(stored);
            urls = urls.filter(u => u !== url);
            localStorage.setItem(CUSTOM_PLUGINS_KEY, JSON.stringify(urls));
        } catch (err) {
            console.error('Failed to update storage:', err);
        }
    }

    updatePluginCount();
}

function renderSettings() {
    // Render built-in plugins
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

    // Render custom plugins
    const customPluginListEl = document.getElementById('custom-plugin-list');
    customPluginListEl.innerHTML = '';

    if (customPlugins.length === 0) {
        customPluginListEl.innerHTML = '<p style="color: #888; font-size: 0.9em;">No custom plugins loaded</p>';
    } else {
        customPlugins.forEach((plugin) => {
            const item = document.createElement('div');
            item.className = 'plugin-item';

            const name = plugin.getName();
            const desc = plugin.getDescription();
            const enabled = plugin.isEnabled ? plugin.isEnabled.value : false;

            item.innerHTML = `
                <div class="plugin-info">
                    <h4>${name}</h4>
                    <p>${desc}</p>
                    <small style="color: #666; display: block; margin-top: 5px;">${plugin.url}</small>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    ${plugin.isEnabled ? `
                        <label class="switch">
                            <input type="checkbox" ${enabled ? 'checked' : ''} class="custom-plugin-toggle">
                            <span class="slider"></span>
                        </label>
                    ` : ''}
                    <button class="remove-plugin-btn" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Remove</button>
                </div>
            `;

            if (plugin.isEnabled) {
                const checkbox = item.querySelector('.custom-plugin-toggle');
                checkbox.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    plugin.isEnabled.value = isChecked;
                    if (currentFilePath) {
                        updateHighlighting();
                    }
                });
            }

            const removeBtn = item.querySelector('.remove-plugin-btn');
            removeBtn.addEventListener('click', () => {
                if (confirm(`Remove plugin "${name}"?`)) {
                    removeCustomPlugin(plugin.url);
                    renderSettings();
                }
            });

            customPluginListEl.appendChild(item);
        });
    }
}

// --- 4. Event Listeners ---

loadPlugins();

// Initialize components
initStatusBar();
initAIChatUI();
initBrowserModal();
loadRecentWorkspaces();

// Settings Modal
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        renderSettings();
        settingsModal.style.display = 'block';
    });
}

// Load Plugin Button
const loadPluginBtn = document.getElementById('load-plugin-btn');
const pluginUrlInput = document.getElementById('plugin-url-input');
const pluginLoadStatus = document.getElementById('plugin-load-status');

if (loadPluginBtn && pluginUrlInput && pluginLoadStatus) {
    loadPluginBtn.addEventListener('click', async () => {
        const url = pluginUrlInput.value.trim();

        if (!url) {
            pluginLoadStatus.textContent = 'Please enter a URL';
            pluginLoadStatus.style.color = '#e74c3c';
            return;
        }

        pluginLoadStatus.textContent = 'Loading plugin...';
        pluginLoadStatus.style.color = '#3498db';
        loadPluginBtn.disabled = true;

        try {
            const result = await loadPluginFromURL(url, true);
            pluginLoadStatus.textContent = `✓ Successfully loaded: ${result.name}`;
            pluginLoadStatus.style.color = '#2ecc71';
            pluginUrlInput.value = '';

            // Refresh the settings view
            renderSettings();
        } catch (err) {
            pluginLoadStatus.textContent = `✗ ${err.message}`;
            pluginLoadStatus.style.color = '#e74c3c';
        } finally {
            loadPluginBtn.disabled = false;
        }
    });

    // Allow Enter key to load plugin
    pluginUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadPluginBtn.click();
        }
    });
}

// VCS History
if (vcsHistoryBtn) {
    vcsHistoryBtn.addEventListener('click', () => {
        loadVcsHistory();
        vcsModal.style.display = 'block';
    });
}

if (closeVcsBtn) {
    closeVcsBtn.addEventListener('click', () => {
        vcsModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === vcsModal) {
        vcsModal.style.display = 'none';
    }
});

async function checkVcsStatus() {
    try {
        const response = await fetch('/vcs/status');
        const data = await response.json();
        if (data.is_vcs) {
            vcsHistoryBtn.style.display = 'inline-block';
        } else {
            vcsHistoryBtn.style.display = 'none';
        }
    } catch (err) {
        console.error('Failed to check VCS status', err);
    }
}

async function loadVcsHistory() {
    vcsHistoryList.innerHTML = '<p>Loading history...</p>';
    try {
        const response = await fetch('/vcs/history');
        const data = await response.json();

        if (data.history && data.history.length > 0) {
            vcsHistoryList.innerHTML = '';
            data.history.forEach(commit => {
                const item = document.createElement('div');
                item.className = 'vcs-history-item';

                const date = new Date(commit.timestamp * 1000).toLocaleString();

                item.innerHTML = `
                    <div class="commit-header">
                        <span class="commit-id">ID: ${commit.commit_id.substring(0, 8)}...</span>
                        <span class="commit-date">${date}</span>
                    </div>
                    <div class="commit-message">${commit.message}</div>
                    <div class="commit-author">Author: ${commit.author}</div>
                    <div class="commit-stats">${commit.files_changed} file(s) changed</div>
                `;
                vcsHistoryList.appendChild(item);
            });
        } else if (data.error) {
            vcsHistoryList.innerHTML = `<p class="error">${data.error}</p>`;
        } else {
            vcsHistoryList.innerHTML = '<p>No commit history found.</p>';
        }
    } catch (err) {
        vcsHistoryList.innerHTML = '<p class="error">Failed to load history</p>';
    }
}


function loadRecentWorkspaces() {
    const container = document.getElementById('recent-workspaces-container');
    const list = document.getElementById('recent-list');

    if (!container || !list) return;

    fetch('/recent')
        .then(res => res.json())
        .then(workspaces => {
            if (workspaces.length > 0) {
                container.style.display = 'block';
                list.innerHTML = '';

                workspaces.forEach(path => {
                    const item = document.createElement('div');
                    item.className = 'recent-item';
                    item.textContent = path;
                    item.title = path;
                    item.onclick = () => {
                        workspaceInput.value = path;
                        openWorkspace();
                    };
                    list.appendChild(item);
                });
            } else {
                container.style.display = 'none';
            }
        })
        .catch(err => console.error('Failed to load recent workspaces', err));
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
if (newFileBtn) {
    newFileBtn.addEventListener('click', createNewFile);
}
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

            checkVcsStatus();
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

        const contentSpan = document.createElement('span');
        contentSpan.className = 'file-content';

        if (item.type === 'directory') {
            contentSpan.textContent = '📁 ' + item.name;
            li.appendChild(contentSpan);

            const deleteBtn = document.createElement('span');
            deleteBtn.textContent = '🗑️';
            deleteBtn.className = 'delete-btn';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteItem(item.path);
            };
            li.appendChild(deleteBtn);

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
            contentSpan.textContent = '📄 ' + item.name;
            li.appendChild(contentSpan);

            const deleteBtn = document.createElement('span');
            deleteBtn.textContent = '🗑️';
            deleteBtn.className = 'delete-btn';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteItem(item.path);
            };
            li.appendChild(deleteBtn);

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
    currentFilePath = path;
    currentFilename.textContent = path;

    // Check if it's a media file
    const filename = path.split('/').pop();
    if (isMediaFile(filename)) {
        displayMedia(path, filename);
        return;
    }

    try {
        const response = await fetch(`/file?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.content !== undefined) {
            hideMedia();
            codeEditor.value = data.content;
            updateLineNumbers();
            updateHighlighting();
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

async function createNewFile() {
    const filename = prompt('Enter file name (e.g., newfile.txt or folder/newfile.txt):');
    if (!filename) return;

    try {
        const response = await fetch('/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filename, type: 'file' })
        });
        const data = await response.json();

        if (data.success) {
            loadFileTree();
            // Optionally open the new file
            loadFile(filename);
        } else {
            alert('Failed to create file: ' + data.error);
        }
    } catch (err) {
        alert('Error creating file');
    }
}

async function deleteItem(path) {
    if (!confirm(`Are you sure you want to delete ${path}?`)) return;

    try {
        const response = await fetch('/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
        });
        const data = await response.json();

        if (data.success) {
            loadFileTree();
            if (currentFilePath === path) {
                currentFilePath = null;
                codeEditor.value = '';
                currentFilename.textContent = 'No file open';
            }
        } else {
            alert('Failed to delete: ' + data.error);
        }
    } catch (err) {
        alert('Error deleting item');
    }
}
