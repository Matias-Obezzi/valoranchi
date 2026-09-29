# frozen_string_literal: true

require 'open3'
require 'json'

# #region read
def read_example
  stdout, stderr, status = Open3.capture3('riotclient', 'whoami')
  if status.success?
    player = JSON.parse(stdout)
    puts "Player: #{player['gameName']}##{player['tagLine']} (#{player['region']})"
  else
    warn "Failed to read player: #{stderr}"
  end

  stdout, _stderr, status = Open3.capture3('riotclient', 'owned-items', '--language', 'en-US')
  return unless status.success?

  collection = JSON.parse(stdout)
  puts "Collection generated at: #{collection['generatedAt']}"
  collection['weapons'].each do |weapon|
    first_skin = weapon['skins'].first
    puts "- #{weapon['name']}: #{first_skin['name']}" if first_skin
  end
end
# #endregion read

# #region write
def equip_card(card_uuid, execute: false)
  cmd = ['riotclient', 'equip', '--card', card_uuid]
  cmd << '--yes' if execute

  stdout, stderr, status = Open3.capture3(*cmd)

  if status.success?
    label = execute ? 'Equipped card:' : 'Dry run passed:'
    puts "#{label} #{stdout.strip}"
  elsif status.exitstatus == 6
    error = JSON.parse(stderr)['error']
    warn "Validation failed: #{error['reason']} - #{error['message']}"
  else
    warn "Command failed with exit code #{status.exitstatus}: #{stderr}"
  end
end
# #endregion write

# #region events
def stream_events
  Open3.popen3('riotclient', 'watch', '--only', 'friend:presence,message') do |_stdin, stdout, _stderr, _wait|
    puts 'Listening for real-time events. Press Ctrl+C to terminate.'
    stdout.each_line do |line|
      line = line.strip
      next if line.empty?

      event = JSON.parse(line)
      data = event['data']
      case event['event']
      when 'friend:presence'
        friend = data['friend']
        puts "Friend #{friend['gameName']} is now #{data['change']} (#{friend.dig('presence', 'state')})"
      when 'message'
        puts "[#{data.dig('from', 'gameName')}]: #{data['body']}"
      end
    end
  end
rescue Interrupt
  puts "\nStreaming terminated."
end
# #endregion events

# #region types
# Generated with: npx quicktype schema/OwnedItems.json --src-lang schema -l ruby -o owned_items.rb
OwnedSkin = Struct.new(:uuid, :name, keyword_init: true) do
  def self.from_hash(hash)
    new(uuid: hash['uuid'], name: hash['name'])
  end
end
# #endregion types

read_example
equip_card('0819fbcd-4bd4-c379-5384-52803440f2b2', execute: false)
stream_events if ARGV.include?('--watch')
