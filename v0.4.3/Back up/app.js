/* ============================================
   JOURNAL APP – v0.4.3
   Date: 2025-12-09
   Description:
     - Pluggable storage adapter (localStorage)
     - journalService wrapper
     - Data model migration:
         notebookId + attachments[] + timestamps
     - Journal entry editor with image & notes
     - Draggable, editable tag pins on image
     - Search over title, body, and tags
     - Search results card
     - Chronological Prev/Next navigation
     - Monthly calendar in sidebar
     - Selected-day highlight in calendar
     - Per-day results card for multi-entry days
     - Export JSON button
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "journalEntries_v1";

  // ============================================
  // Utility Helpers (IDs, dates, status)
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

  // ============================================
  // Pluggable Storage Adapter (localStorage)
  // ============================================

  const StorageAdapter = {
    loadEntries() {
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
    saveEntries(allEntries) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries));
      } catch (err) {
        console.error("Failed to save entries:", err);
      }
    }
  };

  // ============================================
  // Data Model Migration / Normalization
  // ============================================

  function migrateEntry(entry) {
    const e = { ...entry };

    // Notebook
    if (!e.notebookId) {
      e.notebookId = "default";
    }

    // Attachments
    if (!Array.isArray(e.attachments)) {
      e.attachments = [];
    }

    // Legacy imageData → attachments
    if (e.imageData && e.attachments.length === 0) {
      e.attachments.push({
        id: generateId(),
        type: "image",
        storage: "inline",
        data: e.imageData
      });
    }

    // Timestamps
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

    return e;
  }

  const journalService = {
    loadAll() {
      const raw = StorageAdapter.loadEntries();
      return raw.map(migrateEntry);
    },
    saveAll(allEntries) {
      StorageAdapter.saveEntries(allEntries);
    },
    exportAll(allEntries) {
      return JSON.stringify(allEntries, null, 2);
    }
  };

  // ============================================
  // App State
  // ============================================

  let entries = [];
  let currentEntryId = null;
  let lastSavedAt = null;
  let currentTags = [];

  // Tag drag state
  let draggingTagId = null;
  let draggingNewTag = false;
  let ghostTagEl = null;

  // Tag dialog state
  let tagDialogOverlay = null;
  let tagDialogEl = null;
  let tagDialogTextInput = null;
  let tagDialogApplyBtn = null;
  let tagDialogCancelBtn = null;
  let tagDialogSwatches = [];
  let tagDialogSelectedColor = null;
  let tagDialogCurrentTag = null;
  let tagDialogCurrentTagEl = null;

  // Views
  let currentView = "journal";
  let currentSearchResults = [];

  // Calendar state
  let calendarCurrentYear = null;
  let calendarCurrentMonth = null; // 0-11

  // Per-day results card state (for selected calendar day)
  let currentDayIso = null;
  let currentDayEntries = [];

  // DOM references
  const editorInnerEl = document.getElementById("editor-inner");
  const dayResultsEl  = document.getElementById("day-results");

  const newEntryBtn   = document.getElementById("new-entry-btn");
  const newTagBtn     = document.getElementById("new-tag-btn");
  const saveBtn       = document.getElementById("save-btn");
  const deleteBtnTop  = document.getElementById("delete-btn");
  const prevBtn       = document.getElementById("prev-btn");
  const nextBtn       = document.getElementById("next-btn");

  const pageTopBar    = document.getElementById("page-top-bar");
  const pageJournal   = document.getElementById("page-journal");
  const pageSearch    = document.getElementById("page-search");
  const searchResultsEl = document.getElementById("search-results");

  const searchInput     = document.getElementById("search-input");
  const searchClearBtn  = document.getElementById("search-clear-btn");
  const journalViewBtn  = document.getElementById("journal-view-btn");
  const exportBtn       = document.getElementById("export-btn");

  const calendarMonthLabel = document.getElementById("calendar-month-label");
  const calendarGrid       = document.getElementById("calendar-grid");
  const calendarPrevBtn    = document.getElementById("calendar-prev-btn");
  const calendarNextBtn    = document.getElementById("calendar-next-btn");

  // Tag color palette
  const TAG_COLORS = [
    "#2563eb", // blue
    "#16a34a", // green
    "#eab308", // yellow
    "#db2777", // pink
    "#f97316", // orange
    "#0ea5e9"  // light blue
  ];
  const DEFAULT_TAG_COLOR = TAG_COLORS[0];

  // ============================================
  // Helpers: sorting + current entry
  // ============================================

  function getCurrentEntryObject() {
    if (!currentEntryId) return null;
    return entries.find(e => e.id === currentEntryId) || null;
  }

  function getChronologicallySortedEntries() {
    return [...entries].sort((a, b) => {
      const aDate = a.date || "";
      const bDate = b.date || "";

      if (aDate < bDate) return -1;
      if (aDate > bDate) return 1;

      const aCreated = a.createdAt || a.updatedAt || "";
      const bCreated = b.createdAt || b.updatedAt || "";

      if (aCreated < bCreated) return -1;
      if (aCreated > bCreated) return 1;

      return 0;
    });
  }

  function getCurrentEntryIndex() {
    if (!currentEntryId) return -1;
    const sorted = getChronologicallySortedEntries();
    return sorted.findIndex(e => e.id === currentEntryId);
  }

  function updateNavAndActionsUI() {
    const idx = getCurrentEntryIndex();
    const sorted = getChronologicallySortedEntries();
    const hasEntries = sorted.length > 0 && idx !== -1;

    if (deleteBtnTop) {
      deleteBtnTop.disabled = !hasEntries;
    }

    if (prevBtn && nextBtn) {
      if (!hasEntries) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
      } else {
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx >= sorted.length - 1;
      }
    }
  }

  // ============================================
  // View Switching: Journal vs Search
  // ============================================

  function showJournalView() {
    currentView = "journal";
    pageJournal.style.display = "block";
    pageSearch.style.display = "none";
    pageTopBar.style.display = "flex";
  }

  function showSearchView() {
    currentView = "search";
    pageJournal.style.display = "none";
    pageSearch.style.display = "block";
    pageTopBar.style.display = "none";
  }

  // ============================================
  // Tag Dialog
  // ============================================

  function setupTagDialog() {
    tagDialogOverlay = document.createElement("div");
    tagDialogOverlay.className = "tag-dialog-overlay";

    tagDialogEl = document.createElement("div");
    tagDialogEl.className = "tag-dialog";

    const titleEl = document.createElement("div");
    titleEl.className = "tag-dialog-title";
    titleEl.textContent = "Edit Tag";

    const textField = document.createElement("div");
    textField.className = "tag-dialog-field";

    const textLabel = document.createElement("label");
    textLabel.textContent = "Label";
    textLabel.setAttribute("for", "tag-dialog-text");

    tagDialogTextInput = document.createElement("input");
    tagDialogTextInput.type = "text";
    tagDialogTextInput.id = "tag-dialog-text";
    tagDialogTextInput.placeholder = "Tag text";

    textField.appendChild(textLabel);
    textField.appendChild(tagDialogTextInput);

    const colorSection = document.createElement("div");
    colorSection.className = "tag-dialog-colors";

    const colorLabel = document.createElement("div");
    colorLabel.className = "tag-dialog-colors-label";
    colorLabel.textContent = "Color";

    const swatchesContainer = document.createElement("div");
    swatchesContainer.className = "tag-dialog-swatches";

    TAG_COLORS.forEach(color => {
      const swatch = document.createElement("div");
      swatch.className = "tag-color-swatch";
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;
      swatch.addEventListener("click", () => {
        selectDialogColor(color);
      });
      swatchesContainer.appendChild(swatch);
      tagDialogSwatches.push(swatch);
    });

    colorSection.appendChild(colorLabel);
    colorSection.appendChild(swatchesContainer);

    const actions = document.createElement("div");
    actions.className = "tag-dialog-actions";

    tagDialogCancelBtn = document.createElement("button");
    tagDialogCancelBtn.type = "button";
    tagDialogCancelBtn.className = "tag-dialog-btn";
    tagDialogCancelBtn.textContent = "Cancel";
    tagDialogCancelBtn.addEventListener("click", () => {
      closeTagDialog(false);
    });

    tagDialogApplyBtn = document.createElement("button");
    tagDialogApplyBtn.type = "button";
    tagDialogApplyBtn.className = "tag-dialog-btn tag-dialog-btn-primary";
    tagDialogApplyBtn.textContent = "Apply";
    tagDialogApplyBtn.addEventListener("click", () => {
      closeTagDialog(true);
    });

    actions.appendChild(tagDialogCancelBtn);
    actions.appendChild(tagDialogApplyBtn);

    tagDialogEl.appendChild(titleEl);
    tagDialogEl.appendChild(textField);
    tagDialogEl.appendChild(colorSection);
    tagDialogEl.appendChild(actions);

    tagDialogOverlay.appendChild(tagDialogEl);
    document.body.appendChild(tagDialogOverlay);

    tagDialogOverlay.addEventListener("mousedown", (e) => {
      if (e.target === tagDialogOverlay) {
        closeTagDialog(false);
      }
    });
  }

  function selectDialogColor(color) {
    tagDialogSelectedColor = color;
    tagDialogSwatches.forEach(swatch => {
      if (swatch.dataset.color === color) {
        swatch.classList.add("selected");
      } else {
        swatch.classList.remove("selected");
      }
    });
  }

  function openTagDialog(tag, tagEl) {
    tagDialogCurrentTag = tag;
    tagDialogCurrentTagEl = tagEl;

    tagDialogTextInput.value = tag.text || "";
    const colorToUse = tag.color || DEFAULT_TAG_COLOR;
    selectDialogColor(colorToUse);

    tagDialogOverlay.style.display = "flex";
    tagDialogTextInput.focus();
    tagDialogTextInput.select();
  }

  function closeTagDialog(applyChanges) {
    if (applyChanges && tagDialogCurrentTag && tagDialogCurrentTagEl) {
      const newText = tagDialogTextInput.value.trim();
      const newColor = tagDialogSelectedColor || DEFAULT_TAG_COLOR;

      tagDialogCurrentTag.text = newText || "Tag";
      tagDialogCurrentTag.color = newColor;

      const label = tagDialogCurrentTagEl.querySelector(".tag-pin-label");
      if (label) label.textContent = tagDialogCurrentTag.text;
      tagDialogCurrentTagEl.style.backgroundColor = newColor;
    }

    tagDialogOverlay.style.display = "none";
    tagDialogCurrentTag = null;
    tagDialogCurrentTagEl = null;
  }

  // ============================================
  // Tag Rendering & Dragging
  // ============================================

  function renderTagsOverlay() {
    const previewEl = document.getElementById("image-preview");
    if (!previewEl) return;

    previewEl.querySelectorAll(".tag-pin").forEach(el => el.remove());

    const img = previewEl.querySelector("img");
    if (!img) return;

    if (!Array.isArray(currentTags) || currentTags.length === 0) return;

    currentTags.forEach(tag => {
      const tagEl = document.createElement("div");
      tagEl.className = "tag-pin";
      tagEl.dataset.id = tag.id;
      tagEl.style.left = `${tag.x}%`;
      tagEl.style.top = `${tag.y}%`;
      tagEl.style.backgroundColor = tag.color || DEFAULT_TAG_COLOR;

      const label = document.createElement("span");
      label.className = "tag-pin-label";
      label.textContent = tag.text || "Tag";
      tagEl.appendChild(label);

      tagEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startDraggingTag(tag.id);
      });

      tagEl.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        openTagDialog(tag, tagEl);
      });

      previewEl.appendChild(tagEl);
    });
  }

  function startDraggingTag(tagId) {
    draggingTagId = tagId;
    document.addEventListener("mousemove", onTagMouseMove);
    document.addEventListener("mouseup", stopDraggingTag);
  }

  function onTagMouseMove(e) {
    if (!draggingTagId) return;
    const previewEl = document.getElementById("image-preview");
    if (!previewEl) return;

    const rect = previewEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const relX = ((e.clientX - rect.left) / rect.width) * 100;
    const relY = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.min(98, Math.max(2, relX));
    const clampedY = Math.min(98, Math.max(2, relY));

    const tag = currentTags.find(t => t.id === draggingTagId);
    if (!tag) return;

    tag.x = clampedX;
    tag.y = clampedY;

    const tagEl = document.querySelector(`.tag-pin[data-id="${tag.id}"]`);
    if (tagEl) {
      tagEl.style.left = `${tag.x}%`;
      tagEl.style.top = `${tag.y}%`;
    }
  }

  function stopDraggingTag() {
    draggingTagId = null;
    document.removeEventListener("mousemove", onTagMouseMove);
    document.removeEventListener("mouseup", stopDraggingTag);
  }

  // ============================================
  // New Tag Drag from Button
  // ============================================ */

  function startNewTagDrag(e) {
    const previewEl = document.getElementById("image-preview");
    if (!previewEl) {
      alert("Open an entry first.");
      return;
    }
    const img = previewEl.querySelector("img");
    if (!img) {
      alert("Add a photo to this entry before adding tags.");
      return;
    }

    draggingNewTag = true;

    ghostTagEl = document.createElement("div");
    ghostTagEl.className = "tag-pin-ghost";
    ghostTagEl.textContent = "New tag";
    document.body.appendChild(ghostTagEl);

    moveGhostTag(e.clientX, e.clientY);

    document.addEventListener("mousemove", onNewTagDragMove);
    document.addEventListener("mouseup", stopNewTagDrag);
    e.preventDefault();
  }

  function moveGhostTag(clientX, clientY) {
    if (!ghostTagEl) return;
    ghostTagEl.style.left = clientX + "px";
    ghostTagEl.style.top  = clientY + "px";
  }

  function onNewTagDragMove(e) {
    if (!draggingNewTag) return;
    moveGhostTag(e.clientX, e.clientY);
  }

  function stopNewTagDrag(e) {
    if (!draggingNewTag) return;

    draggingNewTag = false;

    document.removeEventListener("mousemove", onNewTagDragMove);
    document.removeEventListener("mouseup", stopNewTagDrag);

    if (ghostTagEl) {
      ghostTagEl.remove();
      ghostTagEl = null;
    }

    const previewEl = document.getElementById("image-preview");
    if (!previewEl) return;

    const rect = previewEl.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!inside) return;

    const relX = ((e.clientX - rect.left) / rect.width) * 100;
    const relY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.min(98, Math.max(2, relX));
    const clampedY = Math.min(98, Math.max(2, relY));

    const newTag = {
      id: generateId(),
      text: "New tag",
      color: DEFAULT_TAG_COLOR,
      x: clampedX,
      y: clampedY
    };
    currentTags.push(newTag);
    renderTagsOverlay();
  }

  // ============================================
  // Editor Rendering (single entry)
  // ============================================

  function renderEditor(entry) {
    currentTags = Array.isArray(entry.tags)
      ? entry.tags.map(t => ({ ...t }))
      : [];

    const firstAttachment = Array.isArray(entry.attachments) && entry.attachments[0]
      ? entry.attachments[0]
      : null;
    const imageDataToUse = firstAttachment?.data || entry.imageData || null;

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

      <div class="image-section">
        <label for="entry-photo">Photo of journal page</label>
        <input type="file" id="entry-photo" accept="image/*">
        <div class="image-preview" id="image-preview">
          ${
            imageDataToUse
              ? `<img src="${imageDataToUse}" alt="Journal page image">`
              : `<span>No image attached yet.</span>`
          }
        </div>
      </div>

      <div style="display:flex; flex-direction:column; flex:1;">
        <label for="entry-body">Entry</label>
        <textarea id="entry-body" placeholder="Optional notes about this page...">${entry.body}</textarea>
      </div>

      <div class="status-text" id="status-text">
        ${
          currentEntryId
            ? (lastSavedAt
                ? `Last saved at ${lastSavedAt.toLocaleTimeString()}`
                : "Loaded existing entry")
            : "New entry (not yet saved)"
        }
      </div>
    `;

    const photoInput = document.getElementById("entry-photo");
    const previewEl  = document.getElementById("image-preview");

    if (photoInput && previewEl) {
      photoInput.addEventListener("change", () => {
        if (photoInput.files && photoInput.files[0]) {
          const file = photoInput.files[0];
          const reader = new FileReader();
          reader.onload = (e) => {
            previewEl.innerHTML = `<img src="${e.target.result}" alt="Journal page image">`;
            renderTagsOverlay();
          };
          reader.readAsDataURL(file);
        } else {
          previewEl.innerHTML = `<span>No image attached yet.</span>`;
        }
      });
    }

    renderTagsOverlay();
  }

  // ============================================
  // Navigation Between Entries
  // ============================================

  function goToEntryAtIndex(idx) {
    const sorted = getChronologicallySortedEntries();
    if (idx < 0 || idx >= sorted.length) return;
    const entry = sorted[idx];
    currentEntryId = entry.id;
    lastSavedAt = entry.updatedAt ? new Date(entry.updatedAt) : null;
    renderEditor(entry);
    updateNavAndActionsUI();
    showJournalView();
    renderCalendar(); // keep highlight in sync
  }

  function goToPreviousEntry() {
    const idx = getCurrentEntryIndex();
    if (idx <= 0) return;
    goToEntryAtIndex(idx - 1);
  }

  function goToNextEntry() {
    const idx = getCurrentEntryIndex();
    const sorted = getChronologicallySortedEntries();
    if (idx === -1 || idx >= sorted.length - 1) return;
    goToEntryAtIndex(idx + 1);
  }

  function openEntryById(entryId) {
    const sorted = getChronologicallySortedEntries();
    const idx = sorted.findIndex(e => e.id === entryId);
    if (idx === -1) return;
    goToEntryAtIndex(idx);
  }

  // ============================================
  // Entry Operations: New, Save, Delete
  // ============================================

  function newEntry() {
    currentEntryId = null;
    lastSavedAt = null;
    currentTags = [];
    currentDayIso = null;
    currentDayEntries = [];
    renderDayResults();

    const fresh = {
      id: null,
      notebookId: "default",
      date: formatDateForInput(new Date()),
      title: "",
      body: "",
      imageData: null,
      attachments: [],
      tags: [],
      createdAt: null,
      updatedAt: null
    };
    renderEditor(fresh);
    updateStatus("New entry (not yet saved)");
    updateNavAndActionsUI();
    showJournalView();
  }

  function saveCurrentEntry() {
    const dateInput  = document.getElementById("entry-date");
    const titleInput = document.getElementById("entry-title");
    const bodyInput  = document.getElementById("entry-body");
    const photoInput = document.getElementById("entry-photo");
    const previewEl  = document.getElementById("image-preview");

    if (!dateInput || !titleInput || !bodyInput || !photoInput || !previewEl) return;

    const dateValue  = dateInput.value || formatDateForInput(new Date());
    const titleValue = titleInput.value.trim();
    const bodyValue  = bodyInput.value;

    const existing = getCurrentEntryObject();
    const now = new Date();
    const nowISO = now.toISOString();

    const existingAttachment = existing && Array.isArray(existing.attachments) && existing.attachments[0]
      ? existing.attachments[0]
      : null;
    const existingImageData = existingAttachment?.data || existing?.imageData || null;

    if (photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const newImageData = e.target.result;
        finalizeSave(dateValue, titleValue, bodyValue, newImageData, now, nowISO, existing);
      };
      reader.readAsDataURL(file);
    } else {
      finalizeSave(dateValue, titleValue, bodyValue, existingImageData, now, nowISO, existing);
    }
  }

  function finalizeSave(dateValue, titleValue, bodyValue, imageData, now, nowISO, existing) {
    let attachments = [];
    if (imageData) {
      const existingAttachment = existing &&
        Array.isArray(existing.attachments) &&
        existing.attachments[0]
          ? existing.attachments[0]
          : null;

      attachments.push({
        id: existingAttachment ? existingAttachment.id : generateId(),
        type: "image",
        storage: "inline",
        data: imageData
      });
    }

    if (currentEntryId) {
      const idx = entries.findIndex(e => e.id === currentEntryId);
      if (idx !== -1) {
        const prev = entries[idx];
        entries[idx] = {
          ...prev,
          notebookId: prev.notebookId || "default",
          date: dateValue,
          title: titleValue,
          body: bodyValue,
          imageData: imageData || null,
          attachments,
          tags: currentTags || [],
          updatedAt: nowISO
        };
      }
    } else {
      currentEntryId = generateId();
      const newEntryObj = {
        id: currentEntryId,
        notebookId: "default",
        date: dateValue,
        title: titleValue,
        body: bodyValue,
        imageData: imageData || null,
        attachments,
        tags: currentTags || [],
        createdAt: nowISO,
        updatedAt: nowISO
      };
      entries.push(newEntryObj);
    }

    journalService.saveAll(entries);
    lastSavedAt = now;
    updateStatus(`Saved at ${now.toLocaleTimeString()}`);
    updateNavAndActionsUI();
    renderCalendar();
    // Day results will be refreshed next time a calendar day is clicked.
  }

  function deleteCurrentEntry() {
    if (!currentEntryId) return;
    const confirmDelete = window.confirm("Delete this entry? This cannot be undone.");
    if (!confirmDelete) return;

    const sortedBefore = getChronologicallySortedEntries();
    const oldIdx = sortedBefore.findIndex(e => e.id === currentEntryId);

    entries = entries.filter(e => e.id !== currentEntryId);
    journalService.saveAll(entries);

    if (entries.length === 0) {
      currentEntryId = null;
      lastSavedAt = null;
      currentTags = [];
      currentDayIso = null;
      currentDayEntries = [];
      renderDayResults();
      newEntry();
      renderCalendar();
      return;
    }

    const sortedAfter = getChronologicallySortedEntries();
    let newIdx = oldIdx;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= sortedAfter.length) newIdx = sortedAfter.length - 1;

    goToEntryAtIndex(newIdx);
    renderCalendar();
  }

  // ============================================
  // Search
  // ============================================

  function entryMatchesQuery(entry, q) {
    const query = q.toLowerCase();
    const inTitle = (entry.title || "").toLowerCase().includes(query);
    const inBody  = (entry.body  || "").toLowerCase().includes(query);
    const inTags  =
      Array.isArray(entry.tags) &&
      entry.tags.some(t => (t.text || "").toLowerCase().includes(query));

    return inTitle || inBody || inTags;
  }

  function runSearch(query) {
    const q = query.trim();
    if (!q) {
      currentSearchResults = [];
      renderSearchResults(q);
      showSearchView();
      return;
    }

    currentSearchResults = entries
      .map((entry) => ({ entry }))
      .filter(({ entry }) => entryMatchesQuery(entry, q));

    renderSearchResults(q);
    showSearchView();
  }

  function renderSearchResults(query) {
    searchResultsEl.innerHTML = "";

    if (!query.trim()) {
      const msg = document.createElement("div");
      msg.className = "search-result-snippet";
      msg.textContent = "Type in the search box to find entries by title, notes, or tags.";
      searchResultsEl.appendChild(msg);
      return;
    }

    if (currentSearchResults.length === 0) {
      const msg = document.createElement("div");
      msg.className = "search-result-snippet";
      msg.textContent = `No results found for "${query}".`;
      searchResultsEl.appendChild(msg);
      return;
    }

    const qLower = query.toLowerCase();

    currentSearchResults.forEach(({ entry }) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.dataset.entryId = entry.id;

      const titleEl = document.createElement("div");
      titleEl.className = "search-result-title";
      titleEl.textContent = entry.title || "(Untitled entry)";

      const metaEl = document.createElement("div");
      metaEl.className = "search-result-meta";
      const dateStr = entry.date || "";
      const tagsText = Array.isArray(entry.tags)
        ? entry.tags.map(t => t.text).filter(Boolean).join(", ")
        : "";
      metaEl.textContent = [dateStr, tagsText ? `Tags: ${tagsText}` : ""]
        .filter(Boolean)
        .join("  •  ");

      const snippetEl = document.createElement("div");
      snippetEl.className = "search-result-snippet";

      const body = (entry.body || "").replace(/\s+/g, " ").trim();
      const snippetLength = 160;

      if (!body) {
        snippetEl.textContent = "";
      } else {
        const idxMatch = body.toLowerCase().indexOf(qLower);
        let snippet;
        if (idxMatch === -1) {
          snippet = body.slice(0, snippetLength);
        } else {
          const start = Math.max(0, idxMatch - 40);
          snippet = body.slice(start, start + snippetLength);
        }
        if (snippet.length < body.length) snippet += "…";
        snippetEl.textContent = snippet;
      }

      item.appendChild(titleEl);
      item.appendChild(metaEl);
      if (snippetEl.textContent) item.appendChild(snippetEl);

      item.addEventListener("click", () => {
        openEntryById(entry.id);
      });

      searchResultsEl.appendChild(item);
    });
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
    const dateStr = formatDateForInput(new Date());
    a.download = `journal_export_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================
  // Calendar: Rendering + Interaction
  // ============================================

  function initCalendarState() {
    let baseDate = new Date();
    const currentEntry = getCurrentEntryObject();
    if (currentEntry && currentEntry.date) {
      const [y, m, d] = currentEntry.date.split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        baseDate = new Date(y, m - 1, d);
      }
    }
    calendarCurrentYear = baseDate.getFullYear();
    calendarCurrentMonth = baseDate.getMonth();
  }

  function renderCalendar() {
    if (!calendarGrid || !calendarMonthLabel) return;

    if (calendarCurrentYear === null || calendarCurrentMonth === null) {
      initCalendarState();
    }

    const year = calendarCurrentYear;
    const month = calendarCurrentMonth; // 0-11

    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;

    calendarGrid.innerHTML = "";

    const weekdayLabels = ["S","M","T","W","T","F","S"];
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
      const emptyCell = document.createElement("div");
      emptyCell.className = "calendar-empty";
      calendarGrid.appendChild(emptyCell);
    }

    const today = new Date();
    const todayIso = formatDateForInput(today);

    const sorted = getChronologicallySortedEntries();

    // Determine which date is "selected" based on the current entry
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
        btn.classList.add("has-entry");
      }

      if (iso === todayIso) {
        btn.classList.add("today");     // current date (bold)
      }

      if (selectedDateIso && iso === selectedDateIso) {
        btn.classList.add("selected");  // currently viewed entry (blue circle)
      }

      btn.dataset.date = iso;

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

  // ============================================
  // Day Results Card (calendar multi-entry days)
  // ============================================

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

    currentDayEntries.forEach((entry) => {
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

    if (sameDayEntries.length === 0) {
      // No entry on this day – clear day card and leave current entry untouched.
      currentDayIso = null;
      currentDayEntries = [];
      renderDayResults();
      return;
    }

    // Update per-day card state and show the card
    currentDayIso = isoDate;
    currentDayEntries = sameDayEntries;
    renderDayResults();

    // Open the first entry for that day in the editor (below the card)
    openEntryById(sameDayEntries[0].id);
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
      const mostRecent = [...entries].sort((a, b) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || "")
      )[0];
      currentEntryId = mostRecent.id;
      lastSavedAt = mostRecent.updatedAt ? new Date(mostRecent.updatedAt) : null;
      renderEditor(mostRecent);
      updateNavAndActionsUI();
    }

    renderDayResults();  // initially hidden

    initCalendarState();
    renderCalendar();

    if (newEntryBtn) newEntryBtn.addEventListener("click", newEntry);
    if (newTagBtn)   newTagBtn.addEventListener("mousedown", startNewTagDrag);
    if (saveBtn)     saveBtn.addEventListener("click", saveCurrentEntry);
    if (deleteBtnTop) deleteBtnTop.addEventListener("click", deleteCurrentEntry);
    if (prevBtn)     prevBtn.addEventListener("click", goToPreviousEntry);
    if (nextBtn)     nextBtn.addEventListener("click", goToNextEntry);

    if (journalViewBtn) {
      journalViewBtn.addEventListener("click", () => {
        showJournalView();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", exportEntries);
    }

    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const query = searchInput.value;
          runSearch(query);
          searchInput.value = "";
        }
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        searchInput.value = "";
        if (currentView === "search") {
          runSearch("");
        }
      });
    }

    if (calendarPrevBtn) {
      calendarPrevBtn.addEventListener("click", () => changeCalendarMonth(-1));
    }

    if (calendarNextBtn) {
      calendarNextBtn.addEventListener("click", () => changeCalendarMonth(1));
    }
  }

  init();
});
