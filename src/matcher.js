function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasCJK(s) {
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/.test(s);
}

function normalizeKeyword(input) {
  return (input || "").trim();
}

function buildMatchers(keywords) {
  const latin = [];
  const cjk = [];
  for (const kw of keywords || []) {
    const k = normalizeKeyword(kw);
    if (!k) continue;
    if (hasCJK(k)) cjk.push(k);
    else latin.push(k);
  }
  const latinBatches = [];
  const BATCH = 50;
  for (let i = 0; i < latin.length; i += BATCH) {
    const slice = latin.slice(i, i + BATCH).map(k => escapeRegex(k));
    if (slice.length) {
      const source = "\\b(?:" + slice.join("|") + ")\\b";
      latinBatches.push(new RegExp(source, "i"));
    }
  }
  const cjkLower = cjk.map(k => k.toLowerCase());
  return { latinBatches, cjkLower };
}

function matchText(text, matchers) {
  if (!text) return { matched: false };
  const t = String(text);
  const tl = t.toLowerCase();
  for (const re of matchers.latinBatches || []) {
    if (re.test(t)) {
      // find exact keyword for logging
      // fallback: re-check each latin keyword individually
      const source = re.source.substring(4, re.source.length - 2); // inside (?: ... )
      const parts = source.split("|");
      for (const p of parts) {
        const r = new RegExp("\\b" + p + "\\b", "i");
        if (r.test(t)) return { matched: true, keyword: p.replace(/\\\\/g, "") };
      }
      return { matched: true };
    }
  }
  for (const phrase of matchers.cjkLower || []) {
    if (tl.indexOf(phrase.toLowerCase()) !== -1) {
      return { matched: true, keyword: phrase };
    }
  }
  return { matched: false };
}

window.ZhihuFilterMatcher = {
  buildMatchers,
  matchText,
  normalizeKeyword
};
