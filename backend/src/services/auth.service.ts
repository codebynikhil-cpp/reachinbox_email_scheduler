import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { UserPayload } from '../types';

export class AuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_CALLBACK_URL
    );
  }

  /**
   * Generate Google OAuth2 Consent URL
   */
  public getGoogleAuthUrl(): string {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new BadRequestError('Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }

    const client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID.trim(),
      env.GOOGLE_CLIENT_SECRET.trim(),
      env.GOOGLE_CALLBACK_URL.trim()
    );

    return client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });
  }

  /**
   * Handle Google OAuth2 callback: Exchange code for tokens, retrieve profile, and upsert user
   */
  public async handleGoogleCallback(code: string): Promise<{ token: string; user: UserPayload }> {
    try {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new BadRequestError('Google OAuth is not configured on the server.');
      }

      const client = new OAuth2Client(
        env.GOOGLE_CLIENT_ID.trim(),
        env.GOOGLE_CLIENT_SECRET.trim(),
        env.GOOGLE_CALLBACK_URL.trim()
      );

      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: env.GOOGLE_CLIENT_ID.trim(),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new BadRequestError('Invalid user profile received from Google');
      }

      const googleId = payload.sub;
      const email = payload.email.toLowerCase();
      const name = payload.name || payload.given_name || email.split('@')[0];
      const avatarUrl = payload.picture || null;

      // Upsert User in PostgreSQL
      const user = await prisma.user.upsert({
        where: { googleId },
        update: {
          name,
          email,
          avatarUrl,
        },
        create: {
          googleId,
          name,
          email,
          avatarUrl,
        },
      });

      const userPayload: UserPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
      };

      const token = this.generateJwt(userPayload);

      logger.info('User authenticated successfully with Google OAuth', {
        userId: user.id,
        email: user.email,
      });

      return { token, user: userPayload };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Google OAuth callback failed', {
        error: errMsg,
      });
      throw new UnauthorizedError(errMsg);
    }
  }

  /**
   * Sign JWT Token
   */
  public generateJwt(payload: UserPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '7d',
    });
  }

  /**
   * Verify JWT Token
   */
  public verifyJwt(token: string): UserPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as UserPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }
  }

  /**
   * Find user by ID
   */
  public async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return user;
  }
}

export const authService = new AuthService();
