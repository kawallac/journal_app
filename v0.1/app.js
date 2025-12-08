document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "journalEntries_v1";

  let entries = [];
  let currentEntryId = null;
  let lastSavedAt = null;

  const editorInnerEl = document.getElementById("editor-inner");
  const newEntryBtn = document.getElementById("new-entry-btn");

  // ----- Storage helpers -----
  function loadEntriesFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        entries = [];
        return;
      }
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) entries = [];
    } catch (e) {
      console.error("Failed to load entries:", e);
      entries = [];
    }
  }

  function saveEntriesToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  // ----- Utility -----
  function formatDateForInput(date) {
    return date.toISOString().slice(0, 10);
  }

  function generateId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function updateStatus(text) {
    const statusEl = document.getElementById("status-text");
    if (statusEl) statusEl.textContent = text;
  }

  // ----- Render editor -----
  function renderEditor(entry) {
    editorInnerEl.innerHTML = `
      <div class="editor-row">
        <div>
          <label for="entry-date">Date</label>
          <input type="date" id="entry-date" value="${entry.date}">
        </div>

        <div style="flex:1;">
          <label for="entry-title">Title</label>
          <input type="text" id="entry-title" placeholder="Title" value="${entry.title}">
        </div>
      </div>

      <div style="display:flex; flex-direction:column; flex:1;">
        <label for="entry-body">Entry</label>
        <textarea id="entry-body" placeholder="Start writing...">${entry.body}</textarea>
      </div>

      <div class="editor-actions">
        <div class="editor-actions-left">
          <button class="primary" id="save-btn">Save</button>
          <button class="danger" id="delete-btn" ${currentEntryId ? "" : "disabled"}>Delete</button>
        </div>

        <div class="editor-actions-right">
          <div class="status-text" id="status-text">
            ${currentEntryId
              ? (lastSavedAt
                  ? `Last saved at ${lastSavedAt.toLocaleTimeString()}`
                  : "Loaded existing entry")
              : "New entry (not yet saved)"}
          </div>
        </div>
      </div>
    `;

    document.getElementById("save-btn").addEventListener("click", saveCurrentEntry);
    const deleteBtn = document.getElementById("delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", deleteCurrentEntry);
    }
  }

  // ----- Entry operations -----
  function newEntry() {
    currentEntryId = null;
    lastSavedAt = null;
    const fresh = {
      id: null,
      date: formatDateForInput(new Date()),
      title: "",
      body: ""
    };
    renderEditor(fresh);
    updateStatus("New entry (not yet saved)");
  }

  function saveCurrentEntry() {
    const dateInput  = document.getElementById("entry-date");
    const titleInput = document.getElementById("entry-title");
    const bodyInput  = document.getElementById("entry-body");
    if (!dateInput || !titleInput || !bodyInput) return;

    const dateValue  = dateInput.value || formatDateForInput(new Date());
    const titleValue = titleInput.value.trim();
    const bodyValue  = bodyInput.value;

    const now = new Date();
    const nowISO = now.toISOString();

    if (currentEntryId) {
      const idx = entries.findIndex(e => e.id === currentEntryId);
      if (idx !== -1) {
        entries[idx] = {
          ...entries[idx],
          date: dateValue,
          title: titleValue,
          body: bodyValue,
          updatedAt: nowISO
        };
      }
    } else {
      currentEntryId = generateId();
      const newEntryObj = {
        id: currentEntryId,
        date: dateValue,
        title: titleValue,
        body: bodyValue,
        createdAt: nowISO,
        updatedAt: nowISO
      };
      entries.push(newEntryObj);
    }

    saveEntriesToStorage();
    lastSavedAt = now;
    updateStatus(`Saved at ${now.toLocaleTimeString()}`);
  }

  function deleteCurrentEntry() {
    if (!currentEntryId) return;
    const confirmDelete = window.confirm("Delete this entry? This cannot be undone.");
    if (!confirmDelete) return;

    entries = entries.filter(e => e.id !== currentEntryId);
    saveEntriesToStorage();
    currentEntryId = null;
    lastSavedAt = null;
    newEntry();
  }

  // ----- Init -----
  function init() {
    loadEntriesFromStorage();

    if (entries.length === 0) {
      newEntry();
    } else {
      const mostRecent = [...entries].sort((a, b) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || "")
      )[0];
      currentEntryId = mostRecent.id;
      lastSavedAt = mostRecent.updatedAt ? new Date(mostRecent.updatedAt) : null;
      renderEditor(mostRecent);
    }

    if (newEntryBtn) {
      newEntryBtn.addEventListener("click", newEntry);
    }
  }

  init();
});
