import threading
import time
import sys
import webview
from server import app

def start_server():
    app.run(port=3000, threaded=True)

if __name__ == '__main__':
    # Start Flask server in a separate thread
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()
    
    # Give the server a moment to start
    time.sleep(1)
    
    # Create the window
    webview.create_window('PMG - WEB IDE', 'http://localhost:3000', width=1200, height=800)
    
    # Start the webview
    webview.start()
