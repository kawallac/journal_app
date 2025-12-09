# Project Structure (v0.1)

This document defines the recommended directory layout for the Journal App project.

The goal is to:
- Keep frontend, backend, documentation, and infrastructure clearly separated.
- Make it easy to grow from a single-page prototype into a full product.
- Maintain clean, readable, and traceable code over time.

This is a living document and should be updated as the project evolves.

------------------------------------------------------------------------
1. TOP-LEVEL LAYOUT
------------------------------------------------------------------------

Root structure (high-level):

/                 Project root
  frontend/       Web client (HTML, CSS, JS, eventually React/SPA)
  backend/        API server, business logic, persistence (future)
  docs/           Documentation (architecture, data model, security, etc.)
  infra/          Deployment and infrastructure configuration (future)
  scripts/        Utility scripts (dev, maintenance, tooling)
  .github/        GitHub workflows (CI/CD) (optional)
  .env.example    Example environment variables (never commit real secrets)
  README.md       High-level project overview
  LICENSE         License information (optional but recommended)

------------------------------------------------------------------------
2. FRONTEND
------------------------------------------------------------------------

Directory:

  frontend/

Purpose:

- Contains the browser-based web app.
- Starts as vanilla HTML/CSS/JS.
- Can later evolve into a structured SPA (e.g., React, Vue, etc.).

Recommended layout:

  frontend/
    public/
      index.html             Entry HTML (served directly)
      favicon.ico            App icon (optional)
      manifest.json          PWA manifest (future)
      assets/                Static assets (logos, images, fonts)

    src/
      app.js                 Main application logic
      styles.css             Main stylesheet
      services/
        journalService_local.js   Current localStorage implementation
        journalService_remote.js  Future API-based implementation (stub initially)
      adapters/
        storageAdapter_local.js   Local storage adapter (current)
        storageAdapter_indexeddb.js (future)
      components/            Reusable UI components (if/when introduced)
      utils/
        domHelpers.js        DOM manipulation helpers (if needed)
        dateHelpers.js       Date formatting, parsing, etc.

    tests/                   Frontend tests (unit/integration)
    package.json             Frontend dependencies (if using a build system)
    vite.config.js / webpack.config.js (future, if we adopt a bundler)

Notes:

- Initially, you may keep app.js and styles.css flat in src until complexity demands further structure.
- journalService_local and journalService_remote are intentionally separated so the app can switch storage modes later without rewriting UI code.
- The public/index.html should reference built or raw assets from src (depending on whether a bundler is used).

------------------------------------------------------------------------
3. BACKEND (FUTURE)
------------------------------------------------------------------------

Directory:

  backend/

Purpose:

- Hosts the API described in API_SKETCH.md.
- Handles authentication, persistence, search, and sync.

Suggested layout (language-agnostic, but friendly to Python/FastAPI or Node):

  backend/
    app/
      api/                  HTTP route handlers
        v1/
          auth.py           or auth.ts, auth.js
          entries.py
          notebooks.py
          attachments.py
          search.py
      core/                 Core application logic
        config.py           Config management (env vars)
        security.py         Security helpers (hashing, tokens)
        errors.py           Error types and handlers
      models/               Database models (ORM)
        user.py
        notebook.py
        entry.py
        attachment.py
        tag.py
      schemas/              Request/response validation
        auth.py
        entry.py
        notebook.py
        attachment.py
      services/             Business logic and domain services
        entry_service.py
        notebook_service.py
        search_service.py
      db/
        migrations/         Database migrations
        init.sql            Initial schema (if using SQL)
      main.py               Application entrypoint (e.g., FastAPI app, Express app)

    tests/
      api/
      services/
      models/

    requirements.txt or pyproject.toml   (Python)
    package.json                        (Node, if using JS/TS backend)
    Dockerfile                          Backend container definition (future)

Notes:

- API versioning is reflected in app/api/v1.
- Business logic is kept out of route handlers and placed in services for testability.
- Models and schemas mirror the shapes defined in DATA_MODEL.md and API_SKETCH.md.

------------------------------------------------------------------------
4. DOCS
------------------------------------------------------------------------

Directory:

  docs/

Purpose:

- Holds all project documentation in one place.
- Acts as the project’s internal “handbook” and reference.

