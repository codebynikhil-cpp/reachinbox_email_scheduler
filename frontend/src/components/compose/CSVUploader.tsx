import { useCallback, useRef, useState } from 'react';
import { uploadService } from '@/services/upload.service';
import { Spinner } from '@/components/ui/Spinner';
import type { UploadLeadsResponse } from '@/types/api';

interface CSVUploaderProps {
  onUploadSuccess: (result: UploadLeadsResponse) => void;
  onUploadError?: (message: string) => void;
}

const ACCEPTED_TYPES = '.csv,.txt,text/csv,text/plain,application/vnd.ms-excel';

export function CSVUploader({ onUploadSuccess, onUploadError }: CSVUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadLeadsResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      // Validate client-side
      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.csv') && !ext.endsWith('.txt')) {
        const msg = 'Only .csv or .txt files are supported.';
        setError(msg);
        onUploadError?.(msg);
        return;
      }

      setUploading(true);
      setError(null);
      setResult(null);
      setFileName(file.name);

      try {
        const data = await uploadService.uploadLeads(file);
        setResult(data);
        onUploadSuccess(data);
      } catch {
        const msg = 'Unable to upload CSV. Please check the file and try again.';
        setError(msg);
        onUploadError?.(msg);
      } finally {
        setUploading(false);
      }
    },
    [onUploadSuccess, onUploadError]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleClear = () => {
    setResult(null);
    setFileName(null);
    setError(null);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-[var(--text-primary)]">
        Lead List (CSV / TXT)<span className="text-red-400 ml-0.5">*</span>
      </label>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200',
          dragging
            ? 'border-indigo-500 bg-indigo-500/8 scale-[1.01]'
            : result
            ? 'border-green-500/40 bg-green-500/5'
            : error
            ? 'border-red-500/40 bg-red-500/5'
            : 'border-[var(--border-default)] hover:border-indigo-500/50 hover:bg-[var(--bg-elevated)]',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Spinner size="md" />
            <p className="text-sm text-[var(--text-secondary)]">Uploading and parsing…</p>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center gap-1">
            <svg className="w-8 h-8 text-green-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-400 truncate max-w-full">{fileName}</p>
            <p className="text-xs text-[var(--text-muted)]">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="text-indigo-400 font-medium">Click to upload</span> or drag & drop
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">CSV or TXT, max 5MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Parse result breakdown */}
      {result && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
              Parse Results
            </p>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Total rows', value: result.totalRows },
              { label: 'Valid emails', value: result.validEmails },
              { label: 'Duplicates', value: result.duplicates },
              {
                label: 'Unique emails',
                value: result.uniqueEmails,
                highlight: true,
              },
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className={[
                  'rounded-lg p-2.5 border',
                  highlight
                    ? 'border-indigo-500/30 bg-indigo-500/10'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]',
                ].join(' ')}
              >
                <p
                  className={[
                    'text-lg font-bold leading-tight',
                    highlight ? 'text-indigo-300' : 'text-[var(--text-primary)]',
                  ].join(' ')}
                >
                  {value}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
