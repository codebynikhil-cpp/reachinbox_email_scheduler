import apiClient from './api';
import type { UploadLeadsResponse } from '@/types/api';

export const uploadService = {
  /**
   * Upload a CSV/TXT file to the backend for parsing.
   * Uses the /api/uploads/leads endpoint with multipart form data.
   * The file field name MUST be "file" (required by multer).
   */
  async uploadLeads(file: File): Promise<UploadLeadsResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<UploadLeadsResponse>('/api/uploads/leads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return data;
  },
};
