"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type AppHeaderProps = {
    userImage?: string | null;
    userName?: string | null;
    showAdminLink?: boolean;
};

export function AppHeader({
    userImage,
    userName,
    showAdminLink = false,
}: AppHeaderProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false);
            }
        }

        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuOpen]);

    return (
        <header className="border-b border-zinc-800 bg-zinc-900 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
            <Link
                href="/player"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
                <div className="w-8 h-8 rounded-md gradient-logo flex items-center justify-center shadow-[0_2px_10px_rgba(59,130,246,0.3)]">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </div>
                <h1 className="text-xl font-semibold tracking-tight">
                    Drive Player
                </h1>
            </Link>

            <div className="flex items-center gap-3">
                {showAdminLink ? (
                    <Link
                        href="/config"
                        className="text-zinc-400 hover:text-zinc-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                        aria-label="Admin settings"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    </Link>
                ) : null}

                <div className="relative h-8 w-8" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => setMenuOpen((prev) => !prev)}
                        className="cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                        aria-label="User menu"
                        aria-expanded={menuOpen}
                    >
                        {userImage ? (
                            <Image
                                src={userImage}
                                alt={userName ?? "User avatar"}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded-full border border-zinc-700 object-cover"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-zinc-500"
                                >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                        )}
                    </button>

                    {menuOpen ? (
                        <div className="absolute right-0 mt-2 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-20">
                            {userName ? (
                                <div className="px-4 py-2 text-sm text-zinc-400 border-b border-zinc-800 truncate">
                                    {userName}
                                </div>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors flex items-center gap-2 cursor-pointer"
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                                Log out
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </header>
    );
}
