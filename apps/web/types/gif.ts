export type GifOrigin = 'USER' | 'OFFICIAL' | string;
export type GifStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'TAKEN_DOWN' | string;

export interface GifAsset {
  id: string;
  title: string;
  origin: GifOrigin;
  status: GifStatus;
  collectionCount: string | number;
  usageCount: string | number;
  rewardedUseCount: string | number;
  creator: {
    nickname: string;
    avatarUrl?: string | null;
  };
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  createdAt: string;
  collected: boolean;
  isCreator: boolean;
  usable: boolean;
  previewUrl?: string | null;
  posterUrl?: string | null;
  reviewPreviewUrl?: string | null;
  reviewPosterUrl?: string | null;
  moderationNote?: string | null;
  reports?: Array<{ id: string; reason: string; detail?: string | null; reporter: string; createdAt: string }>;
}

export interface GifListResponse {
  items: GifAsset[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

export interface GifCollectionResponse {
  meme: GifAsset;
}
