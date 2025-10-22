(function () {
  const LOG_PREFIX = "[ZhihuFilter]";
  const STORAGE = window.ZhihuFilterStorage;
  const MATCHER = window.ZhihuFilterMatcher;

  const CARD_MARK = "data-zhihu-filter-collapsed";
  const CARD_ID_ATTR = "data-zhihu-filter-id";
  const TITLE_LINK_SELECTORS = [
    'a[href^="/question/"]',
    'a[href*="/question/"]',
    'a.QuestionItem-title',
    'a[data-za-detail-view-element_name="Title"]',
    'h2 a[href^="/question/"]',
    'h3 a[href^="/question/"]'
  ].join(',');

  let currentKeywords = [];
  let currentMatchers = MATCHER.buildMatchers(currentKeywords);
  let currentTitleHistory = [];
  let currentTitleHistoryMatcher = MATCHER.buildTitleHistoryMatcher(currentTitleHistory);
  let titleHistoryEnabled = true;

  // Quick Add Keyword UI state
  let quickAddBtn = null;
  let quickAddHideTimer = null;
  let quickAddCurrentText = "";

  // ========== 工具函数 ==========
  function log(...args) {
    try { console.log(LOG_PREFIX, ...args); } catch (_) {}
  }

  function genId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function cleanText(text) {
    return (text || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  // ========== DOM 查询和文本提取 ==========
  function getTitleAnchors(root) {
    try {
      return root.querySelectorAll(TITLE_LINK_SELECTORS);
    } catch (_) {
      return [];
    }
  }

  function extractTitleText(anchor) {
    try {
      const raw = anchor.getAttribute('title')
        || anchor.getAttribute('aria-label')
        || anchor.textContent
        || '';
      return cleanText(raw);
    } catch (_) {
      return '';
    }
  }

  function findCardContainer(el) {
    if (!el || el.nodeType !== 1) return null;
    const selectors = [
      ".List-item",
      ".HotItem",
      ".SearchResult-Card",
      ".TopstoryItem",
      ".Card",
      "[data-za-extra-module]"
    ];
    for (const sel of selectors) {
      const c = el.closest(sel);
      if (c) return c;
    }
    return el.parentElement;
  }

  function extractCardTitle(cardEl) {
    try {
      const titleAnchor = cardEl.querySelector(TITLE_LINK_SELECTORS);
      if (titleAnchor) {
        return extractTitleText(titleAnchor);
      }
      // 尝试从 meta 标签获取
      const metaTitle = cardEl.querySelector('meta[itemprop="name"]');
      if (metaTitle) {
        return cleanText(metaTitle.getAttribute('content'));
      }
    } catch (_) {}
    return "未知标题";
  }

  // ========== 卡片折叠/展开 ==========
  function collapseCard(cardEl, keyword, decision) {
    if (!cardEl || cardEl.getAttribute(CARD_MARK) === "1") return;
    
    const titleText = extractCardTitle(cardEl);
    const reason = decision.reason === "duplicate" ? "重复内容" : "关键词";
    log("拦截标题:", titleText, `(匹配${reason}:`, keyword || "未知", ")");
    
    // 截取标题前30个字符
    let displayTitle = titleText;
    if (displayTitle.length > 30) {
      displayTitle = displayTitle.substring(0, 30) + "...";
    }
    
    const id = cardEl.getAttribute(CARD_ID_ATTR) || genId();
    cardEl.setAttribute(CARD_ID_ATTR, id);

    const placeholder = document.createElement("div");
    placeholder.className = "zhihu-filter__placeholder";
    if (decision && decision.reason === "duplicate") {
      placeholder.classList.add("zhihu-filter__placeholder--duplicate");
    }
    placeholder.setAttribute("data-target", id);
    placeholder.textContent = `${keyword || "关键词"}（${displayTitle}）`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "展开";
    btn.addEventListener("click", function () {
      expandCard(placeholder);
    });
    placeholder.appendChild(btn);

    cardEl.parentNode && cardEl.parentNode.insertBefore(placeholder, cardEl);
    cardEl.style.display = "none";
    cardEl.setAttribute(CARD_MARK, "1");
  }

  function expandCard(placeholderEl) {
    if (!placeholderEl) return;
    const id = placeholderEl.getAttribute("data-target");
    let cardEl = null;
    if (id) {
      cardEl = document.querySelector(`[${CARD_ID_ATTR}="${id}"]`);
    }
    if (!cardEl) {
      const next = placeholderEl.nextElementSibling;
      if (next) cardEl = next;
    }
    if (cardEl) {
      cardEl.style.display = "";
      cardEl.removeAttribute(CARD_MARK);
    }
    placeholderEl.remove();
  }

  // ========== 匹配和过滤逻辑 ==========
  function isHomePage() {
    try {
      const url = window.location.href;
      return /^https:\/\/www\.zhihu\.com\/?(\?.*)?$/.test(url);
    } catch (_) {
      return true; // 默认允许重复内容检查以保持向后兼容
    }
  }

  function shouldCollapse(titleText) {
    // 检查关键词匹配
    const keywordRes = MATCHER.matchText(titleText || "", currentMatchers);
    if (keywordRes && keywordRes.matched) {
      return { yes: true, keyword: keywordRes.keyword, reason: "keyword" };
    }
    
    // 只有首页才进行重复内容检查
    if (!isHomePage()) {
      return { yes: false };
    }
    
    // 检查标题历史重复
    if (titleHistoryEnabled) {
      const historyRes = MATCHER.matchTitleHistory(titleText || "", currentTitleHistoryMatcher);
      if (historyRes && historyRes.matched) {
        return { yes: true, keyword: historyRes.keyword, reason: "duplicate" };
      }
    }
    
    return { yes: false };
  }

  async function processAnchor(a) {
    if (!a) return;
    const titleText = extractTitleText(a);
    if (!titleText) return;
    
    log("处理标题:", titleText);
    
    // 先检查是否应该折叠（基于现有历史）
    const decision = shouldCollapse(titleText);
    if (decision.yes) {
      const card = findCardContainer(a);
      if (card) {
        log("折叠卡片:", titleText, "原因:", decision.reason);
        collapseCard(card, decision.keyword, decision);
      }
      return;
    }
    
    // 如果不需要折叠，则记录标题到历史（如果启用）
    if (titleHistoryEnabled) {
      log("记录新标题:", titleText);
      await recordTitleIfVisible(titleText);
    }
  }

  function getQuestionBlocks(root) {
    try {
      return root.querySelectorAll('div[itemprop="zhihu:question"]');
    } catch (_) {
      return [];
    }
  }

  function extractMetaTitle(blockEl) {
    try {
      const meta = blockEl.querySelector('meta[itemprop="name"]');
      return cleanText(meta && meta.getAttribute('content'));
    } catch (_) {
      return '';
    }
  }

  // ========== 扫描和观察 ==========
  async function scanRoot(root) {
    const anchors = getTitleAnchors(root);
    for (const a of anchors) {
      try { await processAnchor(a); } catch (e) { /* noop */ }
    }
    const blocks = getQuestionBlocks(root);
    for (const b of blocks) {
      try {
        const titleText = extractMetaTitle(b);
        if (!titleText) continue;
        const decision = shouldCollapse(titleText);
        if (!decision.yes) {
          // 如果不需要折叠，记录到历史
          if (titleHistoryEnabled) {
            await recordTitleIfVisible(titleText);
          }
          continue;
        }
        const card = findCardContainer(b);
        if (!card) continue;
        collapseCard(card, decision.keyword, decision);
      } catch (e) { /* noop */ }
    }
  }

  function initObserver() {
    const observer = new MutationObserver(async (mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node && node.nodeType === 1) {
              await scanRoot(node);
            }
          }
        }
        if (m.type === 'characterData' || m.type === 'attributes') {
          const target = m.target && (m.target.nodeType === 1 ? m.target : m.target.parentElement);
          if (target) {
            const anchors = getTitleAnchors(target);
            for (const a of anchors) {
              try { await processAnchor(a); } catch (_) {}
            }
          }
        }
      }
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'title']
    });
  }

  function rebuildMatchers() {
    currentMatchers = MATCHER.buildMatchers(currentKeywords);
  }

  function rebuildTitleHistoryMatcher() {
    currentTitleHistoryMatcher = MATCHER.buildTitleHistoryMatcher(currentTitleHistory);
  }

  // ========== 标题历史记录 ==========
  async function recordTitleIfVisible(title) {
    if (!title || typeof title !== "string") return;
    
    try {
      const added = await STORAGE.addTitleToHistory(title);
      if (added) {
        log("记录标题到历史:", title);
        // 立即更新匹配器
        currentTitleHistory = await STORAGE.loadTitleHistory();
        rebuildTitleHistoryMatcher();
      }
    } catch (err) {
      log("记录标题失败:", err);
    }
  }

  async function initTitleHistory() {
    try {
      // 清理过期标题
      await STORAGE.cleanExpiredTitles();
      
      // 加载标题历史
      currentTitleHistory = await STORAGE.loadTitleHistory();
      rebuildTitleHistoryMatcher();
      
      log("加载标题历史:", currentTitleHistory.length, "条记录");
    } catch (err) {
      log("初始化标题历史失败:", err);
    }
  }

  function setupTitleRecording() {
    // 监听标题历史变化
    STORAGE.onTitleHistoryChanged((history) => {
      currentTitleHistory = history || [];
      rebuildTitleHistoryMatcher();
      log("标题历史已更新:", currentTitleHistory.length, "条记录");
    });
  }

  // ========== 快速添加关键词 UI ==========
  function sanitizeSelectionText(raw) {
    return cleanText(String(raw || "").replace(/\s+/g, " "));
  }

  function getCurrentSelectionText() {
    try {
      const sel = window.getSelection && window.getSelection();
      if (!sel || sel.isCollapsed) return "";
      if (sel.rangeCount === 0) return "";
      const text = sel.toString();
      return sanitizeSelectionText(text);
    } catch (_) {
      return "";
    }
  }

  function ensureQuickAddButton() {
    if (quickAddBtn) return quickAddBtn;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "zhihu-filter__quick-add";
    btn.textContent = "屏蔽此词";
    // Prevent losing selection when clicking
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
    // Click handler: add keyword then give lightweight feedback
    btn.addEventListener("click", async function () {
      if (!quickAddCurrentText) { hideQuickAddButton(); return; }
      const original = btn.textContent;
      btn.disabled = true;
      try {
        btn.textContent = "添加中...";
        const res = await addKeywordAndRefresh(quickAddCurrentText);
        if (res && res.ok) {
          btn.textContent = res.added ? "已加入" : "已存在";
        } else {
          btn.textContent = "失败";
        }
      } catch (_) {
        btn.textContent = "失败";
      } finally {
        setTimeout(() => { hideQuickAddButton(); btn.disabled = false; btn.textContent = original; }, 800);
      }
    });
    document.documentElement.appendChild(btn);
    quickAddBtn = btn;
    return quickAddBtn;
  }

  function hideQuickAddButton() {
    if (!quickAddBtn) return;
    quickAddBtn.classList.remove("zhihu-filter__quick-add--show");
    quickAddBtn.style.top = "-9999px";
    quickAddBtn.style.left = "-9999px";
    if (quickAddHideTimer) {
      clearTimeout(quickAddHideTimer);
      quickAddHideTimer = null;
    }
  }

  function positionAndShowQuickAddButton(rect) {
    const btn = ensureQuickAddButton();
    if (!rect) { hideQuickAddButton(); return; }
    const margin = 8;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    let left = Math.min(rect.right + margin, vw - 80);
    let top = Math.min(rect.bottom + margin, vh - 40);
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    btn.style.left = left + "px";
    btn.style.top = top + "px";
    btn.classList.add("zhihu-filter__quick-add--show");
    if (quickAddHideTimer) clearTimeout(quickAddHideTimer);
    quickAddHideTimer = setTimeout(() => {
      hideQuickAddButton();
    }, 3000);
  }

  async function addKeywordAndRefresh(keyword) {
    try {
      const k = MATCHER.normalizeKeyword(keyword);
      if (!k) return { ok: false, reason: "empty" };
      if (k.length > 64) return { ok: false, reason: "too_long" };
      const { keywords } = await STORAGE.loadKeywords();
      const list = Array.isArray(keywords) ? keywords.slice() : [];
      const exists = new Set(list.map(s => String(s || "").toLowerCase()));
      const lk = k.toLowerCase();
      if (!exists.has(lk)) {
        list.push(k);
        await STORAGE.saveKeywords(list);
      }
      // update local state immediately
      currentKeywords = list;
      rebuildMatchers();
      scanRoot(document);
      return { ok: true, added: !exists.has(lk) };
    } catch (err) {
      log("addKeyword error", err);
      return { ok: false, reason: "error" };
    }
  }

  async function init() {
    try {
      const { keywords } = await STORAGE.loadKeywords();
      currentKeywords = keywords || [];
      rebuildMatchers();
      log("loaded", currentKeywords.length, "keywords");
      
      // 初始化标题历史功能
      await initTitleHistory();
      setupTitleRecording();
      
      await scanRoot(document);
      initObserver();
      
      STORAGE.onKeywordsChanged(async (kws) => {
        currentKeywords = kws || [];
        rebuildMatchers();
        log("keywords updated:", currentKeywords.length);
        // re-scan newly loaded content only; keep existing collapsed state
        await scanRoot(document);
      });
    } catch (err) {
      log("init error", err);
    }
  }

  function maybeShowQuickAddForSelection() {
    const text = getCurrentSelectionText();
    quickAddCurrentText = text;
    if (!text || text.length < 1 || text.length > 64) {
      hideQuickAddButton();
      return;
    }
    // position based on first range rect
    try {
      const sel = window.getSelection && window.getSelection();
      if (!sel || sel.rangeCount === 0) { hideQuickAddButton(); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) { hideQuickAddButton(); return; }
      positionAndShowQuickAddButton(rect);
    } catch (_) {
      hideQuickAddButton();
    }
  }

  // ========== 初始化 ==========
  function setupEventListeners() {
    document.addEventListener("selectionchange", maybeShowQuickAddForSelection);
    document.addEventListener("mouseup", maybeShowQuickAddForSelection, true);
    document.addEventListener("keyup", maybeShowQuickAddForSelection, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
    setupEventListeners();
  } else {
    init();
    setupEventListeners();
  }
})();
