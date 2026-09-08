import apiClient from './api';

export interface SlackStatusResponse {
  success: boolean;
  data: {
    connected: boolean;
    hasWebhook: boolean;
    channel: string | null;
    teamName: string | null;
  };
}

export const slackService = {
  async getStatus(): Promise<SlackStatusResponse['data']> {
    const { data } = await apiClient.get<SlackStatusResponse>('/api/slack/status');
    return data.data;
  },

  async getAuthUrl(): Promise<string> {
    const { data } = await apiClient.get<{ success: boolean; data: { url: string } }>('/api/slack/auth-url');
    return data.data.url;
  },

  async setWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post('/api/slack/webhook', { webhookUrl });
    return data;
  },

  async disconnect(): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete('/api/slack/disconnect');
    return data;
  },
};
