<?php

declare(strict_types=1);

// #region read
/** @return array{0:int,1:string,2:string} exit code, stdout, stderr */
function runCliCommand(array $args): array
{
    $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $command = array_merge(['riotclient'], $args);
    $process = proc_open($command, $descriptors, $pipes);
    if (!is_resource($process)) {
        throw new RuntimeException('Failed to spawn riotclient');
    }
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    return [proc_close($process), (string) $stdout, (string) $stderr];
}

function readExample(): void
{
    [$code, $stdout] = runCliCommand(['whoami']);
    if ($code === 0) {
        $player = json_decode($stdout, true, 512, JSON_THROW_ON_ERROR);
        echo "Player: {$player['gameName']}#{$player['tagLine']} ({$player['region']})\n";
    }

    [$code, $stdout] = runCliCommand(['owned-items', '--language', 'en-US']);
    if ($code === 0) {
        $collection = json_decode($stdout, true, 512, JSON_THROW_ON_ERROR);
        echo "Collection generated at: {$collection['generatedAt']}\n";
        foreach ($collection['weapons'] as $weapon) {
            if (!empty($weapon['skins'])) {
                echo "- {$weapon['name']}: {$weapon['skins'][0]['name']}\n";
            }
        }
    }
}
// #endregion read

// #region write
function equipCard(string $cardUuid, bool $execute = false): void
{
    $args = ['equip', '--card', $cardUuid];
    if ($execute) {
        $args[] = '--yes';
    }
    [$exitCode, $stdout, $stderr] = runCliCommand($args);

    if ($exitCode === 0) {
        $label = $execute ? 'Equipped card:' : 'Dry run passed:';
        echo "{$label} " . trim($stdout) . "\n";
    } elseif ($exitCode === 6) {
        $error = json_decode($stderr, true, 512, JSON_THROW_ON_ERROR)['error'];
        $reason = $error['reason'] ?? 'unknown';
        fwrite(STDERR, "Validation failed: {$reason} - {$error['message']}\n");
    } else {
        fwrite(STDERR, "Command failed [code {$exitCode}]: {$stderr}\n");
    }
}
// #endregion write

// #region events
function streamEvents(): void
{
    $handle = popen('riotclient watch --only friend:presence,message', 'r');
    if ($handle === false) {
        throw new RuntimeException('Failed to spawn riotclient watch');
    }

    echo "Listening for real-time events. Press Ctrl+C to terminate.\n";
    while (($line = fgets($handle)) !== false) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        $event = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        $data = $event['data'] ?? [];
        if ($event['event'] === 'friend:presence') {
            $name = $data['friend']['gameName'] ?? '';
            $state = $data['friend']['presence']['state'] ?? '';
            echo "Friend {$name} is now {$data['change']} ({$state})\n";
        } elseif ($event['event'] === 'message') {
            echo "[{$data['from']['gameName']}]: {$data['body']}\n";
        }
    }
    pclose($handle);
}
// #endregion events

// #region types
/** Generated with: npx quicktype schema/OwnedItems.json --src-lang schema -l php -o OwnedItems.php */
final class OwnedSkin
{
    public function __construct(public readonly string $uuid, public readonly string $name)
    {
    }

    /** @param array<string,mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self((string) $data['uuid'], (string) $data['name']);
    }
}
// #endregion types

readExample();
$card = '0819fbcd-4bd4-c379-5384-52803440f2b2';
equipCard($card, false);
if (in_array('--watch', $argv, true)) {
    streamEvents();
}
