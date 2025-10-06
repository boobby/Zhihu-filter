# Zhihu Keyword Filter

Chrome MV3 extension that collapses Zhihu question cards whose titles match your blocked keywords.

## Load in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder

## Configure keywords
- Click the extension's "Options" page
- Enter one keyword per line
- Case-insensitive; whole-word for Latin; phrase for CJK
- Click Save

## How it works
- On `https://www.zhihu.com/*`, the content script scans question title anchors and collapses matched cards.
- A placeholder bar appears before the card, with a button to expand.
- Keywords are stored in `chrome.storage.local`.

## Debugging
- Open DevTools Console on a Zhihu page.
- Logs are prefixed with `[ZhihuFilter]`.

## Notes
- Only question title text is matched to avoid false positives.
- Large keyword lists (~1000) are supported via batched regex for Latin and direct phrase checks for CJK.
