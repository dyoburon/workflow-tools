# DOM for LLM Extractor

A Hammerspoon tool that extracts rich DOM context optimized for LLM/AI agent consumption. Press `Cmd+Shift+M` in any browser, drag to select elements, and get comprehensive element data copied to clipboard instantly.

## Features

- **Universal browser support** - Chrome, Safari, Arc, Edge (AppleScript), Firefox (bookmarklet)
- **Zero truncation** - All text, all elements, no "... and X more"
- **Agentic context** - Form, table, list, modal, landmark detection for AI understanding
- **Predicted actions** - Tells AI what clicking/interacting would likely do
- **No extensions required** - Pure AppleScript + JavaScript injection
- **Privacy-focused** - No network, no cookies, no sensitive data extraction

## Browser Support

| Browser | Method | Setup Required |
|---------|--------|----------------|
| Chrome | AppleScript injection | Enable: View → Developer → Allow JavaScript from Apple Events |
| Safari | AppleScript injection | Enable: Develop menu → Allow JavaScript from Apple Events |
| Arc | AppleScript injection | None |
| Microsoft Edge | AppleScript injection | None |
| Firefox | Bookmarklet auto-click | One-time bookmark setup |

## Installation

1. Copy `dom-for-llm-extractor/` to `~/.hammerspoon/workflow-tools/`
2. Add to your `~/.hammerspoon/init.lua`:
   ```lua
   dofile(os.getenv("HOME") .. "/.hammerspoon/workflow-tools/dom-for-llm-extractor/init.lua")
   ```
3. Reload Hammerspoon: `Cmd+Alt+Ctrl+R` or `open -g hammerspoon://reload`

### Firefox Setup (One-Time)

Firefox blocks AppleScript JavaScript injection for security. The tool auto-clicks a bookmarklet instead.

1. Open Firefox
2. Create a new bookmark (Cmd+D or right-click bookmarks bar)
3. Set:
   - **Name:** `Dom Extractor` (exact name required)
   - **URL:** Paste entire contents of `bookmarklet.js`
4. Save

Now `Cmd+Shift+M` will automatically find and click this bookmarklet.

## Usage

1. Focus any supported browser
2. Press `Cmd+Shift+M`
3. Drag a rectangle around the element(s) you want to extract
4. Release mouse - data is copied to clipboard instantly
5. Press `Escape` to cancel

## Output Format

```
+-----------------------------------------------------------------
| DOM EXTRACT
| url: https://example.com/checkout
| viewport: 1440x900  scroll: 0,250
+-----------------------------------------------------------------
| SELECTION
| region: middle-center
| position: 45.2%, 52.1%
| pixels: 651,469 -> 789,517 (138x48)
+-----------------------------------------------------------------
| PRIMARY ELEMENT
| tag: button#submit-order.btn.btn-primary
| text: "Place Order"
| selector: #submit-order
|--- position
|    viewport: 651,469 (138x48)
|    in-parent: 75.2%, 80.0% of form#checkout-form
|--- visual
|    background: rgb(37, 99, 235)
|    color: rgb(255, 255, 255)
|    font: 16px Inter
|    fontWeight: 600
|    cursor: pointer
|--- design
|    borderRadius: 8px
|    padding: 12px 24px
|    shadow: yes
|    animated: yes
|--- semantic
|    role: button
|    ariaLabel: Place your order
|--- state
|    disabled: false
|--- interactive: native-button, focusable, pointer
|--- form
|    inForm: true
|    formId: checkout-form
|    formAction: /api/orders
|    formMethod: POST
|    formFields: 8
|    submitButton: button#submit-order
|--- landmark
|    landmark: main
|--- siblings
|    siblingIndex: 2
|    totalSiblings: 2
|    prevSibling: button.btn-secondary
|    prevText: Back to Cart
|--- hierarchy: div.actions < form#checkout-form < main < div.container
|--- action: submit-form
|--- viewport
|    visibility: fully-visible
+-----------------------------------------------------------------
| NEARBY (5)
| 1. span.price "$149.99"
| 2. div.order-summary "Order Summary" [interactive]
| 3. input#card-number [interactive]
| 4. label "Card Number"
| 5. form#checkout-form [interactive]
+-----------------------------------------------------------------
```

