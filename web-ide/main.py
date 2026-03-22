import threading
import time
import webbrowser
from server import app

def start_server():
    # Use a fixed port or allow dynamic port selection
    # For simplicity, keep 3000 as it's already used in the frontend/server
    app.run(port=3000, threaded=True, debug=False)

if __name__ == '__main__':
    print("Starting PMG WEB IDE server...")
    
    # Start Flask server in a separate thread
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()
    
    # Give the server a moment to start
    time.sleep(1)
    
    url = 'http://localhost:3000'
    print(f"Opening {url} in your default browser...")
    webbrowser.open(url)
    
    # Keep the main thread alive as long as the server thread is running
    # Since t is daemon=True, we need to wait for it or just block here
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping server...")
