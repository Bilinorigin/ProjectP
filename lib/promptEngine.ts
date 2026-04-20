/**
 * PatchBase Prompt Engine
 * ------------------------------------------------------------------
 * Takes a short user idea + tactical metadata (country, branch, style,
 * shape, etc.) and assembles a richly-described prompt suitable for
 * an image diffusion model focused on military / tactical patches.
 */

export type Country = "IL" | "US" | "INT";
export type Branch =
  | "IAF"          // Israeli Air Force
  | "IDF"          // IDF generic / ground
  | "USAF"         // US Air Force
  | "USMC"         // US Marines
  | "USARMY"       // US Army
  | "USN"          // US Navy
  | "NATO"         // International / NATO
  | "PMC";         // Private / contractor

export type PatchStyle = "embroidery" | "pvc" | "subdued" | "leather" | "laser";
export type PatchShape = "circle" | "shield" | "rectangle" | "tab" | "rocker";

export interface PromptInput {
  country: Country;
  branch: Branch;
  style: PatchStyle;
  shape?: PatchShape;
  idea: string;
  motto?: string;
  squadron?: string;
}

export interface EnhancedPrompt {
  prompt: string;
  negativePrompt: string;
  tags: string[];
  palette: string[];
}

const STYLE_RULES: Record<PatchStyle, { texture: string; finish: string }> = {
  embroidery: {
    texture:
      "high-detail embroidered thread texture, visible satin and chain stitching, merrowed border edge",
    finish: "felt backing, slightly raised stitch relief, fabric weave",
  },
  pvc: {
    texture:
      "molded PVC rubber patch, crisp vector edges, layered 3D relief, soft matte finish",
    finish: "rubberized surface, hook-and-loop velcro backing",
  },
  subdued: {
    texture:
      "subdued low-visibility colorway, muted desaturated tones, IR-friendly threads",
    finish: "tonal embroidery, minimal contrast, field-worn appearance",
  },
  leather: {
    texture:
      "tooled leather patch, laser-engraved relief, burnished edges",
    finish: "saddle-tan or black leather, vintage flight-jacket aesthetic",
  },
  laser: {
    texture:
      "laser-cut multicam fabric, precision-etched lines, layered cordura",
    finish: "modern operator aesthetic, IR-compliant materials",
  },
};

const BRANCH_RULES: Record<
  Branch,
  { keywords: string[]; palette: string[]; defaultShape: PatchShape }
> = {
  IAF: {
    keywords: [
      "Israeli Air Force squadron heritage",
      "F-15 / F-16 aviation iconography",
      "Hebrew lettering accents",
      "Star of David subtle motif",
      "flight suit shoulder placement",
    ],
    palette: ["IAF blue #1F3A5F", "steel grey #6E7B85", "off-white #E8E6DD"],
    defaultShape: "circle",
  },
  IDF: {
    keywords: [
      "IDF unit insignia heritage",
      "olive drab ground-forces aesthetic",
      "Hebrew motto ribbon",
    ],
    palette: ["olive #3F4A2A", "khaki #8A7E5C", "black #0A0A0A"],
    defaultShape: "shield",
  },
  USAF: {
    keywords: [
      "US Air Force squadron heraldry",
      "winged emblem, jet silhouette",
      "scroll banner with Latin motto",
    ],
    palette: ["USAF blue #00308F", "silver #B8B8B8", "gold #C9A227"],
    defaultShape: "shield",
  },
  USMC: {
    keywords: [
      "USMC heritage, eagle globe and anchor cues",
      "bold blackletter typography",
    ],
    palette: ["scarlet #B22222", "gold #C9A227", "black #0A0A0A"],
    defaultShape: "circle",
  },
  USARMY: {
    keywords: ["US Army unit crest aesthetic", "ranger tab style"],
    palette: ["OD green #4B5320", "tan #8A7E5C", "black #0A0A0A"],
    defaultShape: "shield",
  },
  USN: {
    keywords: ["US Navy aviation squadron", "anchor and trident motifs"],
    palette: ["navy #0A1A33", "gold #C9A227", "white #FFFFFF"],
    defaultShape: "shield",
  },
  NATO: {
    keywords: ["NATO multinational task force", "compass rose motif"],
    palette: ["NATO blue #004990", "white #FFFFFF", "grey #6E7B85"],
    defaultShape: "circle",
  },
  PMC: {
    keywords: [
      "private military contractor morale patch",
      "low-vis operator aesthetic",
      "skull or spartan motif",
    ],
    palette: ["black #0A0A0A", "ranger green #4B5320", "blood red #7A1F1F"],
    defaultShape: "circle",
  },
};

const COUNTRY_FLAVOR: Record<Country, string> = {
  IL: "Israeli military design language, Mediterranean field aesthetic",
  US: "United States military heraldic tradition",
  INT: "international coalition styling, neutral heraldry",
};

const NEGATIVE =
  "photo, photograph, photorealistic skin, real human face, low-res, blurry, jpeg artifacts, watermark, text errors, gibberish letters, extra fingers, cluttered background, modern logo, brand mark";

/**
 * Enhance a short user idea into a structured, technical prompt
 * tuned for tactical patch generation.
 *
 * Example:
 *   enhancePrompt({ country: "IL", branch: "IAF", style: "embroidery", idea: "Eagle" })
 *   → "circular embroidered military patch, IAF blue/grey palette, eagle ..."
 */
export function enhancePrompt(input: PromptInput): EnhancedPrompt {
  const branch = BRANCH_RULES[input.branch];
  const style = STYLE_RULES[input.style];
  const shape = input.shape ?? branch.defaultShape;
  const idea = input.idea.trim() || "abstract emblem";

  const parts: string[] = [
    `${shape} ${input.style} military morale patch`,
    `subject: ${idea}`,
    style.texture,
    style.finish,
    ...branch.keywords,
    `palette: ${branch.palette.join(", ")}`,
    COUNTRY_FLAVOR[input.country],
    "centered composition, symmetrical heraldic layout",
    "clean vector-friendly silhouette, strong readable iconography",
    "studio product shot on dark fabric backdrop, soft directional light",
  ];

  if (input.squadron) {
    parts.push(`squadron designation: "${input.squadron.trim()}"`);
  }
  if (input.motto) {
    parts.push(`motto banner reads: "${input.motto.trim()}"`);
  }

  return {
    prompt: parts.join(", "),
    negativePrompt: NEGATIVE,
    tags: [
      input.country,
      input.branch,
      input.style,
      shape,
      ...branch.keywords.slice(0, 2),
    ],
    palette: branch.palette,
  };
}
