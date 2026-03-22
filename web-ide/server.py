import os
import subprocess
import platform
from flask import Flask, request, jsonify, send_file
import logging
import json
import threading
import queue
import uuid

app = Flask(__name__, static_folder='public', static_url_path='')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

current_workspace = None
RECENT_WORKSPACES_FILE = 'recent_workspaces.json'

# Terminal Global State
# Dictionary mapping terminal_id to {process, fd, output_queue}
terminals = {}

def read_terminal_output(fd, terminal_id):
    while True:
        try:
            # Read non-blocking up to 1024 bytes
            data = os.read(fd, 1024)
            if data:
                if terminal_id in terminals:
                    terminals[terminal_id]['output_queue'].put(data.decode('utf-8', errors='replace'))
                else:
                    break
            else:
                break
        except Exception:
            break

def win_read_output(out, terminal_id):
    while True:
        try:
            data = out.read(1)
            if data:
                if terminal_id in terminals:
                    terminals[terminal_id]['output_queue'].put(data.decode('utf-8', errors='replace'))
                else:
                    break
            else:
                break
        except Exception:
            break

def load_recent_workspaces():
    if not os.path.exists(RECENT_WORKSPACES_FILE):
        return []
    try:
        with open(RECENT_WORKSPACES_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_recent_workspace(path):
    recent = load_recent_workspaces()
    # Remove if exists to move to top
    if path in recent:
        recent.remove(path)
    # Add to top
    recent.insert(0, path)
    # Keep only last 5
    recent = recent[:5]
    
    try:
        with open(RECENT_WORKSPACES_FILE, 'w') as f:
            json.dump(recent, f)
    except Exception as e:
        logger.error(f"Failed to save recent workspaces: {e}")


def read_dir_recursive(directory):
    results = []
    try:
        # List all files and directories
        items = os.listdir(directory)
        
        for item in items:
            full_path = os.path.join(directory, item)
            relative_path = os.path.relpath(full_path, current_workspace)
            
            if os.path.isdir(full_path):
                # Skip .git and node_modules
                if item == '.git' or item == 'node_modules':
                    continue
                
                results.append({
                    'name': item,
                    'path': relative_path,
                    'type': 'directory',
                    'children': read_dir_recursive(full_path)
                })
            else:
                results.append({
                    'name': item,
                    'path': relative_path,
                    'type': 'file'
                })
    except Exception as e:
        logger.error(f"Error reading directory {directory}: {e}")
    
    return results

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/recent', methods=['GET'])
def get_recent_workspaces():
    return jsonify(load_recent_workspaces())

@app.route('/open', methods=['POST'])
def open_workspace():
    global current_workspace
    data = request.get_json()
    folder_path = data.get('path')
    
    if not folder_path:
        return jsonify({'error': 'Path is required'}), 400
    
    if not os.path.isdir(folder_path):
        return jsonify({'error': 'Path is not a directory'}), 400
    
    current_workspace = folder_path
    save_recent_workspace(current_workspace)
    return jsonify({'success': True, 'path': current_workspace})

@app.route('/files', methods=['GET'])
def list_files():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
    
    try:
        files = read_dir_recursive(current_workspace)
        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/file', methods=['GET'])
def read_file():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
    
    file_path = request.args.get('path')
    is_raw = request.args.get('raw') == 'true'
    
    if not file_path:
        return jsonify({'error': 'Path is required'}), 400
    
    try:
        full_path = os.path.join(current_workspace, file_path)
        
        # Security check
        if not os.path.commonpath([current_workspace, full_path]).startswith(current_workspace):
             return jsonify({'error': 'Access denied'}), 403
             
        if not os.path.exists(full_path):
            return jsonify({'error': 'File not found'}), 404

        if is_raw:
            return send_file(full_path)
        else:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save', methods=['POST'])
def save_file():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
    
    data = request.get_json()
    file_path = data.get('path')
    content = data.get('content')
    
    if not file_path or content is None:
        return jsonify({'error': 'Path and content are required'}), 400
        
    try:
        full_path = os.path.join(current_workspace, file_path)
        
        # Security check
        if not os.path.commonpath([current_workspace, full_path]).startswith(current_workspace):
             return jsonify({'error': 'Access denied'}), 403
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/terminal/start', methods=['POST'])
def terminal_start():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
            
    terminal_id = str(uuid.uuid4())
    system_platform = platform.system()
    
    output_queue = queue.Queue()
    
    if system_platform != 'Windows':
        import pty
        master, slave = pty.openpty()
        process = subprocess.Popen(
            ['/bin/bash'],
            stdin=slave,
            stdout=slave,
            stderr=slave,
            cwd=current_workspace,
            env=os.environ.copy()
        )
        os.close(slave)
        
        terminals[terminal_id] = {
            'process': process,
            'fd': master,
            'output_queue': output_queue
        }
        
        t = threading.Thread(target=read_terminal_output, args=(master, terminal_id))
        t.daemon = True
        t.start()
    else:
        process = subprocess.Popen(
            ['cmd.exe'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=current_workspace,
            env=os.environ.copy()
        )
        
        terminals[terminal_id] = {
            'process': process,
            'fd': None,
            'output_queue': output_queue
        }
        
        t = threading.Thread(target=win_read_output, args=(process.stdout, terminal_id))
        t.daemon = True
        t.start()
        
    return jsonify({'success': True, 'terminal_id': terminal_id})

@app.route('/terminal/read', methods=['GET'])
def terminal_read():
    terminal_id = request.args.get('terminal_id')
    if not terminal_id or terminal_id not in terminals:
        return jsonify({'error': 'Invalid terminal_id'}), 404
        
    output = []
    q = terminals[terminal_id]['output_queue']
    while not q.empty():
        try:
            output.append(q.get_nowait())
        except queue.Empty:
            break
    return jsonify({'output': "".join(output)})

@app.route('/terminal/write', methods=['POST'])
def terminal_write():
    data = request.get_json()
    terminal_id = data.get('terminal_id')
    input_text = data.get('input', '')
    
    if not terminal_id or terminal_id not in terminals:
        return jsonify({'error': 'Invalid terminal_id'}), 404
        
    term = terminals[terminal_id]
    system_platform = platform.system()
    
    if system_platform != 'Windows' and term['fd'] is not None:
        try:
            os.write(term['fd'], input_text.encode('utf-8'))
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    elif term['process']:
        try:
            term['process'].stdin.write(input_text.encode('utf-8'))
            term['process'].stdin.flush()
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'success': True})

