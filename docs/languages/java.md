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

<<< @/../examples/java/Main.java#read{java}

## Write with Validation

Every write command performs local client-side validation as a dry run by default. To apply the change, pass `--yes`.

If validation fails, the CLI exits with code `6` and writes structured JSON to standard error:

<<< @/../examples/java/Main.java#write{java}

## Events

Stream real-time events by executing `riotclient watch` and processing lines from a `BufferedReader`:

<<< @/../examples/java/Main.java#events{java}

## Types

Generate Java POJOs using `quicktype`:

```bash
# Generate Java POJO classes with Jackson annotations
npx quicktype schema/OwnedItems.json --src-lang schema -l java -o OwnedItems.java --package com.valoranchi.model
```

The generated POJO models will map directly to the JSON payloads:

<<< @/../examples/java/Main.java#types{java}

