# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `mmr().fit` says whether the account sits at its right rank, judged by the rating won per victory over the last twenty competitive games: `above`, `fit` or `below`, with the expected rank and the average gain and loss.

## [0.3.0] - 2026-09-29

### Added

- Raw entry point `@valoranchi/riot-client/raw` with the transport, session, endpoints, local API, socket and validators.
- Live match actions: select agent, lock agent, dodge agent select, and leave match with validation.
- Expanded party operations: party invites, join requests, custom game configuration, team assignment, team balancing, preferred servers, and member promotion.
- Cloud player settings inspection and persistence (`client.account.settings()`, `client.account.saveSettings()`).
- Local game authorization, client session details, and chat participants inspection (`client.social.participants()`).
- Raw escape hatches on `client.local` and `client.riot` for direct HTTP access to unmodeled routes.
- Remote API operations: account XP, player contracts, active missions, penalties, favourites, and game configs.
- Store catalogue offers and order status inspection (`client.store.offers()`, `client.store.order()`).
- Matchmaking queues, custom game configs, premier details, content, and competitive leaderboard lookup.
- CLI commands and JSON schemas for all new operations.

## [0.2.0] - 2026-09-29

### Added

- Namespaced client API organized into five core domains: `account`, `social`, `store`, `matches`, and `party`.
- Party actions with local pre-flight validation: party invites, promote, kick, invite codes, queue selection, ready state, and matchmaking controls.
- Validated writes for loadout changes, skin equipping, contract activation, and social interactions (chat messages, friend requests, player blocking).
- Real-time event streaming (`client.events()`) listening to local Riot Client WebSocket notifications.
- Match history summaries, detailed match inspection, competitive MMR breakdown, and rank movement history.
- Storefront rotation inspection including daily offers, night market, featured bundles, accessories, and Radianite offers.
- Disk caching for remote responses and catalogue data keyed by game version.

### Changed

- Reorganized client methods under namespaces (`client.store()` -> `client.store.current()`, `client.matches()` -> `client.matches.list()`, `client.party()` -> `client.party.current()`).

## [0.1.0] - 2026-09-27

### Added

- Local Riot Client lockfile discovery and TLS loopback authentication.
- Player identity resolution (`whoami`) with region and shard detection.
- Owned items inventory builder for weapons, skins, chromas, buddies, player cards, titles, and sprays.
- Equipped loadout inspection and currency balance tracking (VP, Radianite, Kingdom Credits).
- `riotclient` CLI entry point with JSON output for integration with scripts and external applications.
- JSON Schema generation for domain models.
