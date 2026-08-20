import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../types';
import { UnauthorizedError, BadRequestError } from '../utils/errors';

export class AuthController {
  /**
   * Redirects user to Google OAuth login URL
   */
  public googleAuth(_req: Request, res: Response): void {
    const url = authService.getGoogleAuthUrl();
    res.redirect(url);
  }

  /**
   * Returns Google OAuth URL as JSON (useful for custom frontend triggers)
   */
  public getGoogleAuthUrl(_req: Request, res: Response): void {
    const url = authService.getGoogleAuthUrl();
    res.status(200).json({ url });
  }

  /**
   * Handles Google OAuth callback redirect
   */
  public async googleCallback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const code = req.query.code as string;
      if (!code) {
        throw new BadRequestError('Missing authorization code in query parameter');
      }

      const { token, user } = await authService.handleGoogleCallback(code);

      // Set secure HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect back to frontend dashboard with token
      const redirectUrl = `${env.FRONTEND_URL}/dashboard?token=${token}`;
      res.redirect(redirectUrl);
    } catch (error) {
      next(error);
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
      sameSite: 'lax',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}

export const authController = new AuthController();
