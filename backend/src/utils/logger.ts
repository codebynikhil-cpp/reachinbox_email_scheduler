type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'jwt_secret',
  'smtp_pass',
  'google_client_secret',
  'authorization',
  'cookie',
]);

function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function formatLog(level: LogLevel, message: string, context?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
  if (context && Object.keys(context).length > 0) {
    const cleanContext = sanitize(context);
    return `${base} ${JSON.stringify(cleanContext)}`;
  }
  return base;
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    console.log(formatLog('info', message, context));
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(formatLog('warn', message, context));
  },
  error: (message: string, context?: Record<string, unknown>) => {
    console.error(formatLog('error', message, context));
  },
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('debug', message, context));
    }
  },
};
