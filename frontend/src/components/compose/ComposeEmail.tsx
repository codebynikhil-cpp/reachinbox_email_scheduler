import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CSVUploader } from './CSVUploader';
import { useCampaign } from '@/hooks/useCampaign';
import { useToast } from '@/components/ui/Toast';
import { toDatetimeLocalValue, datetimeLocalToISO } from '@/utils/date';
import { isNonEmpty, isPositiveNumber } from '@/utils/validation';
import type { UploadLeadsResponse } from '@/types/api';

interface ComposeEmailProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  subject: string;
  body: string;
  startTime: string;
  delayMs: string;
  hourlyLimit: string;
}

interface FormErrors {
  subject?: string;
  body?: string;
  recipients?: string;
  startTime?: string;
  delayMs?: string;
  hourlyLimit?: string;
}

// Default start time: 5 minutes from now
function defaultStartTime(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  return toDatetimeLocalValue(d);
}

export function ComposeEmail({ isOpen, onClose, onSuccess }: ComposeEmailProps) {
  const { create, loading } = useCampaign();
  const { toast } = useToast();

  const [form, setForm] = useState<FormValues>({
    subject: '',
    body: '',
    startTime: defaultStartTime(),
    delayMs: '2000',
    hourlyLimit: '100',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [uploadResult, setUploadResult] = useState<UploadLeadsResponse | null>(null);

  const setField = (field: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!isNonEmpty(form.subject)) newErrors.subject = 'Subject is required.';
    if (!isNonEmpty(form.body)) newErrors.body = 'Body is required.';
    if (!uploadResult || uploadResult.uniqueEmails === 0) {
      newErrors.recipients = 'Please upload a CSV file with at least one valid email address.';
    }
    if (!form.startTime) {
      newErrors.startTime = 'Start time is required.';
    }
    const delay = Number(form.delayMs);
    if (!isPositiveNumber(delay)) newErrors.delayMs = 'Delay must be a positive number.';
    const limit = Number(form.hourlyLimit);
    if (!isPositiveNumber(limit)) newErrors.hourlyLimit = 'Hourly limit must be a positive number.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const res = await create({
      subject: form.subject.trim(),
      body: form.body.trim(),
      recipients: uploadResult!.emails,
      startTime: datetimeLocalToISO(form.startTime),
      delayMs: Number(form.delayMs),
      hourlyLimit: Number(form.hourlyLimit),
    });

    if (res.success && res.data) {
      toast(
        `Campaign scheduled successfully! ${res.data.totalScheduled} email${res.data.totalScheduled !== 1 ? 's' : ''} queued.`,
        'success'
      );
      handleClose();
      onSuccess();
    } else {
      toast(res.error || 'Failed to schedule campaign. Please try again.', 'error');
    }
  };

  const handleClose = () => {
    if (loading) return;
    setForm({
      subject: '',
      body: '',
      startTime: defaultStartTime(),
      delayMs: '2000',
      hourlyLimit: '100',
    });
    setErrors({});
    setUploadResult(null);
    onClose();
  };

  const handleUploadSuccess = (result: UploadLeadsResponse) => {
    setUploadResult(result);
    setErrors((prev) => ({ ...prev, recipients: undefined }));
    toast(
      `CSV uploaded successfully. ${result.uniqueEmails} unique email address${result.uniqueEmails !== 1 ? 'es' : ''} detected.`,
      'success'
    );
  };

  const handleUploadError = (msg: string) => {
    toast(msg, 'error');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Compose New Campaign"
      description="Schedule a batch email campaign to your leads."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            id="schedule-campaign-btn"
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            Schedule Campaign
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
        {/* Subject */}
        <Input
          label="Subject"
          id="compose-subject"
          placeholder="e.g. Exciting product update for you"
          value={form.subject}
          onChange={(e) => setField('subject', e.target.value)}
          error={errors.subject}
          required
          maxLength={200}
        />

        {/* Body */}
        <Textarea
          label="Email Body"
          id="compose-body"
          placeholder="Hi there,&#10;&#10;We'd love to share something exciting with you…"
          value={form.body}
          onChange={(e) => setField('body', e.target.value)}
          error={errors.body}
          required
          rows={6}
        />

        {/* CSV Upload */}
        <div>
          <CSVUploader
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
          {errors.recipients && (
            <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.recipients}
            </p>
          )}
        </div>

        {/* Scheduling settings */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Schedule Settings
          </p>

          <Input
            label="Start Time"
            id="compose-start-time"
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setField('startTime', e.target.value)}
            error={errors.startTime}
            required
            hint="When to send the first email. Uses your local timezone."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Delay Between Emails (ms)"
              id="compose-delay"
              type="number"
              min="1"
              step="100"
              value={form.delayMs}
              onChange={(e) => setField('delayMs', e.target.value)}
              error={errors.delayMs}
              required
              hint="Min gap between consecutive sends"
            />
            <Input
              label="Hourly Limit"
              id="compose-hourly-limit"
              type="number"
              min="1"
              step="1"
              value={form.hourlyLimit}
              onChange={(e) => setField('hourlyLimit', e.target.value)}
              error={errors.hourlyLimit}
              required
              hint="Max emails per hour"
            />
          </div>
        </div>

        {/* Recipients summary */}
        {uploadResult && uploadResult.uniqueEmails > 0 && (
          <div className="flex items-center gap-2 p-3 bg-indigo-500/8 border border-indigo-500/25 rounded-xl animate-fade-in">
            <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-sm text-indigo-300">
              <span className="font-semibold">{uploadResult.uniqueEmails}</span> unique recipient{uploadResult.uniqueEmails !== 1 ? 's' : ''} will receive this campaign
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
