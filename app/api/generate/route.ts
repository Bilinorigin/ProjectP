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
  count?: number;
}

const OPENAI_URL = "https://api.openai.com/v1/images/generations";

/*
 * Strip BOM, zero-width chars, bidi/RTL marks, wrapping quotes, and any
 * non-printable-ASCII byte from the API key before it touches the
 * Authorization header. Node fetch (undici) throws a TypeError
 * "ByteString" if any header byte is outside the 0x00-0xFF ASCII range.
 */
function sanitizeApiKey(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/[^\x20-\x7E]/g, "")
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

export async function POST(req: Request) {
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
          "OPENAI_API_KEY is not configured (or was empty after stripping non-ASCII characters). Re-paste the key in Vercel > Settings > Environment Variables, then redeploy.",
      },
      { status: 500 },
    );
  }

  if (!/^[\x20-\x7E]+$/.test(apiKey)) {
    console.error(
      "[/api/generate] API key still contains non-ASCII bytes after sanitize",
    );
    return NextResponse.json(
      { error: "API key contains invalid characters." },
      { status: 500 },
    );
  }

  console.log("[/api/generate] key ok", {
    length: apiKey.length,
    fingerprint: `${apiKey.slice(0, 3)}...${apiKey.slice(-3)}`,
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
    "tighter crop with bolder iconography",
    "simplified iconic silhouette version",
    "ornate detailed version with finer stitching",
  ].slice(0, count);

  const images: string[] = [];
  const errors: string[] = [];
  let fatalCode: string | null = null;

  for (let i = 0; i < variants.length; i++) {
    try {
      const url = await callDalle(
        apiKey,
        `${enhanced.prompt}, ${variants[i]}`,
        i,
      );
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
          "Check Vercel runtime logs for the full OpenAI error. Common causes: insufficient_quota, billing_hard_limit_reached, rate_limit_exceeded, content_policy_violation, invalid_api_key.",
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

async function callDalle(
  apiKey: string,
  prompt: string,
  slot: number,
): Promise<string> {
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

    const raw = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(raw);
    } catch {
      /* leave as null - raw text will be surfaced below */
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
    console.error(`[/api/generate] slot ${slot} fetch threw`, {
      name: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
      promptPreview: prompt.slice(0, 200),
    });
    throw err;
  }
}
