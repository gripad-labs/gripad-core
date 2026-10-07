# Roadmap

Phases are ordered by dependency, not by calendar. A phase starts when the one before it has met its exit criteria.

## Phase 1: Foundations

- Publish the whitepaper, architecture notes and this roadmap.
- Stand up the public site with live network readouts.
- Fix the preset interface: inputs a preset may read, outputs it may return, and the cost budget it must stay inside.

Exit: the interface document has been reviewed by at least two outside Solana developers.

## Phase 2: First presets

- Build the Entry family: wallet ceiling, named doors, stepped gate.
- Build a local test harness that replays real swap routes against presets.
- Run every preset inside live swap routes on a test network.

Exit: each preset has a written test report and no open critical findings.

## Phase 3: Exit and venue

- Build the Exit family and the Venue family.
- Publish a creator console that assembles presets and shows the plain-language terms before signing.
- Commission an independent audit of the preset programs.

Exit: audit findings resolved and published.

## Phase 4: Pacing and launch

- Build the Pacing family.
- Open the console to a small invited group of creators.
- Publish the contract address and official links on the site.

Exit: first launches settled without a rejected-but-valid transfer.

## Phase 5: Open parts

- Document how outside developers can contribute presets.
- Ship a registry so a preset's behavior and audit status can be checked by anyone.
- Move preset maintenance under the treasury process described in the tokenomics note.
