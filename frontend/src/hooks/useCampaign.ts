import { useState, useCallback } from 'react';
import { campaignService } from '@/services/campaign.service';
import type { CreateCampaignPayload, CreateCampaignResponse } from '@/types/api';
import axios from 'axios';

interface CampaignState {
  loading: boolean;
  error: string | null;
  result: CreateCampaignResponse | null;
}

export function useCampaign() {
  const [state, setState] = useState<CampaignState>({
    loading: false,
    error: null,
    result: null,
  });

  const create = useCallback(
    async (
      payload: CreateCampaignPayload
    ): Promise<{ success: boolean; data?: CreateCampaignResponse; error?: string }> => {
      setState({ loading: true, error: null, result: null });
      try {
        const result = await campaignService.create(payload);
        setState({ loading: false, error: null, result });
        return { success: true, data: result };
      } catch (err) {
        let message = 'Failed to schedule campaign. Please try again.';
        if (axios.isAxiosError(err)) {
          const data = err.response?.data;
          if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
            message = `${data.message || 'Validation failed'}: ${data.errors.map((e: { field?: string; message: string }) => e.message).join(', ')}`;
          } else if (data?.message) {
            message = data.message as string;
          }
        }
        setState({ loading: false, error: message, result: null });
        return { success: false, error: message };
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null });
  }, []);

  return { ...state, create, reset };
}
