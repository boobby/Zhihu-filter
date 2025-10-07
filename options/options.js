(function(){
  const STORAGE = window.ZhihuFilterStorage;
  const el = {
    textarea: null,
    save: null,
    exportBtn: null,
    importInput: null,
    status: null,
    // 标题历史相关元素
    titleHistoryEnabled: null,
    clearHistory: null,
    exportHistory: null,
    importHistory: null,
    historyCount: null,
    historyStatus: null,
    historyList: null
  };

  function setStatus(msg) {
    if (el.status) {
      el.status.textContent = msg || "";
      if (msg) {
        setTimeout(() => { if (el.status.textContent === msg) el.status.textContent = ""; }, 2000);
      }
    }
  }

  function parseTextarea() {
    const raw = (el.textarea.value || "").split(/\r?\n/);
    const result = [];
    const seen = new Set();
    for (const line of raw) {
      const s = (line || "").trim();
      if (!s) continue;
      const lc = s.toLowerCase();
      if (seen.has(lc)) continue;
      seen.add(lc);
      result.push(s);
    }
    return result;
  }

  async function onSave() {
    const list = parseTextarea();
    await STORAGE.saveKeywords(list);
    setStatus(`已保存（${list.length} 条）`);
  }

  function onExport() {
    const list = parseTextarea();
    const text = list.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zhihu-keywords.txt";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function() {
      try {
        const text = String(reader.result || "");
        let list;
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) list = parsed.map(x => String(x || ""));
        } catch (_) {}
        if (!list) {
          list = text.split(/\r?\n/);
        }
        el.textarea.value = (list || []).join("\n");
        setStatus(`已导入（${(list || []).length} 条，未保存）`);
      } catch (err) {
        setStatus("导入失败");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  // ========== Title History Management ==========

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function renderTitleHistory(history) {
    if (!el.historyList) return;
    
    if (!Array.isArray(history) || history.length === 0) {
      el.historyList.innerHTML = '<div class="history-empty">暂无浏览历史</div>';
      return;
    }

    const html = history.map((item, index) => {
      const title = item.title || '未知标题';
      const date = formatDate(item.timestamp || Date.now());
      const truncatedTitle = title.length > 50 ? title.substring(0, 50) + '...' : title;
      
      return `
        <div class="history-item" data-index="${index}">
          <div class="history-title" title="${title}">${truncatedTitle}</div>
          <div class="history-date">${date}</div>
          <button class="history-remove" data-id="${item.id || ''}">删除</button>
        </div>
      `;
    }).join('');

    el.historyList.innerHTML = html;
    
    // 绑定删除按钮事件
    el.historyList.querySelectorAll('.history-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          await removeHistoryItem(id);
        }
      });
    });
  }

  async function removeHistoryItem(id) {
    try {
      const history = await STORAGE.loadTitleHistory();
      const filtered = history.filter(item => item.id !== id);
      await STORAGE.saveTitleHistory(filtered);
      await loadAndRenderHistory();
      setStatus('已删除历史记录');
    } catch (err) {
      setStatus('删除失败');
    }
  }

  async function loadAndRenderHistory() {
    try {
      const history = await STORAGE.loadTitleHistory();
      renderTitleHistory(history);
      updateHistoryStats(history);
    } catch (err) {
      console.error('加载历史失败:', err);
      setStatus('加载历史失败');
    }
  }

  function updateHistoryStats(history) {
    if (el.historyCount) {
      el.historyCount.textContent = `历史记录: ${history.length} 条`;
    }
  }

  async function onClearHistory() {
    if (!confirm('确定要清空所有浏览历史吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await STORAGE.saveTitleHistory([]);
      await loadAndRenderHistory();
      setStatus('已清空历史记录');
    } catch (err) {
      setStatus('清空失败');
    }
  }

  function onExportHistory() {
    try {
      const history = el.historyList ? 
        Array.from(el.historyList.querySelectorAll('.history-item')).map(item => {
          const titleEl = item.querySelector('.history-title');
          const dateEl = item.querySelector('.history-date');
          return {
            title: titleEl ? titleEl.getAttribute('title') || titleEl.textContent : '',
            timestamp: new Date(dateEl ? dateEl.textContent : Date.now()).getTime(),
            id: Math.random().toString(36).slice(2, 10)
          };
        }) : [];
      
      const data = JSON.stringify(history, null, 2);
      const blob = new Blob([data], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "zhihu-title-history.json";
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
      setStatus('已导出历史记录');
    } catch (err) {
      setStatus('导出失败');
    }
  }

  function onImportHistoryFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const text = String(reader.result || "");
        const history = JSON.parse(text);
        
        if (!Array.isArray(history)) {
          throw new Error('Invalid format');
        }
        
        // 验证数据格式
        const validHistory = history.filter(item => 
          item && 
          typeof item.title === 'string' && 
          typeof item.timestamp === 'number' &&
          typeof item.id === 'string'
        );
        
        await STORAGE.saveTitleHistory(validHistory);
        await loadAndRenderHistory();
        setStatus(`已导入历史记录（${validHistory.length} 条）`);
      } catch (err) {
        setStatus('导入历史失败');
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function onTitleHistoryEnabledChange() {
    const enabled = el.titleHistoryEnabled.checked;
    // 这里可以添加保存设置到storage的逻辑
    setStatus(enabled ? '已启用标题历史记录' : '已禁用标题历史记录');
  }

  async function init() {
    // 关键词相关元素
    el.textarea = document.getElementById("keywords");
    el.save = document.getElementById("save");
    el.exportBtn = document.getElementById("export");
    el.importInput = document.getElementById("import");
    el.status = document.getElementById("status");

    // 标题历史相关元素
    el.titleHistoryEnabled = document.getElementById("titleHistoryEnabled");
    el.clearHistory = document.getElementById("clearHistory");
    el.exportHistory = document.getElementById("exportHistory");
    el.importHistory = document.getElementById("importHistory");
    el.historyCount = document.getElementById("historyCount");
    el.historyStatus = document.getElementById("historyStatus");
    el.historyList = document.getElementById("historyList");

    // 加载关键词数据
    const { keywords } = await STORAGE.loadKeywords();
    el.textarea.value = (keywords || []).join("\n");

    // 加载标题历史数据
    await loadAndRenderHistory();

    // 绑定关键词相关事件
    el.save.addEventListener("click", onSave);
    el.exportBtn.addEventListener("click", onExport);
    el.importInput.addEventListener("change", onImportFile);

    // 绑定标题历史相关事件
    el.titleHistoryEnabled.addEventListener("change", onTitleHistoryEnabledChange);
    el.clearHistory.addEventListener("click", onClearHistory);
    el.exportHistory.addEventListener("click", onExportHistory);
    el.importHistory.addEventListener("change", onImportHistoryFile);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
