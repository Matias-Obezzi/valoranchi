# Python

Python applications interact with the local Riot Client session by running the `riotclient` CLI with the standard `subprocess` module and parsing its JSON output. Strongly typed dataclasses can be generated from the JSON Schemas using `quicktype`.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. Standard Python 3.10+ includes `subprocess`, `json`, and `dataclasses` in the standard library without external dependencies.

## Read

Invoke `whoami` and `owned-items` via `subprocess.run()`, capture standard output, and parse the JSON string. The snippet below prints the active player identity and the first owned skin for every weapon:

```python
import json
import subprocess

def main() -> None:
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

if __name__ == "__main__":
    main()
```

## Write with Validation

Every write command performs local client-side validation as a dry run unless `--yes` is specified.

When validation fails (such as an unowned card or missing item), the process exits with code `6` and writes structured error JSON to `stderr`:

```python
import json
import subprocess

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

if __name__ == "__main__":
    card = "0819fbcd-4bd4-c379-5384-52803440f2b2"
    equip_card(card, execute=False)  # Dry run
    equip_card(card, execute=True)   # Apply mutation
```

## Events

Stream real-time events line-by-line using `subprocess.Popen` with buffered line iteration:

```python
import json
import subprocess

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

if __name__ == "__main__":
    stream_events()
```

## Types

Generate Python dataclasses from the JSON Schemas with `quicktype`:

```bash
# Generate Python dataclasses
npx quicktype schema/OwnedItems.json --src-lang schema -l python -o owned_items.py
```

Use the generated `owned_items_from_dict` helper in your code:

```python
import json
import subprocess
from owned_items import owned_items_from_dict

result = subprocess.run(["riotclient", "owned-items"], capture_output=True, text=True, check=True)
items = owned_items_from_dict(json.loads(result.stdout))

for weapon in items.weapons:
    if weapon.skins:
        print(f"- {weapon.name}: {weapon.skins[0].name}")
```
