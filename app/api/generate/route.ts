import { NextResponse } from "next/server";
import {
  enhancePrompt,
  type Branch,
  type Country,
  type PatchShape,
  type PatchStyle,
} from "@/lib/promptEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateRequest {
  country: Country;
  branch: Branch;
  style: PatchStyle;
  idea: string;
  motto?: string;
  squadron?: string;
  shape?: PatchShape;
  count?: number; // default 4 for the 2x2 grid
}

const OPENAI_URL = "https://api.openai.com/v1/images/generations";

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  // 1) Verify the env var is actually present at request time.
  if (!apiKey) {
    console.error(
      "[/api/generate] OPENAI_API_KEY is missing at runtime.",
      {
        vercelEnv: process.env.VERCEL_ENV ?? "unknown",
        nodeEnv: process.env.NODE_ENV,
      },
    );
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured on the server. Add it in Vercel → Project → Settings → Environment Variables and redeploy.",
      },
      { status: 500 },
    );
  }

  // Log a masked fingerprint so Vercel logs confirm *which* key is in use
  // without ever leaking it.
  console.log("[/api/generate] using key", {
    length: apiKey.length,
    fingerprint: `${apiKey.slice(0, 3)}…${apiKey.slice(-3)}`,
    vercelEnv: process.env.VERCEL_ENV ?? "unknown",
  });

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch (err) {
    console.error("[/api/generate] invalid JSON body", err);
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body?.idea || body.idea.trim().length < 2) {
    return NextResponse.json(
      { error: "Please provide an idea of at least 2 characters." },
      { status: 400 },
    );
  }

  const enhanced = enhancePrompt({
    country: body.country,
    branch: body.branch,
    style: body.style,
    shape: body.shape,
    idea: body.idea,
    motto: body.motto,
    squadron: body.squadron,
  });

  const count = Math.min(Math.max(body.count ?? 4, 1), 4);
  const variants = [
    "front-facing heraldic layout",
    "rotated 15° with dynamic action posing",
    "simplified iconic silhouette version",
    "ornate detailed version with finer stitching",
  ].slice(0, count);

  const results = await Promise.allSettled(
    variants.map((variant, i) =>
      callDalle(apiKey, `${enhanced.prompt}, ${variant}`, i),
    ),
  );

  const images: string[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      images.push(r.value);
    } else {
      const reason =
        r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push(`slot ${i + 1}: ${reason}`);
    }
  });

  if (images.length === 0) {
    console.error("[/api/generate] ALL image generations failed", {
      count,
      errors,
      promptPreview: enhanced.prompt.slice(0, 200),
    });
    return NextResponse.json(
      {
        error: "All image generations failed.",
        detail: errors,
        hint:
          "Check Vercel logs for the full OpenAI error. Common causes: " +
          "account has no DALL·E 3 access, insufficient credits, " +
          "content-policy rejection, or rate limit.",
      },
      { status: 502 },
    );
  }

  if (errors.length) {
    console.warn("[/api/generate] partial failures", errors);
  }

  return NextResponse.json({
    prompt: enhanced.prompt,
    negativePrompt: enhanced.negativePrompt,
    tags: enhanced.tags,
    palette: enhanced.palette,
    images,
    partialErrors: errors.length ? errors : undefined,
  });
}

async function callDalle(
  apiKey: string,
  prompt: string,
  slot: number,
): Promise<string> {
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
        response_format: "url",
      }),
    });

    // OpenAI always returns JSON for both success and error; parse once.
    const raw = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(raw);
    } catch {
      // leave as null; raw text will be surfaced below
    }

    if (!res.ok) {
      const apiError = extractOpenAIError(json) ?? raw.slice(0, 300);
      console.error(`[/api/generate] slot ${slot} OpenAI ${res.status}`, {
        status: res.status,
        apiError,
        promptPreview: prompt.slice(0, 200),
      });
      throw new Error(`OpenAI ${res.status}: ${apiError}`);
    }

    const url = (json as { data?: Array<{ url?: string }> })?.data?.[0]?.url;
    if (!url) {
      console.error(`[/api/generate] slot ${slot} no URL in response`, json);
      throw new Error("OpenAI returned no image URL");
    }
    return url;
  } catch (err) {
    // Network-level failures (DNS, timeout, fetch rejection) also land here.
    console.error(`[/api/generate] slot ${slot} fetch threw`, err);
    throw err;
  }
}

function extractOpenAIError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const maybeErr = (json as { error?: { message?: string; code?: string; type?: string } }).error;
  if (!maybeErr) return null;
  const parts = [maybeErr.code, maybeErr.type, maybeErr.message].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}
