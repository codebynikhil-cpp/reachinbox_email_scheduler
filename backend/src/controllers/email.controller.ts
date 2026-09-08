import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { emailService } from '../services/email.service';
import { elasticsearchService } from '../services/elasticsearch.service';
import { AuthenticatedRequest } from '../types';
import { UnauthorizedError } from '../utils/errors';

export class EmailController {
  public async getScheduled(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const campaignId = req.query.campaignId as string | undefined;

      const result = await emailService.getScheduledEmails(
        user.id,
        page,
        limit,
        campaignId
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async getSent(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const campaignId = req.query.campaignId as string | undefined;

      const result = await emailService.getSentEmails(
        user.id,
        page,
        limit,
        campaignId
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async getStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const stats = await emailService.getEmailStats(user.id);
      res.status(200).json({ success: true, data: stats, stats });
    } catch (error) {
      next(error);
    }
  }

  public async search(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const query = (req.query.q as string) || '';
      const status = req.query.status as string | undefined;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const result = await elasticsearchService.searchEmails({
        userId: user.id,
        query,
        status,
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public preview page for inspecting a delivered email
   * Provides a standalone, clean webmail view accessible without login
   */
  public async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const email = await prisma.email.findUnique({
        where: { id },
        include: {
          campaign: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      });

      if (!email) {
        res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Email Not Found</title></head>
            <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
              <h2>Email Record Not Found</h2>
              <p style="color: #94a3b8;">The requested email does not exist or has been deleted.</p>
            </body>
          </html>
        `);
        return;
      }

      const senderName = email.campaign.user?.name || 'ReachInbox Campaign';
      const senderEmail = email.campaign.user?.email || 'noreply@reachinbox.ai';
      const sentDate = email.sentAt ? new Date(email.sentAt).toUTCString() : new Date(email.createdAt).toUTCString();
      const bodyHtml = email.campaign.body.replace(/\n/g, '<br/>');

      const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(email.campaign.subject)} - ReachInbox Email Preview</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #111827;
      --border: #1f2937;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #6366f1;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      padding: 24px 16px;
      display: flex;
      justify-content: center;
    }
    .wrapper {
      max-width: 760px;
      width: 100%;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
    }
    .header-bar {
      padding: 16px 24px;
      background: #0f172a;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(16, 185, 129, 0.1);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .brand-title {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-section {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: grid;
      gap: 10px;
      font-size: 13px;
    }
    .meta-row {
      display: grid;
      grid-template-columns: 80px 1fr;
      align-items: baseline;
    }
    .meta-label {
      color: var(--text-muted);
      font-weight: 500;
    }
    .meta-value {
      color: var(--text-main);
      word-break: break-all;
    }
    .subject-title {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin-top: 4px;
    }
    .body-section {
      padding: 32px 24px;
      background: #ffffff;
      color: #1f2937;
      min-height: 220px;
      line-height: 1.6;
      font-size: 15px;
    }
    .footer-bar {
      padding: 14px 24px;
      background: #0f172a;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header-bar">
      <div class="brand-title">
        <span style="color: var(--accent);">✦ ReachInbox</span>
        <span style="color: var(--text-muted); font-weight: 400; font-size: 12px;">Email Dispatch Preview</span>
      </div>
      <span class="badge-status">● ${email.status}</span>
    </div>

    <div class="meta-section">
      <div class="subject-title">${escapeHtml(email.campaign.subject)}</div>
      <div class="meta-row">
        <span class="meta-label">From:</span>
        <span class="meta-value">${escapeHtml(senderName)} &lt;${escapeHtml(senderEmail)}&gt;</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">To:</span>
        <span class="meta-value" style="font-family: monospace;">${escapeHtml(email.recipient)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Date:</span>
        <span class="meta-value">${escapeHtml(sentDate)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">ID:</span>
        <span class="meta-value" style="font-family: monospace; font-size: 11px; color: var(--text-muted);">${escapeHtml(email.messageId || email.id)}</span>
      </div>
    </div>

    <div class="body-section">
      ${bodyHtml}
    </div>

    <div class="footer-bar">
      <span>Delivered via ReachInbox Distributed Scheduler</span>
      <span style="font-family: monospace;">Attempts: ${email.attempts}</span>
    </div>
  </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(previewHtml);
    } catch (err) {
      next(err);
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const emailController = new EmailController();
