"use client";

import { useMemo, useState } from "react";
import {
  Crosshair,
  Shield,
  Flag,
  Globe2,
  Sparkles,
  Loader2,
  MapPin,
  CreditCard,
  Layers,
  Hexagon,
  Radar,
  ArrowRight,
  Plane,
} from "lucide-react";
import {
  enhancePrompt,
  type Branch,
  type Country,
  type PatchStyle,
} from "@/lib/promptEngine";

type CountryOption = { id: Country; label: string; sub: string; icon: JSX.Element };
type BranchOption = { id: Branch; label: string; country: Country };
type StyleOption = { id: PatchStyle; label: string; hint: string };

const COUNTRIES: CountryOption[] = [
  { id: "IL", label: "Israel", sub: "IDF / IAF", icon: <Shield className="h-4 w-4" /> },
  { id: "US", label: "USA", sub: "DoD / Branches", icon: <Flag className="h-4 w-4" /> },
  { id: "INT", label: "International", sub: "NATO / PMC", icon: <Globe2 className="h-4 w-4" /> },
];

const BRANCHES: BranchOption[] = [
  { id: "IAF", label: "IAF — Israeli Air Force", country: "IL" },
  { id: "IDF", label: "IDF — Ground Forces", country: "IL" },
  { id: "USAF", label: "USAF — Air Force", country: "US" },
  { id: "USMC", label: "USMC — Marines", country: "US" },
  { id: "USARMY", label: "US Army", country: "US" },
  { id: "USN", label: "US Navy", country: "US" },
  { id: "NATO", label: "NATO Coalition", country: "INT" },
  { id: "PMC", label: "PMC / Contractor", country: "INT" },
];

const STYLES: StyleOption[] = [
  { id: "embroidery", label: "Embroidery", hint: "Classic stitched thread" },
  { id: "pvc", label: "PVC", hint: "Molded rubber, 3D relief" },
  { id: "subdued", label: "Subdued", hint: "Low-vis, IR-friendly" },
  { id: "leather", label: "Leather", hint: "Vintage flight jacket" },
  { id: "laser", label: "Laser-Cut", hint: "Multicam, modern operator" },
];

export default function Dashboard() {
  const [country, setCountry] = useState<Country>("IL");
  const [branch, setBranch] = useState<Branch>("IAF");
  const [style, setStyle] = useState<PatchStyle>("embroidery");
  const [idea, setIdea] = useState("Eagle striking with lightning");
  const [motto, setMotto] = useState("");
  const [squadron, setSquadron] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [credits, setCredits] = useState(12);

  const visibleBranches = BRANCHES.filter((b) => b.country === country);

  const enhanced = useMemo(
    () => enhancePrompt({ country, branch, style, idea, motto, squadron }),
    [country, branch, style, idea, motto, squadron],
  );

  function handleCountry(next: Country) {
    setCountry(next);
    const firstBranch = BRANCHES.find((b) => b.country === next);
    if (firstBranch) setBranch(firstBranch.id);
  }

  async function handleGenerate() {
    if (credits < 1) return;
    setGenerating(true);
    setPreviews([]);
    // Simulated diffusion: render 4 deterministic SVG patches from the enhanced prompt.
    await new Promise((r) => setTimeout(r, 900));
    const seeds = [11, 27, 53, 91].map((s) => s + idea.length);
    setPreviews(seeds.map((s) => previewSvg(s, enhanced.palette, style, idea)));
    setCredits((c) => c - 1);
    setGenerating(false);
  }

  return (
    <main className="min-h-screen bg-tactical-bg">
      <div className="bg-grid">
        <Header credits={credits} />

        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            {/* CONTROL PANEL */}
            <section className="space-y-5 rounded-xl border border-tactical-edge bg-tactical-panel/80 p-5 shadow-tactical backdrop-blur">
              <PanelHeader icon={<Crosshair className="h-4 w-4" />} title="Mission Brief" sub="Configure target patch" />

              <Field label="Country / Theater">
                <div className="grid grid-cols-3 gap-2">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCountry(c.id)}
                      className={chipClass(country === c.id)}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        {c.icon}
                        {c.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-tactical-muted">{c.sub}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Branch / Unit">
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value as Branch)}
                  className="w-full rounded-md border border-tactical-edge bg-tactical-bg px-3 py-2 text-sm focus:border-tactical-accent focus:outline-none"
                >
                  {visibleBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Manufacturing Style">
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      className={chipClass(style === s.id) + " text-left"}
                    >
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-[10px] text-tactical-muted">{s.hint}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Concept / Idea">
                <textarea
                  rows={3}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="e.g. Eagle striking with lightning over Mt. Hermon"
                  className="w-full resize-none rounded-md border border-tactical-edge bg-tactical-bg px-3 py-2 text-sm focus:border-tactical-accent focus:outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Squadron #">
                  <input
                    value={squadron}
                    onChange={(e) => setSquadron(e.target.value)}
                    placeholder="133"
                    className="w-full rounded-md border border-tactical-edge bg-tactical-bg px-3 py-2 text-sm focus:border-tactical-accent focus:outline-none"
                  />
                </Field>
                <Field label="Motto">
                  <input
                    value={motto}
                    onChange={(e) => setMotto(e.target.value)}
                    placeholder="Knights of the Twin Tail"
                    className="w-full rounded-md border border-tactical-edge bg-tactical-bg px-3 py-2 text-sm focus:border-tactical-accent focus:outline-none"
                  />
                </Field>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || credits < 1}
                className="group flex w-full items-center justify-center gap-2 rounded-md bg-tactical-olive px-4 py-3 text-sm font-semibold text-tactical-text transition hover:bg-tactical-oliveLight disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate 2×2 Preview
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-tactical-muted">
                Costs 1 credit · {credits} remaining
              </p>
            </section>

            {/* OUTPUT */}
            <section className="space-y-6">
              <PreviewGrid
                generating={generating}
                previews={previews}
                style={style}
                palette={enhanced.palette}
              />

              <PromptInspector
                prompt={enhanced.prompt}
                tags={enhanced.tags}
                palette={enhanced.palette}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <ManufacturerFinder />
                <CreditsCard credits={credits} onTopUp={() => setCredits((c) => c + 25)} />
              </div>
            </section>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}

