"use client";

import { useEffect, useRef, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Dialog({ open, onClose, children, className = "" }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    function handleClose() {
      onClose();
    }

    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  // Close on backdrop click
  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    const el = dialogRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      el.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      className={`backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-dialog-in bg-transparent p-0 ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}

type DialogContentProps = {
  children: ReactNode;
  className?: string;
};

export function DialogContent({ children, className = "" }: DialogContentProps) {
  return (
    <div
      className={`w-[90vw] max-w-md rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}

type DialogHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function DialogHeader({ children, className = "" }: DialogHeaderProps) {
  return (
    <div className={`px-6 pt-6 pb-2 ${className}`}>
      {children}
    </div>
  );
}

type DialogBodyProps = {
  children: ReactNode;
  className?: string;
};

export function DialogBody({ children, className = "" }: DialogBodyProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

type DialogFooterProps = {
  children: ReactNode;
  className?: string;
};

export function DialogFooter({ children, className = "" }: DialogFooterProps) {
  return (
    <div className={`flex items-center justify-end gap-3 border-t border-zinc-800 px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}
