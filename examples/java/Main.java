package com.valoranchi.example;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class Main {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    // #region read
    public static void readExample() throws IOException, InterruptedException {
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
    // #endregion read

    // #region write
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
    // #endregion write

    // #region events
    public static void streamEvents() throws Exception {
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
    // #endregion events

    public static void main(String[] args) throws Exception {
        readExample();
        String card = "0819fbcd-4bd4-c379-5384-52803440f2b2";
        equipCard(card, false);
        equipCard(card, true);
        if (args.length > 0 && args[0].equals("--watch")) {
            streamEvents();
        }
    }

    // #region types
    public static class OwnedItems {
        private String generatedAt;
        private List<OwnedWeapon> weapons;

        @JsonProperty("generatedAt")
        public String getGeneratedAt() { return generatedAt; }
        public void setGeneratedAt(String value) { this.generatedAt = value; }

        @JsonProperty("weapons")
        public List<OwnedWeapon> getWeapons() { return weapons; }
        public void setWeapons(List<OwnedWeapon> value) { this.weapons = value; }
    }

    public static class OwnedWeapon {
        private String name;
        private List<OwnedSkin> skins;

        @JsonProperty("name")
        public String getName() { return name; }
        public void setName(String value) { this.name = value; }

        @JsonProperty("skins")
        public List<OwnedSkin> getSkins() { return skins; }
        public void setSkins(List<OwnedSkin> value) { this.skins = value; }
    }

    public static class OwnedSkin {
        private String uuid;
        private String name;

        @JsonProperty("uuid")
        public String getUuid() { return uuid; }
        public void setUuid(String value) { this.uuid = value; }

        @JsonProperty("name")
        public String getName() { return name; }
        public void setName(String value) { this.name = value; }
    }
    // #endregion types
}
