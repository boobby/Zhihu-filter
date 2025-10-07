const STORAGE_KEY = "zhihuFilter";
const TITLE_HISTORY_KEY = "zhihuFilterTitleHistory";
const KEYWORD_MAX_LEN = 64;
const KEYWORD_TOTAL_MAX = 2000;
const TITLE_HISTORY_MAX = 1000;
const TITLE_HISTORY_EXPIRE_DAYS = 60;

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

// ========== Title History Management ==========

function sanitizeTitleHistory(inputList) {
  if (!Array.isArray(inputList)) return [];
  const seen = new Set();
  const result = [];
  const now = Date.now();
  const expireTime = now - (TITLE_HISTORY_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
  
  for (const item of inputList) {
    if (!item || typeof item !== "object") continue;
    const { title, timestamp, id } = item;
    if (typeof title !== "string" || !title.trim()) continue;
    if (typeof timestamp !== "number" || timestamp < expireTime) continue;
    if (typeof id !== "string" || !id) continue;
    
    const normalizedTitle = title.trim().toLowerCase();
    if (seen.has(normalizedTitle)) continue;
    seen.add(normalizedTitle);
    result.push({ title: title.trim(), timestamp, id });
    if (result.length >= TITLE_HISTORY_MAX) break;
  }
  return result;
}

async function loadTitleHistory() {
  try {
    const data = await chrome.storage.local.get(TITLE_HISTORY_KEY);
    const history = data && data[TITLE_HISTORY_KEY];
    if (Array.isArray(history)) {
      return sanitizeTitleHistory(history);
    }
    return [];
  } catch (err) {
    console.log("[ZhihuFilter] loadTitleHistory error", err);
    return [];
  }
}

async function saveTitleHistory(history) {
  try {
    const sanitized = sanitizeTitleHistory(history);
    await chrome.storage.local.set({ [TITLE_HISTORY_KEY]: sanitized });
  } catch (err) {
    console.log("[ZhihuFilter] saveTitleHistory error", err);
  }
}

async function addTitleToHistory(title) {
  try {
    if (!title || typeof title !== "string") return false;
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return false;
    
    const history = await loadTitleHistory();
    const now = Date.now();
    const id = Math.random().toString(36).slice(2, 10);
    
    // 检查是否已存在
    const exists = history.some(item => 
      item.title.toLowerCase() === normalizedTitle.toLowerCase()
    );
    
    if (!exists) {
      history.unshift({ title: normalizedTitle, timestamp: now, id });
      await saveTitleHistory(history);
    }
    
    return true;
  } catch (err) {
    console.log("[ZhihuFilter] addTitleToHistory error", err);
    return false;
  }
}

async function cleanExpiredTitles() {
  try {
    const history = await loadTitleHistory();
    const now = Date.now();
    const expireTime = now - (TITLE_HISTORY_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
    
    const validHistory = history.filter(item => item.timestamp >= expireTime);
    
    if (validHistory.length !== history.length) {
      await saveTitleHistory(validHistory);
      console.log(`[ZhihuFilter] Cleaned ${history.length - validHistory.length} expired titles`);
    }
    
    return validHistory;
  } catch (err) {
    console.log("[ZhihuFilter] cleanExpiredTitles error", err);
    return [];
  }
}

async function isTitleSeen(title) {
  try {
    if (!title || typeof title !== "string") return false;
    const normalizedTitle = title.trim().toLowerCase();
    if (!normalizedTitle) return false;
    
    const history = await loadTitleHistory();
    return history.some(item => 
      item.title.toLowerCase() === normalizedTitle
    );
  } catch (err) {
    console.log("[ZhihuFilter] isTitleSeen error", err);
    return false;
  }
}

function onTitleHistoryChanged(handler) {
  function listener(changes, areaName) {
    if (areaName !== "local") return;
    const change = changes[TITLE_HISTORY_KEY];
    if (!change) return;
    const next = change.newValue;
    const history = Array.isArray(next) ? sanitizeTitleHistory(next) : [];
    try { handler(history); } catch (_) {}
  }
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

window.ZhihuFilterStorage = {
  loadKeywords,
  saveKeywords,
  onKeywordsChanged,
  loadTitleHistory,
  saveTitleHistory,
  addTitleToHistory,
  cleanExpiredTitles,
  isTitleSeen,
  onTitleHistoryChanged
};
