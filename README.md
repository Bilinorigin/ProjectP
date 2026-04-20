# PatchBase

Specialized AI generator for military and tactical morale patches.
Built for armament technicians, squadron commanders, and unit historians.

## Stack
- Next.js 14 (App Router)
- TypeScript, Tailwind CSS
- Lucide-react icons
- Tactical dark theme (slate / olive)

## Run
```bash
npm install
cp .env.example .env.local   # then paste your OPENAI_API_KEY
npm run dev
```
Open http://localhost:3000.

On Vercel, set `OPENAI_API_KEY` in Project → Settings → Environment Variables.

## API
- `POST /api/generate` — body: `{ country, branch, style, idea, motto?, squadron?, count? }`
  Runs the input through `enhancePrompt` and fans out to DALL·E 3 (n=1 per
  request, parallelized for the 2×2 grid). Returns `{ images: string[], prompt, tags, palette }`.
  Note: DALL·E image URLs expire after ~1 hour — download what you want to keep.

## Structure
- `app/page.tsx` — main Dashboard (controls + 2×2 preview grid + monetization)
- `app/layout.tsx` — root layout, dark theme
- `lib/promptEngine.ts` — prompt enhancement engine (country/branch/style → technical descriptor)
- `tailwind.config.ts` — custom `tactical` color palette

## Prompt Engine
`enhancePrompt({ country: "IL", branch: "IAF", style: "embroidery", idea: "Eagle" })`
returns a structured prompt with squadron heritage keywords, palette,
texture/finish rules, and a negative prompt — ready to feed to a diffusion
model.

## Roadmap
- Wire `enhancePrompt` to a real image API (SDXL / DALL·E / fal.ai)
- Stripe checkout for credit packs
- Manufacturer directory with geolocation
- Hebrew + Arabic typography support
