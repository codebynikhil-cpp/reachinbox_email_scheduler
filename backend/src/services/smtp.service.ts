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

  private async createConfiguredTransporter(): Promise<Transporter> {
    if (env.SMTP_USER && env.SMTP_PASS) {
      const port = Number(env.SMTP_PORT) || 587;
      const isSecure = port === 465;

      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure: isSecure,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      logger.info('Initialized SMTP transporter with configured credentials', {
        host: env.SMTP_HOST,
        port,
        secure: isSecure,
        user: env.SMTP_USER,
      });

      return transporter;
    }

    // Auto-generate an Ethereal test account for seamless zero-setup testing
    logger.info('No SMTP credentials provided. Creating ephemeral Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host || 'smtp.ethereal.email',
      port: testAccount.smtp.port || 587,
      secure: testAccount.smtp.secure ?? false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    logger.info('Ethereal test account created successfully', {
      user: testAccount.user,
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
    });

    return transporter;
  }

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
      this.transporter = await this.createConfiguredTransporter();
      return this.transporter;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Creates a fallback transporter if the primary transporter experiences connection / port failure
   */
  private async createFallbackTransporter(failedPort: number): Promise<Transporter> {
    // If primary port was 465, fallback to standard submission port 587
    // If primary was 587, try alternative port 2525 or 465
    const fallbackPort = failedPort === 465 ? 587 : 2525;
    const isSecure = false;

    if (env.SMTP_USER && env.SMTP_PASS) {
      logger.info(`Attempting fallback SMTP connection on port ${fallbackPort}...`);
      return nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: fallbackPort,
        secure: isSecure,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    }

    // Otherwise generate a fresh test account on port 587
    logger.info('Generating fresh Ethereal test account for fallback dispatch...');
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    let transporter: Transporter;
    try {
      transporter = await this.getTransporter();
    } catch (initErr) {
      logger.error('Failed to initialize SMTP transporter', {
        error: initErr instanceof Error ? initErr.message : String(initErr),
      });
      throw initErr;
    }

    const senderFrom = env.SMTP_FROM || 'ReachInbox Scheduler <noreply@reachinbox.ai>';

    // Primary send attempt
    try {
      const info = await transporter.sendMail({
        from: senderFrom,
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
    } catch (primaryError) {
      const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const currentPort = Number(env.SMTP_PORT) || 587;

      logger.warn(`Primary SMTP send failed on port ${currentPort}: ${primaryMsg}. Attempting fallback...`, {
        to: options.to,
        error: primaryMsg,
      });

      // Clear cached transporter so future calls reinitialize
      this.transporter = null;

      try {
        const fallbackTransporter = await this.createFallbackTransporter(currentPort);
        const info = await fallbackTransporter.sendMail({
          from: senderFrom,
          to: options.to,
          subject: options.subject,
          text: options.body,
          html: options.html || options.body.replace(/\n/g, '<br/>'),
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        logger.info('Email sent successfully via fallback SMTP', {
          to: options.to,
          messageId: info.messageId,
          previewUrl: previewUrl || undefined,
        });

        // Cache the working fallback transporter
        this.transporter = fallbackTransporter;

        return {
          success: true,
          messageId: info.messageId,
          previewUrl: previewUrl || undefined,
        };
      } catch (fallbackError) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.error('All SMTP dispatch attempts failed', {
          to: options.to,
          primaryError: primaryMsg,
          fallbackError: fallbackMsg,
        });
        throw new Error(`SMTP Delivery Failed: ${primaryMsg} | Fallback: ${fallbackMsg}`);
      }
    }
  }
}

export const smtpService = new SmtpService();
