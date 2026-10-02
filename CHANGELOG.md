# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Model Context Protocol (MCP) server over stdio (`riotclient mcp`, `McpServer`) allowing AI assistants (Claude Code, Claude Desktop, Cursor) to inspect active session, inventory, loadout, store, matches, and party data read-only over JSON-RPC 2.0.

- Permanent disk caching for completed official matches (`isCompleted: true`) stored under `official/` in the cache directory, avoiding redundant network requests, with toggle via `officialCache: false` and CLI `--no-official-cache`.
- Player scouting and performance analysis via `client.official.summary(riotId, options?)` and `client.official.profile(riotId, options?)` (and CLI `riotclient official summary` and `riotclient official profile`), returning `PerformanceSummary` and `OfficialProfile` with rank, level, and match statistics.
- Official Riot Developer API support (`client.official` and CLI `riotclient official ...`) for remote inspection of player profiles (`account`), match history (`matches`), match details (`match`), competitive leaderboards (`leaderboard`), and platform status (`status`) without running the Riot Client, backed by sliding-window rate limiting (`RateLimiter`), automatic retry handling on 429/5xx, and credential protection.

## [0.4.0] - 2026-09-29

### Added

- Every language example is a compilable project under `examples/` that the docs import, and CI compiles all of them.
- `npm run fixtures:record` captures anonymized Riot payloads; snapshot tests rebuild the models from them.

- `client.watch.match()` and `client.watch.friends()` provide high-level typed event watchers with async iteration (`[Symbol.asyncIterator]`), 5-second polling floor, and 300ms friend presence debouncing. CLI `watch-match` and `watch-friends`.
- Serve mode (`client.serve()`, CLI `riotclient serve`) runs a local HTTP integration server with REST endpoints (`GET`/`POST /api/<namespace>/<method>`), Server-Sent Events (`GET /events`), auto-generated OpenAPI 3.0 specs (`GET /openapi.json`), route index dashboard (`GET /`), and loopback binding security.
- Single executable distribution (`npm run exe`) builds a standalone Windows executable (`release/riotclient-win-x64.exe`) with Node.js Single Executable Application (SEA) flow and automated GitHub release workflow attachment.
- `matches.trend(options?)` calculates competitive rating trends, streaks, net RR movement over 5/10/20 games, win rate, pace (`climbing`, `holding`, `falling`), and distance to next rank or demotion (`RatingTrend`). CLI `trend`.
- `matches.summary(options?)` aggregates performance stats across recent matches with by-agent and by-map breakdowns, best/worst highlights, and consistency metrics (`PerformanceSummary`). CLI `summary [--count n] [--queue q]`.
- `matches.assess(puuid)` and live match warnings on `LiveMatchPlayer.warnings` detect rank anomalies (`low-level-high-rank`, `inflated`, `underranked`, `long-streak`, `new-act`) (`PlayerAssessment`). CLI `assess [puuid]`.
- `account.diffLoadout()`, `account.equipPreset()`, and `account.exportLoadout()` calculate minimal loadout diffs, validate and equip preset changes, and export active loadouts (`LoadoutDiff`). CLI `loadout-export`, `loadout-diff`, `loadout-apply`.
- `account.collectionValue()` computes total Valorant Points and estimated Radianite Points for owned skins grouped by weapon and tier (`CollectionValue`). CLI `collection-value`.
- `store.history()` and `store.seen(skinUuid)` persist daily storefront rotations to local cache deduplicated per day and query skin appearance history (`StoreHistory`, `StoreSeen`). CLI `store-history`, `store-seen <skin>`.
- `matches.sync(options?)` and `matches.known()` synchronize match history to disk cache paging until reaching known matches and list cached matches (`MatchSyncResult`). CLI `matches-sync`.
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
