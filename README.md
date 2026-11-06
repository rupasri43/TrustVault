# TrustVault
### Secure Document Sharing with a Verifiable Audit Trail

TrustVault is a secure document-sharing platform designed to protect confidential files through authenticated access, document-level permissions, and tamper-evident audit records.

Developed for the **Snovasys Fresher Hiring Challenge 2026**.

## Overview

TrustVault provides a centralized platform where users can upload, manage, and securely share documents. It uses role-based access control to manage user permissions and maintains a hash-linked audit trail to record important security and document-related activities.

## Key Features

- **Secure Authentication:** User registration, login, and logout.
- **Role-Based Access Control:** Administrator, document owner, and viewer roles.
- **Document Management:** Upload, view, update, and manage documents.
- **Document Sharing:** Grant and revoke document-level permissions.
- **Access Control:** Restrict access based on document ownership and granted permissions.
- **Secure File Storage:** Store uploaded documents in a private backend directory.
- **Audit Trail:** Record important user and document activities.
- **Hash-Linked Audit Records:** Use SHA-256 hashing to link audit entries and help detect tampering.
- **Administration Dashboard:** Manage users and view document statistics and audit activity.

## Technology Stack

### Frontend
- React
- TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS
- Vite

### Backend
- Python
- Flask
- Flask-WTF
- SQLite
- Werkzeug

## System Architecture

```text
                 TRUSTVAULT
                     |
          +----------+----------+
          |                     |
     Frontend                Backend
   React + TypeScript        Flask API
          |                     |
          |       HTTP          |
          +---------------------+
                                |
                     +----------+----------+
                     |                     |
                  SQLite              Private File
                  Database             Storage
                     |
                 Audit Logs
                SHA-256 Chain
```

## Project Structure

```text
TrustVault/
│
├── backend/
│   ├── app.py
│   ├── auth.py
│   ├── admin.py
│   ├── documents.py
│   ├── schema.sql
│   ├── init_db.py
│   └── private_uploads/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── documentation/
├── tests/
├── requirements.txt
├── .gitignore
└── README.md
```

## Installation and Setup

### Prerequisites

- Python 3
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/rupasri43/TrustVault.git
cd TrustVault
```

### 2. Set up the backend

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```powershell
.\venv\Scripts\Activate.ps1
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Set the Flask secret key:

```powershell
$env:TRUSTVAULT_SECRET_KEY = (python -c "import secrets; print(secrets.token_hex(32))")
```

Start the backend:

```bash
python backend/app.py
```

### 3. Set up the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local development URL displayed in the terminal.

## Security Measures

- Authenticated user sessions
- Password hashing
- Role-based authorization
- Document ownership verification
- CSRF protection
- Private file storage
- Document-level permission checks
- SHA-256 hash-linked audit records

## Project Status

Under active development.

Implemented functionality includes authentication, document management, role-based access, permission granting and revocation, administration features, and audit logging.

Download integration and production deployment are being finalized.

## Future Enhancements

- Expiring document permissions
- Advanced document activity monitoring
- Improved audit verification tools
- Production deployment with persistent storage
- Additional security testing

## Challenge

**Snovasys Fresher Hiring Challenge 2026**

Built with a focus on secure document sharing, access control, and accountability.