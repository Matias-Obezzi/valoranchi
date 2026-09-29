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

```csharp
using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using Valoranchi.Model;

namespace Valoranchi.Example;

public class Program
{
    private static ProcessStartInfo CreateStartInfo(string arguments) => new()
    {
        FileName = "riotclient",
        Arguments = arguments,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
        CreateNoWindow = true,
    };

    public static async Task Main()
    {
        // 1. Read player identity
        using (var whoami = Process.Start(CreateStartInfo("whoami"))!)
        {
            string output = await whoami.StandardOutput.ReadToEndAsync();
            await whoami.WaitForExitAsync();

            if (whoami.ExitCode == 0)
            {
                using var doc = JsonDocument.Parse(output);
                var root = doc.RootElement;
                Console.WriteLine($"Player: {root.GetProperty("gameName").GetString()}#{root.GetProperty("tagLine").GetString()} ({root.GetProperty("region").GetString()})");
            }
        }

        // 2. Read owned collection with deserialization
        using (var collection = Process.Start(CreateStartInfo("owned-items --language en-US"))!)
        {
            string output = await collection.StandardOutput.ReadToEndAsync();
            await collection.WaitForExitAsync();

            if (collection.ExitCode == 0)
            {
                var items = JsonSerializer.Deserialize<OwnedItems>(output, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                })!;

                Console.WriteLine($"Collection generated at: {items.GeneratedAt}");
                foreach (var weapon in items.Weapons)
                {
                    if (weapon.Skins.Length > 0)
                    {
                        Console.WriteLine($"- {weapon.Name}: {weapon.Skins[0].Name}");
                    }
                }
            }
        }
    }
}
```

## Write with Validation

Every mutation command defaults to a local **dry run**. It validates arguments and local ownership against Riot's rules without sending network requests. To execute the write, append `--yes`.

If validation fails, `riotclient` exits with code `6` and outputs structured error information to standard error:

```csharp
using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;

public static async Task EquipCard(string cardUuid, bool dryRun)
{
    string args = dryRun
        ? $"equip --card {cardUuid}"
        : $"equip --card {cardUuid} --yes";

    var psi = new ProcessStartInfo
    {
        FileName = "riotclient",
        Arguments = args,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
        CreateNoWindow = true,
    };

    using var process = Process.Start(psi)!;
    string stdout = await process.StandardOutput.ReadToEndAsync();
    string stderr = await process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();

    if (process.ExitCode == 0)
    {
        Console.WriteLine(dryRun ? "Dry run succeeded:" : "Equipped card successfully:");
        Console.WriteLine(stdout.Trim());
    }
    else if (process.ExitCode == 6)
    {
        // Validation error
        using var errorDoc = JsonDocument.Parse(stderr);
        var err = errorDoc.RootElement.GetProperty("error");
        string reason = err.GetProperty("reason").GetString()!;
        string message = err.GetProperty("message").GetString()!;
        Console.Error.WriteLine($"Validation failed [code 6]: {reason} - {message}");
    }
    else
    {
        Console.Error.WriteLine($"Command failed with exit code {process.ExitCode}: {stderr}");
    }
}
```

## Events

Subscribe to real-time events by spawning `riotclient watch`. Read standard output asynchronously line-by-line with `ReadLineAsync()`:

```csharp
using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;

public static async Task StreamEvents()
{
    var psi = new ProcessStartInfo
    {
        FileName = "riotclient",
        Arguments = "watch --only friend:presence,message",
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
        CreateNoWindow = true,
    };

    using var process = Process.Start(psi)!;
    Console.WriteLine("Streaming events from Riot Client. Press Ctrl+C to terminate.");

    while (await process.StandardOutput.ReadLineAsync() is { } line)
    {
        if (string.IsNullOrWhiteSpace(line)) continue;

        using var doc = JsonDocument.Parse(line);
        string eventType = doc.RootElement.GetProperty("event").GetString()!;
        var data = doc.RootElement.GetProperty("data");

        if (eventType == "friend:presence")
        {
            var friend = data.GetProperty("friend");
            string name = friend.GetProperty("gameName").GetString()!;
            string change = data.GetProperty("change").GetString()!;
            string state = friend.GetProperty("presence").GetProperty("state").GetString()!;
            Console.WriteLine($"Friend {name} is now {change} ({state})");
        }
        else if (eventType == "message")
        {
            string from = data.GetProperty("from").GetProperty("gameName").GetString()!;
            string body = data.GetProperty("body").GetString()!;
            Console.WriteLine($"[{from}]: {body}");
        }
    }
}
```

## Types

Generate strong C# model classes from the JSON schemas using `quicktype`:

```bash
# Generate C# classes for OwnedItems
npx quicktype schema/OwnedItems.json --src-lang schema -l csharp -o OwnedItems.cs --namespace Valoranchi.Model
```

This generates `System.Text.Json` attributed classes matching the library schema:

```csharp
namespace Valoranchi.Model;

public partial class OwnedItems
{
    public Player Player { get; set; }
    public string Language { get; set; }
    public string GeneratedAt { get; set; }
    public OwnedWeapon[] Weapons { get; set; }
}

public partial class OwnedWeapon
{
    public string Name { get; set; }
    public string Category { get; set; }
    public OwnedSkin[] Skins { get; set; }
}

public partial class OwnedSkin
{
    public string Uuid { get; set; }
    public string Name { get; set; }
}
```
