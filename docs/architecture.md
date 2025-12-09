# Journal App Architecture (v0.1)

This document describes the high-level architecture of the **Journal App** as of version **v0.4.1**.

The app is currently a **client-only web application** (HTML/CSS/JavaScript) running entirely in the browser, with data stored locally via `localStorage`. The design intentionally anticipates a future backend and mobile clients.

---

## 1. High-Level Overview

**Current stack (v0.4.1):**

- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Runtime:** Browser (no server required)
- **Storage:** `localStorage` via a pluggable `StorageAdapter`
- **Primary UI:** Single-page layout with
  - Left sidebar (search, controls)
  - Main journal card (entry editor or search results)

**Future direction:**

- Backend API (e.g., FastAPI / Node / Supabase)
- Authentication & multi-user
- Multiple notebooks/spaces
- Native-like mobile app (e.g., React Native / Expo) consuming the same API and data model

---

## 2. Files & Responsibilities

### 2.1 `index.html`

**Role:** Base HTML shell.

Key responsibilities:

- Defines the **layout containers**:
  - Header
  - `.app-container` (sidebar + editor)
  - Sidebar:
    - Search input
    - “Journal View” button
    - “Export JSON” button
  - Editor:
    - Toolbar (New Entry, New Tag)
    - Central `.page` card
      - Journal view (`#page-journal`)
      - Search results view (`#page-search`)
- Loads:
  - `styles.css` for presentation
  - `app.js` for behavior and state

`index.html` is intentionally minimal―logic lives in `app.js`.

---

### 2.2 `styles.css`

**Role:** Visual design & layout.

Key responsibilities:

- Define **global look & feel**:
  - Typography
  - Colors (clean, minimal, white-based UI)
- Layout:
  - Fixed header
  - Flexible main layout with left sidebar + main editor
- Visual components:
  - Sidebar search “pill”
  - Journal card with consistent drop shadow
  - Search result cards styled to match the journal card
  - Buttons (primary, danger, generic)
- Tag and dialog UI:
  - Positioned `.tag-pin` elements on the image
  - `.tag-dialog` overlay for editing tag label and color

The CSS is written to be framework-agnostic so we can later port the same look into a component system (e.g., React) if desired.

---

### 2.3 `app.js`

**Role:** Application logic, state management, and view wiring.

Key responsibilities:

1. **Data model & state**
   - In-memory `entries` array
   - `currentEntryId`, `lastSavedAt`, `currentTags`
   - View mode: `"journal"` or `"search"`

2. **Storage layer**
   - `StorageAdapter`:
     - Reads/writes raw JSON to `localStorage` under `STORAGE_KEY = "journalEntries_v1"`.
   - `journalService`:
     - Wraps `StorageAdapter` and applies **migrations**:
       - Ensures `notebookId` exists (defaults to `"default"`).
       - Ensures `attachments[]` exists.
       - Converts legacy `imageData` into a proper inline image attachment when needed.
     - Provides:
       - `loadAll()`
       - `saveAll(entries)`
       - `exportAll(entries)` (for JSON export)

   This separation makes it easy to:
   - Replace `StorageAdapter` with an API client later.
   - Keep UI code decoupled from underlying storage details.

3. **Editor behavior**
   - Renders the entry form:
     - Date, title, body
     - File input for “photo of journal page”
     - Image preview
   - Keeps tags in `currentTags` and renders them over the image
   - Handles:
     - New entry (`newEntry()`)
     - Save entry (`saveCurrentEntry()` → `finalizeSave()`)
     - Delete entry
     - Prev/Next navigation

4. **Tag system**
   - Tag data:
     - `{ id, text, color, x, y }`
   - Draggable tag pins on top of the image:
     - Existing tags: click & drag within the image preview
     - New tags: click+drag from “New Tag” button, drop onto image
   - Tag editing dialog:
     - Double-click a tag to edit its text and color
     - Color selection from a fixed palette

5. **Search**
   - Search input in the sidebar:
     - Press **Enter** to run search on:
       - Entry title
       - Body text
       - Tag text
     - Clears field after search
   - `runSearch(query)`:
     - Filters entries in memory
     - Populates `currentSearchResults`
     - Switches to `#page-search` view
   - Results are rendered as clickable cards:
     - On click: open that entry in the journal view

6. **Export**
   - “Export JSON” button in the sidebar:
     - Uses `journalService.exportAll(entries)` to generate pretty JSON
     - Triggers a client-side download: `journal_export_YYYY-MM-DD.json`
   - This ensures the user always owns their data, even before a backend exists.

---

## 3. Data Flow

### 3.1 Startup

1. `DOMContentLoaded` fires.
2. `app.js`:
   - Calls `journalService.loadAll()`:
     - Reads from `localStorage`.
     - Migrates each entry to the current data model.
   - If entries exist:
     - Picks the most recently updated entry.
     - Sets `currentEntryId`.
     - Renders the editor for that entry.
   - If no entries exist:
     - Calls `newEntry()` to start a fresh entry.

### 3.2 Editing & Saving

1. User edits fields (date, title, body) or changes the photo.
2. On **Save**:
   - `saveCurrentEntry()`:
     - Reads form values from the DOM.
     - Reads image data (if a new file is selected).
     - Calls `finalizeSave()` with the normalized data.
3. `finalizeSave()`:
   - If editing an existing entry, updates that object.
   - If creating a new entry:
     - Generates a new `id`.
     - Creates and pushes a new `Entry` object.
   - Keeps:
     - `notebookId: "default"`
     - `attachments[]` (inline image, if present)
     - `tags` from `currentTags`
   - Calls `journalService.saveAll(entries)` to persist to `localStorage`.

---

## 4. Future Backend / Mobile Integration

The current design already anticipates:

- **Backend API**:
  - `journalService.loadAll()` → GET `/entries`
  - `journalService.saveAll()` → sync to API (or future: per-entry calls)
  - `exportAll()` could be replaced or complemented by a server-side export.

- **Authentication**:
  - Add `User` and `userId` to entries, notebooks, and tags.
  - Use `notebookId` for user-specific spaces.

- **Mobile app**:
  - Can reuse the same data model (`Entry`, `Tag`, `Attachment`, `Notebook`).
  - Synchronizes via the same API the web uses.

Because the frontend talks to `journalService` instead of directly to `localStorage`, we can gradually move from:

> **“Browser-only prototype” → “Full stack app”**

without rewriting the UI from scratch.

---

## 5. Versioning

- This document: **Architecture v0.1**
- App baseline: **v0.4.1**
- See also: `DATA_MODEL.md v0.1` for detailed entity definitions.

This document should be updated whenever we:
- Introduce a backend
- Add authentication
- Add notebooks/spaces
- Change how `journalService` or `StorageAdapter` behave
