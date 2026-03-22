import * as SyntaxHighlighter from '../modules/core/highlight/syntax.js';
import * as AIChat from '../modules/core/ai-chat/chat.js';
import { initStatusBar } from '../components/status-bar.js';
import { isMediaFile, displayMedia, hideMedia } from '../components/media-viewer.js';
import { initAIChatUI } from '../components/ai-chat-ui.js';
import { initBrowserModal } from '../components/browser-modal.js';
import * as ELINSupport from '../plugins/elin.js';

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
const closeTerminalBtn = document.getElementById('close-terminal');
const statusScreen = document.getElementById('status-bar');
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
const terminalResizer = document.getElementById('terminal-resizer');
const themeSelect = document.getElementById('theme-select');
const newTerminalBtn = document.getElementById('new-terminal');
const killTerminalBtn = document.getElementById('kill-terminal');
const terminalTabsContainer = document.getElementById('terminal-tabs');
const suggestionsBox = document.getElementById('suggestions-box');
const editorTabs = document.getElementById('editor-tabs');

// --- 2. State Variables ---
let currentFilePath = null;
let openFiles = {}; // { path: { content, name } }
let coreModules = [];
let plugins = [];
let customPlugins = [];
let isWordWrapEnabled = false;
let activeSuggestionIndex = 0;
let currentSuggestions = [];

// Terminal multi-state
let terminals = {}; // { id: { instance, fitAddon, name, container } }
let activeTerminalId = null;
let terminalPolling = null;

// Themes
const THEME_KEY = 'pmg-ide-theme';

function initThemes() {
    if (!themeSelect) return;

    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
        themeSelect.value = savedTheme;
        applyTheme(savedTheme);
    }

    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        applyTheme(theme);
        localStorage.setItem(THEME_KEY, theme);
    });
}

function applyTheme(theme) {
    // Remove all theme classes
    document.body.classList.forEach(cls => {
        if (cls.startsWith('theme-')) {
            document.body.classList.remove(cls);
        }
    });

    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }

    // Update all terminal themes
    const termTheme = getTerminalTheme(theme);
    Object.keys(terminals).forEach(id => {
        terminals[id].instance.options.theme = termTheme;
    });
}

function getTerminalTheme(theme) {
    switch (theme) {
        case 'monokai':
            return {
                background: '#272822',
                foreground: '#f8f8f2',
                cursor: '#f92672',
                black: '#272822',
                red: '#f92672',
                green: '#a6e22e',
                yellow: '#f4bf75',
                blue: '#66d9ef',
                magenta: '#ae81ff',
                cyan: '#a1efe4',
                white: '#f8f8f2'
            };
        case 'dracula':
            return {
                background: '#282a36',
                foreground: '#f8f8f2',
                cursor: '#bd93f9',
                black: '#21222c',
                red: '#ff5555',
                green: '#50fa7b',
                yellow: '#f1fa8c',
                blue: '#bd93f9',
                magenta: '#ff79c6',
                cyan: '#8be9fd',
                white: '#f8f8f2'
            };
        case 'solarized-dark':
            return {
                background: '#002b36',
                foreground: '#839496',
                cursor: '#93a1a1',
                black: '#073642',
                red: '#dc322f',
                green: '#859900',
                yellow: '#b58900',
                blue: '#268bd2',
                magenta: '#d33682',
                cyan: '#2aa198',
                white: '#eee8d5'
            };
        case 'light':
            return {
                background: '#ffffff',
                foreground: '#1f2937',
                cursor: '#3b82f6',
                black: '#000000',
                red: '#ef4444',
                green: '#10b981',
                yellow: '#f59e0b',
                blue: '#3b82f6',
                magenta: '#8b5cf6',
                cyan: '#06b6d4',
                white: '#ffffff'
            };
        case 'rgb':
            return {
                background: '#050505',
                foreground: '#ffffff',
                cursor: '#ff00ea',
                black: '#000000',
                red: '#ff0000',
                green: '#00ff00',
                yellow: '#ffff00',
                blue: '#0000ff',
                magenta: '#ff00ff',
                cyan: '#00ffff',
                white: '#ffffff'
            };
        default: // One Dark
            return {
                background: '#0f111a',
                foreground: '#e2e8f0',
                cursor: '#6366f1',
                selection: 'rgba(99, 102, 241, 0.3)',
                black: '#000000',
                red: '#ef4444',
                green: '#10b981',
                yellow: '#f59e0b',
                blue: '#3b82f6',
                magenta: '#8b5cf6',
                cyan: '#06b6d4',
                white: '#ffffff'
            };
    }
}

