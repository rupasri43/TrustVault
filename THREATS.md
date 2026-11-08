# TrustVault — Threat Model and Security Notes

## 1. Purpose

TrustVault is a document-sharing application designed to protect confidential files through authenticated access, role-based authorization, document-level permissions, private file storage, and an auditable activity history.

This document describes the security controls implemented in the project and the limitations that remain. It does not claim that the application is immune to all attacks.

## 2. Assets to Protect

- User account information and password hashes.
- Uploaded documents and their stored files.
- Document ownership and sharing permissions.
- User sessions and authentication state.
- Audit records describing access and administrative actions.
- Application secrets and database contents.

## 3. Threats and Implemented Controls

| Threat | Implemented control |
|---|---|
| Unauthenticated access to protected APIs | Login-required middleware checks the authenticated session. |
| Unauthorized role access | Backend role checks restrict administrative and owner-only operations. |
| Access to another user's documents | Document ownership and explicit document permissions are checked by backend routes. |
| Unauthorized downloads | The download endpoint checks document access before sending the stored file. |
| Unauthorized permission changes | Sharing and revocation operations are restricted to document owners. |
| Malicious or unexpected uploads | Upload size, filename extension, and file signature checks are applied. |
| Exposure of uploaded files through a public static directory | Uploaded files are stored in a private server-side directory and served through an authorized download route. |
| SQL injection | Database operations use parameterized SQLite queries. |
| Cross-site request forgery | Flask-WTF CSRF protection is enabled; the frontend obtains a CSRF token through the API. |
| Session misuse | Session cookies use HttpOnly and SameSite=Lax settings. The authenticated user is reloaded from the database on protected requests. |
| Undetected modification of audit entries | Audit records are linked using SHA-256 hashes and previous-entry hashes. A verification endpoint checks the chain. |

## 4. Access Control Model

TrustVault uses the following application roles:

- **Administrator:** Can access administrative functionality.
- **Owner:** Can upload and manage owned documents and control sharing permissions.
- **Viewer:** Can access documents explicitly shared with that account, subject to the granted permission.

Document permissions distinguish read access from edit access. The current database representation maps both viewing and downloading to read permission; it does not maintain separate view-only and download-only permissions.

Document listing is restricted to documents owned by the authenticated user or shared with that user. Detail and download operations also perform backend access checks.

The document category is descriptive metadata. A category named `public` does not automatically make a document accessible to every user.

## 5. File Handling

- Maximum upload size is configured as 10 MB.
- Uploaded files are stored in the backend's private upload directory.
- The application validates file extensions and file signatures.
- Downloads are delivered through an authenticated API route after access checks.

The current implementation uses local filesystem storage. A production deployment must provide persistent, access-controlled storage and appropriate backup and recovery procedures.

## 6. Audit Trail

TrustVault records security-relevant actions, including authentication and document-sharing activity.

Each audit entry contains a hash and a reference to the preceding entry. The verifier checks the entry hashes and chain links.

The project includes compatibility verification for entries written using the earlier and later audit payload formats. A direct verification run during development reported 103 entries checked successfully.

**Important limitation:** A hash chain stored only in the same database does not prevent a sufficiently privileged attacker from rewriting the database and recalculating the entire chain. Stronger tamper evidence would require an independently protected signing key, external log storage, or periodic external anchoring.

The audit verification API and the audit dashboard should be treated separately: successful direct chain verification does not by itself prove that the dashboard displays the result correctly. The dashboard's tamper-status display has not been conclusively validated.

## 7. Known Limitations and Residual Risks

- Session cookies are configured with `Secure=False` for local HTTP development. HTTPS and secure cookies are required for production.
- The application uses SQLite and local file storage; production persistence, backups, and recovery need to be configured.
- The audit chain has no independent external anchor.
- The database does not currently support permission expiry.
- Read permission covers both viewing and downloading; separate download-only restrictions are not implemented.
- The current user administration API supports role changes; the user status shown by the interface is not a fully implemented account-suspension control.
- The storage-usage statistic is not currently a measured storage total.
- Rate limiting, account lockout, multi-factor authentication, and password recovery have not been established as implemented controls in the reviewed project.
- Local development settings such as Flask debug mode must not be used in production.

## 8. Verification Status

The project includes automated security tests in `tests/test_security.py`. During development, the command below completed with seven passing tests:

```powershell
python -m pytest tests/test_security.py -v
```

This result confirms that the tests passed at that point in development. It does not establish coverage of every threat listed above.

## 9. Responsible Use

TrustVault is a project implementation and should not be treated as a fully audited production document-management platform. Before production use, configure HTTPS, persistent storage, backups, independent audit protection, operational monitoring, and a broader security test suite.