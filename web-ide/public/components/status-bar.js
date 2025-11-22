/**
 * Status Bar Component
 * Displays current time and internet speed
 */

export function initStatusBar() {
    const statusBar = document.getElementById('status-bar');
    const timeDisplay = document.getElementById('time-display');
    const speedDisplay = document.getElementById('speed-display');

    if (!statusBar || !timeDisplay || !speedDisplay) {
        console.warn('Status bar elements not found');
        return;
    }

    // Update time every second
    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        timeDisplay.textContent = timeString;
    }

    // Update connection speed
    function updateSpeed() {
        if (navigator.connection && navigator.connection.downlink) {
            const speed = navigator.connection.downlink;
            speedDisplay.textContent = `${speed.toFixed(1)} Mbps`;
        } else if (navigator.onLine) {
            speedDisplay.textContent = 'Online';
        } else {
            speedDisplay.textContent = 'Offline';
        }
    }

    // Initial update
    updateTime();
    updateSpeed();

    // Set up intervals
    setInterval(updateTime, 1000);
    setInterval(updateSpeed, 5000);

    // Listen for online/offline events
    window.addEventListener('online', updateSpeed);
    window.addEventListener('offline', updateSpeed);
}
