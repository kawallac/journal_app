# Security Notes (v0.1)

This document outlines early security considerations for the Journal App.  
As the app evolves from a local-only prototype into a cloud-backed platform with authentication, storage, sync, and mobile clients, these principles ensure user data remains protected.

This is a living document. Update it whenever:
- authentication or user accounts are introduced  
- a backend is created  
- deployment architecture changes  
- mobile apps or multiple devices are supported  

------------------------------------------------------------------------
1. THREAT MODEL OVERVIEW
------------------------------------------------------------------------

The Journal App will store sensitive personal information:
- private thoughts  
- business ideas  
- plans and tasks  
- images of handwritten notes  
- tags that may represent contexts, projects, or confidential items  

A compromise of journal data is extremely high impact.  
Therefore, **security is a first-class design goal**.

Key threats:
1. Unauthorized access (stolen account, weak login, exposed tokens)
2. Leakage of journal content in transit (interception)
3. Leakage at rest (database breach, misconfigured storage)
4. Malware or malicious extensions scraping local data
5. Improper permission scoping in a multi-user system
6. Insecure file uploads or attachment handling
7. Accidental data exposure via logs, backups, or analytics
8. Poor encryption or key management

The goal of this document is to set safe defaults early.

------------------------------------------------------------------------
2. LOCAL STORAGE (CURRENT STATE)
------------------------------------------------------------------------

The current prototype uses:
- localStorage
- inline base64 attachments
- no authentication
- in-browser only access

Risks at this stage:
- Anyone with access to the browser profile can read data
- Browser extensions can read localStorage
- Image data (base64) grows large and is stored unencrypted
- No ability to encrypt data locally

Mitigations (later):
- Move to IndexedDB + crypto (WebCrypto API)
- Client-side encryption option for users who want “zero-knowledge” mode
- Introduce user authentication before syncing to backend

------------------------------------------------------------------------
3. AUTHENTICATION (FUTURE)
------------------------------------------------------------------------

Strong requirements from day one:

1. **No plaintext passwords stored anywhere**
   Always hash with a modern KDF:
   - Argon2id (**preferred**)
   - scrypt
   - bcrypt (acceptable fallback)

2. **Password policies**
   - Min 8–12 characters
   - Reject extremely common passwords
   - Encourage passphrase-style passwords

3. **Token-based auth**
   - Access tokens: short-lived (15–60 min)
   - Refresh tokens: long-lived but stored securely, server-rotateable
   - Tokens invalidated on logout or device removal

4. **Multi-device support**
   Track sessions by:
   - deviceId
   - lastUsedAt
   - ability to revoke individual sessions

5. **Optional MFA (later)**  
   - TOTP  
   - WebAuthn  

Users always control:
- active sessions  
- authorized devices  
- revocation of tokens  

------------------------------------------------------------------------
4. TRANSPORT SECURITY
------------------------------------------------------------------------

All network communications must use:
- HTTPS (TLS 1.2+)
- HSTS enabled
- TLS certificates from a trusted CA (e.g., Let’s Encrypt)

Absolutely NO:
- HTTP endpoints  
- Mixed-content requests  
- Unencrypted WebSockets  

------------------------------------------------------------------------
5. API SECURITY
------------------------------------------------------------------------

API endpoints must enforce:

1. **Authentication required** except for registration/login.
2. **Authorization checks**:
   - Users may only access their own notebooks, entries, tags, attachments.
   - No multi-tenant leakage.
3. **Rate limiting**:
   - Protect auth endpoints from brute force attacks.
   - Prevent scraping or enumeration.
4. **Input validation**:
   - Sanitize all string fields.
   - Enforce size limits for uploads.
   - Reject malformed JSON.
5. **Output constraints**:
   - Never return sensitive internals (hashes, internal IDs, debugging messages).

------------------------------------------------------------------------
6. ATTACHMENT SECURITY
------------------------------------------------------------------------

Attachments (photos of journal pages, PDFs, files) require special handling.

Rules:

