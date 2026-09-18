export type DraftKind = 'QUICK' | 'SURVEY';

export interface DraftItem {
  id: string;
  kind: DraftKind;
  name: string;
  payload: Record<string, unknown>;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DraftListResponse {
  items: DraftItem[];
  total: number;
  page: number;
  limit: number;
}
