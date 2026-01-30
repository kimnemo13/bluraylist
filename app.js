const STORAGE_KEY = "bluraylist.entries";
const STORAGE_VERSION = 1;

const entryForm = document.getElementById("entryForm");
const entryList = document.getElementById("entryList");
const entryTemplate = document.getElementById("entryTemplate");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const sortType = document.getElementById("sortType");
const exportButton = document.getElementById("exportButton");
const importInput = document.getElementById("importInput");
const emptyState = document.getElementById("emptyState");
const totalCount = document.getElementById("totalCount");
const blurayCount = document.getElementById("blurayCount");
const dvdCount = document.getElementById("dvdCount");
const resultCount = document.getElementById("resultCount");
const ownershipStatus = document.getElementById("ownershipStatus");

let entries = loadEntries();

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt ?? entry.purchaseDate ?? new Date().toISOString(),
    }));
  } catch (error) {
    console.warn("Failed to parse entries", error);
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  return `${year}.${month}.${day}`;
}

function normalizeText(value) {
  return value.trim().toLowerCase();
}

function updateStats() {
  totalCount.textContent = entries.length;
  blurayCount.textContent = entries.filter((entry) => entry.mediaType === "Blu-ray").length;
  dvdCount.textContent = entries.filter((entry) => entry.mediaType === "DVD").length;
}

function renderEntries() {
  const query = normalizeText(searchInput.value);
  const typeFilter = filterType.value;
  const sortOption = sortType.value;

  const filtered = entries.filter((entry) => {
    const matchesType = typeFilter === "all" || entry.mediaType === typeFilter;
    const text = normalizeText(`${entry.title} ${entry.memo}`);
    const matchesQuery = !query || text.includes(query);
    return matchesType && matchesQuery;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOption === "title") {
      return a.title.localeCompare(b.title, "ko");
    }
    if (sortOption === "oldest") {
      return getSortDate(a) - getSortDate(b);
    }
    return getSortDate(b) - getSortDate(a);
  });

  entryList.innerHTML = "";
  emptyState.style.display = sorted.length === 0 ? "block" : "none";
  resultCount.textContent = sorted.length;

  sorted.forEach((entry) => {
    const node = entryTemplate.content.cloneNode(true);
    node.querySelector(".entry-title").textContent = entry.title;
    node.querySelector(".entry-meta").textContent = `${formatDate(entry.purchaseDate)} · ${entry.memo ? "메모 있음" : "메모 없음"}`;
    node.querySelector(".badge").textContent = entry.mediaType;
    node.querySelector(".entry-memo").textContent = entry.memo || "메모가 없습니다.";

    node.querySelectorAll("button").forEach((button) => {
      button.dataset.id = entry.id;
    });

    entryList.appendChild(node);
  });

  updateStats();
  updateOwnershipStatus(query);
}

function resetForm() {
  entryForm.reset();
  entryForm.querySelector("#title").focus();
}

function updateOwnershipStatus(query) {
  if (!query) {
    ownershipStatus.textContent = "검색어를 입력해주세요.";
    return;
  }

  const match = entries.find((entry) => normalizeText(entry.title) === query);
  ownershipStatus.textContent = match ? `"${match.title}" 구매 기록 있음` : "구매 기록 없음";
}

function getSortDate(entry) {
  const value = entry.purchaseDate || entry.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function exportEntries() {
  const payload = {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bluraylist-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importEntries(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(imported)) {
        throw new Error("Invalid import format");
      }
      entries = imported.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt ?? entry.purchaseDate ?? new Date().toISOString(),
      }));
      saveEntries();
      renderEntries();
    } catch (error) {
      alert("불러오기 파일 형식이 올바르지 않습니다.");
      console.warn(error);
    }
  };
  reader.readAsText(file);
}

function addEntry(formData) {
  const newEntry = {
    id: crypto.randomUUID(),
    title: formData.get("title").trim(),
    mediaType: formData.get("mediaType"),
    purchaseDate: formData.get("purchaseDate"),
    memo: formData.get("memo").trim(),
    createdAt: new Date().toISOString(),
  };

  entries = [newEntry, ...entries];
  saveEntries();
  renderEntries();
  resetForm();
}

function updateEntry(id, formData) {
  entries = entries.map((entry) =>
    entry.id === id
      ? {
          ...entry,
          title: formData.get("title").trim(),
          mediaType: formData.get("mediaType"),
          purchaseDate: formData.get("purchaseDate"),
          memo: formData.get("memo").trim(),
          updatedAt: new Date().toISOString(),
        }
      : entry,
  );
  saveEntries();
  renderEntries();
  resetForm();
}

function populateForm(entry) {
  entryForm.title.value = entry.title;
  entryForm.mediaType.value = entry.mediaType;
  entryForm.purchaseDate.value = entry.purchaseDate;
  entryForm.memo.value = entry.memo;
  entryForm.dataset.editing = entry.id;
  entryForm.querySelector("button.primary").textContent = "기록 수정";
}

function clearEditingState() {
  delete entryForm.dataset.editing;
  entryForm.querySelector("button.primary").textContent = "기록 저장";
}

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(entryForm);
  const editingId = entryForm.dataset.editing;

  if (editingId) {
    updateEntry(editingId, formData);
    clearEditingState();
    return;
  }

  addEntry(formData);
});

entryForm.addEventListener("reset", () => {
  clearEditingState();
});

entryList.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) return;

  if (action === "delete") {
    entries = entries.filter((entry) => entry.id !== id);
    saveEntries();
    renderEntries();
    return;
  }

  if (action === "edit") {
    const entry = entries.find((item) => item.id === id);
    if (entry) {
      populateForm(entry);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
});

searchInput.addEventListener("input", renderEntries);
filterType.addEventListener("change", renderEntries);
sortType.addEventListener("change", renderEntries);
exportButton.addEventListener("click", exportEntries);
importInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    importEntries(file);
  }
  event.target.value = "";
});

renderEntries();
