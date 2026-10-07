# Contributing to Gripad

Thanks for taking a look. This project is small and the rules are short.

## Before you start

- Read the whitepaper and architecture notes in `docs/`.
- Open a discussion before large changes so nobody builds the wrong thing.

## Working on the site

```bash
npm run build
npm run gates
```

Both must exit 0 before you propose a change.

## House rules

1. **Register first.** Any outside fact (address, link, endpoint) goes in `src/register.json` as a record with a state. Never write one directly into the page.
2. **No link without a stated record.** If a fact is not stated, the page shows an inert placeholder.
3. **Colors live in `src/tokens.css` only.** The palette is achromatic until brand assets exist.
4. **Accept any valid base58.** Contract address checks must accept every 32 to 44 character base58 string and refuse everything else.
5. **No dates on the page.** Dates may live in the register.
6. **Original copy.** Write in your own words.
7. **Motion has an off switch.** New animation must respect `prefers-reduced-motion`.
8. **Keep gates fast.** Synthetic fixtures, no network, under five minutes.

## Commits and reviews

Write commit messages in the imperative mood. Keep changes focused. A reviewer should be able to read the diff in one sitting.
