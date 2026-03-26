---
name: deploy
description: Build, lint, and deploy SusLab Web to production
user-invocable: true
---

Run the full deployment pipeline for SusLab Web:

1. **Lint** — Run `npm run lint` and fix any errors
2. **Build** — Run `npm run build` to verify production build succeeds
3. **Edge Functions** — Run `npx supabase functions deploy --no-verify-jwt`
4. **Git** — Commit all changes and push to GitHub (triggers Render deploy)

If any step fails, stop and report the error. Do not continue to the next step.
