/**
 * Example Custom Plugin for PMG Web IDE
 * 
 * This is a sample plugin that demonstrates the plugin interface.
 * To use this plugin:
 * 1. Host this file on a web server (must be accessible via HTTPS or localhost)
 * 2. In the IDE Settings, paste the URL to this .js file
 * 3. Click "Load Plugin"
 * 
 * Plugin Interface Requirements:
 * - Must export a getName() function that returns a string
 * - Must export a getDescription() function that returns a string
 * - Optionally export an isEnabled object with a value property for toggle functionality
 * - Can export any other functions that your plugin needs
 */

export const isEnabled = { value: true };

export function getName() {
    return "Example Custom Plugin";
}

export function getDescription() {
    return "A sample plugin that demonstrates the plugin interface. This plugin doesn't do anything special.";
}

// Optional: Add custom functionality
export function initialize() {
    console.log("Example plugin initialized!");
}

// Optional: You can add any other functions your plugin needs
export function doSomething() {
    console.log("Custom plugin is doing something!");
}
