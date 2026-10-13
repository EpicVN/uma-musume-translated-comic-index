import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "umazing_secret_2026";

  if (secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret token" }, { status: 401 });
  }

  try {
    // revalidatePath("/", "layout") sẽ tự động dọn sạch cache của toàn bộ page,
    // bao gồm cả getFilterOptions lẫn feed data trên homepage mà không lo lệch type
    revalidatePath("/", "layout");

    return NextResponse.json({
      revalidated: true,
      timestamp: new Date().toISOString(),
      message: "Cache purged successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ revalidated: false, error: message }, { status: 500 });
  }
}