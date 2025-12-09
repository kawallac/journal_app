# Journal App Data Model (v0.1)

This document describes the core data model for the Journal app as of **v0.4.1**.  
The goal is to keep the **web app, future backend, and future mobile app** aligned on the same shapes.

---

## 1. Overview

Core concepts:

- **User** – the owner of data (even if we’re currently single-user).
- **Notebook** – a logical collection of entries (e.g., “Journal”, “Business”, “Running”).
- **Entry** – a single journal item (date, title, notes, page photo, tags).
- **Tag** – a label attached to an entry, anchored to a position on the image.
- **Attachment** – a file or media object associated with an entry (image, PDF, etc.).

In the current browser-only version:

- User is implied (single user).
- `notebookId` exists but is always `"default"`.
- Attachments are inline base64 images stored in localStorage.

---

## 2. Entities

### 2.1 User

> **Future use**: not yet persisted in the browser app, but useful to define now.

| Field      | Type     | Description                                  |
| ---------- | -------- | -------------------------------------------- |
| `id`       | string   | Stable unique user ID (UUID or similar).     |
| `email`    | string   | Login/email address.                         |
| `name`     | string   | Display name / full name.                    |
| `settings` | object   | Per-user settings (theme, defaults, etc.).   |

Example `settings` (extensible):

```json
{
  "theme": "light",
  "defaultNotebookId": "default",
  "showTagOutlines": true
}
