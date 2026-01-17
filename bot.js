const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandOptionType } = require('discord.js');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let redirectChannelId = '1461491732507267205'; // Auction System Setup - Embed
let redirectTradeChannelId = '1461778939222687948'; // Trade System Setup - Embed
let redirectInventoryChannelId = null;

// Image upload channels
const TRADE_IMAGES_CHANNEL = '1461849745566990487';
const AUCTION_IMAGES_CHANNEL = '1461849894615646309';

const auctions = new Map(); // channelId -> { host, title, description, model, time, startingPrice, bids: [{user, diamonds, items}], timer, started, channelId, messageId, updateInterval, notificationMessageId }
const trades = new Map(); // messageId -> { host, hostDiamonds, hostItems, offers: [{user, diamonds, items, timestamp}], channelId, messageId, accepted: false, acceptedUser: null, notificationMessages: [] }
const inventories = new Map(); // userId -> { messageId, channelId, items, diamonds, lookingFor, robloxUsername, lastEdited }
const userTradeCount = new Map(); // userId -> count of active trades

// Maximum diamonds allowed (1 billion)
const MAX_DIAMONDS = 1000000000;

// Item categories for trades
const itemCategories = {
  huges: {
    'Black Hole Huges': ['HugeBlackHoleAngelus', 'HugeRainbowBlackHoleAngelus'],
    'Snow Globe Huges': ['HugeSnowGlobeHamster', 'HugeRainbowSnowGlobeHamster', 'HugeSnowGlobeCat', 'HugeRainbowSnowGlobeCat'],
    'Ice Cube Huges': ['HugeIceCubeGingerbreadCorgi', 'HugeRainbowIceCubeGingerbreadCorgi', 'HugeIceCubeCookieCutCat', 'HugeRainbowIceCubeCookieCutCat'],
    'Jelly Huges': ['HugeJellyDragon', 'HugeRainbowJellyDragon', 'HugeJellyKitsune', 'HugeRainbowJellyKitsune'],
    'Blazing Huges': ['HugeBlazingShark', 'HugeRainbowBlazingShark', 'HugeBlazingBat', 'HugeRainbowBlazingBat'],
    'Event Huges': ['HugePartyCat', 'HugeGoldenPartyCat', 'HugeRainbowPartyCat', 'HugePartyDragon', 'HugeGoldenPartyDragon', 'HugeRainbowPartyDragon', 'HugeHellRock', 'HugeGoldenHellRock', 'HugeRainbowHellRock'],
    'Christmas.1 Huges': ['HugePresentChestMimic', 'HugeRainbowPresentChestMimic', 'HugeGingerbreadAngelus', 'HugeGoldenGingerbreadAngelus', 'HugeRainbowGingerbreadAngelus', 'HugeNorthPoleWolf', 'HugeGoldenNorthPoleWolf', 'HugeRainbowNorthPoleWolf'],
    'Christmas.2 Huges': ['HugeIcyPhoenix', 'HugeGoldenIcyPhoenix', 'HugeRainbowIcyPhoenix'],
    'Map Huges': ['HugeChestMimic', 'HugeGoldenChestMimic', 'HugeRainbowChestMimic', 'HugeSorcererCat', 'HugeGoldenSorcererCat', 'HugeRainbowSorcererCat', 'HugePropellerCat', 'HugeGoldenPropellerCat', 'HugeRainbowPropellerCat', 'HugeDominusAzureus', 'HugeGoldenDominusAzureus', 'HugeRainbowDominusAzureus', 'HugeNinjaCat', 'HugeGoldenNinjaCat', 'HugeRainbowNinjaCat', 'HugePropellerDog', 'HugeGoldenPropellerDog', 'HugeRainbowPropellerDog', 'HugeFantasyChest', 'HugeRainbowFantasyChest']
  },
  exclusives: ['BlazingShark', 'BlazingGoldenShark', 'BlazingRainbowShark', 'BlazingBat', 'BlazingGoldenBat', 'BlazingRainbowBat', 'BlazingCorgi', 'BlazingGoldenCorgi', 'BlazingRainbowCorgi', 'IceCubeGingerbreadCat', 'IceCubeGoldenGingerbreadCat', 'IceCubeRainbowGingerbreadCat', 'IceCubeGingerbreadCorgi', 'IceCubeGoldenGingerbreadCorgi', 'IceCubeRainbowGingerbreadCorgi', 'IceCubeCookieCuteCat', 'IceCubeGoldenCookieCuteCat', 'IceCubeRainbowCookieCuteCat', 'SnowGlobeCat', 'SnowGlobeGoldenCat', 'SnowGlobeRainbowCat', 'SnowGlobeAxolotl', 'SnowGlobeGoldenAxolotl', 'SnowGlobeRainbowAxolotl', 'SnowGlobeHamster', 'SnowGlobeGoldenHamster', 'SnowGlobeRainbowHamster', 'JellyCat', 'JellyGoldenCat', 'JellyRainbowCat', 'JellyBunny', 'JellyGoldenBunny', 'JellyRainbowBunny', 'JellyCorgi', 'JellyGoldenCorgi', 'JellyRainbowCorgi', 'BlackHoleAxolotl', 'BlackHoleGoldenAxolotl', 'BlackHoleRainbowAxolotl', 'BlackHoleImmortuus', 'BlackHoleGoldenImmortuus', 'BlackHoleRainbowImmortuus', 'BlackHoleKitsune', 'BlackHoleGoldenKitsune', 'BlackHoleRainbowKitsune'],
  eggs: ['HypeEgg', 'BlazingEgg', 'IceCubeEgg', 'SnowGlobeEgg', 'JellyEgg', 'BlackHoleEgg'],
  gifts: ['LikeGoalLootbox', '2026LootBox', 'SpintheWheellootbox']
};

// Image URLs for Huge pets and all items
const hugeImages = {
  // Black Hole Huges
  'HugeBlackHoleAngelus': '<:HugeBlackHoleAngelus:1461868865758695646>',
  //'HugeRainbowBlackHoleAngelus': '<:HugeRainbowBlackHoleAngelus:00000000000000000>',
  
  // Snow Globe Huges
  //'HugeSnowGlobeHamster': '<:HugeSnowGlobeHamster:00000000000000000>',
  //'HugeRainbowSnowGlobeHamster': '<:HugeRainbowSnowGlobeHamster:00000000000000000>',
  //'HugeSnowGlobeCat': '<:HugeSnowGlobeCat:00000000000000000>',
  //'HugeRainbowSnowGlobeCat': '<:HugeRainbowSnowGlobeCat:00000000000000000>',
  
  // Ice Cube Huges
  //'HugeIceCubeGingerbreadCorgi': '<:HugeIceCubeGingerbreadCorgi:00000000000000000>',
  //'HugeRainbowIceCubeGingerbreadCorgi': '<:HugeRainbowIceCubeGingerbreadCorgi:00000000000000000>',
  //'HugeIceCubeCookieCutCat': '<:HugeIceCubeCookieCutCat:00000000000000000>',
  //'HugeRainbowIceCubeCookieCutCat': '<:HugeRainbowIceCubeCookieCutCat:00000000000000000>',
  
  // Jelly Huges
  //'HugeJellyDragon': '<:HugeJellyDragon:00000000000000000>',
  //'HugeRainbowJellyDragon': '<:HugeRainbowJellyDragon:00000000000000000>',
  //'HugeJellyKitsune': '<:HugeJellyKitsune:00000000000000000>',
  //'HugeRainbowJellyKitsune': '<:HugeRainbowJellyKitsune:00000000000000000>',
  
  // Blazing Huges
  //'HugeBlazingShark': '<:HugeBlazingShark:00000000000000000>',
  //'HugeRainbowBlazingShark': '<:HugeRainbowBlazingShark:00000000000000000>',
  //'HugeBlazingBat': '<:HugeBlazingBat:00000000000000000>',
  //'HugeRainbowBlazingBat': '<:HugeRainbowBlazingBat:00000000000000000>',
  
  // Event Huges
  //'HugePartyCat': '<:HugePartyCat:00000000000000000>',
  //'HugeGoldenPartyCat': '<:HugeGoldenPartyCat:00000000000000000>',
  //'HugeRainbowPartyCat': '<:HugeRainbowPartyCat:00000000000000000>',
  //'HugePartyDragon': '<:HugePartyDragon:00000000000000000>',
  //'HugeGoldenPartyDragon': '<:HugeGoldenPartyDragon:00000000000000000>',
  //'HugeRainbowPartyDragon': '<:HugeRainbowPartyDragon:00000000000000000>',
  //'HugeHellRock': '<:HugeHellRock:00000000000000000>',
  //'HugeGoldenHellRock': '<:HugeGoldenHellRock:00000000000000000>',
  //'HugeRainbowHellRock': '<:HugeRainbowHellRock:00000000000000000>',
  
  // Christmas.1 Huges
  //'HugePresentChestMimic': '<:HugePresentChestMimic:00000000000000000>',
  //'HugeRainbowPresentChestMimic': '<:HugeRainbowPresentChestMimic:00000000000000000>',
  //'HugeGingerbreadAngelus': '<:HugeGingerbreadAngelus:00000000000000000>',
  //'HugeGoldenGingerbreadAngelus': '<:HugeGoldenGingerbreadAngelus:00000000000000000>',
  //'HugeRainbowGingerbreadAngelus': '<:HugeRainbowGingerbreadAngelus:00000000000000000>',
  //'HugeNorthPoleWolf': '<:HugeNorthPoleWolf:00000000000000000>',
  //'HugeGoldenNorthPoleWolf': '<:HugeGoldenNorthPoleWolf:00000000000000000>',
  //'HugeRainbowNorthPoleWolf': '<:HugeRainbowNorthPoleWolf:00000000000000000>',
  
  // Christmas.2 Huges
  //'HugeIcyPhoenix': '<:HugeIcyPhoenix:00000000000000000>',
  //'HugeGoldenIcyPhoenix': '<:HugeGoldenIcyPhoenix:00000000000000000>',
  //'HugeRainbowIcyPhoenix': '<:HugeRainbowIcyPhoenix:00000000000000000>',
  
  // Map Huges
  //'HugeChestMimic': '<:HugeChestMimic:00000000000000000>',
  //'HugeGoldenChestMimic': '<:HugeGoldenChestMimic:00000000000000000>',
  //'HugeRainbowChestMimic': '<:HugeRainbowChestMimic:00000000000000000>',
  //'HugeSorcererCat': '<:HugeSorcererCat:00000000000000000>',
  //'HugeGoldenSorcererCat': '<:HugeGoldenSorcererCat:00000000000000000>',
  //'HugeRainbowSorcererCat': '<:HugeRainbowSorcererCat:00000000000000000>',
  //'HugePropellerCat': '<:HugePropellerCat:00000000000000000>',
  //'HugeGoldenPropellerCat': '<:HugeGoldenPropellerCat:00000000000000000>',
  //'HugeRainbowPropellerCat': '<:HugeRainbowPropellerCat:00000000000000000>',
  //'HugeDominusAzureus': '<:HugeDominusAzureus:00000000000000000>',
  //'HugeGoldenDominusAzureus': '<:HugeGoldenDominusAzureus:00000000000000000>',
  //'HugeRainbowDominusAzureus': '<:HugeRainbowDominusAzureus:00000000000000000>',
  //'HugeNinjaCat': '<:HugeNinjaCat:00000000000000000>',
  //'HugeGoldenNinjaCat': '<:HugeGoldenNinjaCat:00000000000000000>',
  //'HugeRainbowNinjaCat': '<:HugeRainbowNinjaCat:00000000000000000>',
  //'HugePropellerDog': '<:HugePropellerDog:00000000000000000>',
  //'HugeGoldenPropellerDog': '<:HugeGoldenPropellerDog:00000000000000000>',
  //'HugeRainbowPropellerDog': '<:HugeRainbowPropellerDog:00000000000000000>',
  //'HugeFantasyChest': '<:HugeFantasyChest:00000000000000000>',
  //'HugeRainbowFantasyChest': '<:HugeRainbowFantasyChest:00000000000000000>',
  
  // Exclusives
  //'BlazingShark': '<:BlazingShark:00000000000000000>',
  //'BlazingGoldenShark': '<:BlazingGoldenShark:00000000000000000>',
  //'BlazingRainbowShark': '<:BlazingRainbowShark:00000000000000000>',
  //'BlazingBat': '<:BlazingBat:00000000000000000>',
  //'BlazingGoldenBat': '<:BlazingGoldenBat:00000000000000000>',
  //'BlazingRainbowBat': '<:BlazingRainbowBat:00000000000000000>',
  //'BlazingCorgi': '<:BlazingCorgi:00000000000000000>',
  //'BlazingGoldenCorgi': '<:BlazingGoldenCorgi:00000000000000000>',
  //'BlazingRainbowCorgi': '<:BlazingRainbowCorgi:00000000000000000>',
  //'IceCubeGingerbreadCat': '<:IceCubeGingerbreadCat:00000000000000000>',
  //'IceCubeGoldenGingerbreadCat': '<:IceCubeGoldenGingerbreadCat:00000000000000000>',
  //'IceCubeRainbowGingerbreadCat': '<:IceCubeRainbowGingerbreadCat:00000000000000000>',
  //'IceCubeGingerbreadCorgi': '<:IceCubeGingerbreadCorgi:00000000000000000>',
  //'IceCubeGoldenGingerbreadCorgi': '<:IceCubeGoldenGingerbreadCorgi:00000000000000000>',
  //'IceCubeRainbowGingerbreadCorgi': '<:IceCubeRainbowGingerbreadCorgi:00000000000000000>',
  //'IceCubeCookieCuteCat': '<:IceCubeCookieCuteCat:00000000000000000>',
  //'IceCubeGoldenCookieCuteCat': '<:IceCubeGoldenCookieCuteCat:00000000000000000>',
  //'IceCubeRainbowCookieCuteCat': '<:IceCubeRainbowCookieCuteCat:00000000000000000>',
  //'SnowGlobeCat': '<:SnowGlobeCat:00000000000000000>',
  //'SnowGlobeGoldenCat': '<:SnowGlobeGoldenCat:00000000000000000>',
  //'SnowGlobeRainbowCat': '<:SnowGlobeRainbowCat:00000000000000000>',
  //'SnowGlobeAxolotl': '<:SnowGlobeAxolotl:00000000000000000>',
  //'SnowGlobeGoldenAxolotl': '<:SnowGlobeGoldenAxolotl:00000000000000000>',
  //'SnowGlobeRainbowAxolotl': '<:SnowGlobeRainbowAxolotl:00000000000000000>',
  //'SnowGlobeHamster': '<:SnowGlobeHamster:00000000000000000>',
  //'SnowGlobeGoldenHamster': '<:SnowGlobeGoldenHamster:00000000000000000>',
  //'SnowGlobeRainbowHamster': '<:SnowGlobeRainbowHamster:00000000000000000>',
  //'JellyCat': '<:JellyCat:00000000000000000>',
  //'JellyGoldenCat': '<:JellyGoldenCat:00000000000000000>',
  //'JellyRainbowCat': '<:JellyRainbowCat:00000000000000000>',
  //'JellyBunny': '<:JellyBunny:00000000000000000>',
  //'JellyGoldenBunny': '<:JellyGoldenBunny:00000000000000000>',
  //'JellyRainbowBunny': '<:JellyRainbowBunny:00000000000000000>',
  //'JellyCorgi': '<:JellyCorgi:00000000000000000>',
  //'JellyGoldenCorgi': '<:JellyGoldenCorgi:00000000000000000>',
  //'JellyRainbowCorgi': '<:JellyRainbowCorgi:00000000000000000>',
  //'BlackHoleAxolotl': '<:BlackHoleAxolotl:00000000000000000>',
  //'BlackHoleGoldenAxolotl': '<:BlackHoleGoldenAxolotl:00000000000000000>',
  //'BlackHoleRainbowAxolotl': '<:BlackHoleRainbowAxolotl:00000000000000000>',
  //'BlackHoleImmortuus': '<:BlackHoleImmortuus:00000000000000000>',
  //'BlackHoleGoldenImmortuus': '<:BlackHoleGoldenImmortuus:00000000000000000>',
  //'BlackHoleRainbowImmortuus': '<:BlackHoleRainbowImmortuus:00000000000000000>',
  //'BlackHoleKitsune': '<:BlackHoleKitsune:00000000000000000>',
  //'BlackHoleGoldenKitsune': '<:BlackHoleGoldenKitsune:00000000000000000>',
  //'BlackHoleRainbowKitsune': '<:BlackHoleRainbowKitsune:00000000000000000>',
  
  // Eggs
  //'HypeEgg': '<:HypeEgg:00000000000000000>',
  //'BlazingEgg': '<:BlazingEgg:00000000000000000>',
  //'IceCubeEgg': '<:IceCubeEgg:00000000000000000>',
  //'SnowGlobeEgg': '<:SnowGlobeEgg:00000000000000000>',
  //'JellyEgg': '<:JellyEgg:00000000000000000>',
  //'BlackHoleEgg': '<:BlackHoleEgg:00000000000000000>',
  
  // Gifts
  //'LikeGoalLootbox': '<:LikeGoalLootbox:00000000000000000>',
  //'2026LootBox': '<:2026LootBox:00000000000000000>',
  //'SpintheWheellootbox': '<:SpintheWheellootbox:00000000000000000>'
};

