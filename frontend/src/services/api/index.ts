/**
 * TrustVault API service layer.
 * Each function maps 1:1 to a Flask endpoint. When USE_MOCKS is true (default for the
 * UI preview), the MOCK branch is used instead. Set VITE_USE_MOCKS=false to hit the backend.
 */
import { apiRequest, API_BASE_URL, USE_MOCKS } from "./client";
import type {
  AccessLevel, AdminStats, AuthUser, AuditEvent, Classification, DocumentDetail, DocumentSummary,
  LoginRequest, Permission, RegisterRequest, UploadRequest, User,
} from "./types";
import {
  MOCK_ADMIN_STATS, MOCK_AUDIT, MOCK_DOCUMENTS, MOCK_PERMISSIONS, MOCK_USERS, mockDelay,
} from "@/mocks/mock-data";

export const authApi = {
  login: async (body: LoginRequest): Promise<AuthUser> => {
    if (USE_MOCKS) {
      const user = await mockDelay<User>(MOCK_USERS[1]!, 600);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }

    const response = await apiRequest<{
      user: {
        id: number | string;
        name: string;
        email: string;
        role: "admin" | "owner" | "viewer";
      };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      ...response.user,
      id: String(response.user.id),
      role: response.user.role === "admin"
        ? "administrator"
        : response.user.role,
    };
  },

  me: async (): Promise<AuthUser> => {
    if (USE_MOCKS) {
      const user = MOCK_USERS[1]!;
      return { id: user.id, name: user.name, email: user.email, role: user.role };
    }
    const response = await apiRequest<{
      user: {
        id: number | string;
        name: string;
        email: string;
        role: "admin" | "owner" | "viewer";
      };
    }>("/auth/me");

    return {
      ...response.user,
      id: String(response.user.id),
      role: response.user.role === "admin"
        ? "administrator"
        : response.user.role,
    };
  },

  register: (body: RegisterRequest) =>
    USE_MOCKS
      ? mockDelay(undefined)
      : apiRequest<{ message: string; role: string }>(
          "/auth/register",
          { method: "POST", body: JSON.stringify(body) },
        ),

  logout: () =>
    USE_MOCKS
      ? mockDelay(undefined)
      : apiRequest<void>("/auth/logout", { method: "POST" }),
};
export const documentsApi = {
  // GET /documents
  list: async (): Promise<DocumentSummary[]> => {
  if (USE_MOCKS) return mockDelay<DocumentSummary[]>(MOCK_DOCUMENTS);

  const response = await apiRequest<{
    documents: {
      id: number | string;
      title: string;
      description: string;
      category: string;
      original_filename: string;
      owner_id: number | string;
      owner_name: string;
      owner_email: string;
      size_bytes: number;
      sha256: string;
      shared_with: number;
      created_at: string;
      updated_at: string;
    }[];
  }>("/documents");

  return response.documents.map((doc) => {
    const classification = ["public", "internal", "confidential", "restricted"].includes(doc.category)
      ? doc.category as Classification
      : "internal";

    return {
      id: String(doc.id),
      title: doc.title,
      fileName: doc.original_filename,
      fileType: doc.original_filename.split(".").pop()?.toUpperCase() ?? "FILE",
      sizeBytes: doc.size_bytes,
      classification,
      ownerId: String(doc.owner_id),
      ownerName: doc.owner_name,
      ownerEmail: doc.owner_email,
      updatedAt: doc.updated_at,
      sharedWith: doc.shared_with,
      sha256: doc.sha256,
    };
  });
},
  // GET /documents/:id
  get: async (id: string): Promise<DocumentDetail> => {
  if (USE_MOCKS) {
    const doc = MOCK_DOCUMENTS.find((d) => d.id === id);
    if (!doc) throw new Error("Document not found");
    return mockDelay(doc);
  }

  const response = await apiRequest<{
    document: {
      id: number | string;
      title: string;
      description: string;
      category: string;
      original_filename: string;
      owner_id: number | string;
      owner_name: string;
      owner_email: string;
      size_bytes: number;
      sha256: string;
      shared_with: number;
      created_at: string;
      updated_at: string;
    };
    permission: string;
  }>(`/documents/${id}`);

  const doc = response.document;

  const classification: Classification =
    ["public", "internal", "confidential", "restricted"].includes(doc.category)
      ? doc.category as Classification
      : "internal";

  return {
    id: String(doc.id),
    title: doc.title,
    fileName: doc.original_filename,
    fileType: doc.original_filename.split(".").pop()?.toUpperCase() ?? "FILE",
    sizeBytes: doc.size_bytes,
    classification,
    ownerId: String(doc.owner_id),
    ownerName: doc.owner_name,
    ownerEmail: doc.owner_email,
    updatedAt: doc.updated_at,
    sharedWith: doc.shared_with,
    sha256: doc.sha256,
    description: doc.description ?? "",
    createdAt: doc.created_at,
    version: 1,
    expiresAt: null,
    tags: [],
  };
},
  // POST /documents (multipart)
  upload: (req: UploadRequest) => {
    if (USE_MOCKS) return mockDelay<DocumentSummary>({ ...MOCK_DOCUMENTS[0]!, id: "mock-new", title: req.title }, 1200);
    const fd = new FormData();
    fd.append("file", req.file);
    fd.append("title", req.title);
    fd.append("description", req.description);
    fd.append("category", req.classification);
    if (req.expiresAt) fd.append("expires_at", req.expiresAt);
    return apiRequest<DocumentSummary>("/documents", { method: "POST", body: fd });
  },
  // GET /documents/:id/download — returns the authorised file bytes
  downloadUrl: async (id: string): Promise<Blob> => {
    if (USE_MOCKS) {
      return new Blob([]);
    }

    const response = await fetch(
      `${API_BASE_URL}/documents/${id}/download`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to download document");
    }

    return response.blob();
  },
};