// --- 3. Plugin System ---

const CUSTOM_PLUGINS_KEY = 'pmg-ide-custom-plugins';
const PLUGIN_STATES_KEY = 'pmg-ide-plugin-states';

function loadPlugins() {
    // Core Modules (not in plugin list, used as fallbacks)
    coreModules = [
        SyntaxHighlighter
    ];

    // Default built-in plugins (toggleable in Settings)
    plugins = [
        ELINSupport,
        AIChat
    ];

    // Load states
    loadPluginStates();

    // Load custom plugins from localStorage
    loadCustomPluginsFromStorage();

    // Init themes
    initThemes();

    updatePluginCount();
}

function savePluginStates() {
    const states = {};
    plugins.forEach(p => {
        if (p.getName && p.isEnabled) {
            states[p.getName()] = p.isEnabled.value;
        }
    });
    localStorage.setItem(PLUGIN_STATES_KEY, JSON.stringify(states));
}

function loadPluginStates() {
    const stored = localStorage.getItem(PLUGIN_STATES_KEY);
    if (!stored) return;

    try {
        const states = JSON.parse(stored);
        plugins.forEach(p => {
            if (p.getName && states[p.getName()] !== undefined && p.isEnabled) {
                p.isEnabled.value = states[p.getName()];
            }
        });
    } catch (e) {
        console.error('Failed to load plugin states:', e);
    }
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
                savePluginStates();
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
closeTerminalBtn.addEventListener('click', closeTerminal);
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
    updateSuggestions();
});
codeEditor.addEventListener('scroll', syncScroll);
codeEditor.addEventListener('keydown', handleEditorKeys);
codeEditor.addEventListener('click', hideSuggestions);

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

    const filename = currentFilename.textContent || '';
    let customHighlight = null;

    // Check built-in and custom plugins first
    for (const plugin of plugins.concat(customPlugins)) {
        if (plugin.isEnabled && plugin.isEnabled.value !== false && typeof plugin.highlight === 'function') {
            const h = plugin.highlight(text, filename);
            if (h !== null && h !== undefined) {
                customHighlight = h;
                break;
            }
        }
    }

    // Check core modules if no plugin matched
    if (!customHighlight) {
        for (const module of coreModules) {
            if (module !== SyntaxHighlighter && module.isEnabled && module.isEnabled.value !== false && typeof module.highlight === 'function') {
                const h = module.highlight(text, filename);
                if (h !== null && h !== undefined) {
                    customHighlight = h;
                    break;
                }
            }
        }
    }

    if (customHighlight) {
        highlightingContent.innerHTML = customHighlight;
    } else {
        highlightingContent.innerHTML = SyntaxHighlighter.highlight(text);
    }
}

function updateSuggestions() {
    const text = codeEditor.value;
    const position = codeEditor.selectionStart;
    const filename = currentFilePath ? currentFilePath.split('/').pop() : '';
    
    currentSuggestions = [];
    
    // Collect suggestions from plugins
    for (const plugin of plugins.concat(customPlugins)) {
        if (plugin.isEnabled && plugin.isEnabled.value !== false && typeof plugin.getSuggestions === 'function') {
            const suggestions = plugin.getSuggestions(text, position, filename);
            if (suggestions && suggestions.length > 0) {
                currentSuggestions = currentSuggestions.concat(suggestions);
            }
        }
    }
    
    if (currentSuggestions.length > 0) {
        showSuggestions();
    } else {
        hideSuggestions();
    }
}

function showSuggestions() {
    activeSuggestionIndex = 0;
    renderSuggestions();
    
    // Position suggestions box near cursor
    const { top, left } = getCursorCoordinates();
    suggestionsBox.style.top = `${top + 20}px`;
    suggestionsBox.style.left = `${left}px`;
    suggestionsBox.style.display = 'block';
}

