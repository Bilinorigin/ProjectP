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
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
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

  // DALL·E 3 only supports n=1 per request, so fan out in parallel
  const count = Math.min(Math.max(body.count ?? 4, 1), 4);

  // Slight prompt variation per slot so the grid shows distinct candidates
  const variants = [
    "front-facing heraldic layout",
    "rotated 15° with dynamic action posing",
    "simplified iconic silhouette version",
    "ornate detailed version with finer stitching",
  ].slice(0, count);

  const results = await Promise.allSettled(
    variants.map((variant) =>
      callDalle(apiKey, `${enhanced.prompt}, ${variant}`),
    ),
  );

  const images: string[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") images.push(r.value);
    else errors.push(`slot ${i + 1}: ${r.reason}`);
  });

  if (images.length === 0) {
    return NextResponse.json(
      { error: "All image generations failed.", detail: errors },
      { status: 502 },
    );
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

async function callDalle(apiKey: string, prompt: string): Promise<string> {
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

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 180)}`);
  }

  const json = (await res.json()) as { data?: Array<{ url?: string }> };
  const url = json.data?.[0]?.url;
  if (!url) throw new Error("OpenAI returned no image URL");
  return url;
}
