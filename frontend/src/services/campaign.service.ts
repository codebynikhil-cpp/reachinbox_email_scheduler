import apiClient from './api';
import type { CreateCampaignPayload, CreateCampaignResponse } from '@/types/api';

export const campaignService = {
  async create(payload: CreateCampaignPayload): Promise<CreateCampaignResponse> {
    const { data } = await apiClient.post<CreateCampaignResponse>('/api/campaigns', payload);
    return data;
  },
};
