import apiClient from './api';
import type {
  PaginatedScheduledEmails,
  PaginatedSentEmails,
  EmailStatsResponse,
} from '@/types/api';

export interface EmailQueryParams {
  page?: number;
  limit?: number;
  campaignId?: string;
}

export const emailService = {
  async getScheduled(params: EmailQueryParams = {}): Promise<PaginatedScheduledEmails> {
    const { data } = await apiClient.get<PaginatedScheduledEmails>('/api/emails/scheduled', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.campaignId ? { campaignId: params.campaignId } : {}),
      },
    });
    return data;
  },

  async getSent(params: EmailQueryParams = {}): Promise<PaginatedSentEmails> {
    const { data } = await apiClient.get<PaginatedSentEmails>('/api/emails/sent', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.campaignId ? { campaignId: params.campaignId } : {}),
      },
    });
    return data;
  },

  async getStats(): Promise<EmailStatsResponse> {
    const { data } = await apiClient.get<EmailStatsResponse>('/api/emails/stats');
    return data;
  },
};
