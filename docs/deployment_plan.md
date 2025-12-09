# Deployment Plan (v0.1)

This document outlines how the Journal App will be deployed as it evolves from a frontend-only prototype to a secure, scalable, full-stack application. The goal is to ensure every future feature (search, sync, attachments, authentication, mobile app support) has a stable and predictable deployment path.

This plan is divided into phases, starting from the simplest working setup and ending with a production-grade architecture.

------------------------------------------------------------------------
1. DEPLOYMENT GOALS
------------------------------------------------------------------------

The deployment approach should:

1. Support a static frontend (now) and a backend API (future).
2. Provide secure HTTPS, authentication, and safe file handling.
3. Allow the app to run on multiple devices (web + mobile).
4. Scale gracefully without significant redesign.
5. Minimize complexity at early stages while enabling growth later.
6. Ensure reliability, backups, and data durability.

------------------------------------------------------------------------
2. PHASE 1 — FRONTEND-ONLY DEPLOYMENT (CURRENT)
------------------------------------------------------------------------

At this phase, the app is:
- static HTML / CSS / JS
- localStorage as the only storage layer
- no backend
- no authentication

Deployment options:

Option A: GitHub Pages  
Option B: Netlify  
Option C: Vercel  

Recommended: **Netlify** or **Vercel** because both support:
- drag-and-drop deployments
- instant HTTPS
- URL rewrites later (useful when API arrives)

Directory layout:

frontend/
  public/
    index.html
    assets/
  src/
    app.js
    styles.css

Build/deploy steps (if using bundler later):
- Install dependencies
- Run build
- Upload build output to Netlify/Vercel

Advantages:
- Simple
- Free
- Fast iteration
- No server cost

Limitations:
- No sync
- No search API
- No user accounts
- No attachment storage beyond base64 in localStorage

------------------------------------------------------------------------
3. PHASE 2 — INTRODUCING A BACKEND (NEAR FUTURE)
------------------------------------------------------------------------

Once the backend exists, deployment becomes two-fold:

Frontend → static hosting  
Backend → containerized service or serverless API

Backend responsibilities:
- User authentication
- Entries, tags, notebooks
- Attachments (image uploads)
- Search endpoint
- Sync support
- Data validation

Recommended backend stack:
- Python (FastAPI) OR Node (Express / NestJS)
- PostgreSQL database
- Object storage for attachments (S3 or similar)
- Reverse proxy with SSL termination

Deployment options:

Option A: Railway  
Option B: Fly.io  
Option C: Render  
Option D: AWS (more complex, highest control)

Recommended: **Railway or Fly.io** for simplicity + power.

Backend deploy flow:
- Dockerfile builds the app
- Railway/Fly deploys the container
- Automatic HTTPS and routing through their proxy layer
- Environment variables stored securely on the platform

Key environment variables:
- DATABASE_URL
- JWT_SECRET
- REFRESH_TOKEN_SECRET
- STORAGE_BUCKET or STORAGE_PATH
- API_BASE_URL

------------------------------------------------------------------------
4. PHASE 3 — ADDING A DATABASE
------------------------------------------------------------------------

Data should not remain in localStorage once sync is introduced.

Suggested database: **PostgreSQL**

Hosted PostgreSQL options:
- Supabase (managed Postgres + auth + storage)
- Railway Postgres
- Render Postgres
- AWS RDS (advanced)

Schema includes:
- users
- notebooks
- entries
- tags
- attachments
- sessions
- migrations

Migration tool:
- Alembic (Python/FastAPI)
- Prisma (Node)
- Flyway or Liquibase (language-independent)

Deployment details:
- Database sits behind a private network if possible
- Never exposed to the internet
- Automatic daily backups enabled
- PITR (Point-in-Time Recovery) optional but recommended

------------------------------------------------------------------------
5. PHASE 4 — ATTACHMENT STORAGE
------------------------------------------------------------------------

