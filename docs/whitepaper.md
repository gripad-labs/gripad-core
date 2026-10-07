# Gripad Whitepaper

## 1. The problem

A token launch is a promise made in public and kept in private. Founders announce a wallet limit, a vesting plan, a single trading venue. Then the plan lives in a thread, a document, or a bot that someone must keep running. When the bot stops or the author changes their mind, buyers find out the hard way.

Gripad moves the promise into the token. The terms are written when the token is created, and the Solana runtime evaluates them on every transfer. A move that breaks a term is rejected before it lands.

## 2. The idea in one paragraph

A Gripad launch is a token plus a stack of presets. Each preset is a small on-chain program that answers one question about a transfer: may this wallet receive, may this wallet sell, may this route be used, may this happen right now. The token calls its presets during every transfer. If any preset says no, the transfer fails. Nothing is monitored from outside, so there is nothing to forget or to turn off.

## 3. Preset families

**Entry.** Decide who may receive and how much. Wallet ceilings cap a single holder's share of supply. Named doors restrict an opening window to a listed set of wallets. Stepped gates raise a ceiling in stages as pool depth grows.

**Exit.** Decide how supply leaves. Cooldown lanes space out a wallet's sales. Slice unlocks free early balances in portions. Depth throttles keep one sale from outweighing the pool under it.

**Venue.** Decide where the token may move. A single venue keeps liquidity in one market. A pool roster names a short list. Wallet-to-wallet mode allows direct sends and closes market routes.

**Pacing.** Decide when. Quiet windows pause all movement during chosen hours. Slot spacing forces a gap between a wallet's trades. A slow open begins with tight limits and relaxes them along a curve.

## 4. Design principles

1. **The token is the authority.** Terms live in the token, not in a service.
2. **Fail closed.** A check that cannot reach a verdict rejects the transfer.
3. **No custody.** The protocol never holds a creator's keys. The creator signs each step from their own wallet.
4. **Readable terms.** Every preset has a plain statement of what it checks, so a buyer can read a launch in a minute.
5. **Small parts.** Presets are narrow on purpose. Narrow programs are easier to audit and easier to combine.

## 5. What the protocol does not do

Gripad does not promise a token's price, does not vet a creator's intentions, and does not replace an audit of a creator's own contracts. It makes one narrow guarantee: the terms chosen at publish time are the terms enforced at transfer time.

## 6. Open questions

Interaction between presets that read the same pool, upgrade policy for preset programs, and how a launch may loosen a term after the fact are being worked out in the open. See the roadmap and architecture notes.