Recommended files:

  docs/
    README.md               Index of documentation (links to other docs)
    DATA_MODEL.md           Entity definitions (User, Notebook, Entry, Tag, Attachment)
    ARCHITECTURE.md         High-level system architecture and data flow
    API_SKETCH.md           Proposed HTTP API design (versioned)
    SECURITY_NOTES.md       Security considerations and roadmap
    PROJECT_STRUCTURE.md    This file
    DEPLOYMENT_PLAN.md      Hosting and deployment strategy (future)
    BACKEND_BLUEPRINT.md    Backend-specific design based on the API sketch (future)
    UX_NOTES.md             UX and UI design principles (optional)
    ROADMAP.md              Feature roadmap and milestones (optional)

Notes:

- Update these docs when data shapes or architecture change.
- Keep them consistent: if DATA_MODEL.md changes, API_SKETCH.md and ARCHITECTURE.md may need updates.
- Treat docs like code: version-controlled, reviewed, and improved incrementally.

------------------------------------------------------------------------
5. INFRASTRUCTURE (FUTURE)
------------------------------------------------------------------------

Directory:

  infra/

Purpose:

- Capture deployment and infrastructure-as-code (IaC).

Possible contents:

  infra/
    docker/
      docker-compose.dev.yml      Local dev (frontend, backend, db)
      docker-compose.prod.yml     Production-orientated compose (if used)
    k8s/
      frontend-deployment.yaml
      backend-deployment.yaml
      ingress.yaml
    nginx/
      nginx.conf                  Reverse proxy config
    terraform/
      main.tf                     Cloud infrastructure (optional)
    certs/                        TLS cert references (not actual key files)

Notes:

- This layer ties the backend and frontend to real hosting environments.
- It should never contain secrets; it references them (env vars, secret stores) instead.

------------------------------------------------------------------------
6. SCRIPTS
------------------------------------------------------------------------

Directory:

  scripts/

Purpose:

- Reusable development and maintenance scripts.

Examples:

  scripts/
    dev_start.sh            Start dev environment (frontend, backend, db)
    db_migrate.sh           Run database migrations
    db_backup.sh            Backup production DB (or execute via CI/CD)
    lint_all.sh             Run linters on frontend and backend

Notes:

- Scripts should be idempotent and safe.
- They are allowed to assume a certain environment (local dev, CI, etc.) but should fail gracefully.

------------------------------------------------------------------------
7. GITHUB WORKFLOWS (OPTIONAL BUT RECOMMENDED)
------------------------------------------------------------------------

Directory:

  .github/workflows/

Purpose:

- Define CI/CD pipelines.

Examples:

  .github/
    workflows/
      frontend-ci.yml       Lint, test, build frontend
      backend-ci.yml        Lint, test backend
      deploy.yml            Deployment pipeline (when ready)

Notes:

- Workflows can run tests, enforce formatting, and build artifacts.
- Later, they can also trigger automatic deployments.

------------------------------------------------------------------------
8. CONFIGURATION & ENVIRONMENT
------------------------------------------------------------------------

Top-level files:

  .env.example          Example of required env vars (no secrets)
  .gitignore            Ignore build artifacts, env files, etc.
  README.md             High-level project description
  LICENSE               Project license (MIT, etc.)

Notes:

- Real .env files should not be committed.
- Backend and frontend can each have their own env files; document their keys in docs/DEPLOYMENT_PLAN.md.

------------------------------------------------------------------------
9. EVOLUTION STRATEGY
------------------------------------------------------------------------

Phase 1 (current)
- Simple frontend (index.html, app.js, styles.css).
- Local-only storage via localStorage.

Phase 2 (near future)
- Move frontend files into frontend/public and frontend/src.
- Introduce journalService_local wiring that matches journalService_remote interface.
- Continue building docs in docs/.

Phase 3
- Create backend skeleton under backend/.
- Implement minimal API (auth, entries, notebooks).
- Wire frontend to journalService_remote (feature-flag or config-based).

Phase 4
- Add infra/ for deployment (Docker, reverse proxy, SSL, etc.).
- Add CI/CD in .github/workflows.

Update this document as each phase is applied so structure and reality remain aligned.

------------------------------------------------------------------------
End of File
------------------------------------------------------------------------
