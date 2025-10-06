(function(){
  const STORAGE = window.ZhihuFilterStorage;
  const el = {
    textarea: null,
    save: null,
    exportBtn: null,
    importInput: null,
    status: null
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

  async function init() {
    el.textarea = document.getElementById("keywords");
    el.save = document.getElementById("save");
    el.exportBtn = document.getElementById("export");
    el.importInput = document.getElementById("import");
    el.status = document.getElementById("status");

    const { keywords } = await STORAGE.loadKeywords();
    el.textarea.value = (keywords || []).join("\n");

    el.save.addEventListener("click", onSave);
    el.exportBtn.addEventListener("click", onExport);
    el.importInput.addEventListener("change", onImportFile);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
