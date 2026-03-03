import { redirect } from "next/navigation";
import { auth } from "@/auth";

import { FolderSelectionClient } from "./FolderSelectionClient";

export const dynamic = "force-dynamic";

export default async function PlayerPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/");
  }

  return <FolderSelectionClient />;
}
