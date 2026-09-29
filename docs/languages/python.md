# Python

Python applications interact with the local Riot Client session by running the `riotclient` CLI with the standard `subprocess` module and parsing its JSON output. Strongly typed dataclasses can be generated from the JSON Schemas using `quicktype`.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. Standard Python 3.10+ includes `subprocess`, `json`, and `dataclasses` in the standard library without external dependencies.

## Read

Invoke `whoami` and `owned-items` via `subprocess.run()`, capture standard output, and parse the JSON string. The snippet below prints the active player identity and the first owned skin for every weapon:

<<< @/../examples/python/main.py#read{python}

## Write with Validation

Every write command performs local client-side validation as a dry run unless `--yes` is specified.

When validation fails (such as an unowned card or missing item), the process exits with code `6` and writes structured error JSON to `stderr`:

<<< @/../examples/python/main.py#write{python}

## Events

Stream real-time events line-by-line using `subprocess.Popen` with buffered line iteration:

<<< @/../examples/python/main.py#events{python}

## Types

Generate Python dataclasses from the JSON Schemas with `quicktype`:

```bash
# Generate Python dataclasses
npx quicktype schema/OwnedItems.json --src-lang schema -l python -o owned_items.py
```

Use the generated `owned_items_from_dict` helper in your code:

<<< @/../examples/python/main.py#types{python}
