const STORAGE_KEY = "zhihuFilter";
const KEYWORD_MAX_LEN = 64;
const KEYWORD_TOTAL_MAX = 2000;

function sanitizeKeywords(inputList) {
  if (!Array.isArray(inputList)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of inputList) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.length > KEYWORD_MAX_LEN) continue;
    const lc = trimmed.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    result.push(trimmed);
    if (result.length >= KEYWORD_TOTAL_MAX) break;
  }
  return result;
}

async function loadKeywords() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const box = data && data[STORAGE_KEY];
    if (Array.isArray(box)) {
      const keywords = sanitizeKeywords(box);
      const updatedAt = Date.now();
      return { keywords, updatedAt };
    }
    if (box && typeof box === "object") {
      const keywords = sanitizeKeywords(box.keywords);
      const updatedAt = Number(box.updatedAt) || Date.now();
      return { keywords, updatedAt };
    }
    return { keywords: [], updatedAt: 0 };
  } catch (err) {
    console.log("[ZhihuFilter] loadKeywords error", err);
    return { keywords: [], updatedAt: 0 };
  }
}

async function saveKeywords(list) {
  try {
    const keywords = sanitizeKeywords(list);
    const updatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: { keywords, updatedAt } });
  } catch (err) {
    console.log("[ZhihuFilter] saveKeywords error", err);
  }
}

function onKeywordsChanged(handler) {
  function listener(changes, areaName) {
    if (areaName !== "local") return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    const next = change.newValue;
    const keywords = next && Array.isArray(next.keywords)
      ? sanitizeKeywords(next.keywords)
      : [];
    try { handler(keywords); } catch (_) {}
  }
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

window.ZhihuFilterStorage = {
  loadKeywords,
  saveKeywords,
  onKeywordsChanged
};
