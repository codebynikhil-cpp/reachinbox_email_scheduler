// ─── Auth ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface AuthMeResponse {
  success: boolean;
  user: User;
}

export interface GoogleAuthUrlResponse {
  url: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

// ─── Emails ──────────────────────────────────────────────────────────────────

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  campaignId: string;
  scheduledAt: string;
  status: EmailStatus;
  attempts: number;
  createdAt: string;
}

export interface SentEmail {
  id: string;
  recipient: string;
  subject: string;
  campaignId: string;
  sentAt: string | null;
  status: EmailStatus;
  attempts: number;
  messageId: string | null;
  error: string | null;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedScheduledEmails {
  data: ScheduledEmail[];
  pagination: Pagination;
}

export interface PaginatedSentEmails {
  data: SentEmail[];
  pagination: Pagination;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface EmailStats {
  total: number;
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
}

export interface EmailStatsResponse {
  success: boolean;
  stats: EmailStats;
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export interface CreateCampaignPayload {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO-8601
  delayMs: number;
  hourlyLimit: number;
}

export interface CreateCampaignResponse {
  success: boolean;
  campaignId: string;
  subject: string;
  totalScheduled: number;
  firstScheduledAt: string;
  lastScheduledAt: string;
  hourlyLimit: number;
  delayMs: number;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export interface UploadLeadsResponse {
  totalRows: number;
  validEmails: number;
  duplicates: number;
  uniqueEmails: number;
  emails: string[];
}

// ─── Generic API Error ───────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  statusCode?: number;
}
