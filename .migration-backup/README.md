# Skincare Ingredient Checker

A Next.js app that scans skincare product ingredients against a curated list of 25 high-concern chemicals.

## How it works

1. **Primary flow** — Search by product name → Open Beauty Facts API → JS regex matching against toxic list → instant results, no AI cost
2. **Fallback 1** — Upload a product label photo → Claude Vision OCR (server-side) → JS matching
3. **Fallback 2** — Paste ingredients manually → JS matching

Claude is only invoked for image OCR. All ingredient analysis is pure JS.

## Architecture

```
skincare-checker/
├── pages/
│   ├── index.jsx          # UI — search, fallbacks, results
│   └── api/
│       └── claude.js      # Secure API proxy — ANTHROPIC_API_KEY stays server-side
├── lib/
│   └── ingredients.js     # Toxic list + JS matching engine (shared)
├── .env.local.example     # Required env vars (copy to .env.local)
└── package.json
```

## Swapping the data provider

The provider abstraction is in `pages/index.jsx`. To swap Open Beauty Facts for another source:

1. Add a new adapter object implementing `search(query) => { productName, ingredients, image }`
2. Change the `ACTIVE_PROVIDER` constant to point to your new adapter
3. Nothing else needs to change

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure env
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Caching

Search results are cached in `localStorage` indefinitely (until the user clears their browser). Cache keys are prefixed with `skincare_v1_`. To bust the cache, increment the prefix version in `pages/index.jsx`.

## Disclaimer

This tool is for informational purposes only. It does not constitute medical or dermatological advice.
