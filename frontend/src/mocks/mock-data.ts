/**
 * ⚠️ MOCK DATA — UI PREVIEW ONLY.
 * Fictional records used while the Flask backend is not connected.
 * Never import this from components; only src/services/api/* may use it when USE_MOCKS is true.
 */
import type { AdminStats, AuditEvent, DocumentDetail, Permission, User } from "@/services/api/types";

export const MOCK_USERS: User[] = [
  { id: "u1", name: "Anika Rao", email: "anika.rao@example.com", role: "administrator", status: "active", lastActive: "2026-11-01T14:52:00Z" },
  { id: "u2", name: "Daniel Okafor", email: "daniel.okafor@example.com", role: "owner", status: "active", lastActive: "2026-11-01T13:10:00Z" },
  { id: "u3", name: "Meera Iyer", email: "meera.iyer@example.com", role: "owner", status: "active", lastActive: "2026-10-31T18:40:00Z" },
  { id: "u4", name: "Lucas Brandt", email: "lucas.brandt@example.com", role: "viewer", status: "active", lastActive: "2026-11-01T09:05:00Z" },
  { id: "u5", name: "Sana Qureshi", email: "sana.qureshi@example.com", role: "viewer", status: "suspended", lastActive: "2026-10-22T11:00:00Z" },
];

export const MOCK_DOCUMENTS: DocumentDetail[] = [
  { id: "d1", title: "Q4 Board Financial Statement", fileName: "q4-board-financials.pdf", fileType: "PDF", sizeBytes: 2_480_000, classification: "restricted", ownerId: "u2", ownerName: "Daniel Okafor", updatedAt: "2026-11-01T12:30:00Z", createdAt: "2026-10-28T09:00:00Z", sharedWith: 3, sha256: "9f2c4e1ab7d03e58c6f1a2b49e7d0c3f5a8b6e2d1c4f7a9b0e3d6c8f1a2b4e7d", description: "Consolidated statements prepared for the November board meeting.", version: 3, expiresAt: "2026-12-31T23:59:00Z", tags: ["finance", "board"] },
  { id: "d2", title: "Vendor Master Services Agreement", fileName: "msa-northwind.docx", fileType: "DOCX", sizeBytes: 640_000, classification: "confidential", ownerId: "u2", ownerName: "Daniel Okafor", updatedAt: "2026-10-30T16:20:00Z", createdAt: "2026-10-12T10:00:00Z", sharedWith: 2, sha256: "1a7e3c9b5d2f8e4a6c0b1d3f5e7a9c2b4d6f8e0a1c3b5d7f9e2a4c6b8d0f1e3a", description: "Signed MSA with Northwind Logistics.", version: 1, expiresAt: null, tags: ["legal"] },
  { id: "d3", title: "Employee Onboarding Handbook", fileName: "onboarding-2026.pdf", fileType: "PDF", sizeBytes: 5_100_000, classification: "internal", ownerId: "u3", ownerName: "Meera Iyer", updatedAt: "2026-10-29T08:45:00Z", createdAt: "2026-09-01T08:00:00Z", sharedWith: 14, sha256: "c3b1e5d7f9a2c4e6b8d0f1a3c5e7b9d2f4a6c8e0b1d3f5a7c9e2b4d6f8a0c1e3", description: "Policies and first-week checklist for new hires.", version: 5, expiresAt: null, tags: ["hr"] },
  { id: "d4", title: "Penetration Test Report — Sept", fileName: "pentest-sept.pdf", fileType: "PDF", sizeBytes: 1_920_000, classification: "restricted", ownerId: "u3", ownerName: "Meera Iyer", updatedAt: "2026-10-25T19:00:00Z", createdAt: "2026-10-05T12:00:00Z", sharedWith: 1, sha256: "e8d6c4b2a0f9e7d5c3b1a9f8e6d4c2b0a8f7e5d3c1b9a7f6e4d2c0b8a6f5e3d1", description: "External assessment findings and remediation status.", version: 2, expiresAt: "2026-11-30T23:59:00Z", tags: ["security"] },
  { id: "d5", title: "Product Roadmap 2027", fileName: "roadmap-2027.xlsx", fileType: "XLSX", sizeBytes: 380_000, classification: "confidential", ownerId: "u2", ownerName: "Daniel Okafor", updatedAt: "2026-10-20T11:15:00Z", createdAt: "2026-10-01T11:00:00Z", sharedWith: 6, sha256: "5b3d1f9e7c5a3b1d9f7e5c3a1b9d7f5e3c1a9b7d5f3e1c9a7b5d3f1e9c7a5b3d", description: "Draft roadmap for leadership review.", version: 4, expiresAt: null, tags: ["product"] },
];

