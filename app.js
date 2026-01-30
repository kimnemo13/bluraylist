document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "disc_log_v1";
  const $ = (id) => document.getElementById(id);

  const addForm = $("addForm");
  const titleEl = $("title");
  const mediaEl = $("media");
  const dateEl = $("purchaseDate");
  const memoEl = $("memo");

  const qEl = $("q");
  const mediaFilterEl = $("mediaFilter");
  const sortEl = $("sort");
  const listEl = $("list");
  const emptyEl = $("empty");
  const countTextEl = $("countText");

  const resetBtn = $("resetBtn");
  const clearBtn = $("clearBtn");
  const exportBtn = $("exportBtn");
  const importFile = $("importFile");

  const goAddBtn = $("goAddBtn");
  const statTotalEl = $("statTotal");
  const statBlurayEl = $("statBluray");
  const statDvdEl = $("statDvd");

  // 필수 요소 누락 시 디버깅 쉽게
  const required = {
    addForm, titleEl, mediaEl, dateEl, memoEl,
    qEl, mediaFilterEl, sortEl, listEl, emptyEl, countTextEl,
    resetBtn, clearBtn, exportBtn, importFile,
    goAddBtn, statTotalEl, statBlurayEl, statDvdEl
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error("필수 DOM 요소를 못 찾음:", missing);
    alert("화면 요소를 못 찾아서 앱이 시작되지 않았습니다. 콘솔을 확인해주세요.");
    return;
  }

  let items = load();

  goAddBtn.addEventListener("click", () => {
    addForm.scrollIntoView({ behavior: "smooth", block: "start" });
    titleEl.focus();
  });

  initDefaultDate();
  render();

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = titleEl.value.trim();
    const media = mediaEl.value;
    const purchaseDate = dateEl.value;
    const memo = memoEl.value.trim();

    if (!title || !media || !purchaseDate) return;

    const uid =
      (globalThis.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random();

    const item = {
      id: uid,
      title,
      media,
      purchaseDate,
      memo,
      createdAt: Date.now(),
    };

    items.unshift(item);
    save(items);

    addForm.reset();
    initDefaultDate();
    render();
  });

  resetBtn.addEventListener("click", () => {
    addForm.reset();
    initDefaultDate();
  });

  [qEl, mediaFilterEl, sortEl].forEach((el) => el.addEventListener("input", render));

  clearBtn.addEventListener("click", () => {
    if (!items.length) return;
    const ok = confirm("정말 전체 기록을 삭제할까요? 되돌릴 수 없습니다.");
    if (!ok) return;
    items = [];
    save(items);
    render();
  });

  exportBtn.addEventListener("click", () => {
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "disc_log_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = Array.isArray(parsed.items) ? parsed.items : [];

      if (!imported.length) {
        alert("가져올 데이터가 없습니다.");
        return;
      }

      const cleaned = imported
        .filter((x) => x && x.title && x.media && x.purchaseDate)
        .map((x) => ({
          id: x.id || ((globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random()),
          title: String(x.title).trim(),
          media: String(x.media),
          purchaseDate: String(x.purchaseDate),
          memo: x.memo ? String(x.memo) : "",
          createdAt: x.createdAt ? Number(x.createdAt) : Date.now(),
        }));

      const ok = confirm(`총 ${cleaned.length}개를 가져옵니다. 기존 데이터에 "추가"할까요?`);
      if (!ok) return;

      items = [...cleaned, ...items];
      save(items);
      render();
    } catch (err) {
      console.error(err);
      alert("가져오기 실패: JSON 파일이 올바른지 확인해주세요.");
    } finally {
      importFile.value = "";
    }
  });

  function initDefaultDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    dateEl.value = `${yyyy}-${mm}-${dd}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function save(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function render() {
    const q = qEl.value.trim().toLowerCase();
    const mf = mediaFilterEl.value;
    const sort = sortEl.value;

    let filtered = items.filter((it) => {
      const hitQ =
        !q ||
        it.title.toLowerCase().includes(q) ||
        (it.memo || "").toLowerCase().includes(q);

      const hitM = !mf || it.media === mf;
      return hitQ && hitM;
    });

    filtered = sortItems(filtered, sort);

    // 상단 통계
    statTotalEl.textContent = String(items.length);
    statBlurayEl.textContent = String(items.filter((x) => x.media === "Blu-ray").length);
    statDvdEl.textContent = String(items.filter((x) => x.media === "DVD").length);

    // 목록
    listEl.innerHTML = "";
    countTextEl.textContent = `${filtered.length}개`;
    emptyEl.style.display = filtered.length ? "none" : "block";

    for (const it of filtered) {
      const li = document.createElement("li");
      li.className = "item";

      li.innerHTML = `
        <div class="itemTop">
          <div class="title">${escapeHtml(it.title)}</div>
          <div class="badges">
            <span class="badge">${escapeHtml(it.media)}</span>
            <span class="badge">구매: ${escapeHtml(it.purchaseDate)}</span>
          </div>
        </div>
        ${it.memo ? `<p class="memo">${escapeHtml(it.memo)}</p>` : ""}
        <div class="itemBtns">
          <button class="ghost" data-act="edit" data-id="${it.id}">수정</button>
          <button class="danger ghost" data-act="del" data-id="${it.id}">삭제</button>
        </div>
      `;

      listEl.appendChild(li);
    }

    listEl.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        if (act === "del") onDelete(id);
        if (act === "edit") onEdit(id);
      });
    });
  }

  function sortItems(arr, sort) {
    const copy = [...arr];
    switch (sort) {
      case "dateAsc":
        copy.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
        break;
      case "dateDesc":
        copy.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
        break;
      case "titleAsc":
        copy.sort((a, b) => a.title.localeCompare(b.title, "ko"));
        break;
      case "titleDesc":
        copy.sort((a, b) => b.title.localeCompare(a.title, "ko"));
        break;
    }
    return copy;
  }

  function onDelete(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const ok = confirm(`삭제할까요?\n\n${it.title}`);
    if (!ok) return;
    items = items.filter((x) => x.id !== id);
    save(items);
    render();
  }

  function onEdit(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;

    const newTitle = prompt("영화 제목", it.title);
    if (newTitle === null) return;

    const newMedia = prompt("매체 (Blu-ray / 4K UHD / DVD / Steelbook / Other)", it.media);
    if (newMedia === null) return;

    const newDate = prompt("구매일 (YYYY-MM-DD)", it.purchaseDate);
    if (newDate === null) return;

    const newMemo = prompt("메모", it.memo || "");
    if (newMemo === null) return;

    it.title = newTitle.trim() || it.title;
    it.media = newMedia.trim() || it.media;
    it.purchaseDate = newDate.trim() || it.purchaseDate;
    it.memo = newMemo.trim();

    save(items);
    render();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }
});
