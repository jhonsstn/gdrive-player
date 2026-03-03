import { redirect } from "next/navigation";
import { auth } from "@/auth";

import { PlayerClient } from "./PlayerClient";

export const dynamic = "force-dynamic";

export default async function PlayerPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/");
  }

  return <PlayerClient />;
}
