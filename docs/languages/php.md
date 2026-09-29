# PHP

PHP applications interact with the local Riot Client session by executing the `riotclient` CLI as a child process with `proc_open()` and decoding the JSON output with `json_decode()`. The whole example lives in `examples/php/main.php` and passes `php -l`.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. PHP 8.1 or later with the built-in `json` extension.

## Read

Run `whoami` and `owned-items` with `proc_open()` and decode the output into associative arrays:

<<< @/../examples/php/main.php#read{php}

## Write with Validation

Every mutation command performs a **dry run** locally unless `--yes` is given. If validation fails, `riotclient` exits with code `6` and writes the details to `stderr`:

<<< @/../examples/php/main.php#write{php}

## Events

Stream real-time events line by line with `popen()`:

<<< @/../examples/php/main.php#events{php}

## Types

Generate typed PHP classes from the JSON Schemas with `quicktype`:

```bash
npx quicktype schema/OwnedItems.json --src-lang schema -l php -o OwnedItems.php
```

A hand-written class of the same shape, for a single model:

<<< @/../examples/php/main.php#types{php}
