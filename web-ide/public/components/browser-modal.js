/**
 * Browser Modal Component
 * Embedded browser for quick searches
 */

export function initBrowserModal() {
    const browserBtn = document.getElementById('browser-btn');
    const browserModal = document.getElementById('browser-modal');
    const closeBrowserBtn = document.getElementById('close-browser');
    const browserIframe = document.getElementById('browser-iframe');

    if (!browserBtn || !browserModal) return;

    // Open browser modal
    browserBtn.addEventListener('click', () => {
        browserModal.style.display = 'block';
        // Load Google search if not already loaded
        if (browserIframe && !browserIframe.src) {
            // Try Google with igu parameter, fallback to DuckDuckGo if blocked
            browserIframe.src = 'https://www.google.com/webhp?igu=1';

            // Fallback to DuckDuckGo if Google blocks iframe
            browserIframe.onerror = () => {
                browserIframe.src = 'https://duckduckgo.com/';
            };
        }
    });

    // Close browser modal
    if (closeBrowserBtn) {
        closeBrowserBtn.addEventListener('click', () => {
            browserModal.style.display = 'none';
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === browserModal) {
            browserModal.style.display = 'none';
        }
    });
}
