# Garden Sandwich Maker

A web-based paper-cut sandwich builder: drag ingredients, stack, and play with physics in the scene.

## Prerequisites

- [Node.js](https://nodejs.org/) (current LTS recommended)

## Run locally

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open the URL shown in the terminal (default port **3000**).

## Build

- Production build: `npm run build`
- Preview the build: `npm run preview`

## 3D assets

GLB files live under `public/models/` (served as `/models/...`). A Node script in `scripts/generate-bread-glb.mjs` can regenerate the draft bread mesh.
