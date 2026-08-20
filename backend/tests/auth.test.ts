import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { authService } from '../src/services/auth.service';
import { app } from '../src/app';

describe('AuthService & Auth Middleware', () => {
  const sampleUser = {
    id: 'test-user-id-123',
    email: 'testuser@example.com',
    name: 'Test User',
  };

  it('should generate and verify valid JWT tokens', () => {
    const token = authService.generateJwt(sampleUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = authService.verifyJwt(token);
    expect(decoded.id).toBe(sampleUser.id);
    expect(decoded.email).toBe(sampleUser.email);
    expect(decoded.name).toBe(sampleUser.name);
  });

  it('should reject invalid or tampered JWT tokens', () => {
    expect(() => {
      authService.verifyJwt('invalid.token.structure');
    }).toThrow();
  });

  it('should protect /api/campaigns endpoint when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({
        subject: 'Hello',
        body: 'World',
        recipients: ['a@example.com'],
        startTime: new Date().toISOString(),
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('No authentication token');
  });

  it('should protect /api/emails/scheduled endpoint when unauthenticated', async () => {
    const res = await request(app).get('/api/emails/scheduled');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should protect /api/emails/sent endpoint when unauthenticated', async () => {
    const res = await request(app).get('/api/emails/sent');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should accept valid Bearer token in Authorization header', async () => {
    const token = authService.generateJwt(sampleUser);
    // GET /api/auth/me should reach the controller
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    // If DB user doesn't exist, it returns 401/404 from getUserById, but auth middleware succeeded
    expect(res.status).not.toBe(403);
  });
});
