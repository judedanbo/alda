export function useDeclarations() {
  const { getAuthHeaders } = useAuth();

  async function fetchDeclarations(params?: { page?: number; status?: string }) {
    return $fetch<any>("/api/declarations", {
      headers: getAuthHeaders(),
      params,
    });
  }

  async function fetchDeclaration(id: string) {
    return $fetch<any>(`/api/declarations/${id}`, {
      headers: getAuthHeaders(),
    });
  }

  async function createDeclaration() {
    return $fetch<any>("/api/declarations", {
      method: "POST",
      headers: getAuthHeaders(),
    });
  }

  async function submitDeclaration(id: string) {
    return $fetch<any>(`/api/declarations/${id}/submit`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
  }

  async function fetchDeclarationStatus(id: string) {
    return $fetch<any>(`/api/declarations/${id}/status`, {
      headers: getAuthHeaders(),
    });
  }

  return {
    fetchDeclarations,
    fetchDeclaration,
    createDeclaration,
    submitDeclaration,
    fetchDeclarationStatus,
  };
}
