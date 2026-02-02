# Eyedropper Color Picker

A Hammerspoon script that picks any pixel color on screen and copies the hex value to your clipboard. Works system-wide in any app or window.

## Why?

No need to open a separate color picker app or browser extension. One hotkey, one click, hex in your clipboard.

## Installation

1. Install [Hammerspoon](https://www.hammerspoon.org/) (or `brew install --cask hammerspoon`)
2. Copy `init.lua` to `~/.hammerspoon/init.lua`
3. Reload Hammerspoon config

## Usage

| Hotkey | Action |
|--------|--------|
| `Cmd+Option+E` | Activate eyedropper mode |
| `Click` | Pick color at cursor and copy hex to clipboard |
| `Escape` | Cancel eyedropper mode |
| `Cmd+Option+E` (again) | Toggle off |

## Example workflow

1. Press `Cmd+Option+E` → "Eyedropper: click to pick color (Esc to cancel)"
2. Move cursor over the pixel you want
3. Click → "#4A90D9" copied to clipboard and shown as alert
4. Paste anywhere

## How it works

1. `Cmd+Option+E` starts an event tap listening for mouse clicks
2. On click, captures a 1x1 pixel screenshot at cursor position using `screencapture -R`
3. Converts to BMP via `sips` and reads the raw BGRA pixel bytes
4. Formats as `#RRGGBB` and copies to clipboard

Zero external dependencies — uses only macOS built-in tools (`screencapture`, `sips`).

## License

MIT
