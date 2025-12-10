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

  // ============================================
  // DOM References
  // ============================================

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

  // ============================================
  // Helper: get current entry object
  // ============================================

  function getCurrentEntryObject() {
    if (!currentEntryId) return null;
    return entries.find(e => e.id === currentEntryId) || null;
  }

  // ============================================
  // Helper: sorted entries (for chronological nav)
  // ============================================

  function getChronologicallySortedEntries() {
    return [...entries].sort((a, b) => {
      // Sort by date, then by createdAt/updatedAt
      const aDate = a.date || "";
      const bDate = b.date || "";
      const cmpDate = aDate.localeCompare(bDate);
      if (cmpDate !== 0) return cmpDate;

      const aTime = a.createdAt || a.updatedAt || "";
      const bTime = b.createdAt || b.updatedAt || "";
      return aTime.localeCompare(bTime);
    });
  }

  // ============================================
  // View helpers (journal vs search)
  // ============================================

  function showJournalView() {
    currentView = "journal";
    pageJournal.style.display = "block";
    pageSearch.style.display = "none";
    if (pageTopBar) pageTopBar.style.display = "flex";
  }

  function showSearchView() {
    currentView = "search";
    pageJournal.style.display = "none";
    pageSearch.style.display = "block";
    if (pageTopBar) pageTopBar.style.display = "none";
  }

  // ============================================
  // Render Editor (fields + image + tags)
  // ============================================

  function renderEditor(entry) {
    if (!editorInnerEl) return;

    const safeEntry = entry || {
      date: formatDateForInput(new Date()),
      title: "",
      body: "",
      imageData: null,
      tags: []
    };

    currentTags = Array.isArray(safeEntry.tags) ? [...safeEntry.tags] : [];

    editorInnerEl.innerHTML = `
      <!-- Date + Title row -->
      <div class="editor-row-horizontal">
        <div>
          <div class="field-label">Date</div>
          <input
            id="entry-date"
            type="date"
            class="text-input"
            value="${safeEntry.date || ""}"
          />
        </div>
        <div>
          <div class="field-label">Title</div>
          <input
            id="entry-title"
            type="text"
            class="text-input"
            placeholder="Optional title for this page…"
            value="${safeEntry.title ? safeEntry.title.replace(/"/g, "&quot;") : ""}"
          />
        </div>
      </div>

      <!-- Notes area -->
      <div>
        <div class="field-label">Notes</div>
        <textarea
          id="entry-body"
          class="textarea-input"
          placeholder="Write notes, highlights, or a summary of this journal page…"
        >${safeEntry.body || ""}</textarea>
      </div>

      <!-- Image / Photo section -->
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
            safeEntry.imageData
              ? `<img src="${safeEntry.imageData}" alt="Journal page image" />`
              : `<span>No image yet. Upload a photo of your journal page.</span>`
          }
        </div>
      </div>
    `;

    wireEditorFieldListeners();
    renderTagsOnImage();
  }

  function wireEditorFieldListeners() {
    const photoInput = document.getElementById("entry-photo");
    const imagePreview = document.getElementById("image-preview");

    if (photoInput && imagePreview) {
      photoInput.addEventListener("change", () => {
        if (photoInput.files && photoInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const src = e.target.result;
            imagePreview.innerHTML = `<img src="${src}" alt="Journal page image" />`;
            renderTagsOnImage();
          };
          reader.readAsDataURL(photoInput.files[0]);
        } else {
          imagePreview.innerHTML =
            `<span>No image yet. Upload a photo of your journal page.</span>`;
          renderTagsOnImage();
        }
      });
    }
  }

  // ============================================
  // Tags on Image
  // ============================================

  function renderTagsOnImage() {
    const imagePreview = document.getElementById("image-preview");
    if (!imagePreview) return;

    // Remove existing pills (but keep the img / span)
    [...imagePreview.querySelectorAll(".tag-pill")].forEach(el => el.remove());

    currentTags.forEach(tag => {
      const el = document.createElement("div");
      el.className = "tag-pill";
      el.textContent = tag.text || "Tag";
      el.style.backgroundColor = tag.color || "#2563eb";

      const xPct = typeof tag.x === "number" ? tag.x : 50;
      const yPct = typeof tag.y === "number" ? tag.y : 50;
      el.style.left = `${xPct}%`;
      el.style.top = `${yPct}%`;

      el.dataset.tagId = tag.id;

      el.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        const rect = imagePreview.getBoundingClientRect();
        startExistingTagDrag(tag.id, ev, imagePreview, rect);
      });

      el.addEventListener("dblclick", (ev) => {
        ev.preventDefault();
        openTagDialog(tag.id, el);
      });

      imagePreview.appendChild(el);
    });
  }

  function startExistingTagDrag(tagId, ev, imagePreview, rect) {
    draggingTagId = tagId;
    draggingNewTag = false;
    if (!rect) rect = imagePreview.getBoundingClientRect();

    const moveListener = (moveEv) => {
      handleTagDragMove(moveEv, imagePreview, rect);
    };
    const upListener = (upEv) => {
      handleTagDragEnd(upEv, imagePreview, rect, moveListener, upListener);
    };

    window.addEventListener("mousemove", moveListener);
    window.addEventListener("mouseup", upListener);
  }

  function startNewTagDrag(ev) {
    ev.preventDefault();
    if (!newTagBtn) return;

    draggingNewTag = true;
    draggingTagId = null;

    ghostTagEl = document.createElement("div");
    ghostTagEl.className = "tag-pill tag-pill-ghost";
    ghostTagEl.textContent = "New tag";
    ghostTagEl.style.backgroundColor = "#2563eb";
    ghostTagEl.style.left = ev.clientX + "px";
    ghostTagEl.style.top = ev.clientY + "px";
    ghostTagEl.style.position = "fixed";
    ghostTagEl.style.transform = "translate(-50%, -50%)";
    document.body.appendChild(ghostTagEl);

    const moveListener = (moveEv) => {
      if (!ghostTagEl) return;
      ghostTagEl.style.left = moveEv.clientX + "px";
      ghostTagEl.style.top = moveEv.clientY + "px";
    };

    const upListener = (upEv) => {
      if (ghostTagEl) {
        ghostTagEl.remove();
        ghostTagEl = null;
      }
      window.removeEventListener("mousemove", moveListener);
      window.removeEventListener("mouseup", upListener);

      const imagePreview = document.getElementById("image-preview");
      if (!imagePreview) return;
      const rect = imagePreview.getBoundingClientRect();

      if (
        upEv.clientX >= rect.left &&
        upEv.clientX <= rect.right &&
        upEv.clientY >= rect.top &&
        upEv.clientY <= rect.bottom
      ) {
        const xPct = ((upEv.clientX - rect.left) / rect.width) * 100;
        const yPct = ((upEv.clientY - rect.top) / rect.height) * 100;
        const newTag = {
          id: generateId(),
          text: "New tag",
          color: "#2563eb",
          x: xPct,
          y: yPct
        };
        currentTags.push(newTag);
        renderTagsOnImage();
      }
    };

    window.addEventListener("mousemove", moveListener);
    window.addEventListener("mouseup", upListener);
  }

  function handleTagDragMove(ev, imagePreview, rect) {
    if (!draggingTagId && !draggingNewTag) return;
    if (!rect) rect = imagePreview.getBoundingClientRect();

    const tagEl = imagePreview.querySelector(
      `.tag-pill[data-tag-id="${draggingTagId}"]`
    );
    if (!tagEl) return;

    const xPct = ((ev.clientX - rect.left) / rect.width) * 100;
    const yPct = ((ev.clientY - rect.top) / rect.height) * 100;
    tagEl.style.left = `${xPct}%`;
    tagEl.style.top = `${yPct}%`;
  }

  function handleTagDragEnd(ev, imagePreview, rect, moveListener, upListener) {
    window.removeEventListener("mousemove", moveListener);
    window.removeEventListener("mouseup", upListener);

    if (draggingTagId) {
      const tagEl = imagePreview.querySelector(
        `.tag-pill[data-tag-id="${draggingTagId}"]`
      );
      if (tagEl && rect) {
        const left = parseFloat(tagEl.style.left || "50");
        const top = parseFloat(tagEl.style.top || "50");
        const tag = currentTags.find(t => t.id === draggingTagId);
        if (tag) {
          tag.x = left;
          tag.y = top;
        }
      }
    }

    draggingTagId = null;
    draggingNewTag = false;
  }

  // ============================================
  // Tag Dialog
  // ============================================

  function setupTagDialog() {
    tagDialogOverlay = document.createElement("div");
    tagDialogOverlay.className = "tag-dialog-overlay";
    tagDialogOverlay.style.display = "none";

    tagDialogEl = document.createElement("div");
    tagDialogEl.className = "tag-dialog";

    tagDialogEl.innerHTML = `
      <h2 class="tag-dialog-title">Edit Tag</h2>
      <div class="tag-dialog-body">
        <div class="tag-dialog-row">
          <label for="tag-dialog-text">Tag text</label>
          <input id="tag-dialog-text" type="text" class="tag-dialog-input" />
        </div>
        <div class="tag-dialog-row">
          <label>Color</label>
          <div class="tag-dialog-swatches" id="tag-dialog-swatches"></div>
        </div>
      </div>
      <div class="tag-dialog-footer">
        <button id="tag-dialog-cancel" class="btn-secondary" type="button">Cancel</button>
        <button id="tag-dialog-apply" class="btn-primary" type="button">Apply</button>
      </div>
    `;

    tagDialogOverlay.appendChild(tagDialogEl);
    document.body.appendChild(tagDialogOverlay);

    tagDialogTextInput = document.getElementById("tag-dialog-text");
    tagDialogApplyBtn = document.getElementById("tag-dialog-apply");
    tagDialogCancelBtn = document.getElementById("tag-dialog-cancel");

    const swatchesContainer = document.getElementById("tag-dialog-swatches");
    const colors = [
      "#2563eb", // blue
      "#16a34a", // green
      "#f97316", // orange
      "#db2777", // pink
      "#7c3aed", // purple
      "#0f172a"  // slate
    ];
    colors.forEach(color => {
      const swatch = document.createElement("div");
      swatch.className = "tag-dialog-swatch";
      swatch.style.backgroundColor = color;
      swatch.addEventListener("click", () => {
        selectTagColor(color);
      });
      swatchesContainer.appendChild(swatch);
      tagDialogSwatches.push(swatch);
    });

    tagDialogApplyBtn.addEventListener("click", () => {
      applyTagDialogChanges();
    });

    tagDialogCancelBtn.addEventListener("click", () => {
      closeTagDialog();
    });

    tagDialogOverlay.addEventListener("click", (ev) => {
      if (ev.target === tagDialogOverlay) {
        closeTagDialog();
      }
    });
  }

  function selectTagColor(color) {
    tagDialogSelectedColor = color;
    tagDialogSwatches.forEach(swatch => {
      if (swatch.style.backgroundColor === color) {
        swatch.classList.add("tag-dialog-swatch-selected");
      } else {
        swatch.classList.remove("tag-dialog-swatch-selected");
      }
    });
  }

  function openTagDialog(tagId, tagEl) {
    const tag = currentTags.find(t => t.id === tagId);
    if (!tag) return;

    tagDialogCurrentTag = tag;
    tagDialogCurrentTagEl = tagEl;

    tagDialogTextInput.value = tag.text || "";
    selectTagColor(tag.color || "#2563eb");

    tagDialogOverlay.style.display = "flex";
    tagDialogTextInput.focus();
  }

  function closeTagDialog() {
    tagDialogOverlay.style.display = "none";
    tagDialogCurrentTag = null;
    tagDialogCurrentTagEl = null;
  }

  function applyTagDialogChanges() {
    if (!tagDialogCurrentTag) return;

    tagDialogCurrentTag.text = tagDialogTextInput.value.trim() || "Tag";
    tagDialogCurrentTag.color = tagDialogSelectedColor || "#2563eb";
    renderTagsOnImage();
    closeTagDialog();
  }

  // ============================================
  // Save / Delete / New Entry
  // ============================================

  function newEntry() {
    const now = new Date();
    const dateStr = formatDateForInput(now);

    const newEntryObj = {
      id: generateId(),
      notebookId: "default",
      date: dateStr,
      title: "",
      body: "",
      imageData: null,
      attachments: [],
      tags: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    entries.push(newEntryObj);
    currentEntryId = newEntryObj.id;
    lastSavedAt = now;

    renderEditor(newEntryObj);
    updateNavAndActionsUI();
    renderCalendar();
  }

  function saveCurrentEntry() {
    const dateInput = document.getElementById("entry-date");
    const titleInput = document.getElementById("entry-title");
    const bodyInput = document.getElementById("entry-body");
    const photoInput = document.getElementById("entry-photo");

    if (!dateInput || !titleInput || !bodyInput) return;

    const dateValue  = dateInput.value || formatDateForInput(new Date());
    const titleValue = titleInput.value.trim();
    const bodyValue  = bodyInput.value;

    const existing = getCurrentEntryObject();
    const now = new Date();
       const nowISO = now.toISOString();

    const existingAttachment = existing &&
      Array.isArray(existing.attachments) &&
      existing.attachments[0]
        ? existing.attachments[0]
        : null;
    const existingImageData = existingAttachment?.data || existing?.imageData || null;

    if (photoInput && photoInput.files && photoInput.files[0]) {
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
    // Day results will be refreshed automatically via goToEntryAtIndex.
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
  // Navigation (Prev / Next) – Option B:
  // keep day-results card in sync with current entry's date.
  // ============================================

  function updateNavAndActionsUI() {
    const sorted = getChronologicallySortedEntries();
    if (!currentEntryId || sorted.length === 0) {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (deleteBtnTop) deleteBtnTop.disabled = !currentEntryId;
      return;
    }

    const idx = sorted.findIndex(e => e.id === currentEntryId);
    const hasPrev = idx > 0;
    const hasNext = idx < sorted.length - 1;

    if (prevBtn) prevBtn.disabled = !hasPrev;
    if (nextBtn) prevBtn && (nextBtn.disabled = !hasNext);
    if (deleteBtnTop) deleteBtnTop.disabled = false;
  }

  function goToEntryAtIndex(idx) {
    const sorted = getChronologicallySortedEntries();
    if (idx < 0 || idx >= sorted.length) return;
    const target = sorted[idx];

    currentEntryId = target.id;
    lastSavedAt = target.updatedAt ? new Date(target.updatedAt) : null;

    renderEditor(target);
    updateNavAndActionsUI();
    renderCalendar();

    // --- Option B: sync day-results card to this entry's date ---
    const targetDateIso = target.date || null;
    if (targetDateIso) {
      const sameDayEntries = sorted.filter(e => e.date === targetDateIso);
      if (sameDayEntries.length > 1) {
        currentDayIso = targetDateIso;
        currentDayEntries = sameDayEntries;
      } else {
        currentDayIso = null;
        currentDayEntries = [];
      }
    } else {
      currentDayIso = null;
      currentDayEntries = [];
    }
    renderDayResults();
  }

  function goToPreviousEntry() {
    const sorted = getChronologicallySortedEntries();
    if (!currentEntryId || sorted.length === 0) return;
    const idx = sorted.findIndex(e => e.id === currentEntryId);
    if (idx <= 0) return;

    goToEntryAtIndex(idx - 1);
  }

  function goToNextEntry() {
    const sorted = getChronologicallySortedEntries();
    if (!currentEntryId || sorted.length === 0) return;
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
      msg.textContent =
        "Type in the search box to find entries by title, notes, or tags.";
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
      searchInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          runSearch(searchInput.value || "");
          searchInput.value = ""; // auto clear on execute
        }
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        searchInput.value = "";
        runSearch(""); // show "type to search" message
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
