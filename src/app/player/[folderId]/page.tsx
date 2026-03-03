import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { db } from "@/lib/db";

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

  const folder = await db.configuredFolder.findFirst({
    where: { folderId },
    select: { name: true },
  });

  return (
    <PlayerClient
      folderId={folderId}
      folderName={folder?.name ?? null}
      userImage={session.user.image ?? null}
      userName={session.user.name ?? null}
      isAdmin={isAdminSession(session)}
    />
  );
}
