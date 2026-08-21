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
    async (payload: CreateCampaignPayload): Promise<CreateCampaignResponse | null> => {
      setState({ loading: true, error: null, result: null });
      try {
        const result = await campaignService.create(payload);
        setState({ loading: false, error: null, result });
        return result;
      } catch (err) {
        let message = 'Failed to schedule campaign. Please try again.';
        if (axios.isAxiosError(err) && err.response?.data?.message) {
          message = err.response.data.message as string;
        }
        setState({ loading: false, error: message, result: null });
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null });
  }, []);

  return { ...state, create, reset };
}
