# C# (.NET)

C# and .NET applications consume the local Riot Client by spawning the `riotclient` CLI as a child process and deserializing its standard JSON output using `System.Text.Json`. Strong typing is provided by generating classes from the committed JSON Schemas using `quicktype`.

## Setup

1. Install the CLI globally using npm:

```bash
npm install -g @valoranchi/riot-client
```

2. Verify your .NET project targets `.NET 8.0` or later (`System.Text.Json` is built into the base class library).

## Read

Spawn `riotclient` with `ProcessStartInfo`, capturing standard output. This example reads the player's identity (`whoami`) and owned collection (`owned-items`), printing the first owned skin per weapon:

<<< @/../examples/csharp/Program.cs#read{csharp}

## Write with Validation

Every mutation command defaults to a local **dry run**. It validates arguments and local ownership against Riot's rules without sending network requests. To execute the write, append `--yes`.

If validation fails, `riotclient` exits with code `6` and outputs structured error information to standard error:

<<< @/../examples/csharp/Program.cs#write{csharp}

## Events

Subscribe to real-time events by spawning `riotclient watch`. Read standard output asynchronously line-by-line with `ReadLineAsync()`:

<<< @/../examples/csharp/Program.cs#events{csharp}

## Types

Generate strong C# model classes from the JSON schemas using `quicktype`:

```bash
# Generate C# classes for OwnedItems
npx quicktype schema/OwnedItems.json --src-lang schema -l csharp -o OwnedItems.cs --namespace Valoranchi.Model
```

This generates `System.Text.Json` attributed classes matching the library schema:

<<< @/../examples/csharp/Program.cs#types{csharp}
