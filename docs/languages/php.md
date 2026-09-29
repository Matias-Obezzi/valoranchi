# PHP

PHP applications interact with the local Riot Client session by executing the `riotclient` CLI as a child process via `proc_open()` or `exec()` and decoding the resulting JSON output with `json_decode()`.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. Standard PHP 8.1+ with the built-in `json` extension is required.

## Read

Execute `whoami` and `owned-items` using `proc_open()` or `shell_exec()`, and decode the JSON output into associative arrays:

```php
<?php

function runCliCommand(string $command): array {
    $descriptors = [
        1 => ["pipe", "w"], // stdout
        2 => ["pipe", "w"], // stderr
    ];

    $process = proc_open("riotclient " . $command, $descriptors, $pipes);
    if (!is_resource($process)) {
        throw new RuntimeException("Failed to spawn riotclient");
    }

    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $exitCode = proc_close($process);
    return [$exitCode, $stdout, $stderr];
}

// 1. Read player profile
[$code, $stdout] = runCliCommand("whoami");
if ($code === 0) {
    $player = json_decode($stdout, true);
    echo "Player: {$player['gameName']}#{$player['tagLine']} ({$player['region']})\n";
}

// 2. Read owned collection
[$code, $stdout] = runCliCommand("owned-items --language en-US");
if ($code === 0) {
    $collection = json_decode($stdout, true);
    echo "Collection generated at: {$collection['generatedAt']}\n";
    foreach ($collection['weapons'] as $weapon) {
        if (!empty($weapon['skins'])) {
            echo "- {$weapon['name']}: {$weapon['skins'][0]['name']}\n";
        }
    }
}
```

## Write with Validation

Every mutation command performs a **dry run** locally unless `--yes` is specified. If validation fails, `riotclient` exits with code `6` and details are written to `stderr`:

```php
<?php

function equipCard(string $cardUuid, bool $execute = false): void {
    $flag = $execute ? " --yes" : "";
    [$exitCode, $stdout, $stderr] = runCliCommand("equip --card {$cardUuid}{$flag}");

    if ($exitCode === 0) {
        $label = $execute ? "Equipped card successfully:" : "Dry run passed:";
        echo "{$label} " . trim($stdout) . "\n";
    } elseif ($exitCode === 6) {
        // Validation error
        $error = json_decode($stderr, true)['error'];
        $reason = $error['reason'] ?? 'unknown';
        $message = $error['message'] ?? '';
        fwrite(STDERR, "Validation failed [code 6]: {$reason} - {$message}\n");
    } else {
        fwrite(STDERR, "Command failed [code {$exitCode}]: {$stderr}\n");
    }
}

$card = "0819fbcd-4bd4-c379-5384-52803440f2b2";
equipCard($card, false); // Dry run
equipCard($card, true);  // Execute mutation
```

## Events

Stream real-time events line-by-line using `popen()`:

```php
<?php

$handle = popen("riotclient watch --only friend:presence,message", "r");
if (!$handle) {
    die("Failed to spawn riotclient watch\n");
}

echo "Listening for real-time events. Press Ctrl+C to terminate.\n";
while (($line = fgets($handle)) !== false) {
    $line = trim($line);
    if (empty($line)) continue;

    $event = json_decode($line, true);
    $type = $event['event'] ?? '';
    $data = $event['data'] ?? [];

    if ($type === 'friend:presence') {
        $name = $data['friend']['gameName'] ?? '';
        $change = $data['change'] ?? '';
        $state = $data['friend']['presence']['state'] ?? '';
        echo "Friend {$name} is now {$change} ({$state})\n";
    } elseif ($type === 'message') {
        $from = $data['from']['gameName'] ?? '';
        $body = $data['body'] ?? '';
        echo "[{$from}]: {$body}\n";
    }
}

pclose($handle);
```

## Types

Generate typed PHP classes from the JSON Schemas with `quicktype`:

```bash
# Generate PHP classes for OwnedItems
npx quicktype schema/OwnedItems.json --src-lang schema -l php -o OwnedItems.php
```