## Extracted Data

### Core Information
| Field | Description |
|-------|-------------|
| `tag` | Element tag with ID and classes |
| `text` | Full text content (no truncation) |
| `selector` | Unique CSS selector for targeting |

### Position & Layout
| Field | Description |
|-------|-------------|
| `viewport` | Pixel position and dimensions |
| `in-parent` | Percentage position within parent |
| `region` | Semantic region (top-left, middle-center, etc.) |

### Visual Properties
| Field | Description |
|-------|-------------|
| `background` | Background color |
| `color` | Text color |
| `font` | Font size and family |
| `fontWeight` | Font weight if not normal |
| `opacity` | If not fully opaque |
| `cursor` | Cursor style if interactive |
| `zIndex` | Z-index if layered |
| `hidden` | How element is hidden (display:none, visibility:hidden, opacity:0) |

### Design Properties
| Field | Description |
|-------|-------------|
| `borderRadius` | Border radius |
| `shadow` | Has box shadow |
| `padding` | Padding values |
| `margin` | Margin values |
| `layout` | flex or grid |
| `flexDirection` | Flex direction if flex |
| `gap` | Gap if flex/grid |
| `position` | CSS position if not static |
| `overflow` | Overflow if not visible |
| `animated` | Has CSS transitions |

### Semantic & Accessibility
| Field | Description |
|-------|-------------|
| `role` | ARIA role |
| `ariaLabel` | aria-label value |
| `labelledBy` | Text from aria-labelledby element |
| `describedBy` | Text from aria-describedby element |
| `label` | Associated label text (for inputs) |
| `title` | Title attribute |
| `alt` | Alt text (for images) |
| `href` | Link URL (sanitized, no query params) |
| `data` | Non-sensitive data-* attributes |

### Interactive State
| Field | Description |
|-------|-------------|
| `disabled` | Is disabled |
| `checked` | Is checked (checkbox/radio) |
| `selected` | Is selected |
| `expanded` | aria-expanded state |
| `focused` | Currently focused |
| `required` | Is required field |
| `invalid` | Has validation error |
| `readonly` | Is read-only |
| `value` | Current input value (not passwords) |
| `placeholder` | Placeholder text |

### Input Constraints
| Field | Description |
|-------|-------------|
| `minLength` | Minimum length |
| `maxLength` | Maximum length |
| `min` | Minimum value |
| `max` | Maximum value |
| `step` | Step value |
| `pattern` | Validation pattern |
| `inputMode` | Input mode hint |
| `autocomplete` | Autocomplete type |

### Interactivity Detection
| Field | Description |
|-------|-------------|
| `native-*` | Native interactive element (button, input, etc.) |
| `focusable` | Has tabIndex >= 0 |
| `onclick` | Has onclick handler |
| `pointer` | Has cursor: pointer |
| `role-*` | Has interactive ARIA role |
| `editable` | Is contenteditable |
| `draggable` | Is draggable |

### Context (Agentic)

#### Form Context
| Field | Description |
|-------|-------------|
| `inForm` | Is inside a form |
| `formId` | Form ID |
| `formName` | Form name |
| `formAction` | Form action URL (path only) |
| `formMethod` | Form method (GET/POST) |
| `formFields` | Number of form fields |
| `submitButton` | Submit button selector |

#### Table Context
| Field | Description |
|-------|-------------|
| `inTable` | Is inside a table |
| `row` | Row number (1-indexed) |
| `col` | Column number (1-indexed) |
| `totalRows` | Total rows |
| `totalCols` | Total columns |
| `isHeader` | Is a header cell (th) |
| `columnHeader` | Header text for this column |

#### List Context
| Field | Description |
|-------|-------------|
| `inList` | Is inside a list |
| `listType` | ul or ol |
| `position` | Position in list (1-indexed) |
| `totalItems` | Total list items |

#### Landmark Context
| Field | Description |
|-------|-------------|
| `landmark` | header, navigation, main, sidebar, footer, search, dialog, etc. |
| `landmarkLabel` | aria-label of landmark |

#### Modal Context
| Field | Description |
|-------|-------------|
| `inModal` | Is inside a modal/dialog |
| `modalId` | Modal ID |
| `modalTitle` | Modal title |
| `modalType` | Detection method (native, role, css-based) |

