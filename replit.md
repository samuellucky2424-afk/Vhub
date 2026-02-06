# V-Number (Virtual Number Hub)

## Overview
A React + Vite + TypeScript frontend application for virtual phone number services. Includes landing page, pricing, product pages, authentication flows, checkout, and dashboard.

## Project Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (via CDN), Framer Motion for animations
- **Routing**: React Router DOM v6
- **Entry Point**: `index.tsx` -> `App.tsx`
- **Pages**: Located in `pages/` directory
- **Components**: Located in `components/` directory

## Key Files
- `vite.config.ts` - Vite configuration (port 5000, host 0.0.0.0)
- `index.html` - HTML entry with Tailwind CDN config
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration

## Development
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build` (outputs to `dist/`)
- Deployment: Static site deployment from `dist/`

## Recent Changes
- 2026-02-06: Initial Replit setup. Configured Vite for port 5000 with allowedHosts. Added Vite module script entry point to index.html. Removed import map (using Vite bundler instead).
