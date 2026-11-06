# TrustVault — Frontend
### Secure Document Sharing with a Verifiable Audit Trail

This directory contains the frontend application of **TrustVault**, a secure document-sharing platform developed for the Snovasys Fresher Hiring Challenge 2026.

The frontend provides an interface for authentication, document management, access permissions, and administrative activities.

## Technology Stack

- React 19
- TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS
- Vite
- Vitest
- Lucide React
- Sonner

## Features

- Login and user registration
- Dashboard with document overview
- Document upload and management
- Document details and access management
- Granting and revoking document permissions
- Audit activity interface
- Administration dashboard
- User directory and role management
- Responsive user interface

## Project Structure

```text
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   └── tv/
│   ├── lib/
│   ├── routes/
│   └── services/
│       └── api/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## Prerequisites

- Node.js
- npm
- Running TrustVault Flask backend

## Installation

From the frontend directory, install dependencies:

```bash
npm install
```

## Environment Configuration

Create a `.env.local` file in the frontend directory:

```env
VITE_API_BASE_URL=/api
VITE_USE_MOCKS=false
```

The development server uses the Vite proxy configured in `vite.config.ts` to forward API requests to the Flask backend at `http://127.0.0.1:5000`.

## Run the Development Server

```bash
npm run dev
```

Open the local URL displayed in the terminal.

## Production Build

Build the frontend:

```bash
npm run build
```

## Testing

Run frontend tests using:

```bash
npm run test
```

## Backend Integration

The frontend communicates with the Flask backend through REST API endpoints.

The backend handles:
- Authentication and user sessions
- Document upload and retrieval
- Document-level permissions
- File downloads
- Audit logging
- Administrative operations

## Project

**TrustVault — Secure Document Sharing with a Verifiable Audit Trail**

Developed for the Snovasys Fresher Hiring Challenge 2026.