client.once('ready', async () => {
  console.log('Auction Bot is ready!');

  // Register slash commands
  const commands = [
    {
      name: 'setup',
      description: 'Show auction setup information'
    },
    {
      name: 'bid',
      description: 'Place a bid'
    },
    {
      name: 'endauction',
      description: 'End the current auction (host only)'
    },
    {
      name: 'auctionstatus',
      description: 'View current auction status'
    },
    {
      name: 'deleteauction',
      description: 'Delete an auction (admin only)',
      options: [
        {
          name: 'messageid',
          type: ApplicationCommandOptionType.String,
          description: 'The message ID of the auction',
          required: true
        }
      ]
    },
    {
      name: 'endauctionadmin',
      description: 'End an auction timer (admin only)',
      options: [
        {
          name: 'messageid',
          type: ApplicationCommandOptionType.String,
          description: 'The message ID of the auction',
          required: true
        }
      ]
    },
    {
      name: 'redirectauctions',
      description: 'Redirect all future auctions to a specific channel (admin only)',
      options: [
        {
          name: 'channel',
          type: ApplicationCommandOptionType.Channel,
          description: 'The channel to redirect auctions to',
          required: true
        }
      ]
    },
    {
      name: 'endchanneladmin',
      description: 'End the auction in this channel (admin only)'
    },
    {
      name: 'deletechanneladmin',
      description: 'Delete the auction in this channel (admin only)'
    },
    {
      name: 'setuptrade',
      description: 'Show trade setup information'
    },
    {
      name: 'redirecttrade',
      description: 'Redirect all future trades to a specific channel (admin only)',
      options: [
        {
          name: 'channel',
          type: ApplicationCommandOptionType.Channel,
          description: 'The channel to redirect trades to',
          required: true
        }
      ]
    },
    {
      name: 'deletetrade',
      description: 'Delete a trade by message ID (admin only)',
      options: [
        {
          name: 'messageid',
          type: ApplicationCommandOptionType.String,
          description: 'The message ID of the trade',
          required: true
        }
      ]
    },
    {
      name: 'accepttrade',
      description: 'Accept a trade by message ID (admin only)',
      options: [
        {
          name: 'messageid',
          type: ApplicationCommandOptionType.String,
          description: 'The message ID of the trade',
          required: true
        }
      ]
    },
    {
      name: 'setupinventory',
      description: 'Create or view your inventory'
    },
    {
      name: 'redirectinventory',
      description: 'Set the channel for inventories (admin only)',
      options: [
        {
          name: 'channel',
          type: ApplicationCommandOptionType.Channel,
          description: 'The channel for inventories',
          required: true
        }
      ]
    },
  ];

  await client.application.commands.set(commands);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const auction = Array.from(auctions.values()).find(a => a.channelId === message.channel.id);
  if (!auction) return;

  // Parse bid messages
  const bidRegex = /bid (\d+(?:,\d{3})*|\d+K?)(?:\s+and (.+))?/i;
  const match = message.content.match(bidRegex);
  if (match) {
    // Check if bidder is the host
    if (message.author.id === auction.host.id) {
      return message.reply('You cannot bid on your own auction.');
    }

    const diamondsStr = match[1];
    const items = match[2] || '';
    const diamonds = parseBid(diamondsStr);

    if (auction.model === 'items' && diamonds > 0) return message.reply('This auction is offers only.');
    if (auction.model === 'diamonds' && items) return message.reply('This auction is diamonds only.');

    // Add bid
    auction.bids.push({ user: message.author, diamonds, items });
    message.reply(`Bid placed: ${diamonds} 💎${items ? ` and ${items}` : ''}`);
  }
});

function parseBid(str) {
  str = str.replace(/,/g, '').toLowerCase();
  const multipliers = { 'k': 1000, 'm': 1000000, 'b': 1000000000, 't': 1000000000000 };
  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (str.includes(suffix)) {
      const num = parseFloat(str.replace(suffix, ''));
      return Math.floor(num * multiplier);
    }
  }
  return parseInt(str);
}

function formatBid(num) {
  const suffixes = [
    { suffix: 'T', value: 1000000000000 },
    { suffix: 'B', value: 1000000000 },
    { suffix: 'M', value: 1000000 },
    { suffix: 'K', value: 1000 }
  ];

  for (const { suffix, value } of suffixes) {
    if (num >= value) {
      const formatted = (num / value).toFixed(1);
      // Remove trailing .0
      return formatted.endsWith('.0') ? formatted.slice(0, -2) + suffix : formatted + suffix;
    }
  }
  return num.toString();
}
function formatHugeName(name) {
  // Convert HugeBlackHoleAngelus to Huge Black Hole Angelus
  if (!name.startsWith('Huge')) return name;
  
  // Remove 'Huge' prefix and split by capital letters
  const withoutHuge = name.substring(4);
  const words = withoutHuge.split(/(?=[A-Z])/);
  return 'Huge ' + words.join(' ');
}

function consolidateItems(items) {
  // Merge duplicate items and sum quantities
  const consolidated = {};
  items.forEach(item => {
    if (consolidated[item.name]) {
      consolidated[item.name] += item.quantity;
    } else {
      consolidated[item.name] = item.quantity;
    }
  });
  
  // Return as array of objects
  return Object.entries(consolidated).map(([name, quantity]) => ({ name, quantity }));
}

function formatItemsList(items) {
  // Consolidate items and format for display
  const consolidated = consolidateItems(items);
  let itemsList = '';
  consolidated.forEach(item => {
    itemsList += `**${item.name}** x**${item.quantity}**\n`;
  });
  return itemsList;
}

function createItemsEmbed(items) {
  // Create embed with items and their emojis
  const consolidated = consolidateItems(items);
  
  let itemsDescription = '';
  consolidated.forEach(item => {
    const emoji = hugeImages[item.name] || '';
    const formattedName = formatHugeName(item.name);
    if (emoji) {
      itemsDescription += `${emoji} **${formattedName}** x**${item.quantity}**\n`;
    } else {
      itemsDescription += `**${item.name}** x**${item.quantity}**\n`;
    }
  });
  
  const embed = new EmbedBuilder()
    .setTitle('📦 Selected Items')
    .setDescription(itemsDescription || 'No items selected')
    .setColor(0x00ff00);
  
  return embed;
}

