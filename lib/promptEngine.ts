/**
 * PatchBase Prompt Engine
 * ------------------------------------------------------------------
 * Takes a short user idea + tactical metadata (country, branch, style,
 * shape, etc.) and assembles a richly-described prompt suitable for
 * an image diffusion model focused on military / tactical patches.
 *
 * Hebrew Adaptation Layer
 * -----------------------
 * DALL·E 3 and similar models frequently render Hebrew as mirrored or
 * garbled glyphs. To compensate we:
 *   1. Detect Hebrew in idea / motto / squadron fields.
 *   2. Append explicit "Hebrew typography, render RTL correctly, bold
 *      modern tactical font, no mirrored characters" directives.
 *   3. Attach an English semantic translation alongside the Hebrew so
 *      the model still understands the concept even if letter-shapes
 *      degrade (e.g. "טייסת 106" → "Squadron 106").
 *   4. For longer/complex Hebrew, force a dedicated curved banner
 *      region so any font imperfections stay contained.
 *   5. For country "IL" (IDF / IAF), default to bilingual Hebrew/English
 *      composition — the norm on real-world IAF shoulder patches.
 */

export type Country = "IL" | "US" | "INT";
export type Branch =
  | "IAF"
  | "IDF"
  | "USAF"
  | "USMC"
  | "USARMY"
  | "USN"
  | "NATO"
  | "PMC";

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
  /** True if any input text contained Hebrew characters. Useful for telemetry. */
  hebrewDetected: boolean;
}

/* ============================================================ */
/* Style / branch / country reference data                      */
/* ============================================================ */

