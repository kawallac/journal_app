# Backend Blueprint (v0.1)

This document translates the high-level API sketch and data model into a concrete backend design.

It covers:
- Tech stack assumptions
- Directory and module layout
- Entity → database schema mapping
- Route structure and request/response handling
- Authentication and authorization flow
- Error handling and validation
- Testing strategy

This is a blueprint, not an implementation — but it should be detailed enough that future-you (or future-us) can sit down and start coding without rethinking architecture.

------------------------------------------------------------------------
1. TECH STACK ASSUMPTIONS
------------------------------------------------------------------------

Language:
- Python (3.11+)

Framework:
- FastAPI (for HTTP API)

Database:
- PostgreSQL

ORM:
- SQLAlchemy (with or without SQLModel or Pydantic models layered on top)

Migrations:
- Alembic

Authentication:
- JWT access tokens (short-lived)
- Optional refresh tokens

Containerization:
- Docker file for backend
- Docker Compose for local dev (backend + Postgres)

Deployment:
- Railway / Fly.io / Render / similar

------------------------------------------------------------------------
2. DIRECTORY STRUCTURE (BACKEND)
------------------------------------------------------------------------

Location:

  backend/

Proposed layout:

  backend/
    app/
      api/
        v1/
          auth.py
          entries.py
          notebooks.py
          attachments.py
          search.py
      core/
        config.py        (settings, environment variables)
        security.py      (hashing, JWT, token utilities)
        errors.py        (centralized exception types)
        logging.py       (logging setup)
      models/
        user.py
        notebook.py
        entry.py
        tag.py
        attachment.py
        base.py          (Base model + metadata)
      schemas/
        auth.py          (request/response schemas)
        user.py
        notebook.py
        entry.py
        attachment.py
        common.py        (shared paginated responses, etc.)
      services/
        auth_service.py
        entry_service.py
        notebook_service.py
        attachment_service.py
        search_service.py
      db/
        session.py       (SessionLocal, engine)
        migrations/      (Alembic files)
      main.py            (FastAPI app factory)
    tests/
      api/
      services/
      models/

    pyproject.toml or requirements.txt
    alembic.ini
    Dockerfile

------------------------------------------------------------------------
3. DATA MODEL → DATABASE SCHEMA
------------------------------------------------------------------------

Entities from DATA_MODEL.md:

- User
- Notebook
- Entry
- Tag
- Attachment

Mappings (simplified):

User table:
- id (UUID or bigint)
- email (unique)
- password_hash
- name
- created_at
- updated_at
- settings (JSONB, optional)

Notebook table:
- id (UUID or bigint)
- user_id (FK to users.id)
- name
- icon
- color
- sort_order (int)
- created_at
- updated_at

Entry table:
- id (UUID or bigint)
- user_id (FK to users.id)
- notebook_id (FK to notebooks.id)
- date (date)
- title (text)
- body (text)
- created_at (timestamp)
- updated_at (timestamp)

Tag table:
- id (UUID or bigint)
- entry_id (FK to entries.id)
- text (text)
- color (varchar)
- x (numeric or float)
- y (numeric or float)

Attachment table:
- id (UUID or bigint)
- entry_id (FK to entries.id)
- type (varchar)        e.g. "image", "pdf"
- storage (varchar)     e.g. "inline", "remote"
- url (text, nullable)  remote URL when storage = "remote"
- data (bytea, nullable) inline binary (for early phase, might be avoided later)
- filename (text)
- mime_type (text)
- size_bytes (bigint)
- created_at (timestamp)

Notes:
- Prefer remote storage for attachments long-term; inline data in DB is primarily for prototyping.
- Using JSONB for user settings allows flexible per-user configuration without schema changes.

------------------------------------------------------------------------
4. CONFIGURATION & SETTINGS
------------------------------------------------------------------------

Config module (app/core/config.py) handles environment-based settings:

Examples:
- DATABASE_URL
- JWT_SECRET_KEY
- JWT_ALGORITHM
- ACCESS_TOKEN_EXPIRE_MINUTES
- REFRESH_TOKEN_EXPIRE_DAYS
- STORAGE_BUCKET_URL or STORAGE_BACKEND
- ENVIRONMENT (dev / staging / prod)

