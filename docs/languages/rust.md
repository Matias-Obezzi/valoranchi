# Rust

Rust applications interact with the local Riot Client session by executing the `riotclient` CLI with `std::process::Command` and deserializing stdout into typed structs using `serde` and `serde_json`. Data types can be generated from the JSON Schemas with `quicktype`.

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

```rust
use std::process::Command;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Player {
    game_name: String,
    tag_line: String,
    region: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OwnedSkin {
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OwnedWeapon {
    name: String,
    skins: Vec<OwnedSkin>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OwnedItems {
    generated_at: String,
    weapons: Vec<OwnedWeapon>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Read player profile
    let whoami_out = Command::new("riotclient").arg("whoami").output()?;
    if whoami_out.status.success() {
        let player: Player = serde_json::from_slice(&whoami_out.stdout)?;
        println!("Player: {}#{} ({})", player.game_name, player.tag_line, player.region);
    }

    // 2. Read owned collection
    let collection_out = Command::new("riotclient")
        .args(["owned-items", "--language", "en-US"])
        .output()?;
    if collection_out.status.success() {
        let items: OwnedItems = serde_json::from_slice(&collection_out.stdout)?;
        println!("Collection generated at: {}", items.generated_at);
        for weapon in items.weapons {
            if let Some(first_skin) = weapon.skins.first() {
                println!("- {}: {}", weapon.name, first_skin.name);
            }
        }
    }

    Ok(())
}
```

## Write with Validation

Every mutation defaults to a local **dry run** unless `--yes` is supplied. If validation fails (e.g. attempting to equip an unowned card), the process exits with code `6` and returns error JSON on `stderr`:

```rust
use std::process::Command;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ErrorDetail {
    code: String,
    reason: Option<String>,
    message: String,
}

#[derive(Debug, Deserialize)]
struct ErrorEnvelope {
    error: ErrorDetail,
}

fn equip_card(card_uuid: &str, apply: bool) -> Result<(), Box<dyn std::error::Error>> {
    let mut cmd = Command::new("riotclient");
    cmd.args(["equip", "--card", card_uuid]);
    if apply {
        cmd.arg("--yes");
    }

    let output = cmd.output()?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("Success: {}", stdout.trim());
    } else if output.status.code() == Some(6) {
        // Validation error
        let err: ErrorEnvelope = serde_json::from_slice(&output.stderr)?;
        eprintln!(
            "Validation failed [code {} / {:?}]: {}",
            err.error.code,
            err.error.reason.unwrap_or_default(),
            err.error.message
        );
    } else {
        eprintln!("Command failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let card = "0819fbcd-4bd4-c379-5384-52803440f2b2";
    equip_card(card, false)?; // Dry run
    equip_card(card, true)?;  // Apply mutation
    Ok(())
}
```

## Events

Stream real-time WebSocket events from the local client by spawning `riotclient watch` with piped stdout and iterating lines using `BufReader`:

```rust
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use serde_json::Value;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut child = Command::new("riotclient")
        .args(["watch", "--only", "friend:presence,message"])
        .stdout(Stdio::piped())
        .spawn()?;

    println!("Listening for real-time events. Press Ctrl+C to terminate.");
    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let val: Value = serde_json::from_str(&line)?;
        let event = val.get("event").and_then(|v| v.as_str()).unwrap_or_default();
        let data = val.get("data");

        match event {
            "friend:presence" => {
                let name = data.and_then(|d| d.pointer("/friend/gameName")).and_then(|v| v.as_str()).unwrap_or_default();
                let change = data.and_then(|d| d.get("change")).and_then(|v| v.as_str()).unwrap_or_default();
                let state = data.and_then(|d| d.pointer("/friend/presence/state")).and_then(|v| v.as_str()).unwrap_or_default();
                println!("Friend {} is now {} ({})", name, change, state);
            }
            "message" => {
                let from = data.and_then(|d| d.pointer("/from/gameName")).and_then(|v| v.as_str()).unwrap_or_default();
                let body = data.and_then(|d| d.get("body")).and_then(|v| v.as_str()).unwrap_or_default();
                println!("[{}]: {}", from, body);
            }
            _ => {}
        }
    }

    Ok(())
}
```

## Types

Generate Rust `serde` structs matching the library schemas with `quicktype`:

```bash
# Generate Rust structs for OwnedItems
npx quicktype schema/OwnedItems.json --src-lang schema -l rust -o owned_items.rs
```

Include the generated file in your module to deserialize the CLI output:

```rust
mod owned_items;
use owned_items::OwnedItems;

let items: OwnedItems = serde_json::from_slice(&output.stdout)?;
for weapon in items.weapons {
    if let Some(skin) = weapon.skins.first() {
        println!("- {}: {}", weapon.name, skin.name);
    }
}
```
