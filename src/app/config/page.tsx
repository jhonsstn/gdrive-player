import Link from "next/link";

import { auth } from "@/auth";
import { FolderConfigForm } from "@/components/config/FolderConfigForm";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const session = await auth();

  if (!session?.user?.email) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Admin configuration</h1>
        <p>You must sign in with Google first.</p>
        <Link href="/api/auth/signin">Sign in</Link>
      </main>
    );
  }

  if (!isAdminSession(session)) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Admin configuration</h1>
        <p>Your account is not in ADMIN_EMAILS.</p>
        <Link href="/player">Go to player</Link>
      </main>
    );
  }

  const folders = await db.configuredFolder.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Admin configuration</h1>
      <p>Signed in as {session.user.email}</p>
      <p>
        <Link href="/player">Open player</Link>
      </p>
      <FolderConfigForm
        initialFolders={folders.map((folder) => ({
          ...folder,
          createdAt: folder.createdAt.toISOString(),
          updatedAt: folder.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
