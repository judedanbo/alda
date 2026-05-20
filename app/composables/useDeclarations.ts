import { authFetch } from "~/utils/authFetch";

export function useDeclarations() {
  async function fetchDeclarations(params?: { page?: number; status?: string }) {
    return authFetch<any>("/api/declarations", { query: params as Record<string, unknown> });
  }

  async function fetchDeclaration(id: string) {
    return authFetch<any>(`/api/declarations/${id}`);
  }

  async function createDeclaration() {
    return authFetch<any>("/api/declarations", { method: "POST" });
  }

  async function fetchDeclarationStatus(id: string) {
    return authFetch<any>(`/api/declarations/${id}/status`);
  }

  return {
    fetchDeclarations,
    fetchDeclaration,
    createDeclaration,
    fetchDeclarationStatus,
  };
}
