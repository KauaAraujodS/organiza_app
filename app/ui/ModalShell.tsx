"use client";

import { memo, ReactNode } from "react";

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

function ModalShell({
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
        className="modal-overlay absolute inset-0"
        onClick={onClose}
        aria-label="Fechar modal"
      />
      <div
        className={`modal-surface relative z-10 w-full overflow-hidden ${maxWidthClass} rounded-3xl p-6 [transform:translateZ(0)]`}
        style={maxWidthPx ? { maxWidth: `${maxWidthPx}px` } : undefined}
      >
        <div className="mb-5">
          <h2 className="modal-title text-2xl font-semibold">{title}</h2>
          {subtitle ? <p className="modal-subtitle mt-1 text-sm">{subtitle}</p> : null}
        </div>

        <div className="max-h-[58vh] overflow-y-auto overscroll-contain pr-1 md:max-h-[62vh]">{children}</div>

        {footer ? <div className="mt-6 flex items-center justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export default memo(ModalShell);
