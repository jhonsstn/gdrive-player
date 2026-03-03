import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.email) {
    redirect("/player");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-secondary)",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
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
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", letterSpacing: "-0.01em" }}>
            Drive Player
          </h1>
        </div>
      </header>

      <main style={{ flex: 1, padding: "4rem 2rem", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="card" style={{ maxWidth: "400px", width: "100%", textAlign: "center", padding: "3rem 2rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
           <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, var(--bg-tertiary), var(--border-color))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.5rem",
              border: "1px solid var(--border-focus)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          
          <h2 style={{ marginBottom: "0.5rem" }}>Welcome to Drive Player</h2>
          <p style={{ marginBottom: "2.5rem", fontSize: "0.95rem" }}>Sign in to access and manage your Google Drive videos.</p>
          
          <Link 
            href="/api/auth/signin" 
            className="button primary" 
            style={{ 
              display: "inline-flex", 
              width: "100%",
              padding: "0.75rem 1rem", 
              backgroundColor: "white", 
              color: "black", 
              borderRadius: "var(--radius-md)", 
              fontWeight: 500,
              gap: "0.5rem"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Link>
        </div>
      </main>
    </div>
  );
}