function formatItemDisplay(item) {
  if (typeof item === 'object' && item.name && item.quantity) {
    // Check if it's a diamonds item
    if (item.name.includes('💎') || item.name.includes('Diamonds')) {
      return `${item.name} x**${formatBid(item.quantity)}**`;
    }
    // Check if item has an emoji in hugeImages
    if (hugeImages[item.name]) {
      const formattedName = formatHugeName(item.name);
      return `${hugeImages[item.name]} ${formattedName} x**${item.quantity}**`;
    }
    return `${item.name} x**${item.quantity}**`;
  }
  // Check if string item has an emoji in hugeImages
  if (typeof item === 'string' && hugeImages[item]) {
    const formattedName = formatHugeName(item);
    return `${hugeImages[item]} ${formattedName}`;
  }
  return item;
}

function getItemCategory(itemName) {
  if (itemCategories.huges) {
    for (const subcategoryItems of Object.values(itemCategories.huges)) {
      if (subcategoryItems.includes(itemName)) return 'huges';
    }
  }
  if (itemCategories.exclusives && itemCategories.exclusives.includes(itemName)) return 'exclusives';
  if (itemCategories.eggs && itemCategories.eggs.includes(itemName)) return 'eggs';
  if (itemCategories.gifts && itemCategories.gifts.includes(itemName)) return 'gifts';
  return 'gifts';
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('Auction System Setup')
        .setDescription('Welcome to the live auction system!\n\n**How it works:**\n- Auctions are held per channel to avoid conflicts.\n- Bidding can be done via text (e.g., "bid 10000") or slash commands.\n- The auction ends automatically after the set time, or can be ended early.\n- Winner is the highest bidder (diamonds first, then first bid if tie).\n\nClick the button below to create a new auction.')
        .setColor(0x00ff00)
        .setFooter({ text: 'Version 1.1.2 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_auction')
            .setLabel('Create Auction')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'bid') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running in this channel.', ephemeral: true });

      // Show modal
      const modal = new ModalBuilder()
        .setCustomId('bid_modal')
        .setTitle('Place Your Bid');

      const diamondsInput = new TextInputBuilder()
        .setCustomId('diamonds')
        .setLabel('Diamonds (💎)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('10000')
        .setRequired(auction.model !== 'items');

      const itemsInput = new TextInputBuilder()
        .setCustomId('items')
        .setLabel('Additional Items (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Describe items')
        .setRequired(auction.model === 'items');

      const row1 = new ActionRowBuilder().addComponents(diamondsInput);
      const row2 = new ActionRowBuilder().addComponents(itemsInput);

      modal.addComponents(row1, row2);

      await interaction.showModal(modal);
    }

    if (commandName === 'endauction') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });
      if (auction.host.id !== interaction.user.id) return interaction.reply({ content: 'Only the host can end the auction.', ephemeral: true });

      clearTimeout(auction.timer);
      await endAuction(interaction.channel);
      interaction.reply('Auction ended by host.');
    }

    if (commandName === 'auctionstatus') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('Auction Status')
        .setDescription(`Title: ${auction.title}\nDescription: ${auction.description}\nModel: ${auction.model}\nStarting Price: ${formatBid(auction.startingPrice)} 💎\nTime Left: ${Math.max(0, auction.time - Math.floor((Date.now() - auction.started) / 1000))} seconds\nBids: ${auction.bids.length}`)
        .setColor(0x0000ff);

      interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
    const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));

    if (commandName === 'deleteauction') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const messageId = interaction.options.getString('messageid');
      const auction = Array.from(auctions.values()).find(a => a.messageId === messageId);
      if (!auction) return interaction.reply({ content: 'Auction not found.', ephemeral: true });

      clearTimeout(auction.timer);
      clearInterval(auction.updateInterval);
      
      try {
        const channel = interaction.guild.channels.cache.get(auction.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.delete();
      } catch (e) {
        // ignore if message not found
      }
      auctions.delete(auction.channelId);
      interaction.reply({ content: `Auction "${auction.title}" (from ${auction.host}) deleted by admin.`, ephemeral: true });
    }

    if (commandName === 'endauctionadmin') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const messageId = interaction.options.getString('messageid');
      const auction = Array.from(auctions.values()).find(a => a.messageId === messageId);
      if (!auction) return interaction.reply({ content: 'Auction not found.', ephemeral: true });

      clearTimeout(auction.timer);
      clearInterval(auction.updateInterval);
      const channel = interaction.guild.channels.cache.get(auction.channelId);
      await endAuction(channel);
      interaction.reply({ content: `Auction "${auction.title}" (from ${auction.host}) ended by admin.`, ephemeral: true });
    }

    if (commandName === 'endchanneladmin') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running in this channel.', ephemeral: true });

      clearTimeout(auction.timer);
      clearInterval(auction.updateInterval);
      await endAuction(interaction.channel);
      interaction.reply({ content: `Auction "${auction.title}" (from ${auction.host}) ended by admin.`, ephemeral: true });
    }

    if (commandName === 'deletechanneladmin') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running in this channel.', ephemeral: true });

      clearTimeout(auction.timer);
      clearInterval(auction.updateInterval);
      
      try {
        const message = await interaction.channel.messages.fetch(auction.messageId);
        await message.delete();
      } catch (e) {
        // ignore if message not found
      }
      auctions.delete(interaction.channel.id);
      interaction.reply({ content: `Auction "${auction.title}" (from ${auction.host}) deleted by admin.`, ephemeral: true });
    }

    if (commandName === 'restartauction') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const messageId = interaction.options.getString('messageid');
      const auction = Array.from(auctions.values()).find(a => a.messageId === messageId);
      if (!auction) return interaction.reply({ content: 'Auction not found.', ephemeral: true });

      clearTimeout(auction.timer);
      clearInterval(auction.updateInterval);
      auction.started = new Date();
      auction.timer = setTimeout(async () => {
        clearInterval(auction.updateInterval);
        await endAuction(interaction.guild.channels.cache.get(auction.channelId));
      }, auction.time * 1000);
      // Restart update interval
      auction.updateInterval = setInterval(async () => {
        const remaining = Math.max(0, Math.ceil((auction.started.getTime() + auction.time * 1000 - Date.now()) / 1000));
        if (remaining <= 0) {
          clearInterval(auction.updateInterval);
          return;
        }
        const currentBid = auction.bids.length > 0 ? Math.max(...auction.bids.map(b => b.diamonds)) : auction.startingPrice;
        const updatedEmbed = new EmbedBuilder()
          .setTitle(auction.title)
          .setDescription(`${auction.description}\n\n**Looking For:** ${auction.model}\n**Starting Price:** ${formatBid(auction.startingPrice)} 💎\n**Current Bid:** ${formatBid(currentBid)} 💎\n**Time Remaining:** ${remaining}s\n**Hosted by:** ${auction.host}`)
          .setColor(0x00ff00)
          .setFooter({ text: 'Version 1.1.2 | Made By Atlas' })
          .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');
        try {
          const channel = interaction.guild.channels.cache.get(auction.channelId);
          const message = await channel.messages.fetch(auction.messageId);
          await message.edit({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bid_button').setLabel('Bid').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('view_bids_button').setLabel('View Bids').setStyle(ButtonStyle.Secondary)
          )] });
        } catch (e) {
          // ignore
        }
      }, 1000);
      interaction.reply({ content: 'Auction restarted.', ephemeral: true });
    }

    if (commandName === 'redirectauctions') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const channel = interaction.options.getChannel('channel');
      if (channel.type !== 0) return interaction.reply({ content: 'Please select a text channel.', ephemeral: true });
      redirectChannelId = channel.id;
      interaction.reply({ content: `All future auctions will be redirected to ${channel}.`, ephemeral: true });
    }

    if (commandName === 'redirecttrade') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const channel = interaction.options.getChannel('channel');
      if (channel.type !== 0) return interaction.reply({ content: 'Please select a text channel.', ephemeral: true });
      redirectTradeChannelId = channel.id;
      interaction.reply({ content: `All future trades will be redirected to ${channel}.`, ephemeral: true });
    }

    if (commandName === 'redirectinventory') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const channel = interaction.options.getChannel('channel');
      if (channel.type !== 0) return interaction.reply({ content: 'Please select a text channel.', ephemeral: true });
      redirectInventoryChannelId = channel.id;
      interaction.reply({ content: `All inventories will be posted to ${channel}.`, ephemeral: true });
    }

    if (commandName === 'setuptrade') {
      // Check trade limit
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const isAdmin = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      const userTradeLimit = isAdmin ? 10 : 2;
      const currentTradeCount = userTradeCount.get(interaction.user.id) || 0;

      if (currentTradeCount >= userTradeLimit) {
        return interaction.reply({ 
          content: `You have reached your trade creation limit (${userTradeLimit}). ${isAdmin ? 'As an admin, you can have up to 10 active trades.' : 'Regular users can have up to 2 active trades.'}`,
          ephemeral: true 
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('Trade System Setup')
        .setDescription('Welcome to the live trade system!\n\n**How it works:**\n- Create a trade offer with items or diamonds.\n- Other users can place their offers in response.\n- Host can accept or decline offers.\n- Once accepted, both users are notified.\n\nClick the button below to create a new trade.')
        .setColor(0x0099ff)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_trade')
            .setLabel('Create Trade')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'deletetrade') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });

      const messageId = interaction.options.getString('messageid');
      const trade = trades.get(messageId);
      if (!trade) return interaction.reply({ content: 'Trade not found.', ephemeral: true });

      // Decrement trade count for host
      const hostId = trade.host.id;
      const currentCount = userTradeCount.get(hostId) || 0;
      if (currentCount > 0) {
        userTradeCount.set(hostId, currentCount - 1);
      }

      // Delete the trade message
      try {
        const channel = interaction.guild.channels.cache.get(trade.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.delete();
      } catch (e) {
        // ignore if message not found
      }

      trades.delete(messageId);
      interaction.reply({ content: `Trade from ${trade.host} has been deleted.`, ephemeral: true });
    }

    if (commandName === 'accepttrade') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });

      const messageId = interaction.options.getString('messageid');
      const trade = trades.get(messageId);
      if (!trade) return interaction.reply({ content: 'Trade not found.', ephemeral: true });

      if (trade.offers.length > 0) {
        return interaction.reply({ content: 'This trade has offers and cannot be cancelled this way.', ephemeral: true });
      }

      // Mark trade as cancelled
      trade.accepted = true;
      trade.acceptedUser = null;
      trade.adminCancelled = true;

      // Update embed
      await updateTradeEmbed(interaction.guild, trade, messageId);

      const channel = interaction.guild.channels.cache.get(trade.channelId);
      await channel.send(`❌ This trade has been cancelled by an admin.`);

      interaction.reply({ content: `Trade has been cancelled.`, ephemeral: true });
    }

    if (commandName === 'setupinventory') {
      const embed = new EmbedBuilder()
        .setTitle('📦 Inventory System Setup')
        .setDescription('Welcome to the inventory system!\n\n**How it works:**\n- Create your personal inventory with items you have in stock.\n- Set your diamond amount and describe what you\'re looking for.\n- Optionally add your Roblox username to display your avatar.\n- Other users can see your inventory and make offers!\n- Update anytime - your previous items stay saved if you don\'t remove them.\n\nClick the button below to create or edit your inventory.')
        .setColor(0x00a8ff)
        .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_inventory')
            .setLabel('Create Inventory')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'bid_button') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId('bid_modal')
        .setTitle('Place Your Bid');

      const diamondsInput = new TextInputBuilder()
        .setCustomId('diamonds')
        .setLabel('Diamonds (💎)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('10000')
        .setRequired(auction.model !== 'items');

      const itemsInput = new TextInputBuilder()
        .setCustomId('items')
        .setLabel('Additional Items (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Describe items')
        .setRequired(auction.model === 'items');

      const row1 = new ActionRowBuilder().addComponents(diamondsInput);
      const row2 = new ActionRowBuilder().addComponents(itemsInput);

      modal.addComponents(row1, row2);

      await interaction.showModal(modal);
    }

    if (interaction.customId === 'view_bids_button') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });

      if (auction.bids.length === 0) return interaction.reply({ content: 'No bids yet.', ephemeral: true });

      // Sort bids by diamonds descending
      const sortedBids = auction.bids.sort((a, b) => b.diamonds - a.diamonds);

      const bidList = sortedBids.map(bid => {
        const secondsAgo = Math.floor((Date.now() - bid.timestamp) / 1000);
        let timeAgo;
        if (secondsAgo < 60) timeAgo = `${secondsAgo} seconds ago`;
        else if (secondsAgo < 3600) timeAgo = `${Math.floor(secondsAgo / 60)} minutes ago`;
        else timeAgo = `${Math.floor(secondsAgo / 3600)} hours ago`;
        return `${bid.user.username}: ${bid.diamonds} 💎 - ${timeAgo}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('Bid List')
        .setDescription(bidList)
        .setColor(0x00ff00)
        .setFooter({ text: 'Version 1.1.0 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.customId === 'create_auction') {
      const modal = new ModalBuilder()
        .setCustomId('auction_modal')
        .setTitle('Create Auction');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Auction Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const priceInput = new TextInputBuilder()
        .setCustomId('starting_price')
        .setLabel('Starting Price (💎)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const modelInput = new TextInputBuilder()
        .setCustomId('model')
        .setLabel('Model (diamonds/items/both)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(priceInput),
        new ActionRowBuilder().addComponents(modelInput)
      );

      await interaction.showModal(modal);
    }

    if (interaction.customId === 'create_trade') {
      // Show category selection
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('trade_category_select')
        .setPlaceholder('Select an item category')
        .addOptions([
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      await interaction.reply({ content: 'Select an item category to add to your trade offer:', components: [row], ephemeral: true });
    }

    if (interaction.customId === 'create_inventory') {
      // Load previous inventory items if editing
      const previousInventory = inventories.get(interaction.user.id);
      if (previousInventory) {
        interaction.user.inventoryItems = previousInventory.items;
      }

      // Show category selection
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('inventory_category_select')
        .setPlaceholder('Select an item category')
        .addOptions([
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      await interaction.reply({ content: 'Select an item category to add to your inventory:', components: [row], ephemeral: true });
    }

    if (interaction.customId === 'trade_offer_button') {
      const trade = trades.get(interaction.message.id);
      if (!trade) return interaction.reply({ content: 'Trade not found.', flags: 64 });

      // Check if user is the host
      if (interaction.user.id === trade.host.id) {
        return interaction.reply({ content: 'You cannot make an offer on your own trade.', flags: 64 });
      }

      // Show category selection for offer
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_category_select_${interaction.message.id}`)
        .setPlaceholder('Select an item category')
        .addOptions([
          { label: 'Diamonds', value: 'diamonds', emoji: '💎' },
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      
      // Initialize offer items for this user
      interaction.user.offerTradeItems = [];
      interaction.user.offerMessageId = interaction.message.id;
      
      await interaction.reply({ content: 'Select an item category for your offer:', components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('trade_accept_')) {
      const messageId = interaction.customId.replace('trade_accept_', '');
      const trade = trades.get(messageId);
      if (!trade) return interaction.reply({ content: 'Trade not found.', ephemeral: true });
      if (trade.host.id !== interaction.user.id) return interaction.reply({ content: 'Only the host can accept offers.', ephemeral: true });

      // Accept the last offer
      const lastOffer = trade.offers[trade.offers.length - 1];
      trade.accepted = true;
      trade.acceptedUser = lastOffer.user;

      // Delete all notification messages
      const channel = interaction.guild.channels.cache.get(trade.channelId);
      if (channel && trade.notificationMessages && trade.notificationMessages.length > 0) {
        for (const msgId of trade.notificationMessages) {
          try {
            const msg = await channel.messages.fetch(msgId);
            await msg.delete();
          } catch (e) {
            // ignore if message not found
          }
        }
        trade.notificationMessages = [];
      }

      // Update embed and ping both users
      await updateTradeEmbed(interaction.guild, trade, messageId);
      if (channel) {
        await channel.send(`✅ Trade accepted! ${trade.host} and ${lastOffer.user}, your trade has been accepted.`);
      }

      await interaction.reply({ content: 'Trade accepted!', ephemeral: true });
    }

    if (interaction.customId.startsWith('trade_decline_')) {
      const messageId = interaction.customId.replace('trade_decline_', '');
      const trade = trades.get(messageId);
      if (!trade) return interaction.reply({ content: 'Trade not found.', ephemeral: true });
      if (trade.host.id !== interaction.user.id) return interaction.reply({ content: 'Only the host can decline offers.', ephemeral: true });

      // Decline the last offer
      const lastOffer = trade.offers[trade.offers.length - 1];
      trade.offers.pop();

      // Delete the last notification message
      const channel = interaction.guild.channels.cache.get(trade.channelId);
      if (channel && trade.notificationMessages && trade.notificationMessages.length > 0) {
        const lastMsgId = trade.notificationMessages.pop();
        try {
          const msg = await channel.messages.fetch(lastMsgId);
          await msg.delete();
        } catch (e) {
          // ignore if message not found
        }
      }

      // Update embed
      await updateTradeEmbed(interaction.guild, trade, messageId);
      if (channel) {
        await channel.send(`❌ Trade offer from ${lastOffer.user} has been declined.`);
      }

      await interaction.reply({ content: 'Offer declined!', ephemeral: true });
    }

    if (interaction.customId.startsWith('trade_delete_')) {
      // Find which trade this delete button belongs to
      let tradeMessageId = null;
      let trade = null;

      for (const [messageId, t] of trades) {
        if (t.messageId === interaction.message.id) {
          tradeMessageId = messageId;
          trade = t;
          break;
        }
      }

      if (!trade) return interaction.reply({ content: 'Trade not found.', ephemeral: true });
      if (trade.host.id !== interaction.user.id) return interaction.reply({ content: 'Only the host can delete this trade.', ephemeral: true });

      // Delete the trade message
      try {
        await interaction.message.delete();
      } catch (e) {
        // ignore if message not found
      }

      // Decrement trade count for host
      const hostId = trade.host.id;
      const currentCount = userTradeCount.get(hostId) || 0;
      if (currentCount > 0) {
        userTradeCount.set(hostId, currentCount - 1);
      }

      trades.delete(tradeMessageId);
      await interaction.reply({ content: 'Trade deleted!', ephemeral: true });
    }

    if (interaction.customId.startsWith('auction_delete_final_')) {
      // Find the auction by the message
      let auction = null;
      let auctionChannelId = null;

      for (const [channelId, a] of auctions) {
        if (a.finalMessageId === interaction.message.id) {
          auction = a;
          auctionChannelId = channelId;
          break;
        }
      }

      if (!auction) return interaction.reply({ content: 'Auction not found.', ephemeral: true });
      if (auction.host.id !== interaction.user.id) return interaction.reply({ content: 'Only the host can delete this auction.', ephemeral: true });

      // Delete the auction message
      try {
        await interaction.message.delete();
      } catch (e) {
        // ignore if message not found
      }

      auctions.delete(auctionChannelId);
      await interaction.reply({ content: 'Auction deleted!', ephemeral: true });
    }

    if (interaction.customId.startsWith('auction_upload_image_')) {
      // Find the auction by the message
      let auction = null;

      for (const [channelId, a] of auctions) {
        if (a.finalMessageId === interaction.message.id) {
          auction = a;
          break;
        }
      }

      if (!auction) return interaction.reply({ content: 'Auction not found.', ephemeral: true });
      
      // Check if user is the winner
      if (interaction.user.id !== auction.winnerId) {
        return interaction.reply({ content: `Only the winner (${auction.winnerUser}) can upload an image for this auction.`, ephemeral: true });
      }

      // Show file upload dialog
      const modal = new ModalBuilder()
        .setCustomId(`auction_image_upload_modal_${interaction.message.id}`)
        .setTitle('Upload Auction Image');

      const input = new TextInputBuilder()
        .setCustomId('image_url')
        .setLabel('Paste image URL or describe the image')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://... or paste image details')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      
      await interaction.showModal(modal);
    }

    if (interaction.customId.startsWith('trade_upload_image_')) {
      const trade = trades.get(interaction.message.id);
      if (!trade) return interaction.reply({ content: 'Trade not found.', ephemeral: true });

      // Check if user is the host or the accepted guest
      if (interaction.user.id !== trade.host.id && interaction.user.id !== trade.acceptedUser.id) {
        return interaction.reply({ content: `Only the host (${trade.host}) or guest (${trade.acceptedUser}) can upload an image for this trade.`, ephemeral: true });
      }

      // Show file upload dialog
      const modal = new ModalBuilder()
        .setCustomId(`trade_image_upload_modal_${interaction.message.id}`)
        .setTitle('Upload Trade Image');

      const input = new TextInputBuilder()
        .setCustomId('image_url')
        .setLabel('Paste image URL or describe the image')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://... or paste image details')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      
      await interaction.showModal(modal);
    }

    if (interaction.customId === 'inventory_update_button') {
      // Load previous inventory items
      const previousInventory = inventories.get(interaction.user.id);
      if (previousInventory) {
        interaction.user.inventoryItems = previousInventory.items;
      }

      // Show category selection for inventory update
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('inventory_category_select')
        .setPlaceholder('Select an item category')
        .addOptions([
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      await interaction.reply({ content: 'Select an item category to add to your inventory:', components: [row], ephemeral: true });
    }

    if (interaction.customId === 'inventory_remove_button') {
      // Load previous inventory items
      const previousInventory = inventories.get(interaction.user.id);
      if (!previousInventory || previousInventory.items.length === 0) {
        return interaction.reply({ content: 'Your inventory is empty. Nothing to remove.', ephemeral: true });
      }

      interaction.user.inventoryItems = previousInventory.items;

      // Show category selection for inventory removal
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('inventory_remove_category_select')
        .setPlaceholder('Select an item category to remove from')
        .addOptions([
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      await interaction.reply({ content: 'Select an item category to remove from your inventory:', components: [row], ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'inventory_remove_category_select') {
      const category = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const previousInventory = inventories.get(interaction.user.id);
      if (!previousInventory) return interaction.reply({ content: 'Inventory not found.', flags: 64 });

      // Filter items from this category
      const itemsInCategory = previousInventory.items.filter(item => {
        return getItemCategory(item.name) === category;
      });

      if (itemsInCategory.length === 0) {
        return interaction.reply({ content: `You have no items from the ${category} category to remove.`, ephemeral: true });
      }

      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`inventory_remove_item_select_${category}`)
        .setPlaceholder(`Select items to remove from ${category}`)
        .setMaxValues(Math.min(itemsInCategory.length, 25))
        .addOptions(itemsInCategory.map(item => ({ label: item.name, value: item.name })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${category}** to remove:`, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('inventory_remove_item_select_')) {
      const category = interaction.customId.replace('inventory_remove_item_select_', '');
      const selectedItems = interaction.values;

      const previousInventory = inventories.get(interaction.user.id);
      if (!previousInventory) return interaction.reply({ content: 'Inventory not found.', flags: 64 });

      // Store items selection for quantity input
      interaction.user.selectedRemoveItems = selectedItems;
      interaction.user.selectedRemoveCategory = category;

      // Show quantity selection modal
      const quantityModal = new ModalBuilder()
        .setCustomId(`inventory_remove_quantities_modal`)
        .setTitle('Select Quantities to Remove');

      let inputs = [];
      selectedItems.slice(0, 5).forEach((item, index) => {
        const currentItem = previousInventory.items.find(i => i.name === item);
        const currentQty = currentItem ? currentItem.quantity : 0;
        
        const input = new TextInputBuilder()
          .setCustomId(`remove_qty_${index}`)
          .setLabel(`${item} (have: ${currentQty})`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('0')
          .setRequired(true)
          .setMaxLength(3);
        inputs.push(new ActionRowBuilder().addComponents(input));
      });

      quantityModal.addComponents(inputs);
      await interaction.showModal(quantityModal);
    }

    if (interaction.customId === 'trade_category_select') {
      const category = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      let items = [];
      if (category === 'huges') {
        // Para huges, mostrar subcategorias
        const subcategorySelect = new StringSelectMenuBuilder()
          .setCustomId('trade_huge_subcategory_select')
          .setPlaceholder('Select a Huge subcategory')
          .addOptions(Object.keys(itemCategories.huges).map(sub => ({
            label: sub,
            value: sub
          })));
        const row = new ActionRowBuilder().addComponents(subcategorySelect);
        await interaction.reply({ content: `Select a subcategory from **Huges**:`, components: [row], flags: 64 });
        return;
      } else {
        items = itemCategories[category];
      }
      
      // Para outras categorias
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`trade_item_select_${category}`)
        .setPlaceholder(`Select items from ${category}`)
        .setMaxValues(Math.min(items.length, 25))
        .addOptions(items.slice(0, 25).map(item => ({ label: item, value: item })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${category}** category:`, components: [row], flags: 64 });
    }

    if (interaction.customId === 'trade_huge_subcategory_select') {
      const subcategory = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const items = itemCategories.huges[subcategory];
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`trade_item_select_huges_${subcategory}`)
        .setPlaceholder(`Select items from ${subcategory}`)
        .setMaxValues(Math.min(items.length, 25))
        .addOptions(items.map(item => ({
          label: item,
          value: item
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${subcategory}**:`, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('trade_item_select_')) {
      const parts = interaction.customId.replace('trade_item_select_', '').split('_');
      let category = parts[0];
      let subcategory = parts.length > 1 ? parts.slice(1).join('_') : null;
      
      const selectedItems = interaction.values;

      // Store items selection for quantity input
      interaction.user.selectedTradeItems = selectedItems;
      interaction.user.selectedTradeCategory = category;
      interaction.user.selectedTradeSubcategory = subcategory;

      // Show quantity selection modal
      const quantityModal = new ModalBuilder()
        .setCustomId(`trade_item_quantities_modal`)
        .setTitle('Select Quantities');

      let inputs = [];
      selectedItems.slice(0, 5).forEach((item, index) => {
        const input = new TextInputBuilder()
          .setCustomId(`qty_${index}`)
          .setLabel(`${item} quantity`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('1')
          .setRequired(true)
          .setMaxLength(3);
        inputs.push(new ActionRowBuilder().addComponents(input));
      });

      quantityModal.addComponents(inputs);
      await interaction.showModal(quantityModal);
    }

    if (interaction.customId.startsWith('offer_category_select_')) {
      const messageId = interaction.customId.replace('offer_category_select_', '');
      const category = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      if (category === 'diamonds') {
        // Handle diamonds selection
        const diamondsModal = new ModalBuilder()
          .setCustomId(`offer_diamonds_modal_${messageId}`)
          .setTitle('Add Diamonds to Your Offer');

        const diamondsInput = new TextInputBuilder()
          .setCustomId('offer_diamonds_amount')
          .setLabel('Amount of Diamonds')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('10000')
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(diamondsInput);
        diamondsModal.addComponents(row);
        
        await interaction.showModal(diamondsModal);
        return;
      }
      
      if (category === 'huges') {
        // Para huges, mostrar subcategorias
        const subcategorySelect = new StringSelectMenuBuilder()
          .setCustomId(`offer_huge_subcategory_select_${messageId}`)
          .setPlaceholder('Select a Huge subcategory')
          .addOptions(Object.keys(itemCategories.huges).map(sub => ({
            label: sub,
            value: sub
          })));
        const row = new ActionRowBuilder().addComponents(subcategorySelect);
        await interaction.reply({ content: `Select a subcategory from **Huges**:`, components: [row], flags: 64 });
        return;
      }
      
      const items = itemCategories[category];
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_item_select_${messageId}_${category}`)
        .setPlaceholder(`Select items from ${category}`)
        .setMaxValues(Math.min(items.length, 25))
        .addOptions(items.slice(0, 25).map(item => ({ label: item, value: item })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${category}** category:`, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('offer_huge_subcategory_select_')) {
      const messageId = interaction.customId.replace('offer_huge_subcategory_select_', '');
      const subcategory = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const items = itemCategories.huges[subcategory];
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_item_select_${messageId}_huges_${subcategory}`)
        .setPlaceholder(`Select items from ${subcategory}`)
        .setMaxValues(Math.min(items.length, 25))
        .addOptions(items.map(item => ({
          label: item,
          value: item
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${subcategory}**:`, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('offer_item_select_')) {
      const parts = interaction.customId.replace('offer_item_select_', '').split('_');
      const messageId = parts[0];
      let category = parts[1];
      let subcategory = parts.length > 2 ? parts.slice(2).join('_') : null;
      const selectedItems = interaction.values;

      // Store items selection for quantity input
      interaction.user.selectedOfferItems = selectedItems;
      interaction.user.selectedOfferCategory = category;
      interaction.user.selectedOfferSubcategory = subcategory;
      interaction.user.selectedOfferMessageId = messageId;

      // Show quantity selection modal
      const quantityModal = new ModalBuilder()
        .setCustomId(`offer_item_quantities_modal_${messageId}`)
        .setTitle('Select Quantities');

      let inputs = [];
      selectedItems.slice(0, 5).forEach((item, index) => {
        const input = new TextInputBuilder()
          .setCustomId(`offer_qty_${index}`)
          .setLabel(`${item} quantity`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('1')
          .setRequired(true)
          .setMaxLength(3);
        inputs.push(new ActionRowBuilder().addComponents(input));
      });

      quantityModal.addComponents(inputs);
      await interaction.showModal(quantityModal);
    }

    if (interaction.customId === 'trade_continue_select') {
      const choice = interaction.values[0];

      if (choice === 'add_category') {
        const { StringSelectMenuBuilder } = require('discord.js');
        
        const categorySelect = new StringSelectMenuBuilder()
          .setCustomId('trade_category_select')
          .setPlaceholder('Select another item category')
          .addOptions([
            { label: 'Huges', value: 'huges', emoji: '🔥' },
            { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
            { label: 'Eggs', value: 'eggs', emoji: '🥚' },
            { label: 'Gifts', value: 'gifts', emoji: '🎁' }
          ]);

        const row = new ActionRowBuilder().addComponents(categorySelect);
        await interaction.reply({ content: 'Select another item category:', components: [row], flags: 64 });
      } else if (choice === 'confirm_items') {
        // Move to diamonds and target user
        const diamondsModal = new ModalBuilder()
          .setCustomId('trade_setup_modal')
          .setTitle('Complete Your Trade Offer');

        const diamondsInput = new TextInputBuilder()
          .setCustomId('trade_diamonds')
          .setLabel('Diamonds (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('0')
          .setRequired(false);

        const userInput = new TextInputBuilder()
          .setCustomId('trade_target_user')
          .setLabel('Target User (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Leave empty for open trade')
          .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(diamondsInput);
        const row2 = new ActionRowBuilder().addComponents(userInput);

        diamondsModal.addComponents(row1, row2);
        await interaction.showModal(diamondsModal);
      }
    }

    if (interaction.customId.startsWith('offer_continue_select_')) {
      const messageId = interaction.customId.replace('offer_continue_select_', '');
      const choice = interaction.values[0];

      if (choice === 'add_category') {
        const { StringSelectMenuBuilder } = require('discord.js');
        
        const categorySelect = new StringSelectMenuBuilder()
          .setCustomId(`offer_category_select_${messageId}`)
          .setPlaceholder('Select another item category')
          .addOptions([
            { label: 'Diamonds', value: 'diamonds', emoji: '💎' },
            { label: 'Huges', value: 'huges', emoji: '🔥' },
            { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
            { label: 'Eggs', value: 'eggs', emoji: '🥚' },
            { label: 'Gifts', value: 'gifts', emoji: '🎁' }
          ]);

        const row = new ActionRowBuilder().addComponents(categorySelect);
        await interaction.reply({ content: 'Select another item category:', components: [row], flags: 64 });
      } else if (choice === 'confirm_items') {
        // Move to diamonds and submit
        const diamondsModal = new ModalBuilder()
          .setCustomId(`offer_submit_modal_${messageId}`)
          .setTitle('Complete Your Offer');

        const diamondsInput = new TextInputBuilder()
          .setCustomId('offer_diamonds')
          .setLabel('Diamonds (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('0')
          .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(diamondsInput);
        diamondsModal.addComponents(row1);
        
        // Store items in interaction metadata
        interaction.user.offerItems = interaction.user.offerTradeItems || [];
        interaction.user.messageId = messageId;
        delete interaction.user.offerTradeItems;
        delete interaction.user.selectedOfferItems;
        delete interaction.user.selectedOfferCategory;
        delete interaction.user.selectedOfferSubcategory;
        delete interaction.user.selectedOfferMessageId;

        await interaction.showModal(diamondsModal);
      }
    }

    if (interaction.customId === 'inventory_continue_select') {
      const choice = interaction.values[0];

      if (choice === 'add_category') {
        const { StringSelectMenuBuilder } = require('discord.js');
        
        const categorySelect = new StringSelectMenuBuilder()
          .setCustomId('inventory_category_select')
          .setPlaceholder('Select another item category')
          .addOptions([
            { label: 'Huges', value: 'huges', emoji: '🔥' },
            { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
            { label: 'Eggs', value: 'eggs', emoji: '🥚' },
            { label: 'Gifts', value: 'gifts', emoji: '🎁' }
          ]);

        const row = new ActionRowBuilder().addComponents(categorySelect);
        await interaction.reply({ content: 'Select another item category:', components: [row], flags: 64 });
      } else if (choice === 'continue_to_setup') {
        // Move to inventory setup modal
        const inventoryModal = new ModalBuilder()
          .setCustomId('inventory_setup_modal')
          .setTitle('Complete Your Inventory');

        const diamondsInput = new TextInputBuilder()
          .setCustomId('inv_diamonds')
          .setLabel('Diamonds in stock (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('0')
          .setRequired(false);

        const lookingForInput = new TextInputBuilder()
          .setCustomId('inv_looking_for')
          .setLabel('What are you looking for?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe what items/diamonds you\'re looking for')
          .setRequired(true);

        const robloxInput = new TextInputBuilder()
          .setCustomId('inv_roblox_username')
          .setLabel('Roblox username (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('YourRobloxUsername')
          .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(diamondsInput);
        const row2 = new ActionRowBuilder().addComponents(lookingForInput);
        const row3 = new ActionRowBuilder().addComponents(robloxInput);

        inventoryModal.addComponents(row1, row2, row3);
        
        delete interaction.user.selectedInventoryItems;
        delete interaction.user.selectedInventoryCategory;
        delete interaction.user.selectedInventorySubcategory;

        await interaction.showModal(inventoryModal);
      }
    }

    if (interaction.customId === 'inventory_category_select') {
      const category = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      if (category === 'diamonds') {
        const diamondsModal = new ModalBuilder()
          .setCustomId('inventory_diamonds_modal')
          .setTitle('Add Diamonds');

        const diamondsInput = new TextInputBuilder()
          .setCustomId('inv_diamonds_amount')
          .setLabel('Amount of Diamonds')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 5000, 10K, 1M')
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(diamondsInput);
        diamondsModal.addComponents(row1);

        await interaction.showModal(diamondsModal);
        return;
      } else if (category === 'huges') {
        const subcategorySelect = new StringSelectMenuBuilder()
          .setCustomId('inventory_huge_subcategory_select')
          .setPlaceholder('Select a Huge subcategory')
          .addOptions(Object.keys(itemCategories.huges).map(sub => ({
            label: sub,
            value: sub
          })));
        const row = new ActionRowBuilder().addComponents(subcategorySelect);
        await interaction.reply({ content: `Select a subcategory from **Huges**:`, components: [row], flags: 64 });
        return;
      }
      
      const items = itemCategories[category];
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`inventory_item_select_${category}`)
        .setPlaceholder(`Select items from ${category}`)
        .setMaxValues(Math.min(items.length, 25))
        .addOptions(items.slice(0, 25).map(item => ({ label: item, value: item })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${category}** category:`, components: [row], flags: 64 });
    }

    if (interaction.customId === 'inventory_huge_subcategory_select') {
      const subcategory = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const items = itemCategories.huges[subcategory];
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`inventory_item_select_huges_${subcategory}`)
        .setPlaceholder(`Select items from ${subcategory}`)
        .setMaxValues(Math.min(items.length, 25))
        .addOptions(items.map(item => ({
          label: item,
          value: item
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${subcategory}**:`, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('inventory_item_select_')) {
      const parts = interaction.customId.replace('inventory_item_select_', '').split('_');
      let category = parts[0];
      let subcategory = parts.length > 1 ? parts.slice(1).join('_') : null;
      
      const selectedItems = interaction.values;

      interaction.user.selectedInventoryItems = selectedItems;
      interaction.user.selectedInventoryCategory = category;
      interaction.user.selectedInventorySubcategory = subcategory;

      const quantityModal = new ModalBuilder()
        .setCustomId(`inventory_item_quantities_modal`)
        .setTitle('Select Quantities');

      let inputs = [];
      selectedItems.slice(0, 5).forEach((item, index) => {
        const input = new TextInputBuilder()
          .setCustomId(`inv_qty_${index}`)
          .setLabel(`${item} quantity`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('1')
          .setRequired(true)
          .setMaxLength(3);
        inputs.push(new ActionRowBuilder().addComponents(input));
      });

      quantityModal.addComponents(inputs);
      await interaction.showModal(quantityModal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('auction_image_upload_modal_')) {
      const messageId = interaction.customId.replace('auction_image_upload_modal_', '');
      const imageUrl = interaction.fields.getTextInputValue('image_url');

      // Find the auction
      let auction = null;
      for (const [channelId, a] of auctions) {
        if (a.finalMessageId === messageId) {
          auction = a;
          break;
        }
      }

      if (!auction) return interaction.reply({ content: 'Auction not found.', ephemeral: true });

      // Check if user is the winner
      if (interaction.user.id !== auction.winnerId) {
        return interaction.reply({ content: 'Only the winner can upload this image.', ephemeral: true });
      }

      // Send to auction images channel
      try {
        const imagesChannel = await interaction.guild.channels.fetch(AUCTION_IMAGES_CHANNEL);
        if (!imagesChannel) return interaction.reply({ content: 'Images channel not found.', ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle(`Auction Image - ${auction.title}`)
          .setDescription(`**Auction Winner:** ${auction.winnerUser}\n**Bid:** ${formatBid(auction.bids[0].diamonds)} 💎\n\n${imageUrl}`)
          .setColor(0xff0000)
          .setThumbnail(imageUrl)
          .setFooter({ text: `Uploaded by ${interaction.user.username}` });

        await imagesChannel.send({ embeds: [embed] });

        // Update the original auction message with the thumbnail
        try {
          const auctionChannel = await interaction.guild.channels.fetch(auction.channelId);
          if (auctionChannel) {
            const originalMessage = await auctionChannel.messages.fetch(auction.finalMessageId);
            if (originalMessage && originalMessage.embeds.length > 0) {
              const updatedEmbed = new EmbedBuilder(originalMessage.embeds[0])
                .setThumbnail(imageUrl);
              await originalMessage.edit({ embeds: [updatedEmbed] });
            }
          }
        } catch (e) {
          // Ignore if original message cannot be updated
        }

        await interaction.reply({ content: '✅ Image uploaded successfully!', ephemeral: true });
      } catch (e) {
        console.error('Error uploading auction image:', e);
        await interaction.reply({ content: 'Failed to upload image. Please try again.', ephemeral: true });
      }
    }

    if (interaction.customId.startsWith('trade_image_upload_modal_')) {
      const messageId = interaction.customId.replace('trade_image_upload_modal_', '');
      const imageUrl = interaction.fields.getTextInputValue('image_url');

      // Find the trade
      const trade = trades.get(messageId);
      if (!trade) return interaction.reply({ content: 'Trade not found.', ephemeral: true });

      // Check if user is the host or accepted guest
      if (interaction.user.id !== trade.host.id && interaction.user.id !== trade.acceptedUser.id) {
        return interaction.reply({ content: 'Only the host or guest can upload this image.', ephemeral: true });
      }

      // Send to trade images channel
      try {
        const imagesChannel = await interaction.guild.channels.fetch(TRADE_IMAGES_CHANNEL);
        if (!imagesChannel) return interaction.reply({ content: 'Images channel not found.', ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle('Trade Image')
          .setDescription(`**Host:** ${trade.host}\n**Guest:** ${trade.acceptedUser}\n\n${imageUrl}`)
          .setColor(0x00ff00)
          .setThumbnail(imageUrl)
          .setFooter({ text: `Uploaded by ${interaction.user.username}` });

        await imagesChannel.send({ embeds: [embed] });

        // Update the original trade message with the thumbnail
        try {
          const tradeChannel = await interaction.guild.channels.fetch(trade.channelId);
          if (tradeChannel) {
            const originalMessage = await tradeChannel.messages.fetch(messageId);
            if (originalMessage && originalMessage.embeds.length > 0) {
              const updatedEmbed = new EmbedBuilder(originalMessage.embeds[0])
                .setThumbnail(imageUrl);
              await originalMessage.edit({ embeds: [updatedEmbed] });
            }
          }
        } catch (e) {
          // Ignore if original message cannot be updated
        }

        await interaction.reply({ content: '✅ Image uploaded successfully!', ephemeral: true });
      } catch (e) {
        console.error('Error uploading trade image:', e);
        await interaction.reply({ content: 'Failed to upload image. Please try again.', ephemeral: true });
      }
    }

    if (interaction.customId === 'inventory_diamonds_modal') {
      const diamondsStr = interaction.fields.getTextInputValue('inv_diamonds_amount');
      const diamonds = parseBid(diamondsStr);

      if (diamonds > MAX_DIAMONDS) return interaction.reply({ content: `Maximum diamonds allowed is ${formatBid(MAX_DIAMONDS)} 💎.`, ephemeral: true });

      if (!interaction.user.inventoryItems) {
        interaction.user.inventoryItems = [];
      }

      interaction.user.inventoryItems.push({ name: `💎 Diamonds`, quantity: diamonds });

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`inventory_continue_select`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Continue to Next Step', value: 'continue_to_setup' },
          { label: '➕ Add Another Category', value: 'add_category' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsEmbed = createItemsEmbed(interaction.user.inventoryItems);

      await interaction.reply({ 
        content: `What would you like to do?`,
        embeds: [itemsEmbed],
        components: [row], 
        flags: 64 
      });
      return;
    }

    if (interaction.customId === 'trade_item_quantities_modal') {
      const selectedItems = interaction.user.selectedTradeItems || [];
      const category = interaction.user.selectedTradeCategory;
      const subcategory = interaction.user.selectedTradeSubcategory;

      // Process quantities
      const itemsWithQty = selectedItems.map((item, index) => {
        const qty = parseInt(interaction.fields.getTextInputValue(`qty_${index}`) || '1');
        return { name: item, quantity: Math.max(1, qty) };
      });

      // Store in user's session
      if (!interaction.user.tradeItems) {
        interaction.user.tradeItems = [];
      }
      interaction.user.tradeItems = interaction.user.tradeItems.concat(itemsWithQty);

      // Show option to add more categories or proceed
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId('trade_continue_select')
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Confirm and Proceed', value: 'confirm_items' },
          { label: '➕ Add Another Category', value: 'add_category' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsEmbed = createItemsEmbed(interaction.user.tradeItems);

      await interaction.reply({ 
        content: `What would you like to do?`,
        embeds: [itemsEmbed],
        components: [row], 
        flags: 64 
      });
      return;
    }

    if (interaction.customId.startsWith('offer_item_quantities_modal_')) {
      const messageId = interaction.customId.replace('offer_item_quantities_modal_', '');
      const selectedItems = interaction.user.selectedOfferItems || [];
      const category = interaction.user.selectedOfferCategory;
      const subcategory = interaction.user.selectedOfferSubcategory;

      // Process quantities
      const itemsWithQty = selectedItems.map((item, index) => {
        const qty = parseInt(interaction.fields.getTextInputValue(`offer_qty_${index}`) || '1');
        return { name: item, quantity: Math.max(1, qty) };
      });

      // Store in user's session
      if (!interaction.user.offerTradeItems) {
        interaction.user.offerTradeItems = [];
      }
      interaction.user.offerTradeItems = interaction.user.offerTradeItems.concat(itemsWithQty);

      // Show option to add more categories or proceed
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_continue_select_${messageId}`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Confirm and Proceed', value: 'confirm_items' },
          { label: '➕ Add Another Category', value: 'add_category' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsEmbed = createItemsEmbed(interaction.user.offerTradeItems);

      await interaction.reply({ 
        content: `What would you like to do?`,
        embeds: [itemsEmbed],
        components: [row], 
        flags: 64 
      });
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'inventory_item_quantities_modal') {
      const selectedItems = interaction.user.selectedInventoryItems || [];
      const category = interaction.user.selectedInventoryCategory;
      const subcategory = interaction.user.selectedInventorySubcategory;

      const itemsWithQty = selectedItems.map((item, index) => {
        const qty = parseInt(interaction.fields.getTextInputValue(`inv_qty_${index}`) || '1');
        return { name: item, quantity: Math.max(1, qty) };
      });

      if (!interaction.user.inventoryItems) {
        interaction.user.inventoryItems = [];
      }
      interaction.user.inventoryItems = interaction.user.inventoryItems.concat(itemsWithQty);

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`inventory_continue_select`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Continue to Next Step', value: 'continue_to_setup' },
          { label: '➕ Add Another Category', value: 'add_category' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsEmbed = createItemsEmbed(interaction.user.inventoryItems);

      await interaction.reply({ 
        content: `What would you like to do?`,
        embeds: [itemsEmbed],
        components: [row], 
        flags: 64 
      });
      return;
    }

    if (interaction.customId === 'inventory_remove_quantities_modal') {
      const selectedItems = interaction.user.selectedRemoveItems || [];
      const category = interaction.user.selectedRemoveCategory || '';
      
      const previousInventory = inventories.get(interaction.user.id);
      if (!previousInventory) return interaction.reply({ content: 'Inventory not found.', flags: 64 });

      let removalErrors = [];
      let successfulRemovals = [];

      // Process each selected item
      for (let i = 0; i < selectedItems.length; i++) {
        const itemName = selectedItems[i];
        const qtyStr = interaction.fields.getTextInputValue(`remove_qty_${i}`);
        const removeQty = parseInt(qtyStr) || 0;

        if (removeQty <= 0) continue;

        // Find the item in inventory
        const itemIndex = previousInventory.items.findIndex(item => item.name === itemName);
        if (itemIndex === -1) {
          removalErrors.push(`❌ **${itemName}**: You don't have this item.`);
          continue;
        }

        const currentQty = previousInventory.items[itemIndex].quantity;
        if (currentQty < removeQty) {
          removalErrors.push(`❌ **${itemName}**: You only have ${currentQty}, can't remove ${removeQty}.`);
          continue;
        }

        // Remove the item
        previousInventory.items[itemIndex].quantity -= removeQty;
        if (previousInventory.items[itemIndex].quantity === 0) {
          previousInventory.items.splice(itemIndex, 1);
        }
        successfulRemovals.push(`✅ **${itemName}**: Removed ${removeQty}`);
      }

      // Update inventory data
      inventories.set(interaction.user.id, previousInventory);

      // Create response message
      let responseMessage = '';
      if (successfulRemovals.length > 0) {
        responseMessage += `**Removals Successful:**\n${successfulRemovals.join('\n')}\n\n`;
      }
      if (removalErrors.length > 0) {
        responseMessage += `**Errors:**\n${removalErrors.join('\n')}`;
      }

      // Update the inventory embed
      try {
        const channel = interaction.guild.channels.cache.get(previousInventory.channelId);
        const message = await channel.messages.fetch(previousInventory.messageId);
        
        // Rebuild the embed
        const embed = new EmbedBuilder()
          .setTitle('📦 Inventory')
          .setColor(0x00a8ff)
          .setFooter({ text: 'Version 1.1.0 | Made By Atlas' })
          .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

        if (previousInventory.robloxUsername) {
          embed.setAuthor({ 
            name: interaction.user.username, 
            iconURL: `https://www.roblox.com/bust-thumbnails/v1/individual?userIds=${previousInventory.robloxUsername}&size=420x420&format=Png&isCircular=false` 
          });
        } else {
          embed.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
        }

        const itemsText = previousInventory.items.length > 0 ? previousInventory.items.map(item => 
          `${item.name} x${item.quantity}`
        ).join('\n') : 'None';

        embed.addFields({
          name: `Items${previousInventory.diamonds > 0 ? ` + ${formatBid(previousInventory.diamonds)} 💎` : ''}`,
          value: itemsText || 'None',
          inline: true
        });

        embed.addFields({
          name: 'Looking For',
          value: previousInventory.lookingFor || 'Not specified',
          inline: true
        });

        const now = new Date();
        const timeStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} at ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        embed.addFields({
          name: 'Last Edited',
          value: timeStr,
          inline: false
        });

        const updateButton = new ButtonBuilder()
          .setCustomId('inventory_update_button')
          .setLabel('Update Inventory')
          .setStyle(ButtonStyle.Primary);

        const removeButton = new ButtonBuilder()
          .setCustomId('inventory_remove_button')
          .setLabel('Remove Items')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(updateButton, removeButton);

        await message.edit({ embeds: [embed], components: [row] });
      } catch (e) {
        console.log('Failed to update inventory message:', e);
      }

      // Clean up
      delete interaction.user.selectedRemoveItems;
      delete interaction.user.selectedRemoveCategory;

      await interaction.reply({ content: responseMessage || 'Removal completed.', ephemeral: true });
      return;
    }

    if (interaction.customId === 'inventory_setup_modal') {
      const diamondsStr = interaction.fields.getTextInputValue('inv_diamonds') || '0';
      const lookingFor = interaction.fields.getTextInputValue('inv_looking_for') || 'Not specified';
      const robloxUsername = interaction.fields.getTextInputValue('inv_roblox_username') || '';

      let diamonds = 0;
      if (diamondsStr && diamondsStr !== '0') {
        diamonds = parseBid(diamondsStr);
      }

      const inventoryItems = interaction.user.inventoryItems || [];
      delete interaction.user.inventoryItems;
      delete interaction.user.selectedInventoryItems;
      delete interaction.user.selectedInventoryCategory;
      delete interaction.user.selectedInventorySubcategory;

      // Delete previous inventory if exists
      const previousInventory = inventories.get(interaction.user.id);
      if (previousInventory) {
        try {
          const channel = interaction.guild.channels.cache.get(previousInventory.channelId);
          const message = await channel.messages.fetch(previousInventory.messageId);
          await message.delete();
        } catch (e) {
          // ignore if message not found
        }
      }

      // Create inventory embed
      const embed = new EmbedBuilder()
        .setTitle('📦 Inventory')
        .setColor(0x00a8ff)
        .setFooter({ text: 'Version 1.1.0 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      if (robloxUsername) {
        embed.setAuthor({ 
          name: interaction.user.username, 
          iconURL: `https://www.roblox.com/bust-thumbnails/v1/individual?userIds=${robloxUsername}&size=420x420&format=Png&isCircular=false` 
        });
      } else {
        embed.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
      }

      const itemsText = inventoryItems.length > 0 ? inventoryItems.map(item => 
        `${item.name} x${item.quantity}`
      ).join('\n') : 'None';

      embed.addFields({
        name: `Items${diamonds > 0 ? ` + ${formatBid(diamonds)} 💎` : ''}`,
        value: itemsText || 'None',
        inline: true
      });

      embed.addFields({
        name: 'Looking For',
        value: lookingFor,
        inline: true
      });

      const now = new Date();
      const timeStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} at ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      embed.addFields({
        name: 'Last Edited',
        value: timeStr,
        inline: false
      });

      const updateButton = new ButtonBuilder()
        .setCustomId('inventory_update_button')
        .setLabel('Update Inventory')
        .setStyle(ButtonStyle.Primary);

      const removeButton = new ButtonBuilder()
        .setCustomId('inventory_remove_button')
        .setLabel('Remove Items')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(updateButton, removeButton);

      const targetChannel = redirectInventoryChannelId ? interaction.guild.channels.cache.get(redirectInventoryChannelId) : interaction.channel;
      const message = await targetChannel.send({ embeds: [embed], components: [row] });

      const inventoryData = {
        messageId: message.id,
        channelId: targetChannel.id,
        items: inventoryItems,
        diamonds: diamonds,
        lookingFor: lookingFor,
        robloxUsername: robloxUsername,
        lastEdited: now
      };

      inventories.set(interaction.user.id, inventoryData);

      await interaction.reply({ content: `Inventory created! Posted to the inventory channel.`, flags: 64 });
      return;
    }

    if (interaction.customId === 'trade_setup_modal') {
      const diamondsStr = interaction.fields.getTextInputValue('trade_diamonds') || '0';
      const targetUsername = interaction.fields.getTextInputValue('trade_target_user') || '';

      let diamonds = 0;
      if (diamondsStr && diamondsStr !== '0') {
        diamonds = parseBid(diamondsStr);
      }

      if (diamonds > MAX_DIAMONDS) return interaction.reply({ content: `Maximum diamonds allowed is ${formatBid(MAX_DIAMONDS)} 💎.`, flags: 64 });

      const hostItems = interaction.user.tradeItems || [];
      delete interaction.user.tradeItems;
      delete interaction.user.selectedTradeItems;
      delete interaction.user.selectedTradeCategory;
      delete interaction.user.selectedTradeSubcategory;

      // Create trade embed
      const embed = new EmbedBuilder()
        .setTitle('Trade Offer')
        .setDescription(`**Host:** ${interaction.user}\n**Status:** Waiting for offers`)
        .setColor(0x0099ff)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      // Format host items with quantities
      let hostItemsText = 'None';
      if (hostItems.length > 0) {
        hostItemsText = hostItems.map(item => formatItemDisplay(item)).join('\n');
      }
      
      embed.addFields({
        name: `Host Items${diamonds > 0 ? ` + ${formatBid(diamonds)} 💎` : ''}`,
        value: hostItemsText || 'None',
        inline: false
      });

      const offerButton = new ButtonBuilder()
        .setCustomId('trade_offer_button')
        .setLabel('Make Offer')
        .setStyle(ButtonStyle.Primary);

      const deleteButton = new ButtonBuilder()
        .setCustomId(`trade_delete_${Date.now()}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(offerButton, deleteButton);

      const targetChannel = redirectTradeChannelId ? interaction.guild.channels.cache.get(redirectTradeChannelId) : interaction.channel;
      const message = await targetChannel.send({ embeds: [embed], components: [row] });

      const trade = {
        host: interaction.user,
        hostDiamonds: diamonds,
        hostItems: hostItems,
        offers: [],
        channelId: targetChannel.id,
        messageId: message.id,
        accepted: false,
        acceptedUser: null,
        targetUsername: targetUsername,
        notificationMessages: []
      };

      trades.set(message.id, trade);

      // Increment trade count for user
      const currentCount = userTradeCount.get(interaction.user.id) || 0;
      userTradeCount.set(interaction.user.id, currentCount + 1);

      await interaction.reply({ content: `Trade offer created in ${targetChannel}! ${targetUsername ? `Awaiting response from ${targetUsername}.` : 'Open for all users.'}`, flags: 64 });
      return;
    }

    if (interaction.customId.startsWith('offer_diamonds_modal_')) {
      const messageId = interaction.customId.replace('offer_diamonds_modal_', '');
      const diamondsStr = interaction.fields.getTextInputValue('offer_diamonds_amount') || '0';

      let diamonds = parseBid(diamondsStr);

      if (diamonds > MAX_DIAMONDS) {
        return interaction.reply({ content: `You cannot offer more than ${formatBid(MAX_DIAMONDS)} diamonds.`, flags: 64 });
      }

      // Store diamonds in user session
      if (!interaction.user.offerTradeItems) {
        interaction.user.offerTradeItems = [];
      }
      
      // Store the diamonds amount
      interaction.user.offerDiamonds = (interaction.user.offerDiamonds || 0) + diamonds;

      // Show option to add more categories or proceed
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_continue_select_${messageId}`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Confirm and Proceed', value: 'confirm_items' },
          { label: '➕ Add More', value: 'add_category' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      let displayText = `**Your Offer So Far:**\n`;
      if (interaction.user.offerDiamonds > 0) {
        displayText += `💎 Diamonds: ${formatBid(interaction.user.offerDiamonds)}\n`;
      }
      if (interaction.user.offerTradeItems && interaction.user.offerTradeItems.length > 0) {
        interaction.user.offerTradeItems.forEach(item => {
          displayText += `${item.name} x${item.quantity}\n`;
        });
      }

      await interaction.reply({ 
        content: displayText + `\nWhat would you like to do?`,
        components: [row], 
        flags: 64 
      });
      return;
    }

    if (interaction.customId.startsWith('offer_submit_modal_')) {
      const messageId = interaction.customId.replace('offer_submit_modal_', '');
      const diamondsStr = interaction.fields.getTextInputValue('offer_diamonds') || '0';

      let diamonds = 0;
      if (diamondsStr && diamondsStr !== '0') {
        diamonds = parseBid(diamondsStr);
      }

      // Add diamonds stored from category selection
      if (interaction.user.offerDiamonds && interaction.user.offerDiamonds > 0) {
        diamonds += interaction.user.offerDiamonds;
        delete interaction.user.offerDiamonds;
      }

      if (diamonds > MAX_DIAMONDS) return interaction.reply({ content: `Maximum diamonds allowed is ${formatBid(MAX_DIAMONDS)} 💎.`, flags: 64 });

      const offerItems = interaction.user.offerItems || [];
      delete interaction.user.offerItems;
      delete interaction.user.messageId;
      delete interaction.user.offerTradeItems;

      const trade = trades.get(messageId);
      if (!trade) return interaction.reply({ content: 'Trade not found.', flags: 64 });

      // Add offer to trade
      trade.offers.push({
        user: interaction.user,
        diamonds: diamonds,
        items: offerItems,
        timestamp: Date.now()
      });

      // Update trade embed to show grid layout
      await updateTradeEmbed(interaction.guild, trade, messageId);

      // Notify host of new offer
      const channel = interaction.guild.channels.cache.get(trade.channelId);
      if (channel) {
        const notifMsg = await channel.send(`📢 ${trade.host}, you received an offer of ${interaction.user}!`);
        trade.notificationMessages.push(notifMsg.id);
      }

      await interaction.reply({ content: `Offer submitted! Host will accept or decline.`, flags: 64 });
      return;
    }

    if (interaction.customId === 'bid_modal') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });

      // Check if bidder is the host
      if (interaction.user.id === auction.host.id) {
        return interaction.reply({ content: 'You cannot bid on your own auction.', ephemeral: true });
      }

      const diamondsStr = interaction.fields.getTextInputValue('diamonds');
      const items = interaction.fields.getTextInputValue('items') || '';

      let diamonds = 0;
      if (diamondsStr) {
        diamonds = parseBid(diamondsStr);
      }

      if (diamonds > MAX_DIAMONDS) return interaction.reply({ content: `Maximum diamonds allowed is ${formatBid(MAX_DIAMONDS)} 💎.`, ephemeral: true });

      if (auction.model === 'items' && diamonds > 0) return interaction.reply({ content: 'This auction is offers only.', ephemeral: true });
      if (auction.model === 'diamonds' && items) return interaction.reply({ content: 'This auction is diamonds only.', ephemeral: true });
      if (auction.model === 'diamonds' && diamonds === 0) return interaction.reply({ content: 'Please enter diamonds.', ephemeral: true });
      if (auction.model === 'items' && !items) return interaction.reply({ content: 'Please enter an offer.', ephemeral: true });

      // Check if bid is higher than current max
      const maxBid = auction.bids.length > 0 ? Math.max(...auction.bids.map(b => b.diamonds)) : auction.startingPrice;
      if (auction.model !== 'items' && diamonds <= maxBid) return interaction.reply({ content: `Your bid must be higher than the current highest bid of ${maxBid} 💎.`, ephemeral: true });

      auction.bids.push({ user: interaction.user, diamonds, items, timestamp: Date.now() });
      interaction.reply(`Bid placed: ${diamonds > 0 ? `${diamonds} 💎` : ''}${items ? ` and ${items}` : ''}`);
    }

    if (interaction.customId === 'auction_modal') {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const startingPriceStr = interaction.fields.getTextInputValue('starting_price');
      const model = interaction.fields.getTextInputValue('model').toLowerCase();

      if (!['diamonds', 'items', 'both'].includes(model)) return interaction.reply({ content: 'Invalid model. Use diamonds, items/offer, or both.', ephemeral: true });
      const time = 60; // Fixed to 60 seconds
      const startingPrice = parseBid(startingPriceStr);
      if (isNaN(startingPrice) || startingPrice < 0) return interaction.reply({ content: 'Invalid starting price.', ephemeral: true });
      if (startingPrice > MAX_DIAMONDS) return interaction.reply({ content: `Maximum diamonds allowed is ${formatBid(MAX_DIAMONDS)} 💎.`, ephemeral: true });

      if (auctions.size > 0) {
        return interaction.reply({ content: 'An auction is already running in the server. Please wait for it to end.', ephemeral: true });
      }

      const auction = {
        host: interaction.user,
        title,
        description,
        model,
        time,
        startingPrice,
        bids: [],
        started: new Date(),
        channelId: interaction.channel.id
      };

      const targetChannel = redirectChannelId ? interaction.guild.channels.cache.get(redirectChannelId) : interaction.channel;
      if (!targetChannel) return interaction.reply({ content: 'Redirect channel not found.', ephemeral: true });

      // Send ping message first
      const pingMsg = await targetChannel.send('-# ||<@&1461741243427197132>||');
      auction.notificationMessageId = pingMsg.id;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${description}\n\n**Looking For:** ${model}\n**Starting Price:** ${formatBid(startingPrice)} 💎\n**Current Bid:** ${formatBid(startingPrice)} 💎\n**Time Remaining:** ${time}s\n**Hosted by:** ${interaction.user}`)
        .setColor(0x00ff00)
        .setFooter({ text: 'Version 1.1.2 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('bid_button')
            .setLabel('Bid')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('view_bids_button')
            .setLabel('View Bids')
            .setStyle(ButtonStyle.Secondary)
        );

      const message = await targetChannel.send({ embeds: [embed], components: [row] });
      auction.messageId = message.id;
      auction.channelId = targetChannel.id;
      auctions.set(targetChannel.id, auction);

      await interaction.reply({ content: `Auction "${title}" started in ${targetChannel}!`, ephemeral: true });

      // Start timer
      auction.timer = setTimeout(async () => {
        clearInterval(auction.updateInterval);
        await endAuction(targetChannel);
      }, time * 1000);

      // Update embed every second
      auction.updateInterval = setInterval(async () => {
        const remaining = Math.max(0, Math.ceil((auction.started.getTime() + auction.time * 1000 - Date.now()) / 1000));
        if (remaining <= 0) {
          clearInterval(auction.updateInterval);
          return;
        }
        const currentBid = auction.bids.length > 0 ? Math.max(...auction.bids.map(b => b.diamonds)) : auction.startingPrice;
        const updatedEmbed = new EmbedBuilder()
          .setTitle(auction.title)
          .setDescription(`${auction.description}\n\n**Looking For:** ${auction.model}\n**Starting Price:** ${formatBid(auction.startingPrice)} 💎\n**Current Bid:** ${formatBid(currentBid)} 💎\n**Time Remaining:** ${remaining}s\n**Hosted by:** ${auction.host}`)
          .setColor(0x00ff00)
          .setFooter({ text: 'Version 1.1.2 | Made By Atlas' })
          .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');
        try {
          await message.edit({ embeds: [updatedEmbed], components: [row] });
        } catch (e) {
          // ignore if message deleted
        }
      }, 1000);
    }
  }
});

async function updateTradeEmbed(guild, trade, messageId) {
  if (!guild) return;
  
  try {
    const channel = guild.channels.cache.get(trade.channelId);
    if (!channel) return;

    const message = await channel.messages.fetch(messageId);
    if (!message) return;

    // Create embed with grid layout
    const embed = new EmbedBuilder()
      .setTitle('Trade Offer')
      .setColor(trade.accepted ? 0x00ff00 : 0x0099ff)
      .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
      .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

    if (trade.accepted) {
      if (trade.adminCancelled) {
        embed.setDescription(`**Status:** ❌ Cancelled by an admin\n\n**Host:** ${trade.host}`);
      } else {
        embed.setDescription(`**Status:** ✅ Trade Accepted\n\n**Host:** ${trade.host}\n**Guest:** ${trade.acceptedUser}`);
      }
    } else if (trade.offers.length > 0) {
      embed.setDescription(`**Status:** Awaiting Host Decision\n\n**Host:** ${trade.host}`);
    } else {
      embed.setDescription(`**Status:** Waiting for offers\n\n**Host:** ${trade.host}`);
    }

    const hostItemsText = trade.hostItems.length > 0 ? trade.hostItems.map(item => formatItemDisplay(item)).join('\n') : 'None';
    embed.addFields({
      name: `Host${trade.hostDiamonds > 0 ? ` (+ ${formatBid(trade.hostDiamonds)} 💎)` : ''}`,
      value: hostItemsText || 'None',
      inline: true
    });

    if (trade.offers.length > 0 && !trade.accepted) {
      const lastOffer = trade.offers[trade.offers.length - 1];
      const guestItemsText = lastOffer.items.length > 0 ? lastOffer.items.map(item => formatItemDisplay(item)).join('\n') : 'None';
      embed.addFields({
        name: `${lastOffer.user.username}${lastOffer.diamonds > 0 ? ` (+ ${formatBid(lastOffer.diamonds)} 💎)` : ''}`,
        value: guestItemsText || 'None',
        inline: true
      });
    } else if (trade.accepted) {
      const acceptedOffer = trade.offers.find(o => o.user.id === trade.acceptedUser.id);
      if (acceptedOffer) {
        const guestItemsText = acceptedOffer.items.length > 0 ? acceptedOffer.items.map(item => formatItemDisplay(item)).join('\n') : 'None';
        embed.addFields({
          name: `${acceptedOffer.user.username}${acceptedOffer.diamonds > 0 ? ` (+ ${formatBid(acceptedOffer.diamonds)} 💎)` : ''}`,
          value: guestItemsText || 'None',
          inline: true
        });
      }
    }

    let components = [];

    if (!trade.accepted && trade.offers.length > 0) {
      const acceptButton = new ButtonBuilder()
        .setCustomId(`trade_accept_${messageId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success);

      const declineButton = new ButtonBuilder()
        .setCustomId(`trade_decline_${messageId}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger);

      components.push(new ActionRowBuilder().addComponents(acceptButton, declineButton));
    } else if (!trade.accepted) {
      const offerButton = new ButtonBuilder()
        .setCustomId('trade_offer_button')
        .setLabel('Make Offer')
        .setStyle(ButtonStyle.Primary);

      const deleteButton = new ButtonBuilder()
        .setCustomId(`trade_delete_${Date.now()}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      components.push(new ActionRowBuilder().addComponents(offerButton, deleteButton));
    } else if (trade.accepted) {
      const uploadImageButton = new ButtonBuilder()
        .setCustomId(`trade_upload_image_${Date.now()}`)
        .setLabel('Upload Proof Image')
        .setStyle(ButtonStyle.Primary);

      const deleteButton = new ButtonBuilder()
        .setCustomId(`trade_delete_${Date.now()}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      components.push(new ActionRowBuilder().addComponents(uploadImageButton, deleteButton));
    }

    await message.edit({ embeds: [embed], components });
  } catch (e) {
    console.error('Error updating trade embed:', e);
  }
}

async function endAuction(channel) {
  const auction = auctions.get(channel.id);
  if (!auction) return;

  clearTimeout(auction.timer);
  clearInterval(auction.updateInterval);

  // Delete the ping notification message
  if (auction.notificationMessageId) {
    try {
      const pingMsg = await channel.messages.fetch(auction.notificationMessageId);
      await pingMsg.delete();
    } catch (e) {
      // ignore if message not found
    }
  }

  auctions.delete(channel.id);

  if (auction.bids.length === 0) {
    return channel.send('Auction ended with no bids.');
  }

  // Find winner: highest diamonds, if tie, first bid
  auction.bids.sort((a, b) => b.diamonds - a.diamonds || auction.bids.indexOf(a) - auction.bids.indexOf(b));
  const winner = auction.bids[0];

  const embed = new EmbedBuilder()
    .setTitle('Auction Ended!')
    .setDescription(`**Title:** ${auction.title}\n**Winner:** ${winner.user}\n**Bid:** ${formatBid(winner.diamonds)} 💎${winner.items ? ` and ${winner.items}` : ''}`)
    .setColor(0xff0000);

  // Add buttons
  const deleteButton = new ButtonBuilder()
    .setCustomId(`auction_delete_final_${Date.now()}`)
    .setLabel('Delete Auction')
    .setStyle(ButtonStyle.Danger);

  const uploadImageButton = new ButtonBuilder()
    .setCustomId(`auction_upload_image_${Date.now()}`)
    .setLabel('Upload Proof Image')
    .setStyle(ButtonStyle.Primary);
  
  const row = new ActionRowBuilder().addComponents(uploadImageButton, deleteButton);

  const msg = await channel.send({ embeds: [embed], components: [row] });
  
  // Store auction data for the buttons
  auction.finalMessageId = msg.id;
  auction.hostId = auction.host.id;
  auction.winnerId = winner.user.id;
  auction.winnerUser = winner.user;
  auctions.set(channel.id, auction);
}

client.login(process.env.TOKEN || config.token);
