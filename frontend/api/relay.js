import nodemailer from 'nodemailer';

/**
 * Vercel Serverless Email Relay
 *
 * Receives HTTPS POST requests from the Render background worker
 * and executes Nodemailer SMTP transport to Ethereal on port 587,
 * bypassing cloud host (Render) outbound SMTP port blocking.
 */
export default async function handler(req, res) {
  // 1. Method check
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed. Only POST is accepted.`,
    });
  }

  // 2. Authentication check using shared RELAY_SECRET
  const relaySecret = process.env.RELAY_SECRET;
  if (relaySecret) {
    const authHeader = req.headers.authorization || req.headers['authorization'];
    const expectedAuth = `Bearer ${relaySecret}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or missing relay secret token.',
      });
    }
  }

  // 3. Payload validation
  const { to, subject, body, html, text } = req.body || {};

  if (!to || !subject) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request: "to" and "subject" fields are required.',
    });
  }

  // 4. Nodemailer SMTP configuration (running within Vercel serverless environment)
  try {
    const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const senderFrom =
      process.env.SMTP_FROM ||
      (user ? `"ReachInbox Scheduler" <${user}>` : 'ReachInbox Scheduler <noreply@reachinbox.ai>');

    // 5. Dispatch email via Ethereal SMTP
    const info = await transporter.sendMail({
      from: senderFrom,
      to,
      subject,
      text: body || text || '',
      html: html || (body ? body.replace(/\n/g, '<br/>') : ''),
    });

    // 6. Generate real Ethereal test message URL
    const previewUrl = nodemailer.getTestMessageUrl(info);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || false,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Vercel relay SMTP error:', errorMessage);

    return res.status(500).json({
      success: false,
      error: `Relay SMTP delivery failed: ${errorMessage}`,
    });
  }
}