function renderSuggestions() {
    suggestionsBox.innerHTML = '';
    currentSuggestions.forEach((suggestion, index) => {
        const item = document.createElement('div');
        item.style.padding = '4px 10px';
        item.style.cursor = 'pointer';
        item.style.background = index === activeSuggestionIndex ? 'var(--accent)' : 'transparent';
        item.style.color = index === activeSuggestionIndex ? 'white' : 'var(--text-primary)';
        item.innerHTML = `<strong>${suggestion.label}</strong> <small style="opacity: 0.7">${suggestion.detail || ''}</small>`;
        
        item.onclick = (e) => {
            e.stopPropagation();
            applySuggestion(suggestion);
        };
        
        suggestionsBox.appendChild(item);
    });
}

function applySuggestion(suggestion) {
    const start = codeEditor.selectionStart;
    const textToInsert = suggestion.insertText || '';
    
    const before = codeEditor.value.substring(0, start);
    const after = codeEditor.value.substring(start);
    
    codeEditor.value = before + textToInsert + after;
    codeEditor.selectionStart = codeEditor.selectionEnd = start + textToInsert.length;
    
    hideSuggestions();
    updateLineNumbers();
    updateHighlighting();
    codeEditor.focus();
}

function hideSuggestions() {
    if (suggestionsBox) {
        suggestionsBox.style.display = 'none';
        currentSuggestions = [];
    }
}

function getCursorCoordinates() {
    const textBefore = codeEditor.value.substring(0, codeEditor.selectionStart);
    const lines = textBefore.split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length;
    
    const lineHeight = 1.6 * 14; 
    const charWidth = 8.4; 
    
    const top = (lineNum * lineHeight) - codeEditor.scrollTop + 24;
    const left = (colNum * charWidth) - codeEditor.scrollLeft + 24;
    
    return { top, left };
}

function handleEditorKeys(e) {
    if (suggestionsBox.style.display === 'block') {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
            renderSuggestions();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
            renderSuggestions();
            return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            applySuggestion(currentSuggestions[activeSuggestionIndex]);
            return;
        }
        if (e.key === 'Escape') {
            hideSuggestions();
            return;
        }
    }

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
    // If already open, just switch
    if (openFiles[path]) {
        switchTab(path);
        return;
    }

    const filename = path.split('/').pop();
    
    // Check if it's a media file
    if (isMediaFile(filename)) {
        currentFilePath = path;
        currentFilename.textContent = path;
        displayMedia(path, filename);
        return;
    }

    try {
        const response = await fetch(`/file?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.content !== undefined) {
            hideMedia();
            
            // Save current file content before switching
            if (currentFilePath && openFiles[currentFilePath]) {
                openFiles[currentFilePath].content = codeEditor.value;
            }

            // Add to open files
            openFiles[path] = {
                content: data.content,
                name: filename
            };

            switchTab(path);
        }
    } catch (err) {
        alert('Error loading file');
    }
}

function switchTab(path) {
    if (!openFiles[path]) return;

    // Save current content if any
    if (currentFilePath && openFiles[currentFilePath]) {
        openFiles[currentFilePath].content = codeEditor.value;
    }

    currentFilePath = path;
    currentFilename.textContent = path;
    
    hideMedia();
    codeEditor.value = openFiles[path].content;
    
    updateLineNumbers();
    updateHighlighting();
    renderTabs();
    
    // Update file tree active state
    document.querySelectorAll('.file-tree li.file').forEach(li => {
        // This is a bit slow but simple
        const content = li.querySelector('.file-content').textContent;
        const name = path.split('/').pop();
        if (content.includes(name)) {
            document.querySelectorAll('.file-tree li.active').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
        }
    });
}

function closeTab(path, e) {
    if (e) e.stopPropagation();
    
    delete openFiles[path];
    
    const remainingPaths = Object.keys(openFiles);
    
    if (path === currentFilePath) {
        if (remainingPaths.length > 0) {
            switchTab(remainingPaths[remainingPaths.length - 1]);
        } else {
            currentFilePath = null;
            currentFilename.textContent = 'No file open';
            codeEditor.value = '';
            updateLineNumbers();
            updateHighlighting();
        }
    }
    
    renderTabs();
}

function renderTabs() {
    if (!editorTabs) return;
    editorTabs.innerHTML = '';
    
    Object.keys(openFiles).forEach(path => {
        const file = openFiles[path];
        const tab = document.createElement('div');
        tab.className = `tab ${path === currentFilePath ? 'active' : ''}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tab-name';
        nameSpan.textContent = file.name;
        nameSpan.title = path;
        
        const closeSpan = document.createElement('span');
        closeSpan.className = 'tab-close';
        closeSpan.innerHTML = '&times;';
        closeSpan.onclick = (e) => closeTab(path, e);
        
        tab.appendChild(nameSpan);
        tab.appendChild(closeSpan);
        
        tab.onclick = () => switchTab(path);
        
        editorTabs.appendChild(tab);
    });
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
            // Update in-memory content too
            if (openFiles[currentFilePath]) {
                openFiles[currentFilePath].content = codeEditor.value;
            }
            
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

