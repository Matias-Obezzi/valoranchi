# Ruby

Ruby applications interact with the local Riot Client session by executing the `riotclient` CLI using `Open3` and parsing standard JSON with the built-in `json` library.

## Setup

1. Install the CLI globally:

```bash
npm install -g @valoranchi/riot-client
```

2. Standard Ruby 3.0+ includes `open3` and `json` in the standard library without external gem dependencies.

## Read

Execute `whoami` and `owned-items` using `Open3.capture3`, and parse the JSON into Ruby hashes:

```ruby
require 'open3'
require 'json'

# 1. Read player profile
stdout, stderr, status = Open3.capture3('riotclient', 'whoami')
if status.success?
  player = JSON.parse(stdout)
  puts "Player: #{player['gameName']}##{player['tagLine']} (#{player['region']})"
else
  warn "Failed to read player: #{stderr}"
end

# 2. Read owned collection
stdout, stderr, status = Open3.capture3('riotclient', 'owned-items', '--language', 'en-US')
if status.success?
  collection = JSON.parse(stdout)
  puts "Collection generated at: #{collection['generatedAt']}"
  collection['weapons'].each do |weapon|
    first_skin = weapon['skins'].first
    puts "- #{weapon['name']}: #{first_skin['name']}" if first_skin
  end
end
```

## Write with Validation

Every mutation defaults to a local **dry run** unless `--yes` is specified. If validation fails (e.g. attempting to equip an unowned card), the process exits with code `6` and details are output to `stderr`:

```ruby
require 'open3'
require 'json'

def equip_card(card_uuid, execute: false)
  cmd = ['riotclient', 'equip', '--card', card_uuid]
  cmd << '--yes' if execute

  stdout, stderr, status = Open3.capture3(*cmd)

  if status.success?
    label = execute ? "Equipped card successfully:" : "Dry run validated:"
    puts "#{label} #{stdout.strip}"
  elsif status.exitstatus == 6
    # Validation error
    error_payload = JSON.parse(stderr)['error']
    reason = error_payload['reason']
    message = error_payload['message']
    warn "Validation failed [code 6]: #{reason} - #{message}"
  else
    warn "Command failed with exit code #{status.exitstatus}: #{stderr}"
  end
end

card = '0819fbcd-4bd4-c379-5384-52803440f2b2'
equip_card(card, execute: false) # Dry run
equip_card(card, execute: true)  # Apply mutation
```

## Events

Stream real-time events line-by-line using `Open3.popen3`:

```ruby
require 'open3'
require 'json'

Open3.popen3('riotclient', 'watch', '--only', 'friend:presence,message') do |_stdin, stdout, _stderr, _wait_thr|
  puts "Listening for real-time events. Press Ctrl+C to terminate."
  stdout.each_line do |line|
    line = line.strip
    next if line.empty?

    event = JSON.parse(line)
    type = event['event']
    data = event['data']

    case type
    when 'friend:presence'
      friend = data['friend']
      name = friend['gameName']
      change = data['change']
      state = friend.dig('presence', 'state')
      puts "Friend #{name} is now #{change} (#{state})"
    when 'message'
      from = data.dig('from', 'gameName')
      body = data['body']
      puts "[#{from}]: #{body}"
    end
  end
rescue Interrupt
  puts "\nStreaming terminated."
end
```

## Types

Generate typed Ruby classes from the JSON Schemas with `quicktype`:

```bash
# Generate Ruby types for OwnedItems
npx quicktype schema/OwnedItems.json --src-lang schema -l ruby -o owned_items.rb
```