/* ============================================================ */
/* UI bits                                                       */
/* ============================================================ */

function Header({ credits }: { credits: number }) {
  return (
    <header className="border-b border-tactical-edge bg-tactical-panel/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-tactical-olive text-tactical-text">
            <Hexagon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="stencil text-base font-bold tracking-widest text-tactical-text">
              PatchBase
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-tactical-muted">
              Tactical Patch Generator · v0.1
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded-md border border-tactical-edge px-2.5 py-1.5 text-[11px] text-tactical-muted sm:flex">
            <Radar className="h-3.5 w-3.5 text-tactical-accent" />
            ONLINE
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-tactical-edge bg-tactical-bg px-2.5 py-1.5 text-[11px]">
            <Sparkles className="h-3.5 w-3.5 text-tactical-warn" />
            <span className="font-semibold">{credits}</span>
            <span className="text-tactical-muted">credits</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function PanelHeader({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-tactical-edge pb-3">
      <div className="rounded-md bg-tactical-slate/60 p-1.5 text-tactical-accent">{icon}</div>
      <div>
        <p className="stencil text-xs font-semibold tracking-widest">{title}</p>
        <p className="text-[10px] text-tactical-muted">{sub}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="stencil mb-1.5 block text-[10px] tracking-widest text-tactical-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function chipClass(active: boolean) {
  return [
    "rounded-md border px-2.5 py-2 text-xs transition",
    active
      ? "border-tactical-accent bg-tactical-olive/30 text-tactical-text"
      : "border-tactical-edge bg-tactical-bg text-tactical-muted hover:border-tactical-slateLight hover:text-tactical-text",
  ].join(" ");
}

function PreviewGrid({
  generating,
  previews,
  style,
  palette,
}: {
  generating: boolean;
  previews: string[];
  style: PatchStyle;
  palette: string[];
}) {
  return (
    <div className="rounded-xl border border-tactical-edge bg-tactical-panel/80 p-5 shadow-tactical">
      <div className="mb-4 flex items-center justify-between">
        <PanelHeader
          icon={<Layers className="h-4 w-4" />}
          title="Preview Grid"
          sub="2 × 2 candidate variations"
        />
        <span className="rounded-md border border-tactical-edge px-2 py-1 text-[10px] uppercase tracking-widest text-tactical-muted">
          {style}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-lg border border-tactical-edge bg-tactical-bg"
          >
            {generating ? (
              <Skeleton />
            ) : previews[i] ? (
              <div
                className="h-full w-full"
                dangerouslySetInnerHTML={{ __html: previews[i] }}
              />
            ) : (
              <Empty palette={palette} index={i} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-tactical-muted">
        <Loader2 className="h-6 w-6 animate-spin text-tactical-accent" />
        <span className="text-[10px] uppercase tracking-widest">Rendering threads…</span>
      </div>
    </div>
  );
}

function Empty({ palette, index }: { palette: string[]; index: number }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-tactical-muted">
      <Plane className="h-7 w-7 opacity-40" />
      <span className="text-[10px] uppercase tracking-widest">Slot {index + 1}</span>
      <div className="flex gap-1">
        {palette.map((c) => (
          <span
            key={c}
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: c.split(" ").pop() }}
          />
        ))}
      </div>
    </div>
  );
}

function PromptInspector({
  prompt,
  tags,
  palette,
}: {
  prompt: string;
  tags: string[];
  palette: string[];
}) {
  return (
    <div className="rounded-xl border border-tactical-edge bg-tactical-panel/80 p-5 shadow-tactical">
      <PanelHeader
        icon={<Crosshair className="h-4 w-4" />}
        title="Enhanced Prompt"
        sub="Auto-generated technical descriptor"
      />
      <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-tactical-edge bg-tactical-bg p-3 text-[11px] leading-relaxed text-tactical-text/90">
{prompt}
      </pre>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-md border border-tactical-edge bg-tactical-bg px-2 py-0.5 text-[10px] text-tactical-muted"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="stencil text-[10px] text-tactical-muted">Palette:</span>
        {palette.map((c) => (
          <div key={c} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm border border-tactical-edge"
              style={{ backgroundColor: c.split(" ").pop() }}
            />
            <span className="text-[10px] text-tactical-muted">{c.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManufacturerFinder() {
  return (
    <div className="rounded-xl border border-tactical-edge bg-tactical-panel/80 p-5 shadow-tactical">
      <PanelHeader
        icon={<MapPin className="h-4 w-4" />}
        title="Local Manufacturer"
        sub="Find embroidery & PVC vendors"
      />
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-md border border-tactical-edge bg-tactical-bg px-3 py-2">
          <div>
            <p className="font-medium">Tel Aviv · Embroidery Co.</p>
            <p className="text-[10px] text-tactical-muted">2.3km · Min order 10pcs</p>
          </div>
          <button className="text-[11px] text-tactical-accent hover:underline">Contact</button>
        </div>
        <div className="flex items-center justify-between rounded-md border border-tactical-edge bg-tactical-bg px-3 py-2">
          <div>
            <p className="font-medium">Ramat Gan · PVC Works</p>
            <p className="text-[10px] text-tactical-muted">5.1km · Min order 25pcs</p>
          </div>
          <button className="text-[11px] text-tactical-accent hover:underline">Contact</button>
        </div>
      </div>
      <button className="mt-3 w-full rounded-md border border-dashed border-tactical-edge px-3 py-2 text-[11px] text-tactical-muted hover:border-tactical-accent hover:text-tactical-accent">
        + Search manufacturers near me
      </button>
    </div>
  );
}

function CreditsCard({ credits, onTopUp }: { credits: number; onTopUp: () => void }) {
  return (
    <div className="rounded-xl border border-tactical-edge bg-tactical-panel/80 p-5 shadow-tactical">
      <PanelHeader
        icon={<CreditCard className="h-4 w-4" />}
        title="Purchase Credits"
        sub="Stripe checkout · placeholder"
      />
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold">{credits}</p>
          <p className="text-[10px] uppercase tracking-widest text-tactical-muted">
            credits remaining
          </p>
        </div>
        <div className="text-right text-[11px] text-tactical-muted">
          <p>$9 · 25 credits</p>
          <p>$29 · 100 credits</p>
        </div>
      </div>
      <button
        onClick={onTopUp}
        className="mt-3 w-full rounded-md bg-tactical-warn/90 px-3 py-2 text-sm font-semibold text-tactical-bg hover:bg-tactical-warn"
      >
        Top up via Stripe →
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-tactical-edge bg-tactical-panel/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-[10px] uppercase tracking-widest text-tactical-muted lg:flex-row lg:px-8">
        <span>PatchBase © {new Date().getFullYear()} · For authorized morale-patch design only</span>
        <span>Built for Panchief workflows · F-15 ready</span>
      </div>
    </footer>
  );
}

/* ============================================================ */
/* Deterministic SVG mock so the 2x2 grid shows real previews   */
/* without hitting any external image API.                       */
/* ============================================================ */

function previewSvg(seed: number, palette: string[], style: PatchStyle, idea: string): string {
  const colors = palette.map((c) => c.split(" ").pop() ?? "#3F4A2A");
  const [c1, c2 = "#465763", c3 = "#9CB071"] = colors;
  const ring = (seed % 5) + 4;
  const initials = (idea.match(/\b[A-Za-z]/g) ?? ["P", "B"]).slice(0, 2).join("").toUpperCase();
  const filter = style === "subdued"
    ? "filter='url(#desat)'"
    : style === "pvc"
      ? "filter='url(#emboss)'"
      : "";
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <radialGradient id="bg${seed}" cx="50%" cy="40%">
      <stop offset="0%" stop-color="${c2}" />
      <stop offset="100%" stop-color="${c1}" />
    </radialGradient>
    <filter id="desat"><feColorMatrix type="saturate" values="0.25"/></filter>
    <filter id="emboss"><feGaussianBlur stdDeviation="0.6"/></filter>
  </defs>
  <rect width="200" height="200" fill="#0B0F0E"/>
  <g ${filter}>
    <circle cx="100" cy="100" r="92" fill="url(#bg${seed})" stroke="${c3}" stroke-width="3"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="${c3}" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>
    ${Array.from({ length: ring }).map((_, i) => {
      const a = (i / ring) * Math.PI * 2;
      const x = 100 + Math.cos(a) * 60;
      const y = 100 + Math.sin(a) * 60;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${c3}" opacity="0.7"/>`;
    }).join("")}
    <path d="M60 110 L100 60 L140 110 L120 110 L100 85 L80 110 Z" fill="${c3}" opacity="0.9"/>
    <text x="100" y="150" text-anchor="middle" font-family="ui-monospace, monospace" font-size="22" font-weight="700" fill="${c3}">${initials}</text>
    <text x="100" y="172" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="${c3}" opacity="0.8" letter-spacing="2">PATCHBASE</text>
  </g>
</svg>`.trim();
}
