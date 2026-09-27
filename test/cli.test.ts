import { describe, expect, it } from "vitest";
import { exitCodeForError, formatError, runCli, USAGE } from "../src/cli.js";
import {
  ForbiddenHostError,
  RegionUnknownError,
  RiotApiError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
} from "../src/errors.js";

describe("CLI error mapping", () => {
  it("maps RiotClientNotRunningError to exit code 2", () => {
    expect(exitCodeForError(new RiotClientNotRunningError())).toBe(2);
  });

  it("maps RiotClientNotReadyError to exit code 3", () => {
    expect(exitCodeForError(new RiotClientNotReadyError())).toBe(3);
  });

  it("maps RegionUnknownError to exit code 4", () => {
    expect(exitCodeForError(new RegionUnknownError())).toBe(4);
  });

  it("maps RiotApiError to exit code 5", () => {
    expect(exitCodeForError(new RiotApiError(500, "https://pd.na.a.pvp.net"))).toBe(5);
  });

  it("maps ForbiddenHostError and generic errors to exit code 1", () => {
    expect(exitCodeForError(new ForbiddenHostError("evil.com"))).toBe(1);
    expect(exitCodeForError(new Error("Something went wrong"))).toBe(1);
    expect(exitCodeForError("String error")).toBe(1);
  });

  it("formats errors matching { error: { code, message } }", () => {
    const formatted = formatError(new RiotClientNotRunningError("Client offline"));
    expect(formatted).toEqual({
      error: {
        code: "RIOT_CLIENT_NOT_RUNNING",
        message: "Client offline",
      },
    });

    const unknownFormatted = formatError(new Error("Generic failure"));
    expect(unknownFormatted).toEqual({
      error: {
        code: "UNKNOWN_ERROR",
        message: "Generic failure",
      },
    });
  });
});

describe("CLI entrypoint and flags", () => {
  it("prints version and exits 0 on --version", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await runCli(["--version"]);
      expect(code).toBe(0);
      expect(output.trim()).toBe("0.1.0");
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("prints USAGE and exits 0 on --help", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await runCli(["--help"]);
      expect(code).toBe(0);
      expect(output).toBe(USAGE);
    } finally {
      process.stdout.write = originalWrite;
    }
  });
});
