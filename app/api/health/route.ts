import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check for the OPENAI_API_KEY wiring.
 * Visit /api/health in the browser to verify the key is attached on
 * the current environment (local / Vercel preview / Vercel prod).
 *
 * The key itself is never returned — only a boolean + masked fingerprint.
 */
export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  const present = Boolean(key && key.length > 10);

  if (!present) {
    return NextResponse.json(
      {
        ok: false,
        keyConfigured: false,
        message:
          "OPENAI_API_KEY is NOT set on this environment. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.",
      },
      { status: 500 },
    );
  }

  // Mask: show only length + first/last 3 chars so you can confirm it's the
  // right key without leaking it.
  const masked = `${key!.slice(0, 3)}…${key!.slice(-3)}`;

  // Probe OpenAI with a cheap, read-only call to confirm the key actually works.
  let openaiReachable = false;
  let openaiStatus: number | null = null;
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    openaiStatus = res.status;
    openaiReachable = res.ok;
  } catch {
    openaiReachable = false;
  }

  return NextResponse.json({
    ok: openaiReachable,
    keyConfigured: true,
    keyLength: key!.length,
    keyFingerprint: masked,
    openaiReachable,
    openaiStatus,
    env: process.env.VERCEL_ENV ?? "local",
  });
}
