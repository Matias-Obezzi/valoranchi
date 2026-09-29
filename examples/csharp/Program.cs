using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using Valoranchi.Model;

namespace Valoranchi.Example
{
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

        // #region read
        public static async Task ReadAsync()
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
        // #endregion read

        // #region write
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
        // #endregion write

        // #region events
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
        // #endregion events

        public static async Task Main(string[] args)
        {
            await ReadAsync();
            await EquipCard("0819fbcd-4bd4-c379-5384-52803440f2b2", dryRun: true);
            if (args.Length > 0 && args[0] == "--watch")
            {
                await StreamEvents();
            }
        }
    }
}

// #region types
namespace Valoranchi.Model
{
    public partial class Player
    {
        public string Puuid { get; set; } = string.Empty;
        public string GameName { get; set; } = string.Empty;
        public string TagLine { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string Shard { get; set; } = string.Empty;
        public int AccountLevel { get; set; }
    }

    public partial class OwnedItems
    {
        public Player? Player { get; set; }
        public string Language { get; set; } = string.Empty;
        public string GeneratedAt { get; set; } = string.Empty;
        public OwnedWeapon[] Weapons { get; set; } = Array.Empty<OwnedWeapon>();
    }

    public partial class OwnedWeapon
    {
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public OwnedSkin[] Skins { get; set; } = Array.Empty<OwnedSkin>();
    }

    public partial class OwnedSkin
    {
        public string Uuid { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }
}
// #endregion types
