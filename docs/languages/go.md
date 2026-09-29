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
	Region   string `json:"region"`
}

type Skin struct {
	Name string `json:"name"`
}

type Weapon struct {
	Name  string `json:"name"`
	Skins []Skin `json:"skins"`
}

type OwnedItems struct {
	GeneratedAt string   `json:"generatedAt"`
	Weapons     []Weapon `json:"weapons"`
}

func main() {
	// 1. Read player profile
	whoamiOut, err := exec.Command("riotclient", "whoami").Output()
	if err != nil {
		panic(err)
	}
	var player Player
	if err := json.Unmarshal(whoamiOut, &player); err != nil {
		panic(err)
	}
	fmt.Printf("Player: %s#%s (%s)\n", player.GameName, player.TagLine, player.Region)

	// 2. Read owned collection
	itemsOut, err := exec.Command("riotclient", "owned-items", "--language", "en-US").Output()
	if err != nil {
		panic(err)
	}
	var items OwnedItems
	if err := json.Unmarshal(itemsOut, &items); err != nil {
		panic(err)
	}
	fmt.Printf("Collection generated at: %s\n", items.GeneratedAt)
	for _, weapon := range items.Weapons {
		if len(weapon.Skins) > 0 {
			fmt.Printf("- %s: %s\n", weapon.Name, weapon.Skins[0].Name)
		}
	}
}
```

## Write with Validation

Every mutation defaults to a local **dry run** unless `--yes` is specified. If validation fails (e.g. equipping an unowned item), the CLI exits with code `6` and outputs error JSON to `stderr`:

```go
package main

import (
	"encoding/json"
	"fmt"
	"os/exec"
)

type CliErrorPayload struct {
	Error struct {
		Code    string `json:"code"`
		Reason  string `json:"reason"`
		Message string `json:"message"`
	} `json:"error"`
}

func equipCard(cardUuid string, apply bool) {
	args := []string{"equip", "--card", cardUuid}
	if apply {
		args = append(args, "--yes")
	}

	cmd := exec.Command("riotclient", args...)
	out, err := cmd.Output()
	if err == nil {
		label := "Dry run validated:"
		if apply {
			label = "Equipped card successfully:"
		}
		fmt.Printf("%s %s\n", label, string(out))
		return
	}

	if exitErr, ok := err.(*exec.ExitError); ok {
		if exitErr.ExitCode() == 6 {
			// Validation failure
			var errData CliErrorPayload
			_ = json.Unmarshal(exitErr.Stderr, &errData)
			fmt.Printf("Validation failed [code 6]: %s - %s\n", errData.Error.Reason, errData.Error.Message)
			return
		}
		fmt.Printf("Command failed with exit code %d: %s\n", exitErr.ExitCode(), string(exitErr.Stderr))
	}
}

func main() {
	card := "0819fbcd-4bd4-c379-5384-52803440f2b2"
	equipCard(card, false) // Dry run
	equipCard(card, true)  // Apply mutation
}
```

## Events

Stream real-time events by executing `riotclient watch` and reading lines with a `bufio.Scanner`:

```go
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

func main() {
	cmd := exec.Command("riotclient", "watch", "--only", "friend:presence,message")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		panic(err)
	}

	if err := cmd.Start(); err != nil {
		panic(err)
	}

	fmt.Println("Listening for events. Press Ctrl+C to terminate.")
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		if len(strings.TrimSpace(line)) == 0 {
			continue
		}

		var envelope struct {
			Event string          `json:"event"`
			Data  json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal([]byte(line), &envelope); err != nil {
			continue
		}

		if envelope.Event == "friend:presence" {
			var p struct {
				Friend struct {
					GameName string `json:"gameName"`
					Presence struct {
						State string `json:"state"`
					} `json:"presence"`
				} `json:"friend"`
				Change string `json:"change"`
			}
			_ = json.Unmarshal(envelope.Data, &p)
			fmt.Printf("Friend %s is now %s (%s)\n", p.Friend.GameName, p.Change, p.Friend.Presence.State)
		} else if envelope.Event == "message" {
			var m struct {
				From struct {
					GameName string `json:"gameName"`
				} `json:"from"`
				Body string `json:"body"`
			}
			_ = json.Unmarshal(envelope.Data, &m)
			fmt.Printf("[%s]: %s\n", m.From.GameName, m.Body)
		}
	}
}
```

## Types

Generate Go structs matching the JSON Schemas with `quicktype`:

```bash
# Generate Go structs for OwnedItems
npx quicktype schema/OwnedItems.json --src-lang schema -l go -o owned_items.go --package main
```

Use the generated `UnmarshalOwnedItems` helper function to parse CLI output:

```go
items, err := UnmarshalOwnedItems(itemsOut)
if err != nil {
    panic(err)
}

for _, weapon := range items.Weapons {
    if len(weapon.Skins) > 0 {
        fmt.Printf("- %s: %s\n", weapon.Name, weapon.Skins[0].Name)
    }
}
```
