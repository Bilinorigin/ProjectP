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

/**
 * Enhance a short user idea into a structured, technical prompt tuned
 * for tactical patch generation — with automatic Hebrew adaptation.
 */
export function enhancePrompt(input: PromptInput): EnhancedPrompt {
  const branch = BRANCH_RULES[input.branch];
  const style = STYLE_RULES[input.style];
  const shape = input.shape ?? branch.defaultShape;
  const ideaRaw = input.idea.trim() || "abstract emblem";
  const analysis = analyseHebrew({ ...input, idea: ideaRaw });

  const parts: string[] = [
    MANDATORY_PERSPECTIVE,
    `${shape} ${input.style} military morale patch`,
    `subject: ${ideaRaw}`,
    style.texture,
    style.finish,
    ...branch.keywords,
    `palette: ${branch.palette.join(", ")}`,
    COUNTRY_FLAVOR[input.country],
    "centered composition, symmetrical heraldic layout",
    "clean vector-friendly silhouette, strong readable iconography",
    "flat-lay product photograph, evenly lit, dark fabric backdrop, no shadows beneath the patch",
  ];

  // Squadron / motto lines — always include English translation when Hebrew.
  if (input.squadron) {
    if (analysis.fields.squadron) {
      parts.push(
        `squadron designation in Hebrew: "${input.squadron.trim()}" (English meaning: "${analysis.squadronEnglish}")`,
      );
    } else {
      parts.push(`squadron designation: "${input.squadron.trim()}"`);
    }
  }
  if (input.motto) {
    if (analysis.fields.motto) {
      parts.push(
        `motto banner reads in Hebrew: "${input.motto.trim()}" (English meaning: "${analysis.mottoEnglish}")`,
      );
    } else {
      parts.push(`motto banner reads: "${input.motto.trim()}"`);
    }
  }

  // Idea with bilingual pairing so the model still "understands" the concept
  // even if the Hebrew letterforms render imperfectly.
  if (analysis.fields.idea) {
    parts.push(
      `the concept in English is: "${analysis.ideaEnglish}" — use this meaning to drive the iconography`,
    );
  }

  // ===== Hebrew-specific rendering directives =====
  if (analysis.any) {
    parts.push(
      "the patch features HEBREW TYPOGRAPHY: ensure Hebrew letters are rendered correctly right-to-left, using a bold modern tactical sans-serif Hebrew font; preserve letter shapes (aleph, bet, gimel, etc.); do NOT mirror, flip, or reverse characters; do NOT produce gibberish or Latin-looking approximations",
    );
  }

  // Banner fallback — if the Hebrew text is non-trivial (>8 chars total),
  // contain it inside a dedicated curved ribbon so imperfect glyph rendering
  // doesn't contaminate the main composition.
  if (analysis.totalHebrewChars > 8) {
    parts.push(
      "reserve a dedicated curved top or bottom ribbon banner specifically for the text; keep the banner ribbon tonally separated from the central emblem so any typography imperfections remain visually contained",
    );
  }

  // ===== Country-level defaults =====
  // Israeli patches are overwhelmingly bilingual in real life — enforce that
  // convention even when the user typed only English.
  const isIsraeli = input.country === "IL";
  if (isIsraeli) {
    parts.push(
      analysis.any
        ? "bilingual Hebrew + English integration, in the classic IAF / IDF squadron heraldic convention where Hebrew text sits on one ribbon and English on another"
        : "follow the classic IAF / IDF convention: predominantly English Latin lettering with a small Hebrew accent element (e.g. unit designator) typical of Israeli squadron patches",
    );
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
      ...(analysis.any ? ["hebrew"] : []),
      ...(isIsraeli ? ["bilingual"] : []),
    ],
    palette: branch.palette,
    hebrewDetected: analysis.any,
  };
}
