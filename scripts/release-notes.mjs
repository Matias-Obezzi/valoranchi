import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(args) {
  const options = {
    dryRun: false,
    bump: "patch",
    version: null,
    notes: "",
    output: null,
    changelogPath: path.resolve("CHANGELOG.md"),
    packageJsonPath: path.resolve("package.json"),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--bump" && i + 1 < args.length) {
      options.bump = args[++i];
    } else if (arg === "--version" && i + 1 < args.length) {
      options.version = args[++i];
    } else if (arg === "--notes" && i + 1 < args.length) {
      options.notes = args[++i];
    } else if (arg === "--output" && i + 1 < args.length) {
      options.output = args[++i];
    } else if (arg === "--changelog" && i + 1 < args.length) {
      options.changelogPath = path.resolve(args[++i]);
    }
  }

  return options;
}

function bumpVersion(currentVersion, bumpType) {
  const parts = currentVersion.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid semver version in package.json: ${currentVersion}`);
  }
  let [major, minor, patch] = parts;
  if (bumpType === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpType === "minor") {
    minor += 1;
    patch = 0;
  } else if (bumpType === "patch") {
    patch += 1;
  } else {
    throw new Error(`Invalid bump type "${bumpType}". Must be major, minor, or patch.`);
  }
  return `${major}.${minor}.${patch}`;
}

function extractUnreleased(content) {
  const unreleasedRegex = /##[ \t]*\[Unreleased\][ \t]*\r?\n([\s\S]*?)(?=(?:\r?\n)##[ \t]*\[|$)/i;
  const match = content.match(unreleasedRegex);
  if (!match) {
    throw new Error("Could not find ## [Unreleased] section in changelog.");
  }
  return {
    rawMatch: match[0],
    body: match[1].trim(),
    startIndex: match.index,
    endIndex: match.index + match[0].length,
  };
}

function hasBulletPoints(text) {
  return /^\s*[-*]\s+\S/m.test(text);
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.changelogPath)) {
    console.error(`Error: Changelog file not found at ${options.changelogPath}`);
    process.exit(1);
  }

  const changelogContent = fs.readFileSync(options.changelogPath, "utf-8").replace(/\r\n/g, "\n");
  const unreleased = extractUnreleased(changelogContent);

  if (!hasBulletPoints(unreleased.body)) {
    console.error("Error: nothing to release (no bullets found in ## [Unreleased])");
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(unreleased.body);
    return;
  }

  let targetVersion = options.version;
  if (!targetVersion) {
    const pkg = JSON.parse(fs.readFileSync(options.packageJsonPath, "utf-8"));
    targetVersion = bumpVersion(pkg.version, options.bump);
  }

  const today = new Date().toISOString().slice(0, 10);
  let releaseBody = unreleased.body;
  if (options.notes && options.notes.trim().length > 0) {
    releaseBody = `${releaseBody}\n\n${options.notes.trim()}`;
  }

  const newReleaseSection = `## [${targetVersion}] - ${today}\n\n${releaseBody}\n`;
  const updatedUnreleasedSection = `## [Unreleased]\n\n${newReleaseSection}`;

  const updatedChangelog =
    changelogContent.slice(0, unreleased.startIndex) +
    updatedUnreleasedSection +
    changelogContent.slice(unreleased.endIndex);

  fs.writeFileSync(options.changelogPath, updatedChangelog, "utf-8");

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), `${newReleaseSection}`, "utf-8");
  }

  console.log(newReleaseSection.trim());
}

main();
