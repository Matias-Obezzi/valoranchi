# Ruby

Ruby applications interact with the local Riot Client session by executing the `riotclient` CLI with `Open3` and parsing JSON with the standard library. The whole example lives in `examples/ruby/main.rb` and passes `ruby -c`.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. Ruby 3.0 or later; `open3` and `json` ship with it.

## Read

Run `whoami` and `owned-items` with `Open3.capture3` and parse the JSON into hashes:

<<< @/../examples/ruby/main.rb#read{ruby}

## Write with Validation

Every mutation defaults to a local **dry run** unless `--yes` is given. If validation fails, the process exits with code `6` and the details go to `stderr`:

<<< @/../examples/ruby/main.rb#write{ruby}

## Events

Stream real-time events line by line with `Open3.popen3`:

<<< @/../examples/ruby/main.rb#events{ruby}

## Types

Generate typed Ruby classes from the JSON Schemas with `quicktype`:

```bash
npx quicktype schema/OwnedItems.json --src-lang schema -l ruby -o owned_items.rb
```

A hand-written struct of the same shape, for a single model:

<<< @/../examples/ruby/main.rb#types{ruby}