export const MOCK_PERMISSIONS: Permission[] = [
  { id: "p1", documentId: "d1", userId: "u4", userName: "Lucas Brandt", userEmail: "lucas.brandt@example.com", access: "view", grantedAt: "2026-10-29T10:00:00Z", expiresAt: "2026-11-15T00:00:00Z" },
  { id: "p2", documentId: "d1", userId: "u3", userName: "Meera Iyer", userEmail: "meera.iyer@example.com", access: "download", grantedAt: "2026-10-28T12:00:00Z", expiresAt: null },
  { id: "p3", documentId: "d1", userId: "u1", userName: "Anika Rao", userEmail: "anika.rao@example.com", access: "edit", grantedAt: "2026-10-28T09:10:00Z", expiresAt: null },
  { id: "p4", documentId: "d2", userId: "u4", userName: "Lucas Brandt", userEmail: "lucas.brandt@example.com", access: "view", grantedAt: "2026-10-15T09:00:00Z", expiresAt: null },
];

export const MOCK_AUDIT: AuditEvent[] = [
  { id: "a1", at: "2026-11-01T14:52:00Z", actorName: "Anika Rao", actorEmail: "anika.rao@example.com", action: "login", target: "Session", ip: "10.0.4.21", outcome: "success" },
  { id: "a2", at: "2026-11-01T14:31:00Z", actorName: "Lucas Brandt", actorEmail: "lucas.brandt@example.com", action: "download", target: "Q4 Board Financial Statement", ip: "10.0.7.88", outcome: "denied" },
  { id: "a3", at: "2026-11-01T13:12:00Z", actorName: "Daniel Okafor", actorEmail: "daniel.okafor@example.com", action: "share", target: "Q4 Board Financial Statement → Lucas Brandt", ip: "10.0.2.14", outcome: "success" },
  { id: "a4", at: "2026-11-01T12:30:00Z", actorName: "Daniel Okafor", actorEmail: "daniel.okafor@example.com", action: "upload", target: "Q4 Board Financial Statement v3", ip: "10.0.2.14", outcome: "success" },
  { id: "a5", at: "2026-11-01T09:05:00Z", actorName: "Lucas Brandt", actorEmail: "lucas.brandt@example.com", action: "view", target: "Vendor Master Services Agreement", ip: "10.0.7.88", outcome: "success" },
  { id: "a6", at: "2026-10-31T22:48:00Z", actorName: "unknown", actorEmail: "s.qureshi@example.com", action: "failed_login", target: "Session", ip: "203.0.113.42", outcome: "denied" },
  { id: "a7", at: "2026-10-31T18:40:00Z", actorName: "Meera Iyer", actorEmail: "meera.iyer@example.com", action: "revoke", target: "Pentest Report → Lucas Brandt", ip: "10.0.3.9", outcome: "success" },
  { id: "a8", at: "2026-10-31T10:02:00Z", actorName: "Anika Rao", actorEmail: "anika.rao@example.com", action: "role_change", target: "Sana Qureshi → suspended", ip: "10.0.4.21", outcome: "success" },
];

export const MOCK_ADMIN_STATS: AdminStats = {
  totalUsers: 5,
  totalDocuments: 5,
  activeShares: 26,
  deniedAttempts24h: 2,
  storageUsedBytes: 10_520_000,
};

export const mockDelay = <T,>(value: T, ms = 250) =>
  new Promise<T>((r) => setTimeout(() => r(structuredClone(value)), ms));
