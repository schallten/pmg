import os
import subprocess
import platform
from flask import Flask, request, jsonify, send_file
import logging

app = Flask(__name__, static_folder='public', static_url_path='')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

current_workspace = None

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
        # Using zenity as in the original nodejs version
        process = subprocess.Popen(['zenity', '--file-selection', '--directory'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        
        if process.returncode == 0:
            path_str = stdout.decode('utf-8').strip()
            if path_str:
                return jsonify({'path': path_str})
            else:
                return jsonify({'error': 'No directory selected'}), 400
        else:
            return jsonify({'error': 'Selection cancelled'}), 400
            
    except FileNotFoundError:
        return jsonify({'error': 'Zenity not found. Please install zenity (sudo apt install zenity).'}), 500
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
