import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import type { Locale } from '../lib/i18n';

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  locale: Locale;
  className?: string;
}

export default function ShareButton({
  title,
  text,
  url,
  locale,
  className = '',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const isMr = locale === 'mr';

  const handleShare = async () => {
    // Analytics tracking (fire and forget)
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'share_click',
          page_path: window.location.pathname,
          locale,
        }),
      }).catch(() => {});
    } catch {}

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: Copy URL to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback prompt
      window.prompt(isMr ? 'लिंक कॉपी करा:' : 'Copy link:', url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={isMr ? 'शेअर करा' : 'Share'}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-surface-border bg-white text-ink-secondary hover:bg-surface-muted hover:text-ink-primary transition-colors ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-green-700 font-semibold">
            {isMr ? 'लिंक कॉपी झाली!' : 'Copied!'}
          </span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4 text-ink-muted" />
          <span>{isMr ? 'शेअर करा' : 'Share'}</span>
        </>
      )}
    </button>
  );
}
