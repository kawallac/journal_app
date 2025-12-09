# Journal App API Sketch (v0.1)

This document outlines a proposed HTTP API design for the Journal App.  
It is not a final implementation specification.  
It serves as a structural reference for building a real backend later (FastAPI, Supabase, Node, etc.).

This API design matches:
- The data shapes defined in DATA_MODEL.md  
- The frontend structure described in ARCHITECTURE.md  
- Future needs including multi-user, mobile apps, syncing, and remote storage

------------------------------------------------------------------------
2. GOALS
------------------------------------------------------------------------

The API should:

1. Support multi-user data separation.
2. Cleanly expose Entries, Notebooks, Tags, Attachments.
3. Use explicit versioning (example: /api/v1).
4. Be suitable for both browser and mobile clients.
5. Support secure authentication.
6. Allow offline-first behavior and future syncing.
7. Keep the frontend simple by mirroring the existing data model.

------------------------------------------------------------------------
3. BASE URL & VERSIONING
------------------------------------------------------------------------

Example:

    https://api.journalhub.app/api/v1

Using /api/v1 at launch allows safe evolution:

- Breaking changes → /api/v2  
- Non-breaking additions remain in v1  

Clients (web/mobile) should always target a specific API version.

------------------------------------------------------------------------
4. AUTHENTICATION
------------------------------------------------------------------------

Use token-based auth (e.g., JWT access tokens with optional refresh tokens).

Endpoints:

POST /auth/register  
Purpose: Create a new user.

POST /auth/login  
Purpose: Obtain accessToken and optional refreshToken.

POST /auth/refresh  
Purpose: Exchange a valid refreshToken for a new accessToken.

GET /auth/me  
Purpose: Retrieve the authenticated user’s profile and settings.

Authentication header for protected routes:

    Authorization: Bearer <accessToken>

The API must reject requests without valid tokens.

------------------------------------------------------------------------
5. ERROR FORMAT
------------------------------------------------------------------------

Standard error response:

    {
      "error": {
        "code": "ENTRY_NOT_FOUND",
        "message": "Entry not found"
      }
    }

Common error codes:
- UNAUTHENTICATED
- UNAUTHORIZED
- VALIDATION_ERROR
- ENTRY_NOT_FOUND
- NOTEBOOK_NOT_FOUND
- INTERNAL_ERROR

------------------------------------------------------------------------
6. RESOURCES & ENDPOINTS
------------------------------------------------------------------------

The API exposes these primary resource types:

- Users
- Notebooks
- Entries
- Tags (may remain embedded within entries in early versions)
- Attachments (images, PDFs, files)

----------------------------------------
6.1 NOTEBOOKS
----------------------------------------

Represents logical containers/spaces for entries.

GET /notebooks  
Return list of notebooks for the authenticated user.

POST /notebooks  
Create a new notebook.

GET /notebooks/{id}  
Retrieve a notebook.

PATCH /notebooks/{id}  
Update name, icon, color, sortOrder.

DELETE /notebooks/{id}  
Delete or archive a notebook (TBD: cascade behavior or safety checks).

----------------------------------------
6.2 ENTRIES
----------------------------------------

Matches the Entry shape defined in DATA_MODEL.md.

GET /entries  
Return a list of entries with optional filters:
- notebookId
- q (full-text search: title/body/tags)
- tag
- fromDate
- toDate
- limit / offset

POST /entries  
Create a new entry.

GET /entries/{id}  
Return a single entry.

PATCH /entries/{id}  
Partially update an entry.

DELETE /entries/{id}  
Delete an entry.

Entries contain:
- title
- date
- body
- attachments[]
- tags[]
- notebookId
- createdAt / updatedAt

----------------------------------------
6.3 TAGS (OPTIONAL RESOURCE)
----------------------------------------

Initially, tags remain embedded in Entry objects.  
Later versions may add dedicated endpoints:

GET /tags  
List all tags used by the user (for autocomplete, analytics).

GET /notebooks/{id}/tags  
List tags used in a specific notebook.

DELETE /entries/{entryId}/tags/{tagId}  
Remove a tag from an entry.

----------------------------------------
6.4 ATTACHMENTS (FILES)
----------------------------------------

Supports image uploads or other files (PDFs, etc.).

POST /entries/{entryId}/attachments  
Content-Type: multipart/form-data

form fields:
- file
- type (image, pdf, etc.)

Response includes:
- id
- type
- storage mode (inline, file, remote)
- url or data
- metadata such as filename, size, MIME type

Attachment storage strategies:
1. Direct upload to backend.
2. Upload via signed URL (S3-style).
3. Hybrid storage (local filesystem → CDN → hot storage).

------------------------------------------------------------------------
7. SEARCH ENDPOINT
------------------------------------------------------------------------

Server-level search enables more advanced and efficient filtering:

GET /search/entries

Query parameters:
- q (full text)
- tag
- notebookId
- date ranges

Response includes an array of:
- entry (full entry object)
- score (optional relevance ranking)

------------------------------------------------------------------------
8. SYNC & OFFLINE CONSIDERATIONS
------------------------------------------------------------------------

Because the current frontend stores everything locally, the API should support:

1. Fetch entries updated after a certain timestamp:

       GET /entries?updatedAfter=2025-01-01T00:00:00Z

2. Conflict handling based on updatedAt timestamps.
3. Full export for backup.
4. Background sync for mobile or offline-first usage.

------------------------------------------------------------------------
9. FRONTEND MAPPING VIA journalService
------------------------------------------------------------------------

The frontend currently talks to journalService, not directly to storage.  
This abstraction allows a smooth transition to a remote backend.

Suggested API mapping:

journalService method       → API call
------------------------------------------------
loadAll()                   → GET /entries
saveEntry()                 → POST or PATCH /entries/{id}
deleteEntry()               → DELETE /entries/{id}
search(query)               → GET /search/entries?q=
loadNotebooks()             → GET /notebooks
createNotebook()            → POST /notebooks
uploadAttachment()          → POST /entries/{id}/attachments

Because of this mapping, the frontend does not need to be rewritten when a backend is introduced.

------------------------------------------------------------------------
10. VERSIONING & EVOLUTION
------------------------------------------------------------------------

- This file: API Sketch v0.1
- First real backend release: API v1
- Breaking changes require API v2
- Non-breaking additions remain in v1

The API should evolve alongside DATA_MODEL.md and ARCHITECTURE.md.

------------------------------------------------------------------------
END OF FILE
------------------------------------------------------------------------
