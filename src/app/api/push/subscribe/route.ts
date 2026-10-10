import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validateSubscription } from "@/lib/push";
import { badRequest } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const sub = validateSubscription(await readJson(request));
  if (!sub) return badRequest("Suscripcion invalida");
  try {
    const { error } = await getSupabaseAdmin()
      .from("push_subscriptions")
      .upsert(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          prefs: sub.prefs,
          locale: sub.locale,
          updated_at: new Date().toISOString(),
          failures: 0,
        },
        { onConflict: "endpoint" }
      );
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, prefs: sub.prefs }, { headers: NO_STORE });
  } catch (error) {
    console.error("[api/push/subscribe]", error);
    return NextResponse.json({ success: false, error: "No se pudo guardar" }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(request: Request) {
  const body = await readJson(request);
  const endpoint =
    typeof body === "object" && body !== null ? (body as { endpoint?: unknown }).endpoint : undefined;
  if (typeof endpoint !== "string" || !endpoint) return badRequest("Falta endpoint");
  try {
    const { error } = await getSupabaseAdmin().from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("[api/push/subscribe]", error);
    return NextResponse.json({ success: false, error: "No se pudo borrar" }, { status: 500, headers: NO_STORE });
  }
}
