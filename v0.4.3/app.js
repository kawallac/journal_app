/* ============================================
   JOURNAL APP – v0.4.3
   Frontend logic:
     - Local storage adapter
     - Journal entries (image + tags)
     - Search + search results card
     - Calendar + per-day results card
     - Prev/Next navigation
     - Export JSON
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "journalEntries_v1";

  // ============================================
  // Utility Helpers
  // ============================================

  function formatDateForInput(date) {
    return date.toISOString().slice(0, 10);
  }

  function generateId() {
    return (
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function updateStatus(text) {
    const statusEl = document.getElementById("status-text");
    if (statusEl) statusEl.textContent = text;
  }

  // Simple helper to know if search page is visible
  function isSearchVisible() {
    const pageSearch = document.getElementById("page-search");
    return !!pageSearch && pageSearch.style.display !== "none";
  }

  // ============================================
  // Storage Adapter + Migration
  // ============================================

  const StorageAdapter = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.error("Failed to load entries:", err);
        return [];
      }
    },
    save(allEntries) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries));
      } catch (err) {
        console.error("Failed to save entries:", err);
      }
    }
  };

  function migrateEntry(entry) {
    const e = { ...entry };

    if (!e.notebookId) {
      e.notebookId = "default";
    }

    if (!Array.isArray(e.tags)) {
      e.tags = [];
    }

    if (!Array.isArray(e.attachments)) {
      e.attachments = [];
    }

    if (e.imageData && e.attachments.length === 0) {
      e.attachments.push({
        id: generateId(),
        type: "image",
        storage: "inline",
        data: e.imageData
      });
    }

    const nowIso = new Date().toISOString();
    if (!e.createdAt && e.updatedAt) {
      e.createdAt = e.updatedAt;
    } else if (!e.createdAt) {
      e.createdAt = nowIso;
    }
    if (!e.updatedAt && e.createdAt) {
      e.updatedAt = e.createdAt;
    } else if (!e.updatedAt) {
      e.updatedAt = nowIso;
    }

    e.date = e.date || formatDateForInput(new Date());
    e.title = e.title || "";
    e.body = e.body || "";

    return e;
  }

  const journalService = {
    loadAll() {
      return StorageAdapter.load().map(migrateEntry);
    },
    saveAll(allEntries) {
      StorageAdapter.save(allEntries);
    },
    exportAll(allEntries) {
      return JSON.stringify(allEntries, null, 2);
    }
  };

  // ============================================
  // DOM References
  // ============================================

  const newEntryBtn = document.getElementById("new-entry-btn");
  const newTagBtn = document.getElementById("new-tag-btn");
  const saveBtn = document.getElementById("save-btn");
  const deleteBtnTop = document.getElementById("delete-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const exportBtn = document.getElementById("export-btn");
  const journalViewBtn = document.getElementById("journal-view-btn");

  const editorInnerEl = document.getElementById("editor-inner");
  const pageJournal = document.getElementById("page-journal");
  const pageSearch = document.getElementById("page-search");
  const pageTopBar = document.getElementById("page-top-bar");
  const dayResultsEl = document.getElementById("day-results");

  const searchInput = document.getElementById("search-input");
  const searchClearBtn = document.getElementById("search-clear-btn");
  const searchResultsEl = document.getElementById("search-results");

  const calendarMonthLabel = document.getElementById("calendar-month-label");
  const calendarGrid = document.getElementById("calendar-grid");
  const calendarPrevBtn = document.getElementById("calendar-prev-btn");
  const calendarNextBtn = document.getElementById("calendar-next-btn");

  // ============================================
  // In-memory State
  // ============================================

  let entries = [];
  let currentEntryId = null;
  let currentTags = [];

  let calendarCurrentYear = null;
  let calendarCurrentMonth = null;

  let currentDayIso = null;
  let currentDayEntries = [];

  // Tag dialog
  let tagDialogBackdrop = null;
  let tagDialogInput = null;
  let tagDialogColorSwatches = [];
  let tagDialogActiveTagId = null;

  const TAG_COLORS = [
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#d97706",
    "#7c3aed",
    "#0f766e"
  ];

  // ============================================
  // Core Helpers
  // ============================================

  function getChronologicallySortedEntries() {
    const copy = [...entries];
    copy.sort((a, b) => {
      const aDate = a.date || "";
      const bDate = b.date || "";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      const aTime = a.updatedAt || "";
      const bTime = b.updatedAt || "";
      return aTime.localeCompare(bTime);
    });
    return copy;
  }

  function getCurrentEntryObject() {
    if (!currentEntryId) return null;
    return entries.find(e => e.id === currentEntryId) || null;
  }

  function ensureEntryShape(e) {
    const nowIso = new Date().toISOString();
    return {
      id: e.id || generateId(),
      notebookId: e.notebookId || "default",
      date: e.date || formatDateForInput(new Date()),
      title: e.title || "",
      body: e.body || "",
      imageData: e.imageData || null,
      tags: Array.isArray(e.tags) ? e.tags : [],
      attachments: Array.isArray(e.attachments) ? e.attachments : [],
      createdAt: e.createdAt || nowIso,
      updatedAt: e.updatedAt || nowIso
    };
  }

  function updateNavButtons() {
    const sorted = getChronologicallySortedEntries();
    if (!currentEntryId || sorted.length === 0) {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (deleteBtnTop) deleteBtnTop.disabled = !currentEntryId;
      return;
    }
    const idx = sorted.findIndex(e => e.id === currentEntryId);
    const hasPrev = idx > 0;
    const hasNext = idx >= 0 && idx < sorted.length - 1;

    if (prevBtn) prevBtn.disabled = !hasPrev;
    if (nextBtn) nextBtn.disabled = !hasNext;
    if (deleteBtnTop) deleteBtnTop.disabled = false;
  }

  // ============================================
  // View helpers
  // ============================================

  function showJournalView() {
    if (pageSearch) pageSearch.style.display = "none";
    if (pageJournal) pageJournal.style.display = "block";
    if (pageTopBar) pageTopBar.style.display = "flex";
  }

  function showSearchOnlyView() {
    if (pageSearch) pageSearch.style.display = "block";
    if (pageJournal) pageJournal.style.display = "none";
    if (pageTopBar) pageTopBar.style.display = "none";
  }

  function showSearchWithEditorView() {
    if (pageSearch) pageSearch.style.display = "block";
    if (pageJournal) pageJournal.style.display = "block";
    if (pageTopBar) pageTopBar.style.display = "flex";
  }

  // ============================================
  // Editor Rendering
  // ============================================

  function renderEditor(entry) {
    if (!editorInnerEl) return;

    const safe = entry || {
      date: formatDateForInput(new Date()),
      title: "",
      body: "",
      imageData: null,
      tags: []
    };

    currentTags = Array.isArray(safe.tags) ? [...safe.tags] : [];

    editorInnerEl.innerHTML = `
      <div class="editor-row-horizontal">
        <div>
          <div class="field-label">Date</div>
          <input
            id="entry-date"
            type="date"
            class="text-input"
            value="${safe.date || ""}"
          />
        </div>
        <div>
          <div class="field-label">Title</div>
          <input
            id="entry-title"
            type="text"
            class="text-input"
            placeholder="Optional title for this page…"
            value="${safe.title ? safe.title.replace(/"/g, "&quot;") : ""}"
          />
        </div>
      </div>

      <div>
              <div class="image-section">
        <div class="image-upload-row">
          <div>
            <div class="field-label">Journal Page Photo</div>
            <input id="entry-photo" type="file" accept="image/*" />
          </div>
          <div class="image-note">
            Tip: snap a photo of your handwritten page and add tags on top.
          </div>
        </div>

        <div id="image-preview" class="image-preview">
          ${
            safe.imageData
              ? `<img src="${safe.imageData}" alt="Journal page image" />`
              : `<span>No image yet. Upload a photo of your journal page.</span>`
          }
        </div>
      </div>

      <div>
        <div class="field-label">Notes</div>
        <textarea
          id="entry-body"
          class="textarea-input"
          placeholder="Write notes, highlights, or a summary of this journal page…"
        >${safe.body || ""}</textarea>
      </div>

    `;

    wireEditorInputs();
    renderTagsOnImage();
  }

  function wireEditorInputs() {
    const dateInput = document.getElementById("entry-date");
    const titleInput = document.getElementById("entry-title");
    const bodyInput = document.getElementById("entry-body");
    const photoInput = document.getElementById("entry-photo");
    const imagePreview = document.getElementById("image-preview");

    if (dateInput) {
      dateInput.addEventListener("change", () => {
        const entry = getCurrentEntryObject();
        if (!entry) return;
        entry.date = dateInput.value || entry.date;
        entry.updatedAt = new Date().toISOString();
        journalService.saveAll(entries);
        renderCalendar();
        updateStatus("Date updated");
      });
    }

    if (titleInput) {
      titleInput.addEventListener("input", () => {
        const entry = getCurrentEntryObject();
        if (!entry) return;
        entry.title = titleInput.value || "";
        entry.updatedAt = new Date().toISOString();
        journalService.saveAll(entries);
        updateStatus("Title updated");
      });
    }

    if (bodyInput) {
      bodyInput.addEventListener("input", () => {
        const entry = getCurrentEntryObject();
        if (!entry) return;
        entry.body = bodyInput.value || "";
        entry.updatedAt = new Date().toISOString();
        journalService.saveAll(entries);
        updateStatus("Notes updated");
      });
    }

    if (photoInput && imagePreview) {
      photoInput.addEventListener("change", () => {
        if (photoInput.files && photoInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const src = e.target.result;
            imagePreview.innerHTML = `<img src="${src}" alt="Journal page image" />`;

            const entry = getCurrentEntryObject();
            if (!entry) return;
            entry.imageData = src;
            entry.updatedAt = new Date().toISOString();
            journalService.saveAll(entries);
            updateStatus("Image updated");

            renderTagsOnImage();
          };
          reader.readAsDataURL(photoInput.files[0]);
        }
      });
    }
  }

  // ============================================
  // Tags
  // ============================================

  function renderTagsOnImage() {
    const imagePreview = document.getElementById("image-preview");
    if (!imagePreview) return;

    [...imagePreview.querySelectorAll(".tag-pill")].forEach(el => el.remove());

    const entry = getCurrentEntryObject();
    if (!entry || !entry.imageData) return;

    currentTags.forEach(tag => {
      const el = document.createElement("div");
      el.className = "tag-pill";
      el.textContent = tag.text || "Tag";
      el.style.left = `${tag.x || 50}%`;
      el.style.top = `${tag.y || 50}%`;
      el.style.backgroundColor = tag.color || TAG_COLORS[0];
      el.dataset.tagId = tag.id;

      let dragging = false;

      el.addEventListener("mousedown", (evt) => {
        evt.preventDefault();
        dragging = true;

        const rect = imagePreview.getBoundingClientRect();

        function onMove(moveEvt) {
          if (!dragging) return;
          const xPercent = ((moveEvt.clientX - rect.left) / rect.width) * 100;
          const yPercent = ((moveEvt.clientY - rect.top) / rect.height) * 100;
          el.style.left = `${Math.min(100, Math.max(0, xPercent))}%`;
          el.style.top = `${Math.min(100, Math.max(0, yPercent))}%`;
        }

        function onUp(upEvt) {
          dragging = false;
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);

          const rect2 = imagePreview.getBoundingClientRect();
          const xPercent = ((upEvt.clientX - rect2.left) / rect2.width) * 100;
          const yPercent = ((upEvt.clientY - rect2.top) / rect2.height) * 100;

          const tagObj = currentTags.find(t => t.id === tag.id);
          if (tagObj) {
            tagObj.x = Math.min(100, Math.max(0, xPercent));
            tagObj.y = Math.min(100, Math.max(0, yPercent));
          }

          const entry = getCurrentEntryObject();
          if (entry) {
            entry.tags = [...currentTags];
            entry.updatedAt = new Date().toISOString();
            journalService.saveAll(entries);
            updateStatus("Tag moved");
          }
        }

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      el.addEventListener("dblclick", (evt) => {
        evt.stopPropagation();
        openTagDialog(tag.id);
      });

      imagePreview.appendChild(el);
    });
  }

  function setupTagDialog() {
    tagDialogBackdrop = document.createElement("div");
    tagDialogBackdrop.className = "tag-dialog-backdrop";

    const dialog = document.createElement("div");
    dialog.className = "tag-dialog";

    dialog.innerHTML = `
      <div>
        <div class="field-label">Tag text</div>
        <input id="tag-dialog-input" type="text" class="text-input" />
      </div>
      <div>
        <div class="field-label">Color</div>
        <div class="tag-dialog-colors" id="tag-dialog-colors"></div>
      </div>
      <div class="tag-dialog-buttons">
        <button type="button" class="btn-secondary" id="tag-dialog-cancel">Cancel</button>
        <button type="button" class="btn-primary" id="tag-dialog-apply">Apply</button>
      </div>
    `;

    tagDialogBackdrop.appendChild(dialog);
    document.body.appendChild(tagDialogBackdrop);

    tagDialogInput = dialog.querySelector("#tag-dialog-input");
    const colorsContainer = dialog.querySelector("#tag-dialog-colors");
    const applyBtn = dialog.querySelector("#tag-dialog-apply");
    const cancelBtn = dialog.querySelector("#tag-dialog-cancel");

    TAG_COLORS.forEach(color => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "tag-color-swatch";
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;

      swatch.addEventListener("click", () => {
        tagDialogColorSwatches.forEach(s => s.classList.remove("selected"));
        swatch.classList.add("selected");
      });

      colorsContainer.appendChild(swatch);
      tagDialogColorSwatches.push(swatch);
    });

    cancelBtn.addEventListener("click", () => {
      hideTagDialog();
    });

    applyBtn.addEventListener("click", () => {
      applyTagDialogChanges();
    });

    tagDialogBackdrop.addEventListener("click", (evt) => {
      if (evt.target === tagDialogBackdrop) {
        hideTagDialog();
      }
    });
  }

  function openTagDialog(tagId) {
    const tag = currentTags.find(t => t.id === tagId);
    if (!tag || !tagDialogBackdrop) return;

    tagDialogActiveTagId = tagId;
    if (tagDialogInput) tagDialogInput.value = tag.text || "";

    const color = tag.color || TAG_COLORS[0];
    tagDialogColorSwatches.forEach(swatch => {
      if (swatch.dataset.color === color) {
        swatch.classList.add("selected");
      } else {
        swatch.classList.remove("selected");
      }
    });

    tagDialogBackdrop.style.display = "flex";
    if (tagDialogInput) tagDialogInput.focus();
  }

  function hideTagDialog() {
    if (tagDialogBackdrop) {
      tagDialogBackdrop.style.display = "none";
    }
    tagDialogActiveTagId = null;
  }

  function applyTagDialogChanges() {
    if (!tagDialogActiveTagId) return;

    const tag = currentTags.find(t => t.id === tagDialogActiveTagId);
    if (!tag) return;

    if (tagDialogInput) tag.text = tagDialogInput.value || "Tag";

    const selectedSwatch = tagDialogColorSwatches.find(s => s.classList.contains("selected"));
    if (selectedSwatch) {
      tag.color = selectedSwatch.dataset.color || tag.color;
    }

    const entry = getCurrentEntryObject();
    if (entry) {
      entry.tags = [...currentTags];
      entry.updatedAt = new Date().toISOString();
      journalService.saveAll(entries);
      updateStatus("Tag updated");
    }

    renderTagsOnImage();
    hideTagDialog();
  }

  function createNewTagAtCenter() {
    const imagePreview = document.getElementById("image-preview");
    const entry = getCurrentEntryObject();
    if (!imagePreview || !entry || !entry.imageData) {
      updateStatus("Add an image first.");
      return;
    }

    const newTag = {
      id: generateId(),
      text: "Tag",
      x: 50,
      y: 50,
      color: TAG_COLORS[0]
    };

    currentTags.push(newTag);
    entry.tags = [...currentTags];
    entry.updatedAt = new Date().toISOString();
    journalService.saveAll(entries);

    renderTagsOnImage();
    openTagDialog(newTag.id);
  }

  // ============================================
  // CRUD: New / Save / Delete / Navigation
  // ============================================

  function newEntry() {
    const fresh = ensureEntryShape({
      date: formatDateForInput(new Date()),
      title: "",
      body: "",
      imageData: null,
      tags: []
    });

    entries.push(fresh);
    currentEntryId = fresh.id;
    renderEditor(fresh);
    updateNavButtons();
    renderCalendar();
    currentDayIso = null;
    currentDayEntries = [];
    renderDayResults();
    showJournalView();
    updateStatus("New entry created");
  }

  function saveCurrentEntry() {
    const entry = getCurrentEntryObject();
    if (!entry) return;

    const dateInput = document.getElementById("entry-date");
    const titleInput = document.getElementById("entry-title");
    const bodyInput = document.getElementById("entry-body");

    if (dateInput) entry.date = dateInput.value || entry.date;
    if (titleInput) entry.title = titleInput.value || "";
    if (bodyInput) entry.body = bodyInput.value || "";

    entry.tags = [...currentTags];
    entry.updatedAt = new Date().toISOString();

    journalService.saveAll(entries);
    updateNavButtons();
    renderCalendar();
    updateStatus("Entry saved");
  }

  function deleteCurrentEntry() {
    if (!currentEntryId) return;
    const idx = entries.findIndex(e => e.id === currentEntryId);
    if (idx === -1) return;

    entries.splice(idx, 1);
    journalService.saveAll(entries);

    const sorted = getChronologicallySortedEntries();
    if (sorted.length === 0) {
      currentEntryId = null;
      editorInnerEl.innerHTML = "";
      updateNavButtons();
      renderCalendar();
      currentDayIso = null;
      currentDayEntries = [];
      renderDayResults();
      updateStatus("Entry deleted");
      return;
    }

    const newIdx = Math.min(idx, sorted.length - 1);
    currentEntryId = sorted[newIdx].id;
    renderEditor(sorted[newIdx]);
    updateNavButtons();
    renderCalendar();
    updateStatus("Entry deleted");
  }

  function goToEntryAtIndex(idx) {
    const sorted = getChronologicallySortedEntries();
    if (idx < 0 || idx >= sorted.length) return;

    const target = sorted[idx];
    currentEntryId = target.id;
    renderEditor(target);
    updateNavButtons();
    renderCalendar();

    // Sync day-results *only if* search is not visible
    if (!isSearchVisible()) {
      const sameDay = sorted.filter(e => e.date === target.date);
      if (sameDay.length > 1) {
        currentDayIso = target.date;
        currentDayEntries = sameDay;
      } else {
        currentDayIso = null;
        currentDayEntries = [];
      }
      renderDayResults();
    } else {
      currentDayIso = null;
      currentDayEntries = [];
      renderDayResults();
    }
  }

  function goToPreviousEntry() {
    const sorted = getChronologicallySortedEntries();
    if (!currentEntryId) return;
    const idx = sorted.findIndex(e => e.id === currentEntryId);
    if (idx <= 0) return;
    goToEntryAtIndex(idx - 1);
  }

  function goToNextEntry() {
    const sorted = getChronologicallySortedEntries();
    if (!currentEntryId) return;
    const idx = sorted.findIndex(e => e.id === currentEntryId);
    if (idx === -1 || idx >= sorted.length - 1) return;
    goToEntryAtIndex(idx + 1);
  }

  function openEntryById(entryId) {
    const sorted = getChronologicallySortedEntries();
    const idx = sorted.findIndex(e => e.id === entryId);
    if (idx === -1) return;
    showJournalView();
    goToEntryAtIndex(idx);
  }

  function openEntryFromSearch(entryId) {
    const sorted = getChronologicallySortedEntries();
    const idx = sorted.findIndex(e => e.id === entryId);
    if (idx === -1) return;
    showSearchWithEditorView();
    goToEntryAtIndex(idx); // internal logic will suppress day-results if search is visible
  }

  // ============================================
  // Search
  // ============================================

  function entryMatchesQuery(entry, qLower) {
    const fields = [
      entry.title || "",
      entry.body || "",
      ...(Array.isArray(entry.tags)
        ? entry.tags.map(t => t.text || "")
        : [])
    ]
      .join(" ")
      .toLowerCase();

    return fields.includes(qLower);
  }

  function runSearch(query) {
    const q = (query || "").trim();
    const qLower = q.toLowerCase();

    // Search should always clear day-results so it doesn't stack under the card
    currentDayIso = null;
    currentDayEntries = [];
    renderDayResults();

    if (!q) {
      // Empty query -> show helpful message in card
      if (searchResultsEl) {
        searchResultsEl.innerHTML = "";
        const msg = document.createElement("div");
        msg.className = "search-result-snippet";
        msg.textContent = "Type in the search box and press Enter to search.";
        searchResultsEl.appendChild(msg);
      }
      showSearchOnlyView();
      updateStatus("Search cleared");
      return;
    }

    const results = entries.filter(e => entryMatchesQuery(e, qLower));
    results.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    renderSearchResults(results);
    showSearchOnlyView();
    updateStatus(`Found ${results.length} result${results.length === 1 ? "" : "s"}`);
  }

  function renderSearchResults(results) {
    if (!searchResultsEl) return;
    searchResultsEl.innerHTML = "";

    if (!results || results.length === 0) {
      const msg = document.createElement("div");
      msg.className = "search-result-snippet";
      msg.textContent = "No results. Try a different query.";
      searchResultsEl.appendChild(msg);
      return;
    }

    results.forEach(entry => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.dataset.entryId = entry.id;

      const titleEl = document.createElement("div");
      titleEl.className = "search-result-title";
      titleEl.textContent = entry.title || "(Untitled entry)";

      const snippetEl = document.createElement("div");
      snippetEl.className = "search-result-snippet";

      const dateStr = entry.date || "";
      const bodySnippet = (entry.body || "").replace(/\s+/g, " ").slice(0, 120);
      const tagsText = Array.isArray(entry.tags)
        ? entry.tags.map(t => t.text).filter(Boolean).join(", ")
        : "";

      const parts = [];
      if (dateStr) parts.push(dateStr);
      if (bodySnippet) parts.push(bodySnippet + (entry.body && entry.body.length > 120 ? "…" : ""));
      if (tagsText) parts.push(`Tags: ${tagsText}`);

      snippetEl.textContent = parts.join("  •  ");

      item.appendChild(titleEl);
      item.appendChild(snippetEl);

      item.addEventListener("click", () => {
        openEntryFromSearch(entry.id);
      });

      searchResultsEl.appendChild(item);
    });
  }

  // ============================================
  // Calendar + Day Results
  // ============================================

  function initCalendarState() {
    const now = new Date();
    calendarCurrentYear = now.getFullYear();
    calendarCurrentMonth = now.getMonth();
  }

  function renderCalendar() {
    if (!calendarGrid || !calendarMonthLabel) return;

    if (calendarCurrentYear === null || calendarCurrentMonth === null) {
      initCalendarState();
    }

    const year = calendarCurrentYear;
    const month = calendarCurrentMonth;

    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;
    calendarGrid.innerHTML = "";

    const weekdayLabels = ["Su","Mo","Tu","We","Th","Fr","Sa"];
    weekdayLabels.forEach(label => {
      const wd = document.createElement("div");
      wd.className = "calendar-weekday";
      wd.textContent = label;
      calendarGrid.appendChild(wd);
    });

    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      calendarGrid.appendChild(empty);
    }

    const todayIso = formatDateForInput(new Date());
    const sorted = getChronologicallySortedEntries();
    const currentEntry = getCurrentEntryObject();
    const selectedDateIso = currentEntry?.date || null;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const iso = formatDateForInput(dateObj);

      const hasEntry = sorted.some(e => e.date === iso);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-day";
      btn.textContent = String(day);

      if (hasEntry) {
        const dot = document.createElement("div");
        dot.className = "entry-dot";
        btn.appendChild(dot);
      }

      if (iso === todayIso) {
        btn.classList.add("today");
      }

      if (selectedDateIso && iso === selectedDateIso) {
        btn.classList.add("selected");
      }

      btn.addEventListener("click", () => {
        handleCalendarDayClick(iso);
      });

      calendarGrid.appendChild(btn);
    }
  }

  function changeCalendarMonth(delta) {
    if (calendarCurrentYear === null || calendarCurrentMonth === null) {
      initCalendarState();
    }
    calendarCurrentMonth += delta;
    if (calendarCurrentMonth < 0) {
      calendarCurrentMonth = 11;
      calendarCurrentYear -= 1;
    } else if (calendarCurrentMonth > 11) {
      calendarCurrentMonth = 0;
      calendarCurrentYear += 1;
    }
    renderCalendar();
  }

  function renderDayResults() {
    if (!dayResultsEl) return;

    dayResultsEl.innerHTML = "";
    if (!currentDayIso || !currentDayEntries || currentDayEntries.length === 0) {
      dayResultsEl.style.display = "none";
      return;
    }

    dayResultsEl.style.display = "block";

    const card = document.createElement("div");
    card.className = "day-results-card";

    const titleEl = document.createElement("div");
    titleEl.className = "day-results-title";
    titleEl.textContent = `Entries on ${currentDayIso}`;

    const listEl = document.createElement("div");
    listEl.className = "day-results-list";

    currentDayEntries.forEach(entry => {
      const item = document.createElement("div");
      item.className = "day-result-item";
      item.dataset.entryId = entry.id;

      const title = document.createElement("div");
      title.className = "day-result-title";
      title.textContent = entry.title || "(Untitled entry)";

      const meta = document.createElement("div");
      meta.className = "day-result-meta";

      const tagsText = Array.isArray(entry.tags)
        ? entry.tags.map(t => t.text).filter(Boolean).join(", ")
        : "";

      meta.textContent = [
        entry.date || "",
        tagsText ? `Tags: ${tagsText}` : ""
      ].filter(Boolean).join("  •  ");

      item.appendChild(title);
      if (meta.textContent) item.appendChild(meta);

      item.addEventListener("click", () => {
        openEntryById(entry.id);
      });

      listEl.appendChild(item);
    });

    card.appendChild(titleEl);
    card.appendChild(listEl);
    dayResultsEl.appendChild(card);
  }

  function handleCalendarDayClick(isoDate) {
    const sorted = getChronologicallySortedEntries();
    const sameDayEntries = sorted.filter(e => e.date === isoDate);

    // Calendar selection should exit search mode
    showJournalView();

    if (sameDayEntries.length === 0) {
      currentDayIso = null;
      currentDayEntries = [];
      renderDayResults();
      return;
    }

    currentDayIso = isoDate;
    currentDayEntries = sameDayEntries;
    renderDayResults();

    openEntryById(sameDayEntries[0].id);
  }

  // ============================================
  // Export
  // ============================================

  function exportEntries() {
    const json = journalService.exportAll(entries);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "journal_entries.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    updateStatus("Exported entries as JSON");
  }

  // ============================================
  // Init
  // ============================================

  function init() {
    entries = journalService.loadAll();
    setupTagDialog();

    if (entries.length === 0) {
      newEntry();
    } else {
      const sorted = getChronologicallySortedEntries();
      const mostRecent = sorted[sorted.length - 1];
      currentEntryId = mostRecent.id;
      renderEditor(mostRecent);
      updateNavButtons();
      renderCalendar();
    }

    renderDayResults();

    // Button wiring
    if (newEntryBtn) {
      newEntryBtn.addEventListener("click", () => {
        newEntry();
      });
    }

    if (newTagBtn) {
      newTagBtn.addEventListener("click", () => {
        createNewTagAtCenter();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", saveCurrentEntry);
    }

    if (deleteBtnTop) {
      deleteBtnTop.addEventListener("click", deleteCurrentEntry);
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", goToPreviousEntry);
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", goToNextEntry);
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", exportEntries);
    }

    if (journalViewBtn) {
      journalViewBtn.addEventListener("click", () => {
        showJournalView();
      });
    }

    // Search events
    if (searchInput) {
      searchInput.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          const value = searchInput.value || "";
          // auto-clear field after executing
          searchInput.value = "";
          runSearch(value);
        }
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        runSearch("");
      });
    }

    // Calendar nav
    if (calendarPrevBtn) {
      calendarPrevBtn.addEventListener("click", () => changeCalendarMonth(-1));
    }
    if (calendarNextBtn) {
      calendarNextBtn.addEventListener("click", () => changeCalendarMonth(1));
    }
  }

  init();
});