Key need: store images securely and privately.

Recommended: **object storage**
- AWS S3
- DigitalOcean Spaces
- Supabase Storage
- MinIO (self-hosted)

The backend generates:
- signed URLs for uploads
- signed URLs for controlled downloads

Benefits:
- Large images no longer stored inline
- Client uploads directly to the storage provider
- Backend remains unaware of file content, improves security

------------------------------------------------------------------------
6. PHASE 5 — DOMAIN, DNS, AND HTTPS
------------------------------------------------------------------------

A custom domain provides professionalism and stability.

Domain examples:
- journal.keithwallace.com
- keithjournal.app
- podiumjournal.app
- mindhub.app (generic option)

DNS steps:

1. Purchase domain (Google Domains, Namecheap, Cloudflare)
2. Point the root domain or subdomain to:
   - Vercel/Netlify (frontend)
   - Fly.io/Railway (backend)

HTTPS:
- Automatically provided by Vercel/Netlify/Railway/Fly
- No need to manually manage certificates
- HSTS recommended
- Redirect all HTTP to HTTPS

------------------------------------------------------------------------
7. PHASE 6 — FULL STACK API + FRONTEND INTEGRATION
------------------------------------------------------------------------

Frontend now uses:

journalService_remote.js →
  fetches data from backend API instead of localStorage.

Config file or environment variables to switch modes:

ENVIRONMENT=production
API_BASE_URL=https://api.journalhub.app/api/v1

Frontend bundler (Vite recommended) injects the correct values at build time.

------------------------------------------------------------------------
8. PHASE 7 — BACKUPS, LOGGING, MONITORING
------------------------------------------------------------------------

Required when real user data is stored.

Backups:
- Daily DB backups
- Weekly retention
- Test restoration quarterly
- Attachment storage versioning enabled if provider supports it

Logging:
- Structured JSON logs
- Never include journal content
- Never log passwords/tokens

Monitoring:
- Uptime monitoring (UptimeRobot, BetterStack)
- Error alerting (Sentry)
- Performance monitoring (APM optional)

------------------------------------------------------------------------
9. PHASE 8 — OPTIONAL PRODUCTION HARDENING
------------------------------------------------------------------------

When traffic grows:

1. Rate limiting on auth routes
2. Web Application Firewall (WAF)
3. Database connection pooling
4. Automatic horizontal scaling
5. CDN for frontend assets
6. API caching for read-heavy endpoints
7. Background jobs for slow tasks (image processing, OCR, etc.)

------------------------------------------------------------------------
10. PHASE 9 — MOBILE APP SUPPORT
------------------------------------------------------------------------

The API will already support mobile clients.

Mobile build options:
- React Native + Expo
- Flutter
- Native Swift/Kotlin (higher cost)

Mobile app uses the same API endpoints:
- Login
- Sync entries
- Upload attachments
- Offline mode with background sync

------------------------------------------------------------------------
11. DEPLOYMENT GLOSSARY
------------------------------------------------------------------------

Static hosting:
- Serves HTML/CSS/JS without needing a server.

Reverse proxy:
- Handles routing and SSL termination (e.g., Nginx, platform proxy).

Object storage:
- System for storing binary files without a traditional filesystem.

Container:
- Self-contained environment for running backend code consistently.

Migration:
- Versioned database schema changes.

------------------------------------------------------------------------
12. DEPLOYMENT ROADMAP SUMMARY
------------------------------------------------------------------------

Phase 1: Static frontend deployed  
Phase 2: Backend container deployed  
Phase 3: Database introduced  
Phase 4: Image storage introduced  
Phase 5: Custom domain + HTTPS  
Phase 6: Frontend ↔ Backend integration  
Phase 7: Backups, logs, and monitoring  
Phase 8: Hardening and scaling  
Phase 9: Mobile app support  

Update this file as each phase becomes reality.

------------------------------------------------------------------------
End of File
------------------------------------------------------------------------
