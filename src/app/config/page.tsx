import Link from "next/link";

import { auth } from "@/auth";
import { FolderConfigForm } from "@/components/config/FolderConfigForm";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function AdminHeader() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-secondary)",
        padding: "1rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--accent-primary), #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(59, 130, 246, 0.3)",
          }}
        >
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
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </div>
        <h1 style={{ margin: 0, fontSize: "1.25rem", letterSpacing: "-0.01em" }}>
          Admin Configuration
        </h1>
      </div>
      <Link
        href="/"
        style={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to Player
      </Link>
    </header>
  );
}

export default async function ConfigPage() {
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AdminHeader />
        <main style={{ padding: "4rem 2rem", display: "flex", justifyContent: "center" }}>
          <div className="card" style={{ maxWidth: "500px", width: "100%", textAlign: "center", padding: "3rem 2rem" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "1.5rem" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h2 style={{ marginBottom: "0.5rem" }}>Authentication Required</h2>
            <p style={{ marginBottom: "2rem" }}>You must sign in with Google first to access the admin configuration.</p>
            <Link href="/api/auth/signin" className="button primary" style={{ display: "inline-flex", padding: "0.5rem 1rem", backgroundColor: "var(--accent-primary)", color: "white", borderRadius: "var(--radius-md)", fontWeight: 500 }}>
              Sign in with Google
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdminSession(session)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AdminHeader />
        <main style={{ padding: "4rem 2rem", display: "flex", justifyContent: "center" }}>
          <div className="card" style={{ maxWidth: "500px", width: "100%", textAlign: "center", padding: "3rem 2rem", border: "1px solid var(--error-bg)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "1.5rem" }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2 style={{ marginBottom: "0.5rem" }}>Access Denied</h2>
            <p style={{ marginBottom: "2rem" }}>Your account ({session.user.email}) is not authorized to access the admin configuration.</p>
            <Link href="/" style={{ display: "inline-flex", padding: "0.5rem 1rem", backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", borderRadius: "var(--radius-md)", fontWeight: 500 }}>
              Return to Player
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const folders = await db.configuredFolder.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AdminHeader />
      <main style={{ padding: "3rem 2rem", maxWidth: "var(--max-w)", width: "100%", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Drive Folders</h2>
            <p style={{ margin: "0.5rem 0 0 0", color: "var(--text-secondary)" }}>
              Manage the folders synced to the video player.
            </p>
          </div>
          <div style={{ padding: "0.25rem 0.75rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", fontSize: "0.875rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--accent-primary)" }}></div>
            {session.user.email}
          </div>
        </div>

        <FolderConfigForm
          initialFolders={folders.map((folder) => ({
            ...folder,
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
