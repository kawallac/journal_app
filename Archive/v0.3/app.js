document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "journalEntries_v1";

  let entries = [];
  let currentEntryId = null;
  let lastSavedAt = null;
  let currentTags = [];        // tags for the currently open entry
  let draggingTagId = null;    // which existing tag is being dragged

  // For dragging a new tag from the button
  let draggingNewTag = false;
  let ghostTagEl = null;

  const editorInnerEl = document.getElementById("editor-inner");
  const newEntryBtn = document.getElementById("new-entry-btn");
  const newTagBtn = document.getElementById("new-tag-btn");

  const DEFAULT_TAG_COLOR = "#2563eb";  // all new tags start blue

  function mapColorInput(input, current) {
    const raw = input.trim();
    const val = raw.toLowerCase();

    const namedColors = {
      "blue": "#2563eb",
      "green": "#16a34a",
      "yellow": "#eab308",
      "pink": "#db2777",
      "orange": "#f97316",
      "light blue": "#0ea5e9",
      "teal": "#0ea5e9"
    };

    if (namedColors[val]) {
      return namedColors[val];
    }

    // Allow hex like #ff00ff or #f0f
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
      return raw;
    }

    // Fallback: keep current color
    return current;
  }

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

  function getCurrentEntryObject() {
    if (!currentEntryId) return null;
    return entries.find(e => e.id === currentEntryId) || null;
  }

  // ----- Tags rendering & dragging on image -----
  function renderTagsOverlay() {
    const previewEl = document.getElementById("image-preview");
    if (!previewEl) return;

    // Remove any existing tag elements
    previewEl.querySelectorAll(".tag-pin").forEach(el => el.remove());

    const img = previewEl.querySelector("img");
    if (!img) return; // no image = no tags

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

      // Drag existing tag
      tagEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startDraggingTag(tag.id);
      });

      // Edit label + color on double-click
      tagEl.addEventListener("dblclick", (e) => {
        e.stopPropagation();

        // Edit text
        const newText = prompt("Tag text:", tag.text || "");
        if (newText !== null) {
          tag.text = newText.trim();
          label.textContent = tag.text || "Tag";
        }

        // Edit color
        const currentColor = tag.color || DEFAULT_TAG_COLOR;
        const colorPromptMsg =
          "Tag color (blue, green, yellow, pink, orange, light blue, or hex like #ff00ff):";
        const colorInput = prompt(colorPromptMsg, currentColor);

        if (colorInput !== null && colorInput.trim() !== "") {
          const chosen = mapColorInput(colorInput, currentColor);
          tag.color = chosen;
          tagEl.style.backgroundColor = chosen;
        }
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

  // ----- Dragging a NEW tag from the header button -----
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

    // Create ghost tag that follows cursor
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
    ghostTagEl.style.top = clientY + "px";
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

    // If mouseup is not over the image area, cancel creation
    if (!inside) {
      return;
    }

    // Compute relative position within image
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

  // ----- Render editor -----
  function renderEditor(entry) {
    // Prepare tags for this entry
    currentTags = Array.isArray(entry.tags)
      ? entry.tags.map(t => ({ ...t }))
      : [];

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
            entry.imageData
              ? `<img src="${entry.imageData}" alt="Journal page image">`
              : `<span>No image attached yet.</span>`
          }
        </div>
      </div>

      <div style="display:flex; flex-direction:column; flex:1;">
        <label for="entry-body">Entry</label>
        <textarea id="entry-body" placeholder="Optional notes about this page...">${entry.body}</textarea>
      </div>

      <div class="editor-actions">
        <div class="editor-actions-left">
          <button class="primary" id="save-btn">Save</button>
          <button class="danger" id="delete-btn" ${currentEntryId ? "" : "disabled"}>Delete</button>
        </div>

        <div class="editor-actions-right">
          <div class="status-text" id="status-text">
            ${
              currentEntryId
                ? (lastSavedAt
                    ? `Last saved at ${lastSavedAt.toLocaleTimeString()}`
                    : "Loaded existing entry")
                : "New entry (not yet saved)"
            }
          </div>
        </div>
      </div>
    `;

    // Wire up buttons
    document.getElementById("save-btn").addEventListener("click", saveCurrentEntry);
    const deleteBtn = document.getElementById("delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", deleteCurrentEntry);
    }

    // Photo input + preview; keep tags when image is already there
    const photoInput = document.getElementById("entry-photo");
    const previewEl = document.getElementById("image-preview");

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

    // Render any existing tags for this entry
    renderTagsOverlay();
  }

  // ----- Entry operations -----
  function newEntry() {
    currentEntryId = null;
    lastSavedAt = null;
    currentTags = [];
    const fresh = {
      id: null,
      date: formatDateForInput(new Date()),
      title: "",
      body: "",
      imageData: null,
      tags: []
    };
    renderEditor(fresh);
    updateStatus("New entry (not yet saved)");
  }

  function saveCurrentEntry() {
    const dateInput  = document.getElementById("entry-date");
    const titleInput = document.getElementById("entry-title");
    const bodyInput  = document.getElementById("entry-body");
    const photoInput = document.getElementById("entry-photo");

    if (!dateInput || !titleInput || !bodyInput || !photoInput) return;

    const dateValue  = dateInput.value || formatDateForInput(new Date());
    const titleValue = titleInput.value.trim();
    const bodyValue  = bodyInput.value;

    const existing = getCurrentEntryObject();
    const existingImageData = existing ? existing.imageData || null : null;

    const now = new Date();
    const nowISO = now.toISOString();

    if (photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const newImageData = e.target.result;
        finalizeSave(dateValue, titleValue, bodyValue, newImageData, now, nowISO);
      };
      reader.readAsDataURL(file);
    } else {
      finalizeSave(dateValue, titleValue, bodyValue, existingImageData, now, nowISO);
    }
  }

  function finalizeSave(dateValue, titleValue, bodyValue, imageData, now, nowISO) {
    if (currentEntryId) {
      const idx = entries.findIndex(e => e.id === currentEntryId);
      if (idx !== -1) {
        entries[idx] = {
          ...entries[idx],
          date: dateValue,
          title: titleValue,
          body: bodyValue,
          imageData: imageData || null,
          tags: currentTags || [],
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
        imageData: imageData || null,
        tags: currentTags || [],
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
    currentTags = [];
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
    if (newTagBtn) {
      // drag start from button
      newTagBtn.addEventListener("mousedown", startNewTagDrag);
    }
  }

  init();
});
