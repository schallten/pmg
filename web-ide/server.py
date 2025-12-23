import os
import subprocess
import platform
from flask import Flask, request, jsonify, send_file
import logging
import json

app = Flask(__name__, static_folder='public', static_url_path='')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

current_workspace = None
RECENT_WORKSPACES_FILE = 'recent_workspaces.json'

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

@app.route('/terminal', methods=['POST'])
def open_terminal():
    if not current_workspace:
        return jsonify({'error': 'No workspace open'}), 400
        
    system_platform = platform.system()
    
    try:
        if system_platform == 'Windows':
            subprocess.Popen(['cmd.exe', '/c', 'start', 'cmd.exe', '/K', f'cd /d "{current_workspace}"'], shell=True)
        elif system_platform == 'Darwin': # macOS
            subprocess.Popen(['open', '-a', 'Terminal', current_workspace])
        elif system_platform == 'Linux':
            terminals = [
                ['gnome-terminal', '--working-directory', current_workspace],
                ['konsole', '--workdir', current_workspace],
                ['x-terminal-emulator', '-e', f'cd "{current_workspace}" && $SHELL'],
                ['xterm', '-e', f'cd "{current_workspace}" && $SHELL']
            ]
            
            spawned = False
            for cmd in terminals:
                try:
                    subprocess.Popen(cmd, start_new_session=True)
                    spawned = True
                    break
                except FileNotFoundError:
                    continue
                except Exception:
                    continue
            
            if not spawned:
                 return jsonify({'error': 'No supported terminal found'}), 500
                 
        else:
             return jsonify({'error': f'Unsupported OS: {system_platform}'}), 400
             
        return jsonify({'success': True, 'message': 'Terminal launch requested'})
        
    except Exception as e:
        logger.error(f"Failed to open terminal: {e}")
        return jsonify({'error': 'Failed to open terminal'}), 500

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
