# Shell (Bash & PowerShell)

Shell scripts and terminal pipelines provide the fastest way to inspect your account, experiment with commands, and automate workflows. Use `jq` in POSIX shells (bash / zsh) or `ConvertFrom-Json` in PowerShell.

## Setup

Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

For Bash/Zsh, ensure `jq` is installed:

```bash
# macOS
brew install jq

# Debian/Ubuntu
sudo apt-get install jq

# Windows (winget or choco)
winget install jqlang.jq
```

PowerShell includes `ConvertFrom-Json` and `ConvertTo-Json` out of the box in Windows PowerShell 5.1 and PowerShell 7+.

## Read

Read player identity and weapons collection, printing the weapon name and first owned skin.

### Bash with `jq`

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Read player profile
player=$(riotclient whoami)
echo "Player: $(echo "$player" | jq -r '.gameName + "#" + .tagLine + " (" + .region + ")")"

# 2. Read owned collection and print first skin per weapon
riotclient owned-items --language en-US | jq -r '
  "Collection generated at: " + .generatedAt,
  (.weapons[] | select(.skins | length > 0) | "- " + .name + ": " + .skins[0].name)
'
```

### PowerShell

```powershell
# 1. Read player profile
$player = riotclient whoami | ConvertFrom-Json
Write-Host "Player: $($player.gameName)#$($player.tagLine) ($($player.region))"

# 2. Read owned collection and print first skin per weapon
$collection = riotclient owned-items --language en-US | ConvertFrom-Json
Write-Host "Collection generated at: $($collection.generatedAt)"

foreach ($weapon in $collection.weapons) {
    if ($weapon.skins.Count -gt 0) {
        Write-Host "- $($weapon.name): $($weapon.skins[0].name)"
    }
}
```

## Write with Validation

Every mutation defaults to a **dry run** without mutating the account. Use `--yes` to apply the update. Exit code `6` indicates local validation failure.

### Bash with `jq`

```bash
#!/usr/bin/env bash
card="0819fbcd-4bd4-c379-5384-52803440f2b2"

# 1. Dry run (default)
echo "=== Dry Run ==="
riotclient equip --card "$card"

# 2. Execute mutation with validation check
echo "=== Applying Mutation ==="
if output=$(riotclient equip --card "$card" --yes 2> error.json); then
    echo "Equipped card successfully: $output"
else
    exit_code=$?
    if [ "$exit_code" -eq 6 ]; then
        reason=$(jq -r '.error.reason' error.json)
        message=$(jq -r '.error.message' error.json)
        echo "Validation failed [code 6]: $reason - $message" >&2
    else
        echo "Command failed with code $exit_code" >&2
        cat error.json >&2
    fi
    rm -f error.json
fi
```

### PowerShell

```powershell
$card = "0819fbcd-4bd4-c379-5384-52803440f2b2"

# 1. Dry run
Write-Host "=== Dry Run ==="
riotclient equip --card $card

# 2. Execute mutation with error handling
Write-Host "=== Applying Mutation ==="
$errFile = [System.IO.Path]::GetTempFileName()
$stdout = riotclient equip --card $card --yes 2> $errFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Equipped card successfully: $stdout"
} elseif ($LASTEXITCODE -eq 6) {
    $errObj = Get-Content $errFile | ConvertFrom-Json
    Write-Warning "Validation failed [code 6]: $($errObj.error.reason) - $($errObj.error.message)"
} else {
    Write-Error "Command failed with exit code $LASTEXITCODE"
    Get-Content $errFile | Write-Host
}
Remove-Item -Force $errFile
```

## Events

Stream real-time events line-by-line using standard pipes.

### Bash with `jq`

```bash
#!/usr/bin/env bash
echo "Listening for real-time events. Press Ctrl+C to stop."

riotclient watch --only friend:presence,message | while IFS= read -r line; do
    [ -z "$line" ] && continue
    event=$(echo "$line" | jq -r '.event')
    if [ "$event" = "friend:presence" ]; then
        name=$(echo "$line" | jq -r '.data.friend.gameName')
        change=$(echo "$line" | jq -r '.data.change')
        state=$(echo "$line" | jq -r '.data.friend.presence.state')
        echo "Friend $name is now $change ($state)"
    elif [ "$event" = "message" ]; then
        from=$(echo "$line" | jq -r '.data.from.gameName')
        body=$(echo "$line" | jq -r '.data.body')
        echo "[$from]: $body"
    fi
done
```

### PowerShell

```powershell
Write-Host "Listening for real-time events. Press Ctrl+C to stop."

riotclient watch --only friend:presence,message | ForEach-Object {
    if ([string]::IsNullOrWhiteSpace($_)) { return }
    $event = $_ | ConvertFrom-Json
    switch ($event.event) {
        "friend:presence" {
            $friend = $event.data.friend
            Write-Host "Friend $($friend.gameName) is now $($event.data.change) ($($friend.presence.state))"
        }
        "message" {
            Write-Host "[$($event.data.from.gameName)]: $($event.data.body)"
        }
    }
}
```

## Types

While shell scripts do not compile against static types, you can inspect the canonical JSON Schemas in `schema/*.json` to discover exact field names, nullability, and nested types:

```bash
# View all available schemas
ls schema/

# Inspect schema properties using jq
jq '.definitions.OwnedItems.properties | keys' schema/OwnedItems.json
```
