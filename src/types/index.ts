// ── 사용자 ──
export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

// ── 폴더 ──
export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  ownerId: string;
  createdAt: string;
}

export interface FolderMember {
  folderId: string;
  userId: string;
  username: string;
  displayName: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
}

// ── 캘린더 이벤트 ──
export interface CalendarEvent {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string | null; // HH:MM
  eventType: string;
  memo: string | null;
  completed: boolean;
  importSource: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ── 이벤트 카테고리 ──
export interface EventCategory {
  id: string;
  userId: string;
  name: string;
  colorBg: string;
  colorText: string;
  sortOrder: number;
  keywords: string;
  createdAt: string;
}

// ── API 응답 ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── AI 응답 ──
export interface AiCalendarResponse {
  action: 'create' | 'update' | 'delete' | 'query' | 'error';
  message?: string;
  events?: Partial<CalendarEvent>[];
  eventIds?: string[];
}
