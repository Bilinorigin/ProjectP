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

/**
 * Node's fetch (undici) rejects any header byte outside 0x00-0xFF with a
 * TypeError, and OpenAI rejects anything that isn't a clean `sk-...` key.
 *
 * When a key is pasted from a Hebrew terminal / RTL editor it can silently
 * carry bidi marks (U+200E/F, U+202A–E), zero-width spaces (U+200B–D),
 * a BOM (U+FEFF), or wrapping quotes — all of which break the header.
 *
 * This helper strips every non-printable-ASCII byte so whatever we hand to
 * `Authorization` is guaranteed to be a valid HTTP header value.
 */
function sanitizeApiKey(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/^\uFEFF/, "")                 // BOM
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "") // zero-width + bidi
    .replace(/^["'`]|["'`]$/g, "")          // wrapping quotes
    .replace(/[^\x20-\x7E]/g, "")          // keep only printable ASCII
    .trim();
}

function extractOpenAIError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const err = (json as {
    error?: { message?: string; code?: string; type?: string };
  }).error;
  if (!err) return null;
  return [err.code, err.type, err.message].filter(Boolean).join(" | ") || null;
}

export async function POST(req: Request) {
  // 1) Read + sanitize the API key.
  const rawKey = process.env.OPENAI_API_KEY;
  const apiKey = sanitizeApiKey(rawKey);

  if (!apiKey) {
    console.error("[/api/generate] OPENAI_API_KEY missing or invalid", {
      rawPresent: Boolean(rawKey),
      rawLength: rawKey?.length ?? 0,
      sanitizedLength: apiKey.length,
      vercelEnv: process.env.VERCEL_ENV ?? "unknown",
    });
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured (or was empty after stripping non-ASCII characters). Re-paste the key in Vercel → Settings → Environment Variables, making sure there are no hidden characters, then redeploy.",
      },
      { status: 500 },
    );
  }

  // 2) Hard guarantee: the key we pass to Authorization must be ASCII-only.
  if (!/^[\x20-\x7E]+$/.test(apiKey)) {
    console.error(
      "[/api/generate] API key still contains non-ASCII bytes after sanitize",
    );
    return NextResponse.json(
      { error: "API key contains invalid characters." },
      { status: 500 },
    );
  }

  // Masked fingerprint in logs — confirms which key is in use without leaking.
  console.log("[/api/generate] key ok", {
    length: apiKey.length,
    fingerprint: `${apiKey.slice(0, 3)}…${apiKey.slice(-3)}`,
    vercelEnv: process.env.VERCEL_ENV ?? "unknown",
  });

  // 3) Parse body.
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

  // 4) Build the enhanced prompt. Hebrew / unicode in `idea`, `motto`,
  //    or `squadron` is fine — it only ever travels in the request BODY,
  //    which is explicitly UTF-8 encoded below.
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

  // 5) Call DALL·E 3 sequentially (not parallel) so we don't trip per-minute
  //    rate limits on low-tier OpenAI orgs. If we hit a fatal org-wide error
  //    (billing cap, invalid key, rate limit), stop immediately — every
  //    further attempt will fail for the same reason and just burns latency.
  const images: string[] = [];
  const errors: string[] = [];
  let fatalCode: string | null = null;

  for (let i = 0; i < variants.length; i++) {
    try {
      const url = await callDalle(apiKey, `${enhanced.prompt}, ${variants[i]}`, i);
      images.push(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`slot ${i + 1}: ${msg}`);
      if (isFatalOrgError(msg)) {
        fatalCode = extractErrorCode(msg);
        console.warn(
          `[/api/generate] fatal org-level error (${fatalCode}); aborting remaining slots`,
        );
        break;
      }
    }
  }

  if (images.length === 0) {
    console.error("[/api/generate] ALL image generations failed", {
      count,
      errors,
      fatalCode,
      promptPreview: enhanced.prompt.slice(0, 200),
    });
    return NextResponse.json(
      {
        error: "All image generations failed.",
        code: fatalCode,
        detail: errors,
        hint:
          "Check Vercel runtime logs for the full OpenAI error. Common causes: " +
          "insufficient_quota, billing_hard_limit_reached, rate_limit_exceeded, " +
          "content_policy_violation, invalid_api_key.",
      },
      { status: 502 },
    );
  }

  if (errors.length) {
    console.warn("[/api/generate] partial failures", { fatalCode, errors });
  }

  return NextResponse.json({
    prompt: enhanced.prompt,
    negativePrompt: enhanced.negativePrompt,
    tags: enhanced.tags,
    palette: enhanced.palette,
    images,
    partialErrors: errors.length ? errors : undefined,
    code: fatalCode,
  });
}

// Errors that are about the *organization* rather than the specific prompt.
// No point retrying sibling slots — they'll all fail identically.
function isFatalOrgError(message: string): boolean {
  return /billing_hard_limit_reached|insufficient_quota|rate_limit_exceeded|invalid_api_key|account_deactivated/i.test(
    message,
  );
}

function extractErrorCode(message: string): string | null {
  const m = message.match(
    /billing_hard_limit_reached|insufficient_quota|rate_limit_exceeded|invalid_api_key|account_deactivated|content_policy_violation/i,
  );
  return m ? m[0] : null;
}

async function callDalle(
  apiKey: string,
  prompt: string,
  slot: number,
): Promise<string> {
  // Body — explicitly UTF-8 encoded. This is the ONLY place unicode may live;
  // headers stay strict ASCII.
  const payload = {
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    style: "vivid",
    response_format: "url",
  };
  const bodyBytes = new TextEncoder().encode(JSON.stringify(payload));

  // Headers — constructed via Headers() so any bad byte fails loudly here
  // (inside the try) rather than deep inside undici.
  const headers = new Headers();
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Accept", "application/json");

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers,
      body: bodyBytes,
      cache: "no-store",
    });

    // OpenAI returns JSON for both success and error; parse once.
    const raw = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(raw);
    } catch {
      /* leave as null — raw text will be surfaced */
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
    // Catches TypeError from undici (bad header), network failures, and the
    // re-thrown OpenAI errors above — everything goes to the logs with the
    // slot index and a preview of the prompt that triggered it.
    console.error(`[/api/generate] slot ${slot} fetch threw`, {
      name: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
      promptPreview: prompt.slice(0, 200),
    });
    throw err;
  }
}
