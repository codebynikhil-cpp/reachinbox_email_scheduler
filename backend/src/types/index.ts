import { Request } from 'express';

export enum EmailStatus {
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface UserPayload {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export interface EmailJobData {
  emailId: string;
  campaignId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export interface LeadStats {
  totalRows: number;
  validEmails: number;
  duplicates: number;
  uniqueEmails: number;
}
