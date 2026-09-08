import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types';
import { UnauthorizedError, BadRequestError } from '../utils/errors';

export class AuthController {
  /**
   * Redirects user to Google OAuth login URL
   */
  public googleAuth(_req: Request, res: Response, next: NextFunction): void {
    try {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        res.status(400).json({
          success: false,
          message: 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        });
        return;
      }
      const url = authService.getGoogleAuthUrl();
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns Google OAuth URL as JSON
   */
  public getGoogleAuthUrl(_req: Request, res: Response, next: NextFunction): void {
    try {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        res.status(400).json({
          success: false,
          message: 'Google OAuth is not configured on the server.',
        });
        return;
      }
      const url = authService.getGoogleAuthUrl();
      res.status(200).json({ success: true, url });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles Google OAuth callback redirect
   */
  public async googleCallback(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    try {
      const code = req.query.code as string;
      const oauthError = req.query.error as string;

      if (oauthError) {
        logger.warn('Google OAuth returned error query param:', { oauthError });
        const encodedReason = encodeURIComponent(oauthError);
        res.redirect(`${env.FRONTEND_URL}/login?error=${encodedReason}`);
        return;
      }

      if (!code) {
        logger.warn('Google OAuth callback missing code');
        res.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
        return;
      }

      const { token } = await authService.handleGoogleCallback(code);

      // Set secure HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect back to frontend dashboard with token query parameter so cross-origin
      // deployments (e.g. Render backend + Vercel frontend) authenticate reliably
      const frontendTarget = env.FRONTEND_URL.replace(/\/$/, '');
      res.redirect(`${frontendTarget}/dashboard?token=${encodeURIComponent(token)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Google OAuth callback handler caught error:', {
        error: msg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      const encodedMsg = encodeURIComponent(msg);
      res.redirect(`${env.FRONTEND_URL}/login?error=${encodedMsg}`);
    }
  }

  /**
   * Returns current authenticated user profile
   */
  public async getMe(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedError('Unauthorized');
      }

      const user = await authService.getUserById(req.user.id);
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user and clear cookies
   */
  public logout(_req: Request, res: Response): void {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}

export const authController = new AuthController();
