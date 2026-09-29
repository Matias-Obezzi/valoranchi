# Java

Java applications integrate with the local Riot Client session by executing the `riotclient` CLI via `ProcessBuilder` and parsing standard JSON with the Jackson library (`jackson-databind`). Model classes (POJOs) can be generated from the JSON Schemas using `quicktype`.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. Add Jackson to your project dependencies:

**Maven (`pom.xml`):**

```xml
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.18.2</version>
</dependency>
```

**Gradle (`build.gradle`):**

```groovy
implementation 'com.fasterxml.jackson.core:jackson-databind:2.18.2'
```

## Read

Execute `whoami` and `owned-items` using `ProcessBuilder`, read the standard output stream, and deserialize the payload into Java objects:

```java
package com.valoranchi.example;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.valoranchi.model.OwnedItems;
import com.valoranchi.model.OwnedWeapon;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class ReadExample {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public static void main(String[] args) throws IOException, InterruptedException {
        // 1. Read player profile
        Process whoamiProcess = new ProcessBuilder("riotclient", "whoami").start();
        String whoamiJson = new String(whoamiProcess.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int whoamiExit = whoamiProcess.waitFor();

        if (whoamiExit == 0) {
            JsonNode playerNode = MAPPER.readTree(whoamiJson);
            System.out.printf("Player: %s#%s (%s)%n",
                    playerNode.get("gameName").asText(),
                    playerNode.get("tagLine").asText(),
                    playerNode.get("region").asText());
        }

        // 2. Read owned collection
        Process collectionProcess = new ProcessBuilder("riotclient", "owned-items", "--language", "en-US").start();
        String collectionJson = new String(collectionProcess.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        int collectionExit = collectionProcess.waitFor();

        if (collectionExit == 0) {
            OwnedItems collection = MAPPER.readValue(collectionJson, OwnedItems.class);
            System.out.println("Collection generated at: " + collection.getGeneratedAt());
            for (OwnedWeapon weapon : collection.getWeapons()) {
                if (weapon.getSkins() != null && !weapon.getSkins().isEmpty()) {
                    System.out.printf("- %s: %s%n", weapon.getName(), weapon.getSkins().get(0).getName());
                }
            }
        }
    }
}
```

## Write with Validation

Every write command performs local client-side validation as a dry run by default. To apply the change, pass `--yes`.

If validation fails, the CLI exits with code `6` and writes structured JSON to standard error:

```java
package com.valoranchi.example;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class WriteExample {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static void equipCard(String cardUuid, boolean execute) throws IOException, InterruptedException {
        ProcessBuilder pb = execute
                ? new ProcessBuilder("riotclient", "equip", "--card", cardUuid, "--yes")
                : new ProcessBuilder("riotclient", "equip", "--card", cardUuid);

        Process process = pb.start();
        String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
        int exitCode = process.waitFor();

        if (exitCode == 0) {
            System.out.println(execute ? "Equipped card successfully:" : "Dry run passed:");
            System.out.println(stdout.trim());
        } else if (exitCode == 6) {
            // Validation error
            JsonNode errNode = MAPPER.readTree(stderr).get("error");
            String reason = errNode.get("reason").asText();
            String message = errNode.get("message").asText();
            System.err.printf("Validation failed [code 6]: %s - %s%n", reason, message);
        } else {
            System.err.printf("Command failed with exit code %d: %s%n", exitCode, stderr);
        }
    }

    public static void main(String[] args) throws Exception {
        String card = "0819fbcd-4bd4-c379-5384-52803440f2b2";
        equipCard(card, false); // Dry run
        equipCard(card, true);  // Execute mutation
    }
}
```

## Events

Stream real-time events by executing `riotclient watch` and processing lines from a `BufferedReader`:

```java
package com.valoranchi.example;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class EventsExample {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        ProcessBuilder pb = new ProcessBuilder("riotclient", "watch", "--only", "friend:presence,message");
        Process process = pb.start();

        System.out.println("Listening for real-time events. Press Ctrl+C to exit.");
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                JsonNode eventNode = MAPPER.readTree(line);
                String event = eventNode.get("event").asText();
                JsonNode data = eventNode.get("data");

                if ("friend:presence".equals(event)) {
                    JsonNode friend = data.get("friend");
                    String name = friend.get("gameName").asText();
                    String change = data.get("change").asText();
                    String state = friend.get("presence").get("state").asText();
                    System.out.printf("Friend %s is now %s (%s)%n", name, change, state);
                } else if ("message".equals(event)) {
                    String from = data.get("from").get("gameName").asText();
                    String body = data.get("body").asText();
                    System.out.printf("[%s]: %s%n", from, body);
                }
            }
        }
    }
}
```

## Types

Generate Java POJOs using `quicktype`:

```bash
# Generate Java POJO classes with Jackson annotations
npx quicktype schema/OwnedItems.json --src-lang schema -l java -o OwnedItems.java --package com.valoranchi.model
```

The generated POJO models will map directly to the JSON payloads:

```java
package com.valoranchi.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class OwnedItems {
    private String generatedAt;
    private List<OwnedWeapon> weapons;

    @JsonProperty("generatedAt")
    public String getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(String value) { this.generatedAt = value; }

    @JsonProperty("weapons")
    public List<OwnedWeapon> getWeapons() { return weapons; }
    public void setWeapons(List<OwnedWeapon> value) { this.weapons = value; }
}
```