#### Sibling Context
| Field | Description |
|-------|-------------|
| `siblingIndex` | Position among siblings (1-indexed) |
| `totalSiblings` | Total sibling count |
| `prevSibling` | Previous sibling selector |
| `prevText` | Previous sibling text |
| `nextSibling` | Next sibling selector |
| `nextText` | Next sibling text |

#### Parent Hierarchy
Shows up to 5 parent elements: `div.card < section#main < main < body`

#### Predicted Action
| Action | Meaning |
|--------|---------|
| `submit-form` | Will submit a form |
| `navigate` | Will navigate to new page |
| `open-new-tab` | Will open in new tab |
| `scroll-to-anchor` | Will scroll to anchor |
| `toggle-expand` | Will expand/collapse |
| `toggle-check` | Will check/uncheck |
| `toggle-switch` | Will toggle switch |
| `select-option` | Will select option |
| `text-input` | Text input field |
| `number-input` | Number input field |
| `date-input` | Date/time input |
| `file-upload` | File upload |
| `slider-input` | Range slider |
| `color-picker` | Color picker |
| `dropdown-select` | Dropdown select |
| `video-player` | Video element |
| `audio-player` | Audio element |
| `switch-tab` | Tab switcher |
| `menu-action` | Menu item |
| `click-action` | Generic clickable |

#### Loading/Error Status
| Field | Description |
|-------|-------------|
| `loading` | Is in loading state |
| `loadingType` | Type (spinner, skeleton, etc.) |
| `hasError` | Has error state |
| `errorMessage` | Nearby error message text |

#### Viewport Visibility
| Field | Description |
|-------|-------------|
| `visibility` | fully-visible, partially-visible, off-screen |
| `clipped` | Which edge is clipped (top, bottom, left, right) |
| `direction` | Direction if off-screen (above, below, left, right) |

### Scroll Context
| Field | Description |
|-------|-------------|
| `scrollParent` | Scrollable parent selector |
| `scrollTop` | Current scroll position |
| `scrollHeight` | Total scrollable height |

### Pseudo Content
| Field | Description |
|-------|-------------|
| `before` | ::before content |
| `after` | ::after content |

## Files

| File | Purpose |
|------|---------|
| `init.lua` | Hammerspoon hotkey binding, browser detection, Firefox bookmarklet auto-click |
| `dom-extractor.js` | Full source JavaScript (readable, ~42KB) |
| `dom-extractor.min.js` | Minified JavaScript (used by init.lua, ~17KB) |
| `bookmarklet.js` | Ready-to-copy bookmarklet with `javascript:` prefix |

## How It Works

### Chrome, Safari, Arc, Edge
AppleScript directly injects JavaScript into the active tab:
```applescript
tell application "Chrome" to execute front window's active tab javascript "..."
```

### Firefox
Firefox blocks AppleScript JavaScript injection (security feature). Instead:
1. Hammerspoon uses System Events to open the Bookmarks menu
2. Searches for bookmark named exactly "Dom Extractor"
3. Clicks it to execute the bookmarklet

## Troubleshooting

### "Injection failed - Check browser permissions"
- **Chrome:** View → Developer → Allow JavaScript from Apple Events
- **Safari:** Settings → Advanced → Show Develop menu, then Develop → Allow JavaScript from Apple Events

### Firefox: "Bookmarklet not found"
- Bookmark must be named exactly `Dom Extractor`
- Must be in: Bookmarks Menu, Bookmarks Toolbar, or Other Bookmarks
- Nested folders are NOT searched (keep at top level)

### Hotkey doesn't work
1. Check Hammerspoon is running (menu bar icon)
2. Reload config: `open -g hammerspoon://reload`
3. Check console for errors

### No elements found
- Ensure you drag a rectangle (not just click)
- Some elements may be in iframes (not supported)
- Shadow DOM elements may not be detected

## Security & Privacy

- **No network access** - Everything runs locally
- **No extensions** - No browser permissions required  
- **No sensitive data** - Excludes: passwords, cookies, localStorage, tokens, auth data, query params
- **Clipboard only** - Data goes to clipboard, nowhere else
- **Open source** - Full source in `dom-extractor.js`

## License

MIT - Part of the workflow-tools collection.
