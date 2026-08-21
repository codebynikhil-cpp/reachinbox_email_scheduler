import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, id, className = '', ...props }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
          {props.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}

      <textarea
        id={textareaId}
        {...props}
        className={[
          'w-full bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
          'border rounded-lg px-3 py-2 text-sm resize-y transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500',
          'min-h-[100px]',
          error
            ? 'border-red-500/60 focus:ring-red-500/30 focus:border-red-500'
            : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      />

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
