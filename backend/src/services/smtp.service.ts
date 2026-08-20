import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  previewUrl?: string | false;
}

export class SmtpService {
  private transporter: Transporter | null = null;
  private isInitializing = false;

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (this.isInitializing) {
      // Wait briefly if another call is initializing
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.transporter) return this.transporter;
    }

    this.isInitializing = true;

    try {
      if (env.SMTP_USER && env.SMTP_PASS) {
        // Use user-provided credentials
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        });
        logger.info('Initialized SMTP transporter with configured credentials', {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
        });
      } else {
        // Auto-generate an Ethereal test account for seamless zero-setup testing
        logger.info('No SMTP credentials provided. Creating ephemeral Ethereal test account...');
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info('Ethereal test account created successfully', {
          user: testAccount.user,
        });
      }

      return this.transporter;
    } finally {
      this.isInitializing = false;
    }
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const transporter = await this.getTransporter();

    try {
      const info = await transporter.sendMail({
        from: env.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        text: options.body,
        html: options.html || options.body.replace(/\n/g, '<br/>'),
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);

      logger.info('Email sent successfully via SMTP', {
        to: options.to,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      });

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      };
    } catch (error) {
      logger.error('SMTP sending error', {
        to: options.to,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const smtpService = new SmtpService();
