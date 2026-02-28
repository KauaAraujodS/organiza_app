"use client";

import { ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  maxWidthPx?: number;
};

export default function ModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-lg",
  maxWidthPx,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Fechar modal"
      />
      <div
        className={`relative z-10 w-full overflow-hidden ${maxWidthClass} rounded-3xl border border-white/15 bg-[#0f1117] p-6 shadow-2xl [transform:translateZ(0)]`}
        style={maxWidthPx ? { maxWidth: `${maxWidthPx}px` } : undefined}
      >
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-white/60">{subtitle}</p> : null}
        </div>

        <div className="max-h-[58vh] overflow-y-auto overscroll-contain pr-1 md:max-h-[62vh]">{children}</div>

        {footer ? <div className="mt-6 flex items-center justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
