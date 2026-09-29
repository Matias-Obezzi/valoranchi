use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use serde::Deserialize;
use serde_json::Value;

// #region types
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub game_name: String,
    pub tag_line: String,
    pub region: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedSkin {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedWeapon {
    pub name: String,
    pub skins: Vec<OwnedSkin>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedItems {
    pub generated_at: String,
    pub weapons: Vec<OwnedWeapon>,
}

pub fn types_example(stdout: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let items: OwnedItems = serde_json::from_slice(stdout)?;
    for weapon in items.weapons {
        if let Some(skin) = weapon.skins.first() {
            println!("- {}: {}", weapon.name, skin.name);
        }
    }
    Ok(())
}
// #endregion types

// #region read
pub fn read_example() -> Result<(), Box<dyn std::error::Error>> {
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
// #endregion read

// #region write
#[derive(Debug, Deserialize)]
pub struct ErrorDetail {
    pub code: String,
    pub reason: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct ErrorEnvelope {
    pub error: ErrorDetail,
}

pub fn equip_card(card_uuid: &str, apply: bool) -> Result<(), Box<dyn std::error::Error>> {
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
// #endregion write

// #region events
pub fn stream_events() -> Result<(), Box<dyn std::error::Error>> {
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
// #endregion events

fn main() -> Result<(), Box<dyn std::error::Error>> {
    read_example()?;
    let card = "0819fbcd-4bd4-c379-5384-52803440f2b2";
    equip_card(card, false)?; // Dry run
    equip_card(card, true)?;  // Apply mutation
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "--watch" {
        stream_events()?;
    }
    Ok(())
}
