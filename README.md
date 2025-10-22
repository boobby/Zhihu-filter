# Zhihu Content Filter & Ad Remover

Chrome MV3 extension that collapses Zhihu question cards whose titles match your blocked keywords or have been seen before, and removes ads automatically.

## Features

### Ad Removal
- Automatically remove Zhihu ad elements from the page
- Silent operation with no user interaction required
- Supports common ad containers: `Pc-feedAd`, `advert-signpc-label`

### Keyword Filtering
- Collapse question cards whose titles match blocked keywords
- Case-insensitive matching; whole-word for Latin; phrase for CJK
- Support for large keyword lists (~1000) via batched regex

### Title History Management
- Automatically record browsed question titles
- Block duplicate content within 60 days
- Visual distinction between keyword-filtered and duplicate content
- History management interface with import/export functionality

## Load in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder

## Configuration

### Keywords
- Click the extension's "Options" page
- Enter one keyword per line in the "关键词过滤" section
- Click Save

### Title History
- Enable/disable title history recording
- View, clear, import, or export browsing history
- History records are automatically cleaned after 60 days
- Maximum 1000 history records

## How it works
- On `https://*.zhihu.com/*`, the content script scans question title anchors
- Ad elements are silently removed before content filtering
- Cards are collapsed if they match:
  1. Blocked keywords (blue placeholder)
  2. Previously seen titles within 60 days (orange placeholder)
- A placeholder bar appears with a button to expand
- Data is stored in `chrome.storage.local`

## Visual Indicators
- **Blue placeholder**: Content filtered by keywords
- **Orange placeholder**: Duplicate content (seen before)
- Both placeholders show truncated title and reason for filtering

## Debugging
- Open DevTools Console on a Zhihu page
- Logs are prefixed with `[ZhihuFilter]`
- History operations are logged for debugging

## Technical Details
- Only question title text is matched to avoid false positives
- Title history uses normalized text comparison for accurate duplicate detection
- Debounced title recording prevents excessive storage writes
- Automatic cleanup of expired history records
- Responsive design for mobile and desktop

## Privacy
- All data is stored locally in your browser
- No data is sent to external servers
- History records include only title text and timestamp
