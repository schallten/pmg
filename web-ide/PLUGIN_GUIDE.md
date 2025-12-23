# Custom Plugin System

The PMG Web IDE now supports loading custom plugins from external URLs!

## How to Load a Custom Plugin

1. Open the IDE and click the **⚙️ Settings** button
2. Scroll down to the **"Load Custom Plugin"** section
3. Enter a URL to a JavaScript file (must end with `.js`)
4. Click **"Load Plugin"**

The plugin will be:
- Loaded immediately
- Saved to localStorage for future sessions
- Listed in the "Custom Plugins" section

## Creating Your Own Plugin

Your plugin must be a JavaScript ES6 module that exports at least two functions:

### Required Exports

```javascript
// Required: Return the plugin name
export function getName() {
    return "My Awesome Plugin";
}

// Required: Return the plugin description
export function getDescription() {
    return "This plugin does amazing things!";
}
```

### Optional Exports

```javascript
// Optional: Add an enable/disable toggle
export const isEnabled = { value: true };

// Optional: Add any custom functionality
export function myCustomFunction() {
    // Your code here
}
```

## Example Plugin

See `public/example-plugin.js` in this directory for a complete example.

To test it locally:
1. Start the IDE
2. Use the URL: `http://localhost:3000/example-plugin.js`

## Plugin Requirements

- ✅ Must be a valid JavaScript ES6 module
- ✅ Must export `getName()` function
- ✅ Must export `getDescription()` function
- ✅ URL must end with `.js`
- ✅ Must be accessible via HTTP/HTTPS (CORS-enabled)

## Managing Custom Plugins

- **View**: Open Settings → Custom Plugins section
- **Toggle**: Use the switch to enable/disable (if plugin supports it)
- **Remove**: Click the "Remove" button to unload and delete from storage

## Plugin Storage

Custom plugins are stored in localStorage under the key `pmg-ide-custom-plugins`. They will automatically reload when you restart the IDE.

## Security Notes

⚠️ **Important**: Only load plugins from trusted sources! Custom plugins have access to the IDE's JavaScript context and can execute arbitrary code.

## Troubleshooting

**Plugin won't load?**
- Ensure the URL ends with `.js`
- Check browser console for errors
- Verify the server allows CORS requests
- Make sure the plugin exports required functions

**Plugin loaded but doesn't appear?**
- Check that `getName()` and `getDescription()` are exported
- Ensure there are no JavaScript errors in the plugin code
- Try refreshing the page

## Advanced: Plugin Hooks

Currently, plugins can export:
- `getName()` - Display name
- `getDescription()` - Description text
- `isEnabled` - Toggle state (object with `value` property)

Future versions may support additional hooks for:
- Syntax highlighting
- Code completion
- Custom UI panels
- File type handlers