@app.route('/terminal/resize', methods=['POST'])
def terminal_resize():
    data = request.get_json()
    terminal_id = data.get('terminal_id')
    cols = data.get('cols', 80)
    rows = data.get('rows', 24)
    
    if not terminal_id or terminal_id not in terminals:
        return jsonify({'error': 'Invalid terminal_id'}), 404
        
    term = terminals[terminal_id]
    if platform.system() != 'Windows' and term['fd'] is not None:
        try:
            import fcntl, termios, struct
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(term['fd'], termios.TIOCSWINSZ, winsize)
        except Exception:
            pass
    return jsonify({'success': True})

@app.route('/terminal/kill', methods=['POST'])
def terminal_kill():
    data = request.get_json()
    terminal_id = data.get('terminal_id')
    
    if not terminal_id or terminal_id not in terminals:
        return jsonify({'error': 'Invalid terminal_id'}), 404
        
    term = terminals[terminal_id]
    try:
        term['process'].kill()
        if term['fd'] is not None:
            try:
                os.close(term['fd'])
            except:
                pass
        del terminals[terminal_id]
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/browse', methods=['GET'])
def browse_directory():
    try:
        system = platform.system()
        path_str = None
        
        if system == 'Windows':
            # Windows: Use PowerShell folder browser dialog
            ps_script = """
Add-Type -AssemblyName System.Windows.Forms
$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$folderBrowser.Description = 'Select a folder'
$folderBrowser.RootFolder = 'MyComputer'
if ($folderBrowser.ShowDialog() -eq 'OK') {
    Write-Output $folderBrowser.SelectedPath
}
"""
            process = subprocess.Popen(
                ['powershell', '-Command', ps_script],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            stdout, stderr = process.communicate()
            path_str = stdout.strip()
            
        elif system == 'Darwin':  # macOS
            # macOS: Use AppleScript
            applescript = 'POSIX path of (choose folder with prompt "Select a folder")'
            process = subprocess.Popen(
                ['osascript', '-e', applescript],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            stdout, stderr = process.communicate()
            if process.returncode == 0:
                path_str = stdout.strip()
            
        else:  # Linux
            # Try multiple Linux options in order of preference
            dialog_commands = [
                # KDE
                ['kdialog', '--getexistingdirectory', '.'],
                # GNOME/GTK
                ['zenity', '--file-selection', '--directory'],
                # Generic X11
                ['qarma', '--file-selection', '--directory'],
                # Fallback: yad
                ['yad', '--file', '--directory']
            ]
            
            for cmd in dialog_commands:
                try:
                    process = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True
                    )
                    stdout, stderr = process.communicate()
                    if process.returncode == 0:
                        path_str = stdout.strip()
                        break
                except FileNotFoundError:
                    continue
            
            if path_str is None:
                return jsonify({
                    'error': 'No dialog tool found. Please install one of: zenity, kdialog, qarma, or yad'
                }), 500
        
        # Common response handling
        if path_str:
            return jsonify({'path': path_str})
        else:
            return jsonify({'error': 'No directory selected'}), 400
            
    except FileNotFoundError as e:
        system = platform.system()
        if system == 'Windows':
            error_msg = 'PowerShell not found'
        elif system == 'Darwin':
            error_msg = 'osascript not found (macOS required)'
        else:
            error_msg = 'No dialog tool found. Install: sudo apt install zenity'
        return jsonify({'error': error_msg}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/create', methods=['POST'])
def create_item():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
    
    data = request.get_json()
    item_path = data.get('path')
    item_type = data.get('type', 'file') # default to file
    
    if not item_path:
        return jsonify({'error': 'Path is required'}), 400
        
    try:
        full_path = os.path.join(current_workspace, item_path)
        
        # Security check
        if not os.path.commonpath([current_workspace, full_path]).startswith(current_workspace):
             return jsonify({'error': 'Access denied'}), 403
        
        if os.path.exists(full_path):
            return jsonify({'error': 'File or directory already exists'}), 400
            
        if item_type == 'directory':
            os.makedirs(full_path)
        else:
            # Ensure parent directory exists
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write('') # Create empty file
                
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/delete', methods=['POST'])
def delete_item():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
    
    data = request.get_json()
    item_path = data.get('path')
    
    if not item_path:
        return jsonify({'error': 'Path is required'}), 400
        
    try:
        full_path = os.path.join(current_workspace, item_path)
        
        # Security check
        if not os.path.commonpath([current_workspace, full_path]).startswith(current_workspace):
             return jsonify({'error': 'Access denied'}), 403
        
        if not os.path.exists(full_path):
            return jsonify({'error': 'File or directory not found'}), 404
            
        if os.path.isdir(full_path):
            import shutil
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
            
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vcs/status', methods=['GET'])
def vcs_status():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
    
    vcs_path = os.path.join(current_workspace, '.pmg')
    is_vcs = os.path.isdir(vcs_path)
    return jsonify({'is_vcs': is_vcs})

@app.route('/vcs/history', methods=['GET'])
def vcs_history():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
    
    db_path = os.path.join(current_workspace, '.pmg', 'vcs.db')
    if not os.path.exists(db_path):
        return jsonify({'error': 'VCS database not found'}), 404
    
    try:
        import sqlite3
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT commit_id, commit_message, author, last_updated, COUNT(path) as files_changed
            FROM files 
            GROUP BY commit_id 
            ORDER BY id DESC
        ''')
        
        history = []
        for row in cursor.fetchall():
            # Ensure all fields are JSON serializable (decode bytes if necessary)
            commit_id = row[0].decode('utf-8', errors='replace') if isinstance(row[0], bytes) else row[0]
            message = row[1].decode('utf-8', errors='replace') if isinstance(row[1], bytes) else row[1]
            author = row[2].decode('utf-8', errors='replace') if isinstance(row[2], bytes) else row[2]
            
            history.append({
                'commit_id': commit_id,
                'message': message,
                'author': author,
                'timestamp': row[3],
                'files_changed': row[4]
            })
            
        conn.close()
        return jsonify({'history': history})
    except Exception as e:
        logger.error(f"Error reading VCS history: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/resources', methods=['GET'])
def get_resources():
    try:
        import psutil
        cpu_percent = psutil.cpu_percent(interval=None)
        ram_percent = psutil.virtual_memory().percent
        return jsonify({'cpu': cpu_percent, 'ram': ram_percent})
    except ImportError:
        return jsonify({'error': 'psutil not installed'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=3000, debug=True)
