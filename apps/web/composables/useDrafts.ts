import { errorMessage } from '~/composables/useApi';
import type { DraftItem, DraftKind, DraftListResponse } from '~/types/draft';

export function useDrafts() {
  const api = useApi();
  const { error: toastError } = useToast();

  async function listDrafts(kind?: DraftKind, template?: boolean): Promise<DraftItem[]> {
    try {
      const params = new URLSearchParams();
      if (kind) params.set('kind', kind);
      if (template !== undefined) params.set('template', String(template));
      const query = params.toString();
      const res = await api.get<DraftListResponse>(`/me/drafts${query ? `?${query}` : ''}`);
      return res.items;
    } catch (e) {
      toastError(errorMessage(e));
      return [];
    }
  }

  async function saveDraft(kind: DraftKind, name: string, payload: Record<string, unknown>, isTemplate = false): Promise<DraftItem | null> {
    try {
      return await api.post<DraftItem>('/me/drafts', { kind, name, payload, isTemplate });
    } catch (e) {
      toastError(errorMessage(e));
      return null;
    }
  }

  async function updateDraft(id: string, patch: { name?: string; payload?: Record<string, unknown>; isTemplate?: boolean }): Promise<DraftItem | null> {
    try {
      return await api.patch<DraftItem>(`/me/drafts/${id}`, patch);
    } catch (e) {
      toastError(errorMessage(e));
      return null;
    }
  }

  async function deleteDraft(id: string): Promise<boolean> {
    try {
      await api.delete<{ success: boolean }>(`/me/drafts/${id}`);
      return true;
    } catch (e) {
      toastError(errorMessage(e));
      return false;
    }
  }

  return { listDrafts, saveDraft, updateDraft, deleteDraft };
}