1. **No arbitrary file execution**
   Uploaded files must:
   - be validated by MIME type
   - be scanned (ClamAV or equivalent, if backend supports it)
   - be stored as immutable blobs

2. **Never store executable files**
   Allowed types:
   - image jpeg/png/webp
   - pdf
   - text/plain  
   Reject everything else unless explicitly added.

3. **URL-based access**
   Attachments served via:
   - signed URLs (time-limited)
   - authenticated endpoints

Public URLs should never expose private images.

------------------------------------------------------------------------
7. DATA AT REST
------------------------------------------------------------------------

When a backend is introduced, all sensitive data at rest must be encrypted.

Layers:

1. **Database encryption**
   - Encrypt database volume (Postgres, etc.)
   - Encrypt attachments on disk or require encrypted object storage

2. **Application-level encryption (optional)**
   - Client-side (“zero-knowledge”) encryption for users who want absolute privacy
   - Would require storing only ciphertext server-side
   - Keys never reach the server

3. **Key management**
   - Encryption keys stored in an HSM or managed secrets vault
   - Keys rotated annually or after compromise

------------------------------------------------------------------------
8. LOGGING & MONITORING
------------------------------------------------------------------------

Rules:

1. **Logs must never contain:**
   - passwords  
   - access tokens  
   - refresh tokens  
   - journal text  
   - images or attachments  
   - tags or titles  

2. **Audit trails**
   Track:
   - login attempts  
   - password resets  
   - session creation/removal  
   - notebook/entry creation/deletion (metadata only, never content)  

3. **Intrusion detection**
   - Rate limit suspicious IPs
   - Alerts on repeated failures
   - Alerts on unusual access patterns

------------------------------------------------------------------------
9. DEPLOYMENT SECURITY (FUTURE)
------------------------------------------------------------------------

Requirements:

1. **Secrets management**
   Use environment variables managed by:
   - Kubernetes Secrets
   - Docker secrets
   - AWS Secrets Manager
   - Vault by HashiCorp

   Never check secrets into source control.

2. **CI/CD integrity**
   - Protected branches
   - Code signing optional
   - Automated testing before deploy

3. **Network segmentation**
   - API server not publicly reachable except on defined ports
   - Database not exposed to the public internet
   - Attachment storage via restricted bucket policies

4. **Backups**
   - Encrypted
   - Rotated
   - Test restores regularly

------------------------------------------------------------------------
10. FRONTEND SECURITY
------------------------------------------------------------------------

Browser risks include malicious extensions, XSS, and clickjacking.

Mitigations:

1. **Content Security Policy (CSP)**
   - Restrict script sources
   - Block inline scripts if possible

2. **Escape all user-generated content**
   Even though entries are private, sanitize:
   - titles
   - body text
   - tags

3. **Disable dangerous HTML**
   No rich-text HTML injection unless a sanitizer is used.

4. **Clickjacking protection**
   - X-Frame-Options: DENY

------------------------------------------------------------------------
11. FUTURE: END-TO-END ENCRYPTION OPTION
------------------------------------------------------------------------

Some users may want a “true private journal” experience.

Design direction:

- All content (entries, tags, attachments) encrypted client-side  
- Server stores ciphertext only  
- Keys derived from passphrase using Argon2  
- Zero trust: server cannot read user journals  

This requires architectural decisions now so the transition is possible later.

------------------------------------------------------------------------
12. SECURITY ROADMAP
------------------------------------------------------------------------

Phase 1 (Now)
- Document security assumptions
- Clean data model and architecture (done)
- Avoid design choices that block encryption later

Phase 2 (Before Backend)
- Authentication design
- Token handling
- Role and permission model
- Attachment safety

Phase 3 (Backend MVP)
- Secure API routing
- Storage encryption
- Logging and audit rules

Phase 4 (Advanced)
- Device-level session management
- Optional end-to-end encryption
- Mobile secure storage integration
- Differential sync with conflict resolution

------------------------------------------------------------------------
End of File
------------------------------------------------------------------------