async function closeTerminal() {
    document.getElementById('terminal-pane').style.display = 'none';
    if (terminalResizer) terminalResizer.style.display = 'none';
}

async function notifyResize(terminalId, cols, rows) {
    try {
        await fetch('/terminal/resize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ terminal_id: terminalId, cols, rows })
        });
    } catch (e) { }
}

function renderTerminalTabs() {
    if (!terminalTabsContainer) return;
    terminalTabsContainer.innerHTML = '';
    
    Object.keys(terminals).forEach(id => {
        const tab = document.createElement('div');
        tab.className = `terminal-tab ${id === activeTerminalId ? 'active' : ''}`;
        tab.textContent = terminals[id].name;
        tab.onclick = () => switchTerminal(id);
        terminalTabsContainer.appendChild(tab);
    });
}

async function switchTerminal(id) {
    if (!terminals[id]) return;
    
    // Hide all terminal containers
    Object.keys(terminals).forEach(tid => {
        if (terminals[tid].container) {
            terminals[tid].container.style.display = 'none';
        }
    });
    
    activeTerminalId = id;
    const activeTerm = terminals[id];
    
    if (activeTerm.container) {
        activeTerm.container.style.display = 'block';
    }
    
    activeTerm.instance.focus();
    renderTerminalTabs();
    
    // Fit and notify
    setTimeout(() => {
        activeTerm.fitAddon.fit();
        notifyResize(id, activeTerm.instance.cols, activeTerm.instance.rows);
    }, 50);
}

async function killTerminal(id) {
    id = id || activeTerminalId;
    if (!id || !terminals[id]) return;
    
    if (!confirm('Are you sure you want to kill this terminal process?')) return;
    
    try {
        const response = await fetch('/terminal/kill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ terminal_id: id })
        });
        
        if (response.ok) {
            terminals[id].instance.dispose();
            if (terminals[id].container) {
                terminals[id].container.remove();
            }
            delete terminals[id];
            
            const remainingIds = Object.keys(terminals);
            if (remainingIds.length > 0) {
                switchTerminal(remainingIds[remainingIds.length - 1]);
            } else {
                activeTerminalId = null;
                closeTerminal();
            }
            renderTerminalTabs();
        }
    } catch (e) {
        console.error('Failed to kill terminal:', e);
    }
}

async function openTerminal() {
    const pane = document.getElementById('terminal-pane');
    pane.style.display = 'flex';
    if (terminalResizer) terminalResizer.style.display = 'block';

    // Global Terminal controls
    if (newTerminalBtn && !newTerminalBtn.dataset.hasListener) {
        newTerminalBtn.onclick = () => createNewTerminal();
        newTerminalBtn.dataset.hasListener = 'true';
    }
    
    if (killTerminalBtn && !killTerminalBtn.dataset.hasListener) {
        killTerminalBtn.onclick = () => killTerminal();
        killTerminalBtn.dataset.hasListener = 'true';
    }

    const clearBtn = document.getElementById('clear-terminal');
    const restartBtn = document.getElementById('restart-terminal');

    if (clearBtn && !clearBtn.dataset.hasListener) {
        clearBtn.addEventListener('click', () => {
            if (activeTerminalId && terminals[activeTerminalId]) {
                terminals[activeTerminalId].instance.clear();
            }
        });
        clearBtn.dataset.hasListener = 'true';
    }

    if (restartBtn && !restartBtn.dataset.hasListener) {
        restartBtn.addEventListener('click', async () => {
            if (activeTerminalId && terminals[activeTerminalId]) {
                const id = activeTerminalId;
                terminals[id].instance.write('\r\n\x1b[33mRestarting terminal...\x1b[0m\r\n');
                await killTerminal(id);
                await createNewTerminal();
            }
        });
        restartBtn.dataset.hasListener = 'true';
    }

    if (Object.keys(terminals).length === 0) {
        await createNewTerminal();
    } else if (activeTerminalId) {
        switchTerminal(activeTerminalId);
    }

    // Ensure polling is running if terminals exist
    startTerminalPolling();
}

