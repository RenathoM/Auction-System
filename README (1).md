# Auction Bot

A Discord bot for live auctions with support for bidding using diamonds (💎) and/or items.

## Features

- Live auctions per channel to avoid conflicts
- Flexible auction models: diamonds only, items only, or both
- Text-based bid parsing (e.g., "bid 10,000" or "10K")
- Slash commands and interactive UI for bidding
- Administrative controls for hosts
- Time-based auction ending with "sold" announcement
- No minimum/maximum bid restrictions

## Setup

1. Clone or download this repository.
2. Install dependencies: `npm install`
3. Create a Discord bot at https://discord.com/developers/applications
4. Copy the bot token and paste it in `config.json` under "token"
5. Invite the bot to your server with appropriate permissions (Send Messages, Use Slash Commands, etc.)
6. Run the bot: `npm start`

<<<<<<< HEAD
=======
## Troubleshooting

- **ReadableStream error**: If you encounter `ReferenceError: ReadableStream is not defined`, the polyfill is included. Re-deploy after `npm install` if needed.
- **Token invalid**: Ensure your bot token is correct in `config.json`.

>>>>>>> ddbe013 (Fix ReadableStream error by adding web-streams-polyfill)
## Configuration

Edit `config.json`:

- `token`: Your Discord bot token
- `prefix`: Command prefix (not used much, as slash commands are primary)
- `auctionTime`: Auction duration in seconds

## Usage

### Starting an Auction

Use `/startauction` with:
- `item`: Description of the item
- `model`: Choose "diamonds", "items", or "both"

### Bidding

- Use `/bid` to open a modal for bidding
- Or type messages like "I'll bid 10000" or "I'll bid 10K and a sword"
- Click the "Bid" button in the auction message

### Administrative Commands

- `/endauction`: End the auction early (host only)
- `/auctionstatus`: View current auction details

## Auction Flow

1. Host starts auction
2. Users place bids via commands or text
3. Timer counts down
4. Auction ends automatically or by host
5. Winner announced with their bid details

## Notes

- Auctions are channel-specific
- Bids are compared by diamond amount (highest wins, first in case of tie)
- Items are additional descriptive text
