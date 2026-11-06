// Shared API contract types. Keep in sync with the Flask backend's JSON responses.

export type Role = "administrator" | "owner" | "viewer";
export type BackendRole = "admin" | "owner" | "viewer";
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export type AccessLevel = "view" | "download" | "edit";
export type Classification = "public" | "internal" | "confidential" | "restricted";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended";
  lastActive: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  classification: Classification;
  ownerId: string;
  ownerName: string;
  updatedAt: string;
  sharedWith: number;
  sha256: string;
}

export interface DocumentDetail extends DocumentSummary {
  description: string;
  createdAt: string;
  version: number;
  expiresAt: string | null;
  tags: string[];
}

export interface Permission {
  id: string;
  documentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  access: AccessLevel;
  grantedAt: string;
  expiresAt: string | null;
}

export type AuditAction =
  | "login"
  | "upload"
  | "view"
  | "download"
  | "share"
  | "revoke"
  | "delete"
  | "role_change"
  | "failed_login";

export interface AuditEvent {
  id: string;
  at: string;
  actorName: string;
  actorEmail: string;
  action: AuditAction;
  target: string;
  ip: string;
  outcome: "success" | "denied";
}

export interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  activeShares: number;
  deniedAttempts24h: number;
  storageUsedBytes: number;
}

export interface LoginRequest { email: string; password: string }
export interface RegisterRequest { name: string; email: string; password: string }
export interface UploadRequest {
  file: File;
  title: string;
  description: string;
  classification: Classification;
  expiresAt: string | null;
}