const STYLE_RULES: Record<PatchStyle, { texture: string; finish: string }> = {
  embroidery: {
    texture:
      "highly detailed embroidery thread texture, visible satin and chain stitching, merrowed border",
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
      "contemporary Israeli Air Force squadron morale patch in the aesthetic of modern pvcpatch_il style studios",
      "bold illustrated design, often a cinematic scene or a character-driven composition rather than a plain heraldic crest",
      "modern jet silhouettes: F-35I Adir, F-15I Ra'am, F-16I Sufa, and combat helicopters",
      "prominent IAF roundel (Star of David inside a circle) integrated naturally into the design",
      "bilingual typography: Hebrew unit name on an upper banner, English designation or date on a lower banner",
      "vivid saturated colors acceptable (purple, yellow, scarlet, teal) alongside the IAF blue/grey signature",
      "tongue-in-cheek squadron humor or operational gravitas as appropriate to the concept",
    ],
    palette: ["IAF blue #1F3A5F", "steel grey #6E7B85", "off-white #E8E6DD"],
    defaultShape: "circle",
  },
  IDF: {
    keywords: [
      "contemporary IDF unit morale patch aesthetic, bold illustrated style",
      "operational scene composition: desert terrain, night ops, armored vehicles, tactical gear",
      "prominent Star of David or unit emblem, integrated not hidden",
      "bilingual layout: Hebrew unit name on one banner, English or operation name on another",
      "vivid saturated accent colors alongside the olive/khaki ground-forces base",
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

/* Mandatory perspective lock - prepended to every prompt so the AI never
 * produces tilted, isometric, or 3D-rendered patch mockups. Flat-lay only. */
const MANDATORY_PERSPECTIVE =
  "perfectly centered flat-lay, symmetrical front view, orthographic perspective, top-down camera, head-on straight-on view, zero tilt, zero rotation, zero perspective distortion, zero foreshortening";

const NEGATIVE =
  "3D render, isometric view, tilted angle, rotated view, perspective distortion, foreshortening, depth of field, side view, three-quarter view, photo, photograph, photorealistic skin, real human face, low-res, blurry, jpeg artifacts, watermark, text errors, gibberish letters, mirrored letters, reversed text, extra fingers, cluttered background, modern logo, brand mark";

/* ============================================================ */
/* Hebrew adaptation layer                                       */
/* ============================================================ */

const HEBREW_RANGE = /[\u0590-\u05FF]/;

/** Word-level translation of common IDF/IAF military vocabulary.
 *  Applied BEFORE letter-level transliteration so phrases like
 *  "טייסת 106" become "Squadron 106" instead of "teyeset 106". */
const HEBREW_TERM_MAP: Record<string, string> = {
  // Units
  "טייסת": "Squadron",
  "גדוד": "Battalion",
  "חטיבה": "Brigade",
  "פלוגה": "Company",
  "מחלקה": "Platoon",
  "יחידה": "Unit",
  "חיל": "Corps",
  "צבא": "Army",
  "צה\"ל": "IDF",
  "צהל": "IDF",
  // Branches
  "אוויר": "Air",
  "אויר": "Air",
  "ים": "Navy",
  "יבשה": "Ground",
  "שריון": "Armor",
  "צנחנים": "Paratroopers",
  "גולני": "Golani",
  "גבעתי": "Givati",
  "נחל": "Nahal",
  "כפיר": "Kfir",
  "מודיעין": "Intelligence",
  "הנדסה": "Engineering",
  // Imagery
  "נשר": "Eagle",
  "אריה": "Lion",
  "זאב": "Wolf",
  "דרקון": "Dragon",
  "עקרב": "Scorpion",
  "כוכב": "Star",
  "ברק": "Lightning",
  "אש": "Fire",
  "רעם": "Thunder",
  "סער": "Storm",
  "סערה": "Storm",
  "חרב": "Sword",
  "חנית": "Spear",
  "חץ": "Arrow",
  "מגן": "Shield",
  "כנף": "Wing",
  "כנפיים": "Wings",
  "דגל": "Flag",
  "לוחם": "Warrior",
  "אביר": "Knight",
  "אבירי": "Knights of",
  // Platforms
  "בז": "Falcon",
  "בז\"ק": "Ra'am (F-15I)",
  "סופה": "Sufa (F-16I)",
  "נץ": "Netz (F-16A/B)",
  "ברק_מטוס": "Barak (F-16C/D)",
  "מרכבה": "Merkava",
};

/** Letter-level phonetic fallback used when a word isn't in the term map. */
const HEBREW_LETTER_MAP: Record<string, string> = {
  "א": "a", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z",
  "ח": "ch", "ט": "t", "י": "y", "כ": "k", "ך": "kh", "ל": "l", "מ": "m",
  "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "a", "פ": "p", "ף": "f",
  "צ": "tz", "ץ": "tz", "ק": "k", "ר": "r", "ש": "sh", "ת": "t",
};

function containsHebrew(s: string | undefined): boolean {
  return Boolean(s && HEBREW_RANGE.test(s));
}

function transliterateWord(word: string): string {
  if (HEBREW_TERM_MAP[word]) return HEBREW_TERM_MAP[word];
  let out = "";
  for (const ch of word) out += HEBREW_LETTER_MAP[ch] ?? ch;
  return out;
}

/** Produce an English-readable version of a mixed Hebrew/Latin string.
 *  "טייסת 106" → "Squadron 106"
 *  "אבירי הזנב הכתום" → "Knights of hazanav hakatom" */
function translateHebrew(s: string): string {
  return s
    .split(/(\s+)/)
    .map((chunk) => (/^\s+$/.test(chunk) ? chunk : transliterateWord(chunk)))
    .join("")
    .trim();
}

interface HebrewAnalysis {
  any: boolean;
  fields: {
    idea: boolean;
    motto: boolean;
    squadron: boolean;
  };
  totalHebrewChars: number;
  ideaEnglish: string;
  mottoEnglish: string;
  squadronEnglish: string;
}

function analyseHebrew(input: PromptInput): HebrewAnalysis {
  const ideaHas = containsHebrew(input.idea);
  const mottoHas = containsHebrew(input.motto);
  const sqHas = containsHebrew(input.squadron);
  const any = ideaHas || mottoHas || sqHas;
  const count = (s: string | undefined) =>
    (s?.match(/[\u0590-\u05FF]/g)?.length ?? 0);
  return {
    any,
    fields: { idea: ideaHas, motto: mottoHas, squadron: sqHas },
    totalHebrewChars:
      count(input.idea) + count(input.motto) + count(input.squadron),
    ideaEnglish: ideaHas ? translateHebrew(input.idea) : input.idea,
    mottoEnglish: mottoHas && input.motto ? translateHebrew(input.motto) : (input.motto ?? ""),
    squadronEnglish:
      sqHas && input.squadron ? translateHebrew(input.squadron) : (input.squadron ?? ""),
  };
}

/* ============================================================ */
/* Public API                                                    */
/* ============================================================ */

/** Strip style-vocabulary from the user's idea so the selected style
 *  dropdown is the single source of truth. Prevents the "embroidery patch
 *  of an F-15 PVC patch" contradiction when users redundantly type
 *  style words into the concept field. */
function cleanIdea(raw: string): string {
  return raw
    .replace(
      /\b(patch(es)?|morale|embroider\w*|pvc|leather|laser[- ]?cut|subdued|velcro|hook[- ]?and[- ]?loop)\b/gi,
      "",
    )
    .replace(/[ ,]+/g, " ")
    .replace(/^\s*[,;:\-]+\s*|\s*[,;:\-]+\s*$/g, "")
    .trim();
}

function styleAdjective(style: PatchStyle): string {
  switch (style) {
    case "embroidery": return "embroidered";
    case "pvc": return "molded PVC rubber";
    case "subdued": return "subdued low-visibility embroidered";
    case "leather": return "tooled leather";
    case "laser": return "laser-cut multicam fabric";
  }
}

function shapeAdjective(shape: PatchShape): string {
  switch (shape) {
    case "circle": return "circular";
    case "shield": return "shield-shaped";
    case "rectangle": return "rectangular";
    case "tab": return "narrow tab-style";
    case "rocker": return "curved rocker-style";
  }
}

/**
 * Enhance a short user idea into a structured, natural-language prompt
 * tuned for DALL-E 3 with automatic Hebrew adaptation.
 *
 * Key design choices (informed by DALL-E 3 quirks):
 *  - Full sentences, not CSV keyword soup (DALL-E 3 weighs sentence
 *    structure strongly).
 *  - One style anchor only - cleanIdea() strips style-conflict words
 *    from the concept field so there are no contradictions.
 *  - Composition / perspective rules live at the END of the prompt where
 *    DALL-E 3's recency weighting gives them the most pull.
 *  - Concise: aim for ~450-600 chars. Longer prompts dilute every token.
 */
export function enhancePrompt(input: PromptInput): EnhancedPrompt {
  const branch = BRANCH_RULES[input.branch];
  const style = STYLE_RULES[input.style];
  const shape = input.shape ?? branch.defaultShape;
  const subject = cleanIdea(input.idea.trim()) || "an abstract heraldic emblem";
  const analysis = analyseHebrew({ ...input, idea: subject });

  const styleAdj = styleAdjective(input.style);
  const shapeAdj = shapeAdjective(shape);
  const subjectEnglish = analysis.fields.idea ? analysis.ideaEnglish : subject;

  const sentences: string[] = [];

  // 1) Opening shot — the patch itself + style anchor, single source of truth.
  sentences.push(
    `A ${shapeAdj} ${styleAdj} military morale patch, rendered as a flat-lay product photograph on a plain dark fabric surface.`,
  );

  // 2) Subject / iconography.
  sentences.push(
    `The central design depicts ${subjectEnglish}, drawing on ${branch.keywords[0]}.`,
  );

  // 3) Branch heritage detail (one extra keyword, not all five).
  if (branch.keywords[1]) {
    sentences.push(`Iconography cues: ${branch.keywords[1]}.`);
  }

  // 4) Style / texture.
  sentences.push(`${style.texture}, ${style.finish}.`);

  // 5) Palette - dominant anchor + freedom for saturated accents where the
  //    subject calls for it (matches real pvcpatch_il aesthetic).
  sentences.push(
    `Dominant color palette anchored by ${branch.palette.join(", ")}, with freedom to introduce one or two saturated accent colors (scarlet, gold, purple, teal, yellow) where the subject calls for it.`,
  );

  // 6) Text elements — explicit banner placement for readability.
  const textElements: string[] = [];
  if (input.squadron) {
    const sqTxt = input.squadron.trim();
    textElements.push(
      analysis.fields.squadron
        ? `a clean bold squadron number "${sqTxt}" (meaning: ${analysis.squadronEnglish})`
        : `a clean bold squadron number "${sqTxt}"`,
    );
  }
  if (input.motto) {
    const mtTxt = input.motto.trim();
    textElements.push(
      analysis.fields.motto
        ? `a curved ribbon banner at the bottom with the Hebrew motto "${mtTxt}" (meaning: ${analysis.mottoEnglish})`
        : `a curved ribbon banner at the bottom reading "${mtTxt}"`,
    );
  }
  if (textElements.length) {
    sentences.push(
      `Text elements: ${textElements.join("; ")}. Keep all lettering crisp, legible, and spelled correctly.`,
    );
  }

  // 7) Hebrew rendering directives (only when Hebrew present).
  if (analysis.any) {
    sentences.push(
      "Any Hebrew text must render correctly right-to-left in a bold modern tactical sans-serif Hebrew font; do not mirror, reverse, or garble the letters.",
    );
  }
  if (analysis.totalHebrewChars > 8) {
    sentences.push(
      "Contain all Hebrew text inside a dedicated curved ribbon banner so any rendering imperfections stay visually isolated from the main emblem.",
    );
  }

  // 8) Aesthetic directive for Israeli patches - match the contemporary
  //    IAF/IDF morale-patch visual language (pvcpatch_il reference), which
  //    is illustrated and character-driven, NOT a classic heraldic crest.
  if (input.country === "IL") {
    sentences.push(
      "Render in the contemporary Israeli morale-patch visual language seen on modern IAF and IDF squadrons: confident illustrated design (cinematic scene or character-driven composition), vivid saturated colors, bold bilingual typography with Hebrew on an upper banner and English on a lower banner, and a clearly integrated IAF roundel or Star of David where appropriate. The design should feel operational and modern, not a stiff heraldic crest.",
    );
  }

  // 9) Composition lock - LAST so DALL-E 3 weighs it heaviest. Applies to
  //    how the PATCH is photographed, not to the illustration inside it -
  //    internal scene perspective is fine and often desirable.
  sentences.push(
    "Composition rules: the patch itself is photographed as a perfectly centered flat-lay product shot, viewed head-on from directly above, with zero camera tilt, zero rotation, and no 3D-rendered angle. No shadows beneath the patch, no background clutter. (Internal illustration inside the patch may use scene perspective freely where it serves the subject.)",
  );

  return {
    prompt: sentences.join(" "),
    negativePrompt: NEGATIVE,
    tags: [
      input.country,
      input.branch,
      input.style,
      shape,
      ...branch.keywords.slice(0, 2),
      ...(analysis.any ? ["hebrew"] : []),
      ...(input.country === "IL" ? ["bilingual"] : []),
    ],
    palette: branch.palette,
    hebrewDetected: analysis.any,
  };
}