Use Pydantic (BaseSettings) or similar to map environment variables to strongly-typed config objects.

------------------------------------------------------------------------
5. AUTHENTICATION & AUTHORIZATION FLOW
------------------------------------------------------------------------

Auth responsibilities:
- User registration
- Login
- Token issuance (access + optional refresh)
- Me endpoint
- Future: session tracking across devices

Flow:

1. Registration:
   - POST /auth/register
   - Validate email/password
   - Hash password using a secure KDF (Argon2id recommended)
   - Insert new user
   - Issue tokens

2. Login:
   - POST /auth/login
   - Validate credentials
   - Compare hashed password
   - Issue tokens

3. Access token:
   - Short-lived (e.g., 15–60 minutes)
   - Encodes user id and basic claims (no sensitive data)
   - Used in Authorization header (Bearer)

4. Refresh token (optional phase):
   - Long-lived
   - Stored securely server-side (with rotation)
   - Used at /auth/refresh to get new access token

5. Me endpoint:
   - GET /auth/me
   - Uses token to identify user
   - Returns user id, email, name, and settings (not password)

Authorization:
- All entry/notebook/attachment endpoints verify user id from token and ensure resources belong to that user.
- No cross-user data leakage.

------------------------------------------------------------------------
6. ROUTES & HANDLER RESPONSIBILITIES
------------------------------------------------------------------------

Modules under app/api/v1/:

auth.py
- POST /auth/register
- POST /auth/login
- POST /auth/refresh (later)
- GET /auth/me

notebooks.py
- GET /notebooks
- POST /notebooks
- GET /notebooks/{id}
- PATCH /notebooks/{id}
- DELETE /notebooks/{id}

entries.py
- GET /entries
- POST /entries
- GET /entries/{id}
- PATCH /entries/{id}
- DELETE /entries/{id}

attachments.py
- POST /entries/{entry_id}/attachments
- GET /attachments/{id} (optional if using signed URLs)
- DELETE /attachments/{id}

search.py
- GET /search/entries

Each route module:
- Parses and validates HTTP requests using Pydantic schemas from app/schemas.
- Calls into services in app/services.
- Returns response DTOs (Pydantic models) defined in app/schemas.

------------------------------------------------------------------------
7. SERVICES / BUSINESS LOGIC
------------------------------------------------------------------------

Services contain most of the “behavior” logic and stay free of HTTP-specific details.

auth_service.py
- register_user(email, password, name)
- authenticate_user(email, password)
- create_access_token(user)
- (optional) create_refresh_token(user)
- get_user_from_token(token)

notebook_service.py
- list_notebooks(user_id)
- create_notebook(user_id, data)
- get_notebook(user_id, notebook_id)
- update_notebook(user_id, notebook_id, data)
- delete_notebook(user_id, notebook_id)

entry_service.py
- list_entries(user_id, filters)
- create_entry(user_id, data)
- get_entry(user_id, entry_id)
- update_entry(user_id, entry_id, data)
- delete_entry(user_id, entry_id)

attachment_service.py
- add_attachment(user_id, entry_id, file_metadata)
- generate_upload_url(user_id, entry_id, file_metadata) (future, S3-style)
- delete_attachment(user_id, attachment_id)

search_service.py
- search_entries(user_id, query, filters)

Key principles:
- services know about DB models and domain logic
- API handlers know about HTTP and schemas
- models know about persistence only

------------------------------------------------------------------------
8. SCHEMAS (REQUEST / RESPONSE)
------------------------------------------------------------------------

Use Pydantic schemas for validation and response shaping.

Examples (conceptual, not code):

auth schemas:
- RegisterRequest: email, password, name
- LoginRequest: email, password
- AuthResponse: user (UserSchema), accessToken, refreshToken (optional)

user schemas:
- UserSchema: id, email, name, settings

notebook schemas:
- NotebookCreate: name, icon, color
- NotebookUpdate: partial fields
- NotebookResponse: id, userId, name, icon, color, sortOrder, timestamps

