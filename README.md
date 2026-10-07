# Gripad

Gripad is a Solana-native launchpad protocol. A team chooses the terms of a token before its first buy, and the program keeps those terms in place for the life of the token.

This repository holds the marketing site and the written design for the protocol. The site is a static build; the deploy folder is `dist/`.

## Quick start

```bash
npm run build     # writes dist/
npm run gates     # runs the checks, exit 0 means ship
npm run serve     # previews dist/ at http://localhost:4173
```

No dependencies are installed. Node 20 or newer is all you need.

## Layout

| Path | What lives there |
| --- | --- |
| `src/register.json` | One record per external fact: chain, RPC, contract address, X, GitHub. |
| `src/tokens.css` | The only file allowed to contain color values. |
| `src/index.html`, `styles.css`, `app.js`, `live.js` | The page, its styles, its behavior, and the pure feed helpers. |
| `tools/build.mjs` | Renders the register into the page and writes `dist/`. |
| `tools/gates.mjs` | The release checks, including both branches of every unstated fact. |
| `docs/` | Whitepaper, tokenomics, roadmap, architecture. |

## The register

Every outside fact is a record with a state of `stated`, `absent` or `unconfirmed`. A record that is not stated never produces a link, and the page shows an inert placeholder in its place. To publish the contract address, set the `ca` record to `stated` with a base58 string of 32 to 44 characters and rebuild. The same applies to the X and GitHub URLs; the handle is derived from the stored URL.

## Deploying

Run `npm run build` and drag the `dist/` folder to Cloudflare Pages. The `_headers` file inside it carries the security headers.

## License

MIT. See `LICENSE`.
