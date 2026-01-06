# DOM for LLM Extractor

Extract DOM elements with rich context optimized for LLM consumption. Press `Cmd+Shift+M` in any browser, drag to select, and get detailed element info copied to clipboard.

## Browser Support

| Browser | Method | Setup Required |
|---------|--------|----------------|
| Chrome | AppleScript injection | None |
| Safari | AppleScript injection | None |
| Arc | AppleScript injection | None |
| Microsoft Edge | AppleScript injection | None |
| Firefox | Bookmarklet click | One-time bookmark setup |

## Installation

1. Copy `dom-for-llm-extractor/` to `~/.hammerspoon/workflow-tools/`
2. Add to your `~/.hammerspoon/init.lua`:
   ```lua
   dofile(os.getenv("HOME") .. "/.hammerspoon/workflow-tools/dom-for-llm-extractor/init.lua")
   ```
3. Reload Hammerspoon: `Cmd+Alt+Ctrl+R`

### Firefox Setup (One-Time)

Firefox blocks AppleScript JavaScript injection for security. We work around this by clicking a bookmarklet via the Bookmarks menu.

1. Open Firefox
2. Press `Cmd+Shift+B` to show the Bookmarks Sidebar
3. Right-click "Bookmarks Toolbar" > "Add Bookmark..."
4. Set:
   - **Name:** `DOM Extractor`
   - **URL:** Copy the entire contents of `firefox-bookmarklet.js`
5. Save

The bookmarklet must be named "DOM Extractor" (or contain those words) for the hotkey to find it.

## Usage

1. Focus any supported browser
2. Press `Cmd+Shift+M`
3. Drag a rectangle around the element(s) you want to extract
4. Release - info is copied to clipboard and a toast confirms

Press `Escape` to cancel without copying.

## Output Format

The extracted data is optimized for LLM context:

```
=== SELECTION ===
Region: top-center of viewport
Position: 25.0% from left, 5.2% from top
Size: 200x48px (15.0% x 4.5% of viewport)

=== PRIMARY ELEMENT ===
Tag: button#submit-btn.primary.large
Text: "Submit Form"
Selector: #submit-btn
Path: main > form.contact > div.actions > [this]

--- Position ---
Viewport: 25.0% left, 5.2% top
Size: 15.0% x 4.5%
In div.actions: 80.0% left, 50.0% top
Child 2 of 3 siblings
Inside: <form> (form.contact)

--- Attributes ---
Role: button
Label: Submit contact form
Test ID: submit-button

=== NEARBY ELEMENTS (2) ===
- input#email: "Enter your email"
- label.required: "Email Address"
```

### What's Extracted

- **Region detection:** top-left, middle-center, bottom-right, etc.
- **Landmark context:** Detects if element is inside `<header>`, `<nav>`, `<main>`, `<footer>`, etc.
- **Unique CSS selectors:** Includes `:nth-of-type()` for disambiguation
- **Ancestor path:** Shows parent chain for context
- **Semantic/ARIA info:** `role`, `aria-label`, `data-testid`, etc.
- **Sibling context:** "Child 3 of 5 siblings"
- **Interactive attributes:** `href`, `placeholder`, `name`, `type` for inputs
- **Image info:** `alt` text and `src`
- **All nearby elements:** Every element in your selection, not truncated

## Files

| File | Purpose |
|------|---------|
| `init.lua` | Hammerspoon hotkey binding and browser detection |
| `page-measure-enhanced-fixed.js` | Source JavaScript (readable) |
| `page-measure-enhanced-fixed.min.js` | Minified JavaScript (used by init.lua) |
| `firefox-bookmarklet.js` | Ready-to-copy bookmarklet with `javascript:` prefix |

## How It Works

### Chrome, Safari, Arc, Edge
AppleScript directly injects JavaScript into the active tab:
```applescript
tell application "Chrome" to execute front window's active tab javascript "..."
```

### Firefox
Firefox blocks AppleScript JavaScript injection (security feature). Instead:
1. Hammerspoon opens the Bookmarks menu via AppleScript
2. Searches for any bookmark containing "DOM Extractor"
3. Clicks it to execute the bookmarklet

This approach:
- Requires NO browser extensions
- Opens NO network ports
- Has NO visible UI (menu click is instant)
- Works with any bookmark location (toolbar, menu, folders)

## Troubleshooting

### Firefox: "Bookmarklet not found"
- Ensure bookmark name contains "DOM Extractor"
- Bookmark must be in: Bookmarks Menu, Bookmarks Toolbar, or Other Bookmarks
- Nested folders are NOT searched (keep it at top level)

### Hotkey doesn't work
1. Check Hammerspoon is running (menu bar icon)
2. Reload config: `Cmd+Alt+Ctrl+R`
3. Check console for errors: `Cmd+Alt+Ctrl+C`
4. Ensure browser window is focused

### "Not in a supported browser"
The frontmost app must be one of: Google Chrome, Safari, Arc, Microsoft Edge, Firefox

## Security

- **No network access:** Everything runs locally
- **No extensions:** No browser permissions required
- **No ports:** No localhost servers
- **Clipboard only:** Data goes to clipboard, nowhere else
- **Open source:** Full source in `page-measure-enhanced-fixed.js`

## License

MIT - Part of the workflow-tools collection.
