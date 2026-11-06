import { queryOptions } from "@tanstack/react-query";
import { adminApi, auditApi, documentsApi, permissionsApi } from "./api";

export const documentsQuery = () => queryOptions({ queryKey: ["documents"], queryFn: documentsApi.list });
export const documentQuery = (id: string) => queryOptions({ queryKey: ["documents", id], queryFn: () => documentsApi.get(id) });
export const permissionsQuery = (id: string) => queryOptions({ queryKey: ["permissions", id], queryFn: () => permissionsApi.list(id) });
export const auditQuery = () => queryOptions({ queryKey: ["audit"], queryFn: auditApi.list });
export const adminStatsQuery = () => queryOptions({ queryKey: ["admin", "stats"], queryFn: adminApi.stats });
export const adminUsersQuery = () => queryOptions({ queryKey: ["admin", "users"], queryFn: adminApi.users });
