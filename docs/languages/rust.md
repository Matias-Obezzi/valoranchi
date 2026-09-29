# Rust

Rust applications interact with the local Riot Client session by executing the `riotclient` CLI with `std::process::Command` and deserializing stdout into typed structs using `serde` and `serde_json`. Data types can be generated from the JSON Schemas with `quicktype`. The whole example lives in `examples/rust/` and compiles with `cargo check`.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. Add `serde` and `serde_json` to your `Cargo.toml`:

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

## Read

Spawn `riotclient` commands and deserialize the standard output into typed Rust structs:

<<< @/../examples/rust/src/main.rs#read{rust}

## Write with Validation

Every mutation defaults to a local **dry run** unless `--yes` is supplied. If validation fails (for example equipping a card the account does not own), the process exits with code `6` and returns error JSON on `stderr`:

<<< @/../examples/rust/src/main.rs#write{rust}

## Events

Stream real-time events from the local client by spawning `riotclient watch` with piped stdout and iterating lines with `BufReader`:

<<< @/../examples/rust/src/main.rs#events{rust}

## Types

The structs the example deserializes into:

<<< @/../examples/rust/src/main.rs#types{rust}

Generate complete `serde` structs for every model from the schemas with `quicktype`:

```bash
npx quicktype schema/OwnedItems.json --src-lang schema -l rust -o owned_items.rs
```
