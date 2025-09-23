# Testing & QA

## Unit tests (Vitest)

```bash
npm run test
```

- Uses `@testing-library/svelte` with the JSDOM environment configured in `vite.config.ts`.
- Test files live alongside components under `src/lib/components/__tests__`.
- `npm run test -- --watch` provides interactive feedback during development.

## End-to-end smoke (Playwright)

```bash
npm run test:ui
```

- Spins up `npm run dev -- --host --port 5173` automatically via `playwright.config.ts`.
- Verifies that the dashboard renders core modules and that mocked logs are visible.
- Requires Playwright browsers (`npx playwright install --with-deps`).

## Linting & type checking

```bash
npm run lint
npm run typecheck
npm run check # lint + typecheck + unit tests
```

ESLint is configured with Svelte/TypeScript support via flat config. `svelte-check` validates component types and accessibility
warnings.

## Lighthouse budgets

```bash
npm run lighthouse
```

The script builds the app, starts `vite preview`, runs Lighthouse via `lighthouse` + `chrome-launcher`, and fails the build if the
following scores drop below target:

- Performance ≥ 90
- Accessibility ≥ 95
- Best Practices ≥ 95

Adjustments should maintain or improve these budgets.
