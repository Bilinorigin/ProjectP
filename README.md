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
npm run dev
```
Open http://localhost:3000.

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
