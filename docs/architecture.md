# Architecture

## Components

```
creator wallet --signs--> console --builds--> token + preset stack
                                                  |
buyer wallet ---transfer---> token program --calls--> preset programs
                                  |                        |
                                  |<------ allow / deny ---+
                                  v
                          settle or reject
```

**Token.** A Solana token that routes every transfer through a hook. The hook holds the ordered list of presets chosen at publish time.

**Preset program.** A narrow on-chain program. It receives the transfer details (source, destination, amount, the accounts involved in the route, and the current slot) and returns allow or deny. Presets keep their own small state accounts when they need memory, for example a cooldown timer per wallet.

**Console.** A client that assembles a preset stack, shows its terms in plain language, and asks the creator to sign. It holds no keys.

**Site.** This repository's static page. It reads public feeds from the browser and has no server.

## Transfer flow

1. A wallet sends tokens, directly or through a market.
2. The token program invokes the hook.
3. The hook calls each preset in order and passes the transfer details.
4. The first deny ends the call and the transfer fails with the preset's reason code.
5. If every preset allows, the transfer settles.

## Failure behavior

Presets fail closed. A missing account, a read that cannot be completed, or a budget overrun counts as a deny. The cost budget per preset is fixed in the interface so a stack of presets stays inside a transfer's compute limit.

## Site internals

- `src/register.json` is the single list of outside facts. `tools/build.mjs` renders it into the page.
- Live data: slot from a Solana JSON-RPC `getSlot` call, chain value locked from the DefiLlama chains list matched by the `solana` slug, and busiest pairs from DexScreener search filtered to Solana.
- Every feed polls with exponential backoff and jitter, pauses while the tab is hidden, and falls back to a dash on error.
- Scrolling publishes one number (`--sy`) as a CSS variable. Progress and parallax are computed by the stylesheet.
- The content security policy allows scripts and styles from the site only and lists each feed origin by name.

## Security notes

The console and hook never ask for a seed phrase. See `.github/SECURITY.md` for reporting.