entry schemas:
- EntryCreate: notebookId, date, title, body, tags[]
- EntryUpdate: partial fields
- EntryResponse: id, notebookId, date, title, body, attachments[], tags[], timestamps

attachment schemas:
- AttachmentResponse: id, type, storage, url, filename, mimeType, sizeBytes, createdAt

Shared:
- PaginatedList: items[], total, limit, offset

All schemas should match and evolve alongside DATA_MODEL.md and API_SKETCH.md.

------------------------------------------------------------------------
9. ERROR HANDLING STRATEGY
------------------------------------------------------------------------

Centralized errors in app/core/errors.py:

Example logical exceptions:
- AuthenticationError
- AuthorizationError
- ValidationError (domain level)
- NotFoundError (EntryNotFound, NotebookNotFound)
- ConflictError (optional)

FastAPI exception handlers map these to HTTP responses:
- AuthenticationError → 401
- AuthorizationError → 403
- NotFoundError → 404
- ValidationError (domain) → 400
- Internal errors → 500

Error body format:
- code: machine-readable short code (e.g., ENTRY_NOT_FOUND)
- message: human-friendly message
- details: optional extra info (rarely needed)

------------------------------------------------------------------------
10. SECURITY IMPLEMENTATION DETAILS
------------------------------------------------------------------------

Security details (aligns with SECURITY_NOTES.md):

Password storage:
- Use Argon2id or bcrypt via a dedicated library
- Never store plaintext passwords

JWT:
- Use strong secret key, stored in environment
- Short expiration for access tokens
- Minimal payload (user id, issuedAt, expiresAt)

CORS:
- Allow frontend origin(s) explicitly
- Deny others by default

Rate limiting (future):
- Especially on /auth/login and /auth/register

Attachment safety:
- Validate content type
- Enforce size limits
- Prefer external object storage with signed URLs

------------------------------------------------------------------------
11. TESTING STRATEGY
------------------------------------------------------------------------

Types of tests:

Unit tests:
- services: ensure business logic is correct
- models: ensure relationships and constraints work as expected

Integration tests:
- API endpoints using a test client (FastAPI TestClient)
- Temporary test database (SQLite or ephemeral Postgres)

End-to-end (optional later):
- Spin up backend + test DB inside Docker
- Run API-level tests simulating real usage

Minimum test coverage:
- Authentication flows
- Entry CRUD
- Notebook CRUD
- Ownership/authorization boundaries
- Basic search behavior

------------------------------------------------------------------------
12. MIGRATION & EVOLUTION
------------------------------------------------------------------------

Initial versions:
- Basic auth, notebooks, entries, tags, attachments
- All modeled as above

Later changes may include:
- Extra fields (e.g., entry pinning, task status)
- New entities (tasks, projects, links between entries)
- End-to-end encryption (client-side)
- Sync metadata (per-device state)

Each change should:
- Update DATA_MODEL.md
- Update API_SKETCH.md
- Update ARCHITECTURE.md
- Potentially bump API version if breaking

------------------------------------------------------------------------
13. IMPLEMENTATION ROADMAP
------------------------------------------------------------------------

Step-by-step backend build plan:

1) Initialize backend project:
   - Set up FastAPI project
   - Add config, logging, DB connection (SQLAlchemy + Postgres)
   - Create base model and Alembic migrations

2) Implement core models:
   - User
   - Notebook
   - Entry
   - Tag
   - Attachment

3) Implement authentication:
   - Register, login, me
   - Password hashing
   - JWT issuance and verification
   - Basic tests

4) Implement notebooks API:
   - CRUD
   - Ownership checks
   - Tests

5) Implement entries API:
   - CRUD
   - Filtering by notebook, date
   - Basic search in title/body/tags (simple LIKE queries to start)
   - Tests

6) Implement attachments API:
   - Attach file metadata
   - Later: integrate remote storage and signed URLs
   - Tests

7) Implement search API:
   - Wrap existing queries in /search/entries
   - Tests

8) Harden and refine:
   - Validation, rate limits (if needed)
   - Logging and error handling
   - Security checks from SECURITY_NOTES.md

------------------------------------------------------------------------
End of File
------------------------------------------------------------------------
