import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";

import { PlayerClient } from "../PlayerClient";

export const dynamic = "force-dynamic";

type PlayerFolderPageProps = {
  params: Promise<{ folderId: string }>;
};

export default async function PlayerFolderPage({ params }: PlayerFolderPageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/");
  }

  const { folderId } = await params;

  return (
    <PlayerClient
      folderId={folderId}
      userImage={session.user.image ?? null}
      userName={session.user.name ?? null}
      isAdmin={isAdminSession(session)}
    />
  );
}
