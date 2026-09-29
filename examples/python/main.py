from dataclasses import dataclass
import json
import subprocess
import sys
from typing import Any, List, Optional

# #region types
@dataclass
class Skin:
    name: str

@dataclass
class Weapon:
    name: str
    skins: List[Skin]

@dataclass
class OwnedItems:
    generated_at: str
    weapons: List[Weapon]

def owned_items_from_dict(obj: Any) -> OwnedItems:
    assert isinstance(obj, dict)
    generated_at = obj.get("generatedAt", "")
    raw_weapons = obj.get("weapons", [])
    weapons = [
        Weapon(
            name=w.get("name", ""),
            skins=[Skin(name=s.get("name", "")) for s in w.get("skins", [])]
        )
        for w in raw_weapons
    ]
    return OwnedItems(generated_at=generated_at, weapons=weapons)

def types_example() -> None:
    result = subprocess.run(["riotclient", "owned-items"], capture_output=True, text=True, check=True)
    items = owned_items_from_dict(json.loads(result.stdout))

    for weapon in items.weapons:
        if weapon.skins:
            print(f"- {weapon.name}: {weapon.skins[0].name}")
# #endregion types

# #region read
def read_example() -> None:
    # 1. Read player profile
    whoami = subprocess.run(
        ["riotclient", "whoami"],
        capture_output=True,
        text=True,
        check=True,
    )
    player = json.loads(whoami.stdout)
    print(f"Player: {player['gameName']}#{player['tagLine']} ({player['region']})")

    # 2. Read owned collection
    collection_run = subprocess.run(
        ["riotclient", "owned-items", "--language", "en-US"],
        capture_output=True,
        text=True,
        check=True,
    )
    collection = json.loads(collection_run.stdout)
    print(f"Collection generated at: {collection['generatedAt']}")
    for weapon in collection["weapons"]:
        skins = weapon.get("skins", [])
        if skins:
            print(f"- {weapon['name']}: {skins[0]['name']}")
# #endregion read

# #region write
def equip_card(card_uuid: str, execute: bool = False) -> None:
    args = ["riotclient", "equip", "--card", card_uuid]
    if execute:
        args.append("--yes")

    result = subprocess.run(args, capture_output=True, text=True)

    if result.returncode == 0:
        label = "Mutation applied:" if execute else "Dry run validated:"
        print(f"{label} {result.stdout.strip()}")
    elif result.returncode == 6:
        # Exit code 6: local validation error
        error_payload = json.loads(result.stderr)
        reason = error_payload["error"].get("reason")
        message = error_payload["error"].get("message")
        print(f"Validation failed [code 6]: {reason} - {message}")
    else:
        print(f"Command failed [code {result.returncode}]: {result.stderr.strip()}")
# #endregion write

# #region events
def stream_events() -> None:
    process = subprocess.Popen(
        ["riotclient", "watch", "--only", "friend:presence,message"],
        stdout=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    print("Listening to real-time events. Press Ctrl+C to terminate.")
    try:
        assert process.stdout is not None
        for line in process.stdout:
            line = line.strip()
            if not line:
                continue

            event = json.loads(line)
            event_type = event.get("event")
            data = event.get("data", {})

            if event_type == "friend:presence":
                friend = data.get("friend", {})
                name = friend.get("gameName")
                change = data.get("change")
                state = friend.get("presence", {}).get("state")
                print(f"Friend {name} is now {change} ({state})")
            elif event_type == "message":
                from_name = data.get("from", {}).get("gameName")
                body = data.get("body")
                print(f"[{from_name}]: {body}")
    except KeyboardInterrupt:
        process.terminate()
# #endregion events

def main() -> None:
    read_example()
    card = "0819fbcd-4bd4-c379-5384-52803440f2b2"
    equip_card(card, execute=False)  # Dry run
    equip_card(card, execute=True)   # Apply mutation
    if len(sys.argv) > 1 and sys.argv[1] == "--watch":
        stream_events()

if __name__ == "__main__":
    main()
