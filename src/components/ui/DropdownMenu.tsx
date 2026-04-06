"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

export type DropdownMenuItem = {
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
};

type DropdownMenuProps = {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  className?: string;
};

export function DropdownMenu({ trigger, items, align = "right", className = "" }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsOpen((prev) => !prev);
          }
        }}
        className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 rounded-md flex items-center justify-center"
      >
        {trigger}
      </div>

      {isOpen ? (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } z-20 mt-2 min-w-[160px] max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl`}
        >
          {items.map((item, index) =>
            item.divider ? (
              <div key={index} className="border-t border-zinc-700 my-1" />
            ) : (
              <button
                key={index}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
