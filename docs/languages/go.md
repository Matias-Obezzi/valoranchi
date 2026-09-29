# Go

Go applications integrate with the local Riot Client session by running the `riotclient` CLI with the standard library `os/exec` package and unmarshaling standard JSON into typed structs. Structs can be generated using `quicktype`.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. Standard Go 1.20+ with built-in `encoding/json` and `os/exec` packages is required.

## Read

Execute `whoami` and `owned-items` using `exec.Command()`, unmarshaling the JSON output into Go structs:

<<< @/../examples/go/main.go#read{go}

## Write with Validation

Every mutation defaults to a local **dry run** unless `--yes` is specified. If validation fails (e.g. equipping an unowned item), the CLI exits with code `6` and outputs error JSON to `stderr`:

<<< @/../examples/go/main.go#write{go}

## Events

Stream real-time events by executing `riotclient watch` and reading lines with a `bufio.Scanner`:

<<< @/../examples/go/main.go#events{go}

## Types

Generate Go structs matching the JSON Schemas with `quicktype`:

```bash
# Generate Go structs for OwnedItems
npx quicktype schema/OwnedItems.json --src-lang schema -l go -o owned_items.go --package main
```

Use the generated `UnmarshalOwnedItems` helper function to parse CLI output:

<<< @/../examples/go/main.go#types{go}
