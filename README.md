# Tirth Patel — portfolio

A static portfolio for an AI product engineer. Plain HTML/CSS/JS — no framework,
no build step, no component library. Self-hosted fonts, a canvas-rendered voxel
wordmark, and one genuinely live tool that reads a real GitHub pull request.

**Lighthouse (desktop): 100 / 100 / 100 / 100** — performance, accessibility,
best-practices, SEO, on both the homepage and the project page.

## Run it locally

Any static file server works. It must be served over HTTP (not opened as a
`file://` path) so the web fonts and the live GitHub call behave correctly.

```bash
# Python (no install)
python3 -m http.server 8000
# → open http://localhost:8000

# or Node
npx serve .
```

The "Read a real pull request" tool calls `api.github.com` directly from the
browser (public data, no key). Unauthenticated GitHub allows 60 requests/hour
per IP; each PR view is 2 requests. Deep-link a PR with
`?pr=owner/repo/123`.

## Structure

```
index.html               homepage — all copy lives inline here
projects/voxel-air.html  Voxel Air case study
assets/
  css/style.css          the whole design system (palette, type, layout)
  js/wordmark.js         voxel wordmark (canvas; animates once, static fallback)
  js/prq.js              live GitHub PR reader
  js/main.js             click-to-load live embed on the project page
  fonts/*.woff2          Cabinet Grotesk · General Sans · JetBrains Mono (latin subset)
  favicon.svg            voxel "T" in the site palette
  og.png                 social share image (1200×630)
og.html                  generator for og.png (not deployed)
```

Everything else in the repo — `BRIEF.md`, `shots/`, `og.html`, `.claude/` — is
kept out of the published site by the deploy workflow (see below).

## Editing

- **Copy** is written directly into `index.html` and `projects/voxel-air.html`.
- **Design tokens** (colours, type scale, spacing) are CSS variables at the top
  of `assets/css/style.css`.
- **Fonts** are self-hosted `woff2` in `assets/fonts/` (Fontshare + Google Fonts,
  open licenses). Swap the files and update the `@font-face` block to change them.

### Regenerating the OG image

`assets/og.png` is a screenshot of `og.html`. To rebuild it after a copy or
palette change:

```bash
python3 -m http.server 8000 &
npx -y playwright@1 screenshot --channel chrome \
  --viewport-size "1200,630" --wait-for-timeout 2200 \
  "http://localhost:8000/og.html" assets/og.png
```

## Deploy — GitHub Pages

Deployed from **`github.com/Tirth-byte/portfolio`** → **https://tirth-byte.github.io/portfolio/**.

The workflow at `.github/workflows/deploy.yml` publishes **only** `index.html`,
`assets/`, and `projects/`. `BRIEF.md`, `.claude/`, and the working screenshots
are git-ignored and never leave your machine.

1. In **Settings → Pages → Build and deployment**, set **Source: GitHub Actions**.
2. Push to `main`. The workflow builds and deploys; the live URL appears in the
   Actions run summary.

> **Absolute URLs** (canonical, `og:url`, `og:image`) are set for the
> `/portfolio/` project path. If you later move this to a *user site* repo named
> `Tirth-byte.github.io` (served at the root domain), drop the `/portfolio` segment
> from those tags in `index.html` and `projects/voxel-air.html`. Internal links are
> all relative and need no change either way.

> Don't switch Pages to "Deploy from a branch": that serves the entire repo. The
> Actions workflow is the safe path.
