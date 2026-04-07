"use client";

import { CheckCircle2, Info, X } from "lucide-react";

interface NoticeModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export function NoticeModal({ open, message, onClose }: NoticeModalProps) {
  if (!open || !message) return null;

  const positive = /收藏|favorite|登录|log in/i.test(message) && !/失败|error/i.test(message);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="auth-modal-card">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-1.5 text-muted transition-colors hover:bg-[var(--border-color)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${positive ? "bg-emerald-500/10 text-emerald-300" : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"}`}>
            {positive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
            sk-buy.com
          </div>
          <div className="pr-8 text-center text-base font-bold leading-7 text-[var(--foreground)]">{message}</div>
        </div>
      </div>
    </div>
  );
}