export const permissionsApi = {
  // GET /documents/:id/permissions
  list: (documentId: string) =>
    USE_MOCKS ? mockDelay(MOCK_PERMISSIONS.filter((p) => p.documentId === documentId))
      : apiRequest<Permission[]>(`/documents/${documentId}/permissions`),
  // POST /documents/:id/permissions
  grant: (documentId: string, body: { email: string; access: AccessLevel; expiresAt: string | null }) =>
    USE_MOCKS ? mockDelay<Permission>({ id: `mock-${Date.now()}`, documentId, userId: "mock", userName: body.email.split("@")[0] ?? body.email, userEmail: body.email, access: body.access, grantedAt: new Date().toISOString(), expiresAt: body.expiresAt })
      : apiRequest<Permission>(`/documents/${documentId}/permissions`, { method: "POST", body: JSON.stringify(body) }),
  // DELETE /documents/:id/permissions/:pid
  revoke: (documentId: string, permissionId: string) =>
    USE_MOCKS ? mockDelay(undefined)
      : apiRequest<void>(`/documents/${documentId}/permissions/${permissionId}`, { method: "DELETE" }),
};
export const auditApi = {
  list: async (): Promise<AuditEvent[]> => {
    if (USE_MOCKS) {
      return mockDelay<AuditEvent[]>(MOCK_AUDIT);
    }

    const response = await apiRequest<{
      logs: {
        id: number;
        actor_name: string;
        actor_email: string;
        action: string;
        outcome: string;
        details: string;
        document_id: number | null;
        created_at: string;
      }[];
    }>("/admin/audit");

    return response.logs.map((log) => ({
      id: String(log.id),
      at: log.created_at,
      actorName: log.actor_name,
      actorEmail: log.actor_email,
      action: log.action as AuditEvent["action"],
      target: log.details || (
        log.document_id ? `Document #${log.document_id}` : "System"
      ),
      ip: "—",
      outcome: log.outcome === "success" ? "success" : log.outcome === "failure" ? "failure" : "denied",
    }));
  },
  verifyChain: () => USE_MOCKS
    ? mockDelay({ valid: true, entries_checked: 0, first_invalid_id: null })
    : apiRequest<{ valid: boolean; entries_checked: number; first_invalid_id: number | null }>("/admin/audit/verify"),
};

export const adminApi = {
  // GET /admin/stats
  stats: () => (USE_MOCKS ? mockDelay<AdminStats>(MOCK_ADMIN_STATS) : apiRequest<AdminStats>("/admin/stats")),
  // GET /admin/users
  users: () => (USE_MOCKS ? mockDelay<User[]>(MOCK_USERS) : apiRequest<User[]>("/admin/users")),
  // PATCH /admin/users/:id — backend validates the caller is an administrator
  updateUser: (id: string, body: Partial<Pick<User, "role" | "status">>) => {
    if (!USE_MOCKS) return apiRequest<User>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    const u = MOCK_USERS.find((x) => x.id === id);
    if (!u) throw new Error("User not found");
    return mockDelay<User>({ ...u, ...body }, 500);
  },
};

export { USE_MOCKS } from "./client";
export * from "./types";
