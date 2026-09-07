import { NextResponse } from "next/server";
import { fetchLiveFires } from "@/lib/firms";

export async function GET() {
  try {
    const data = await fetchLiveFires();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
