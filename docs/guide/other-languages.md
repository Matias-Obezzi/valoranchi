# Other Languages

Any programming language or runtime can interact with the local Riot Client session by invoking the `riotclient` binary as a child process and parsing standard JSON from stdout.

::: tip Dedicated Language Guides
For complete, copy-paste recipes, quicktype code generation, and error handling across 10 programming languages, see [Usage by Language](/languages/).
:::

## Spawning the CLI

### C#

```csharp
using System;
using System.Diagnostics;
using System.Text.Json;

var psi = new ProcessStartInfo
{
    FileName = "riotclient",
    Arguments = "whoami",
    RedirectStandardOutput = true,
    RedirectStandardError = true,
    UseShellExecute = false,
    CreateNoWindow = true,
};

using var process = Process.Start(psi)!;
string output = process.StandardOutput.ReadToEnd();
process.WaitForExit();

if (process.ExitCode == 0)
{
    using var doc = JsonDocument.Parse(output);
    Console.WriteLine($"Player: {doc.RootElement.GetProperty("gameName").GetString()}");
}
```

### Rust

```rust
use std::process::Command;
use serde_json::Value;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new("riotclient")
        .arg("whoami")
        .output()?;

    if output.status.success() {
        let json: Value = serde_json::from_slice(&output.stdout)?;
        println!("Player: {}", json["gameName"]);
    }
    Ok(())
}
```

### Python

```python
import subprocess
import json

result = subprocess.run(
    ["riotclient", "whoami"],
    capture_output=True,
    text=True,
    check=True
)

data = json.loads(result.stdout)
print(f"Player: {data['gameName']}#{data['tagLine']}")
```

### Go

```go
package main

import (
	"encoding/json"
	"fmt"
	"os/exec"
)

type Player struct {
	GameName string `json:"gameName"`
	TagLine  string `json:"tagLine"`
}

func main() {
	out, err := exec.Command("riotclient", "whoami").Output()
	if err != nil {
		panic(err)
	}

	var player Player
	if err := json.Unmarshal(out, &player); err != nil {
		panic(err)
	}

	fmt.Printf("Player: %s#%s\n", player.GameName, player.TagLine)
}
```

## JSON Schemas and quicktype

The repository includes strongly typed JSON Schemas for all models in the `schema/` directory.

Generate native model classes in any language using `quicktype`:

```bash
# Generate C# types
npx quicktype schema/OwnedItems.json -o OwnedItems.cs --namespace Valoranchi

# Generate Go types
npx quicktype schema/Store.json -o store.go --package main

# Generate Rust structs
npx quicktype schema/Match.json -o match.rs

# Generate Python dataclasses
npx quicktype schema/LiveMatch.json -o live_match.py
```

## Streaming Events via stdout

The `riotclient watch` command emits real-time events as a continuous stream of newline-delimited JSON (NDJSON) over standard output.

Process events line-by-line as they occur:

### Python Example

```python
import subprocess
import json

process = subprocess.Popen(
    ["riotclient", "watch", "--only", "friend:presence,message"],
    stdout=subprocess.PIPE,
    text=True
)

for line in process.stdout:
    event = json.loads(line)
    print(f"Event received: {event}")
```

### Go Example

```go
package main

import (
	"bufio"
	"fmt"
	"os/exec"
)

func main() {
	cmd := exec.Command("riotclient", "watch")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		panic(err)
	}

	if err := cmd.Start(); err != nil {
		panic(err)
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		fmt.Printf("Line: %s\n", scanner.Text())
	}
}
```
