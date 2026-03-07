import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { DriveRequestError, getStreamPassthroughHeaders, streamDriveFile } from "@/lib/drive";

type RouteParams = {
  params: Promise<{ fileId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing Google Drive access token" }, { status: 401 });
  }

  const { fileId } = await params;

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  try {
    const upstream = await streamDriveFile(
      session.accessToken,
      fileId,
      request.headers.get("range"),
    );

    const headers = getStreamPassthroughHeaders(upstream.headers);
    if (!headers.get("content-type")) {
      headers.set("content-type", "application/octet-stream");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    if (error instanceof DriveRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
