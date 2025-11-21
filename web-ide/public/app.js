// ==========================================
// PMG - WEB IDE Client Side Logic
// ==========================================

// --- 1. Select DOM Elements ---
// We get references to all the HTML elements we need to interact with.
const welcomeScreen = document.getElementById('welcome-screen');
const ideScreen = document.getElementById('ide-screen');
const workspaceInput = document.getElementById('workspace-path');
const openBtn = document.getElementById('open-btn');
const errorMsg = document.getElementById('error-msg');
const fileTree = document.getElementById('file-tree');
const codeEditor = document.getElementById('code-editor');
const lineNumbers = document.getElementById('line-numbers');
const currentFilename = document.getElementById('current-filename');
const saveBtn = document.getElementById('save-btn');
const terminalBtn = document.getElementById('terminal-btn');
const refreshBtn = document.getElementById('refresh-btn');
const projectName = document.getElementById('project-name');

// --- 2. State Variables ---
// Variables to keep track of the current application state.
let currentFilePath = null; // Stores the path of the currently open file

// --- 3. Event Listeners ---
// We listen for user actions like clicks and key presses.

// "Open Workspace" button click
openBtn.addEventListener('click', openWorkspace);

// Allow pressing "Enter" in the input field to open workspace
workspaceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') openWorkspace();
});

// Toolbar buttons
saveBtn.addEventListener('click', saveFile);
terminalBtn.addEventListener('click', openTerminal);
refreshBtn.addEventListener('click', loadFileTree);

// Editor interactions
codeEditor.addEventListener('input', updateLineNumbers); // Update line numbers when typing
codeEditor.addEventListener('scroll', syncScroll); // Sync scroll between editor and line numbers
codeEditor.addEventListener('keydown', handleEditorKeys); // Handle Tab and Ctrl+S

// --- 4. Functions ---

/**
 * Syncs the scroll position of the line numbers with the code editor.
 */
function syncScroll() {
    lineNumbers.scrollTop = codeEditor.scrollTop;
}

/**
 * Handles special key presses in the editor (Tab for indentation, Ctrl+S for save).
 */
function handleEditorKeys(e) {
    // Handle 'Tab' key to insert spaces instead of changing focus
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = codeEditor.selectionStart;
        const end = codeEditor.selectionEnd;

        // Insert 4 spaces at the cursor position
        codeEditor.value = codeEditor.value.substring(0, start) + '    ' + codeEditor.value.substring(end);

        // Move cursor after the inserted spaces
        codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
        updateLineNumbers();
    }

    // Handle 'Ctrl+S' (or Cmd+S on Mac) to save the file
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
}

/**
 * Updates the line numbers sidebar based on the number of lines in the editor.
 */
function updateLineNumbers() {
    const content = codeEditor.value;
    const numberOfLines = content.split('\n').length;

    // Create an array of numbers [1, 2, 3, ...] and join them with <br> tags
    lineNumbers.innerHTML = Array(numberOfLines)
        .fill(0)
        .map((_, index) => index + 1)
        .join('<br>');
}

/**
 * Sends a request to the server to open a workspace directory.
 */
async function openWorkspace() {
    const path = workspaceInput.value.trim();
    if (!path) return;

    try {
        // Send POST request to /open endpoint
        const response = await fetch('/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: path })
        });
        const data = await response.json();

        if (data.success) {
            // If successful, switch to IDE screen and load files
            welcomeScreen.classList.remove('active');
            ideScreen.classList.add('active');

            // Show the folder name as project name
            projectName.textContent = path.split('/').pop();

            loadFileTree();
        } else {
            errorMsg.textContent = data.error;
        }
    } catch (err) {
        errorMsg.textContent = 'Failed to connect to server';
    }
}

/**
 * Fetches the list of files from the server and renders the file tree.
 */
async function loadFileTree() {
    try {
        const response = await fetch('/files');
        const data = await response.json();

        if (data.files) {
            fileTree.innerHTML = ''; // Clear existing tree
            const listContainer = document.createElement('ul');
            renderTreeNodes(data.files, listContainer);
            fileTree.appendChild(listContainer);
        }
    } catch (err) {
        console.error('Failed to load files', err);
    }
}

/**
 * Recursive function to render the file tree structure.
 * @param {Array} items - List of file/folder objects
 * @param {HTMLElement} container - The UL element to append to
 */
function renderTreeNodes(items, container) {
    // Sort items: Directories first, then files, both alphabetically
    items.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
    });

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = item.type; // 'directory' or 'file'

        if (item.type === 'directory') {
            li.textContent = '📁 ' + item.name;

            // Create a nested list for children
            const childUl = document.createElement('ul');
            childUl.style.display = 'none'; // Hidden by default (collapsed)

            if (item.children) {
                renderTreeNodes(item.children, childUl);
            }

            // Toggle visibility on click
            li.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering parent click events
                childUl.style.display = childUl.style.display === 'none' ? 'block' : 'none';
            });

            container.appendChild(li);
            container.appendChild(childUl);
        } else {
            // It's a file
            li.textContent = '📄 ' + item.name;

            // Open file on click
            li.addEventListener('click', (e) => {
                e.stopPropagation();

                // Highlight the active file
                document.querySelectorAll('.file-tree li.active').forEach(el => el.classList.remove('active'));
                li.classList.add('active');

                loadFile(item.path);
            });

            container.appendChild(li);
        }
    });
}

/**
 * Fetches the content of a specific file from the server.
 * @param {string} path - Relative path of the file
 */
async function loadFile(path) {
    try {
        // Encode the path to ensure it's safe for URL
        const response = await fetch(`/file?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.content !== undefined) {
            codeEditor.value = data.content;
            currentFilePath = path;
            currentFilename.textContent = path;
            updateLineNumbers();
        }
    } catch (err) {
        alert('Error loading file');
    }
}

/**
 * Sends the current editor content to the server to save.
 */
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
            // Show temporary "Saved!" message
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

/**
 * Requests the server to open the system terminal.
 */
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
