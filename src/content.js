(function () {
  const LOG_PREFIX = "[ZhihuFilter]";
  const STORAGE = window.ZhihuFilterStorage;
  const MATCHER = window.ZhihuFilterMatcher;

  const CARD_MARK = "data-zhihu-filter-collapsed";
  const CARD_ID_ATTR = "data-zhihu-filter-id";

  let currentKeywords = [];
  let currentMatchers = MATCHER.buildMatchers(currentKeywords);

  function log(...args) {
    try { console.log(LOG_PREFIX, ...args); } catch (_) {}
  }

  function genId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function getTitleAnchors(root) {
    try {
      // Extend selectors to cover more layouts (feed/search/hotlist/etc.)
      return root.querySelectorAll([
        'a[href^="/question/"]',
        'a[href*="/question/"]',
        'a.QuestionItem-title',
        'a[data-za-detail-view-element_name="Title"]',
        'h2 a[href^="/question/"]',
        'h3 a[href^="/question/"]'
      ].join(','));
    } catch (_) {
      return [];
    }
  }

  function extractTitleText(anchor) {
    try {
      const raw = (anchor.getAttribute('title')
        || anchor.getAttribute('aria-label')
        || anchor.textContent
        || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
      return raw.trim();
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

  function collapseCard(cardEl, keyword) {
    if (!cardEl || cardEl.getAttribute(CARD_MARK) === "1") return;
    
    // 获取被拦截的标题文本用于日志记录
    let titleText = "";
    try {
      const titleAnchor = cardEl.querySelector('a[href^="/question/"], a[href*="/question/"], a.QuestionItem-title, a[data-za-detail-view-element_name="Title"], h2 a[href^="/question/"], h3 a[href^="/question/"]');
      if (titleAnchor) {
        titleText = extractTitleText(titleAnchor);
      }
      // 如果没找到链接标题，尝试从meta标签获取
      if (!titleText) {
        const metaTitle = cardEl.querySelector('meta[itemprop="name"]');
        if (metaTitle) {
          titleText = extractMetaTitle(cardEl);
        }
      }
    } catch (e) {
      titleText = "未知标题";
    }
    
    // 记录拦截日志
    log("拦截标题:", titleText || "未知标题", "(匹配关键词:", keyword || "未知关键词", ")");
    
    // 截取标题前20个字符
    let truncatedTitle = titleText || "未知标题";
    if (truncatedTitle.length > 20) {
      truncatedTitle = truncatedTitle.substring(0, 20) + "...";
    }
    
    const id = cardEl.getAttribute(CARD_ID_ATTR) || genId();
    cardEl.setAttribute(CARD_ID_ATTR, id);

    const placeholder = document.createElement("div");
    placeholder.className = "zhihu-filter__placeholder";
    placeholder.setAttribute("data-target", id);
    placeholder.textContent = `${keyword || "关键词"}（${truncatedTitle}）`;

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

  function shouldCollapse(titleText) {
    const res = MATCHER.matchText(titleText || "", currentMatchers);
    return res && res.matched ? { yes: true, keyword: res.keyword } : { yes: false };
  }

  function processAnchor(a) {
    if (!a) return;
    const titleText = extractTitleText(a);
    if (!titleText) return;
    const decision = shouldCollapse(titleText);
    if (!decision.yes) return;
    const card = findCardContainer(a);
    if (!card) return;
    collapseCard(card, decision.keyword);
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
      const content = meta && meta.getAttribute('content');
      return (content || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    } catch (_) {
      return '';
    }
  }

  function scanRoot(root) {
    const anchors = getTitleAnchors(root);
    for (const a of anchors) {
      try { processAnchor(a); } catch (e) { /* noop */ }
    }
    const blocks = getQuestionBlocks(root);
    for (const b of blocks) {
      try {
        const titleText = extractMetaTitle(b);
        if (!titleText) continue;
        const decision = shouldCollapse(titleText);
        if (!decision.yes) continue;
        const card = findCardContainer(b);
        if (!card) continue;
        collapseCard(card, decision.keyword);
      } catch (e) { /* noop */ }
    }
  }

  function initObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node && node.nodeType === 1) {
              scanRoot(node);
            }
          }
        }
        if (m.type === 'characterData' || m.type === 'attributes') {
          const target = m.target && (m.target.nodeType === 1 ? m.target : m.target.parentElement);
          if (target) {
            const anchors = getTitleAnchors(target);
            for (const a of anchors) {
              try { processAnchor(a); } catch (_) {}
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

  async function init() {
    try {
      const { keywords } = await STORAGE.loadKeywords();
      currentKeywords = keywords || [];
      rebuildMatchers();
      log("loaded", currentKeywords.length, "keywords");
      scanRoot(document);
      initObserver();
      STORAGE.onKeywordsChanged((kws) => {
        currentKeywords = kws || [];
        rebuildMatchers();
        log("keywords updated:", currentKeywords.length);
        // re-scan newly loaded content only; keep existing collapsed state
        scanRoot(document);
      });
    } catch (err) {
      log("init error", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
