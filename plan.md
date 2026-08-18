# AI Wedding Crest Studio — Implementation Plan

## Discovery summary

The requested upstream template is now the project baseline. Its existing backend remains the source of truth for authentication, persistence, AI providers, storage, credits, payments, RBAC, and admin pages.

Confirmed reusable modules:

- Better Auth: `src/core/auth`, `/api/auth/[...all]`, sign-in/sign-up pages.
- Drizzle + D1/SQLite/Postgres/MySQL adapters: `src/core/db`, `src/config/db`.
- AI manager and providers: `src/extensions/ai`, `src/shared/services/ai`, `src/shared/models/ai_task`.
- R2/S3 storage: `src/extensions/storage`, `src/shared/services/storage`.
- Payment Manager and existing order/webhook flow: `src/extensions/payment`, `src/shared/services/payment`, `/api/payment/*`.
- RBAC and admin UI: `src/core/rbac`, `src/shared/services/rbac`, `src/app/[locale]/(admin)/admin/*`.
- Existing credits and failure refund behavior: `src/shared/models/credit` and `src/shared/models/ai_task`.

`AGENTS.md` was not present in the cloned root; the template's parent guidance was read. `LOOP.md` was not present. The complete product specification is the pasted requirements document supplied with this task.

## MVP scope implemented in this pass

1. Wedding Crest Studio landing page and full-screen wizard with names, initials, date, six styles, seven palettes, location/venue/flowers/personal elements, and four layouts.
2. Typed style/layout/typography system and versioned prompt compiler.
3. Programmatic SVG composer for the text/layout layer; AI remains responsible for the illustration layer through the template AI manager.
4. Project, elements, generations, reviews, assets, and prompt-template persistence in the existing Drizzle schema family.
5. Project and generation APIs, job polling, candidate selection, edit controls, and HD download entitlement checks.
6. Existing authentication is used when a session exists; guest projects are tracked with a guest token and require sign-in before paid checkout/download.
7. Existing payment checkout is reused with project metadata and the existing order/webhook lifecycle.
8. Existing storage service is reused for generated assets when configured; no replacement backend is introduced.
9. Existing RBAC/Admin surface is preserved; wedding generation records are available through the existing AI task/admin flow and a dedicated admin permission is added for future admin views.

## Acceptance criteria

- `POST /api/projects` validates and stores a project.
- `POST /api/projects/:id/generate` compiles a versioned prompt, selects a configured template AI provider, creates three candidate records, and returns a pollable job id.
- `GET /api/jobs/:id` reports `queued`, `generating`, `reviewing`, `composing`, `complete`, or `failed` with candidate and asset data.
- A completed result contains an SVG-composed crest with user names/date/initials supplied as text rather than AI-generated text.
- QA data stores review scores and accept/repair/reject decision thresholds.
- The result page displays the primary crest, alternate candidates, typography controls, and four deterministic mockup placements using the same master crest.
- Unpaid downloads are preview-only; paid checkout uses the template payment API and paid orders unlock the HD package.
- Unit tests cover prompt compilation, style/layout selection, SVG composition, and entitlement decisions.
- `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm db:push`, `pnpm db:generate`, and `./scripts/verify-loop.sh` all exit 0.

## Implementation sequence

1. Add domain types/configuration, composer, prompt compiler, schema tables, and models.
2. Add project/generation/job/select/edit/download APIs while preserving existing auth/AI/storage/payment routes.
3. Add the localized Wedding Crest Studio UI and result/mockup experience.
4. Add tests and the loop verification script.
5. Run all required commands, repair failures, and rerun until the loop is green.

## Known constraints to validate

- A configured image provider is required for live AI generation. The UI exposes the provider error instead of substituting a mock backend.
- Cloudflare Queue bindings are not present in the cloned template; the first pass uses persisted job state and the existing provider callback/task machinery so the request is not coupled to a new backend. Queue binding can be added later without changing the project API contract.
- Watercolor raster output can be stored and downloaded as PNG/PDF only after a production raster/PDF worker is configured; SVG output is the canonical text/layout artifact in this pass.
