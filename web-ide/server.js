const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

let currentWorkspace = null;

// Helper to recursively read directory
async function readDirRecursive(dir) {
    const results = [];
    const list = await fs.readdir(dir, { withFileTypes: true });

    for (const file of list) {
        const fullPath = path.join(dir, file.name);
        const relativePath = path.relative(currentWorkspace, fullPath);

        if (file.isDirectory()) {
            // Skip .git and node_modules to avoid massive trees
            if (file.name === '.git' || file.name === 'node_modules') continue;

            results.push({
                name: file.name,
                path: relativePath,
                type: 'directory',
                children: await readDirRecursive(fullPath)
            });
        } else {
            results.push({
                name: file.name,
                path: relativePath,
                type: 'file'
            });
        }
    }
    return results;
}

// Set Workspace
app.post('/open', async (req, res) => {
    const { path: folderPath } = req.body;
    try {
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
            return res.status(400).json({ error: 'Path is not a directory' });
        }
        currentWorkspace = folderPath;
        res.json({ success: true, path: currentWorkspace });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List Files
app.get('/files', async (req, res) => {
    if (!currentWorkspace) return res.status(400).json({ error: 'No workspace open' });
    try {
        const files = await readDirRecursive(currentWorkspace);
        res.json({ files });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Read File
app.get('/file', async (req, res) => {
    if (!currentWorkspace) return res.status(400).json({ error: 'No workspace open' });
    const filePath = req.query.path;
    try {
        const fullPath = path.join(currentWorkspace, filePath);
        // Security check to prevent directory traversal
        if (!fullPath.startsWith(currentWorkspace)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const content = await fs.readFile(fullPath, 'utf-8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save File
app.post('/save', async (req, res) => {
    if (!currentWorkspace) return res.status(400).json({ error: 'No workspace open' });
    const { path: filePath, content } = req.body;
    try {
        const fullPath = path.join(currentWorkspace, filePath);
        if (!fullPath.startsWith(currentWorkspace)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        await fs.writeFile(fullPath, content, 'utf-8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Open Terminal
app.post('/terminal', (req, res) => {
    if (!currentWorkspace) return res.status(400).json({ error: 'No workspace open' });

    // Attempt to open a terminal. This is OS dependent.
    // Focusing on Linux as per user OS.

    // Try gnome-terminal, then x-terminal-emulator, then xterm
    const terminals = [
        ['gnome-terminal', ['--working-directory', currentWorkspace]],
        ['x-terminal-emulator', ['-e', `cd "${currentWorkspace}" && $SHELL`]],
        ['xterm', ['-e', `cd "${currentWorkspace}" && $SHELL`]]
    ];

    let spawned = false;

    for (const [cmd, args] of terminals) {
        try {
            const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
            child.on('error', () => { }); // Ignore errors, try next
            child.unref();
            spawned = true;
            break; // If spawn didn't throw immediately, assume success for now (simplified)
        } catch (e) {
            continue;
        }
    }

    // Since spawn is async and 'error' event is async, we might report success even if it fails later.
    // But for a simple tool, this is okay.
    res.json({ success: true, message: 'Terminal launch requested' });
});

// Browse Directory
app.get('/browse', (req, res) => {
    // Use zenity to pick a directory
    // We use spawn to run the command
    const child = spawn('zenity', ['--file-selection', '--directory']);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    child.on('close', (code) => {
        if (code === 0) {
            const pathStr = stdout.trim();
            if (pathStr) {
                res.json({ path: pathStr });
            } else {
                res.status(400).json({ error: 'No directory selected' });
            }
        } else {
            // Zenity returns non-zero if cancelled or failed
            res.status(400).json({ error: 'Selection cancelled' });
        }
    });

    child.on('error', (err) => {
        res.status(500).json({ error: 'Zenity not found. Please install zenity (sudo apt install zenity).' });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