function startTerminalPolling() {
    if (terminalPolling) return;
    
    terminalPolling = setInterval(async () => {
        const pane = document.getElementById('terminal-pane');
        if (pane.style.display === 'none') return;
        
        const ids = Object.keys(terminals);
        if (ids.length === 0) {
            clearInterval(terminalPolling);
            terminalPolling = null;
            return;
        }
        
        for (const id of ids) {
            try {
                const res = await fetch(`/terminal/read?terminal_id=${id}`);
                const text = await res.json();
                if (text.output && terminals[id]) {
                    terminals[id].instance.write(text.output);
                }
            } catch (e) {
                console.error('Terminal poll error:', e);
            }
        }
    }, 50);
}

async function createNewTerminal() {
    try {
        const response = await fetch('/terminal/start', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            const terminalId = data.terminal_id;
            const termNumber = Object.keys(terminals).length + 1;
            
            // Create container for this terminal
            const container = document.createElement('div');
            container.id = `terminal-${terminalId}`;
            container.className = 'terminal-instance-container';
            container.style.height = '100%';
            container.style.width = '100%';
            document.getElementById('terminal-container').appendChild(container);

            const instance = new window.Terminal({
                cursorBlink: true,
                theme: getTerminalTheme(themeSelect.value),
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                lineHeight: 1.4,
                allowTransparency: true
            });

            const fitAddon = new window.FitAddon.FitAddon();
            instance.loadAddon(fitAddon);

            instance.open(container);

            instance.attachCustomKeyEventHandler((e) => {
                if (e.ctrlKey && e.key === 'c' && instance.hasSelection()) {
                    return false;
                }
                if (e.ctrlKey && e.key === 'c' && !instance.hasSelection()) {
                    fetch('/terminal/write', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ terminal_id: terminalId, input: '\x03' })
                    });
                    return false;
                }
                return true;
            });

            instance.onData(async (data) => {
                await fetch('/terminal/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ terminal_id: terminalId, input: data })
                });
            });

            terminals[terminalId] = {
                instance,
                fitAddon,
                container,
                name: `bash ${termNumber}`
            };
            
            switchTerminal(terminalId);
            startTerminalPolling();
        }
    } catch (err) {
        console.error('Failed to create new terminal:', err);
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
            // Close tab if it was open
            if (openFiles[path]) {
                closeTab(path);
            }
        } else {
            alert('Failed to delete: ' + data.error);
        }
    } catch (err) {
        alert('Error deleting item');
    }
}

function initTerminalResizer() {
    if (!terminalResizer) return;

    let isResizing = false;
    const terminalPane = document.getElementById('terminal-pane');

    terminalResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        terminalResizer.classList.add('active');
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const terminalTop = e.clientY;
        const windowHeight = window.innerHeight;
        const newHeight = windowHeight - terminalTop;

        // Min 50px, Max 80vh
        if (newHeight > 50 && newHeight < (windowHeight * 0.8)) {
            terminalPane.style.height = `${newHeight}px`;
            if (activeTerminalId && terminals[activeTerminalId]) {
                const term = terminals[activeTerminalId];
                term.fitAddon.fit();
                notifyResize(activeTerminalId, term.instance.cols, term.instance.rows);
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            terminalResizer.classList.remove('active');
            document.body.style.cursor = 'default';
        }
    });
}

// Initialize resizer
initTerminalResizer();
