import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";

import { FolderSelectionClient } from "./FolderSelectionClient";

export const dynamic = "force-dynamic";

export default async function PlayerPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/");
  }

  return (
    <FolderSelectionClient
      userImage={session.user.image ?? null}
      userName={session.user.name ?? null}
      isAdmin={isAdminSession(session)}
    />
  );
}
