---
name: code-review
description: Code review standards for SusLab Web — React 19, Supabase Edge Functions, MUI v6
autoActivate: true
---

# Code Review — SusLab Web

## Severity Labels
- `[blocking]` — Must fix before merge (security, data loss, broken functionality)
- `[important]` — Should fix (performance, maintainability, accessibility)
- `[nit]` — Style/preference (naming, formatting)
- `[suggestion]` — Optional improvement
- `[praise]` — Highlight good patterns

## Golden Rule
Ask questions, don't command. Always explain WHY, not just WHAT.

## React 19 Checklist
- [ ] Hooks follow Rules of Hooks (no conditional calls)
- [ ] useEffect dependencies are correct and complete
- [ ] No unnecessary re-renders (memoize expensive computations)
- [ ] Keys on list items are stable and unique
- [ ] Error boundaries around async data loading
- [ ] Props destructured — no `props.xxx` chains

## Supabase Edge Functions Checklist
- [ ] Uses `_shared/auth.ts` for JWT verification
- [ ] CORS headers via `_shared/cors.ts`
- [ ] Input validation before database queries
- [ ] `service_role` access guarded by role checks
- [ ] No secrets hardcoded — all from `Deno.env.get()`
- [ ] Error responses have consistent shape

## MUI v6 Checklist
- [ ] Uses `sx` prop (not inline styles or CSS modules)
- [ ] Responsive: works on mobile/tablet/desktop
- [ ] Theme tokens used (not hardcoded colors)
- [ ] Accessibility: proper `aria-*` labels on interactive elements

## i18n Checklist
- [ ] All user-facing strings use `t()` — no hardcoded text
- [ ] New keys added to ALL 4 locale files
- [ ] Flat key format: `section.subsection.key`
