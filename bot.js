const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandOptionType } = require('discord.js');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let redirectChannelId = null;
let redirectTradeChannelId = null;

const auctions = new Map(); // channelId -> { host, title, description, model, time, startingPrice, bids: [{user, diamonds, items}], timer, started, channelId, messageId, updateInterval }
const trades = new Map(); // messageId -> { host, hostDiamonds, hostItems, offers: [{user, diamonds, items, timestamp}], channelId, messageId, accepted: false, acceptedUser: null }

// Item categories for trades
const itemCategories = {
  huges: {
    'Black Hole Huges': ['HugeBlackHoleAngelus', 'HugeGoldenBlackHoleAngelus', 'HugeRainbowBlackHoleAngelus'],
    'Snow Globe Huges': ['HugeSnowGlobeHamster', 'HugeGoldenSnowGlobeHamster', 'HugeRainbowSnowGlobeHamster', 'HugeSnowGlobeCat', 'HugeGoldenSnowGlobeCat', 'HugeRainbowSnowGlobeCat'],
    'Ice Cube Huges': ['HugeIceCubeGingerbreadCorgi', 'HugeGoldenIceCubeGingerbreadCorgi', 'HugeRainbowIceCubeGingerbreadCorgi', 'HugeIceCubeCookieCutCat', 'HugeGoldenIceCubeCookieCutCat', 'HugeRainbowIceCubeCookieCutCat'],
    'Jelly Huges': ['HugeJellyDragon', 'HugeGoldenJellyDragon', 'HugeRainbowJellyDragon', 'HugeJellyKitsune', 'HugeGoldenJellyKitsune', 'HugeRainbowJellyKitsune'],
    'Blazing Huges': ['HugeBlazingShark', 'HugeGoldenBlazingShark', 'HugeRainbowBlazingShark', 'HugeBlazingBat', 'HugeGoldenBlazingBat', 'HugeRainbowBlazingBat'],
    'Event Huges': ['HugePartyCat', 'HugeGoldenPartyCat', 'HugeRainbowPartyCat', 'HugePartyDragon', 'HugeGoldenPartyDragon', 'HugeRainbowPartyDragon', 'HugeHellRock', 'HugeGoldenHellRock', 'HugeRainbowHellRock', 'HugeNinjaCat', 'HugeGoldenNinjaCat', 'HugeRainbowNinjaCat'],
    'Christmas.1 Huges': ['HugePresentChestMimic', 'HugeGoldenPresentChestMimic', 'HugeRainbowPresentChestMimic', 'HugeGingerbreadAngelus', 'HugeGoldenGingerbreadAngelus', 'HugeRainbowGingerbreadAngelus', 'HugeNorthPoleWolf', 'HugeGoldenNorthPoleWolf', 'HugeRainbowNorthPoleWolf'],
    'Christmas.2 Huges': ['HugeIcyPhoenix', 'HugeGoldenIcyPhoenix', 'HugeRainbowIcyPhoenix'],
    'Map Huges': ['HugeChestMimic', 'HugeGoldenChestMimic', 'HugeRainbowChestMimic', 'HugeSorcererCat', 'HugeGoldenSorcererCat', 'HugeRainbowSorcererCat', 'HugePropellerCat', 'HugeGoldenPropellerCat', 'HugeRainbowPropellerCat', 'HugeDominusAzureus', 'HugeGoldenDominusAzureus', 'HugeRainbowDominusAzureus', 'HugePropellerDog', 'HugeGoldenPropellerDog', 'HugeRainbowPropellerDog']
  },
  exclusives: ['BlazingShark', 'BlazingGoldenShark', 'BlazingRainbowShark', 'BlazingBat', 'BlazingGoldenBat', 'BlazingRainbowBat', 'BlazingCorgi', 'BlazingGoldenCorgi', 'BlazingRainbowCorgi', 'IceCubeGingerbreadCat', 'IceCubeGoldenGingerbreadCat', 'IceCubeRainbowGingerbreadCat', 'IceCubeGingerbreadCorgi', 'IceCubeGoldenGingerbreadCorgi', 'IceCubeRainbowGingerbreadCorgi', 'IceCubeCookieCuteCat', 'IceCubeGoldenCookieCuteCat', 'IceCubeRainbowCookieCuteCat', 'SnowGlobeCat', 'SnowGlobeGoldenCat', 'SnowGlobeRainbowCat', 'SnowGlobeAxolotl', 'SnowGlobeGoldenAxolotl', 'SnowGlobeRainbowAxolotl', 'SnowGlobeHamster', 'SnowGlobeGoldenHamster', 'SnowGlobeRainbowHamster', 'JellyCat', 'JellyGoldenCat', 'JellyRainbowCat', 'JellyBunny', 'JellyGoldenBunny', 'JellyRainbowBunny', 'JellyCorgi', 'JellyGoldenCorgi', 'JellyRainbowCorgi', 'BlackHoleAxolotl', 'BlackHoleGoldenAxolotl', 'BlackHoleRainbowAxolotl', 'BlackHoleImmortuus', 'BlackHoleGoldenImmortuus', 'BlackHoleRainbowImmortuus', 'BlackHoleKitsune', 'BlackHoleGoldenKitsune', 'BlackHoleRainbowKitsune'],
  eggs: ['HypeEgg', 'BlazingEgg', 'IceCubeEgg', 'SnowGlobeEgg', 'JellyEgg', 'BlackHoleEgg'],
  gifts: ['LikeGoalLootbox', '2026LootBox', 'SpintheWheellootbox']
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
        .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
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
          .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
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

    if (commandName === 'setuptrade') {
      const embed = new EmbedBuilder()
        .setTitle('Trade System Setup')
        .setDescription('Welcome to the live trade system!\n\n**How it works:**\n- Create a trade offer with items or diamonds.\n- Other users can place their offers in response.\n- Host can accept or decline offers.\n- Once accepted, both users are notified.\n\nClick the button below to create a new trade.')
        .setColor(0x0099ff)
        .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
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
        .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
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

    if (interaction.customId === 'trade_offer_button') {
      const trade = trades.get(interaction.message.id);
      if (!trade) return interaction.reply({ content: 'Trade not found.', flags: 64 });

      // Show category selection for offer
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_category_select_${interaction.message.id}`)
        .setPlaceholder('Select an item category')
        .addOptions([
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

      // Update embed and ping both users
      await updateTradeEmbed(interaction.guild, trade, messageId);
      const channel = interaction.guild.channels.cache.get(trade.channelId);
      await channel.send(`✅ Trade accepted! ${trade.host} and ${lastOffer.user}, your trade has been accepted.`);

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

      // Update embed
      await updateTradeEmbed(interaction.guild, trade, messageId);
      const channel = interaction.guild.channels.cache.get(trade.channelId);
      await channel.send(`❌ Trade offer from ${lastOffer.user} has been declined.`);

      await interaction.reply({ content: 'Offer declined!', ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu()) {
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
        .addOptions(items.map(item => ({ label: item, value: item })));

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
        .addOptions(items.map(item => ({ label: item, value: item })));

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
  }

  if (interaction.isModalSubmit()) {
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
      
      let itemsList = '';
      interaction.user.tradeItems.forEach(item => {
        itemsList += `${item.name} x${item.quantity}\n`;
      });

      await interaction.reply({ 
        content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
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
      
      let itemsList = '';
      interaction.user.offerTradeItems.forEach(item => {
        itemsList += `${item.name} x${item.quantity}\n`;
      });

      await interaction.reply({ 
        content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
        components: [row], 
        flags: 64 
      });
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'trade_setup_modal') {
      const diamondsStr = interaction.fields.getTextInputValue('trade_diamonds') || '0';
      const targetUsername = interaction.fields.getTextInputValue('trade_target_user') || '';

      let diamonds = 0;
      if (diamondsStr && diamondsStr !== '0') {
        diamonds = parseBid(diamondsStr);
      }

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
        .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      // Format host items with quantities
      let hostItemsText = 'None';
      if (hostItems.length > 0) {
        hostItemsText = hostItems.map(item => 
          typeof item === 'object' ? `${item.name} x${item.quantity}` : item
        ).join('\n');
      }
      
      embed.addFields({
        name: `Host Items${diamonds > 0 ? ` + ${diamonds} 💎` : ''}`,
        value: hostItemsText || 'None',
        inline: false
      });

      const offerButton = new ButtonBuilder()
        .setCustomId('trade_offer_button')
        .setLabel('Make Offer')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(offerButton);

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
        targetUsername: targetUsername
      };

      trades.set(message.id, trade);

      await interaction.reply({ content: `Trade offer created! ${targetUsername ? `Awaiting response from ${targetUsername}.` : 'Open for all users.'}`, flags: 64 });
      return;
    }

    if (interaction.customId.startsWith('offer_submit_modal_')) {
      const messageId = interaction.customId.replace('offer_submit_modal_', '');
      const diamondsStr = interaction.fields.getTextInputValue('offer_diamonds') || '0';

      let diamonds = 0;
      if (diamondsStr && diamondsStr !== '0') {
        diamonds = parseBid(diamondsStr);
      }

      const offerItems = interaction.user.offerItems || [];
      delete interaction.user.offerItems;
      delete interaction.user.messageId;

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
        await channel.send(`📢 ${trade.host}, você recebeu uma oferta de ${interaction.user}!`);
      }

      await interaction.reply({ content: `Offer submitted! Host will accept or decline.`, flags: 64 });
      return;
    }

    if (interaction.customId === 'bid_modal') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });

      const diamondsStr = interaction.fields.getTextInputValue('diamonds');
      const items = interaction.fields.getTextInputValue('items') || '';

      let diamonds = 0;
      if (diamondsStr) {
        diamonds = parseBid(diamondsStr);
      }

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
      await targetChannel.send('-# ||<@&1461741243427197132>||');

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${description}\n\n**Looking For:** ${model}\n**Starting Price:** ${formatBid(startingPrice)} 💎\n**Current Bid:** ${formatBid(startingPrice)} 💎\n**Time Remaining:** ${time}s\n**Hosted by:** ${interaction.user}`)
        .setColor(0x00ff00)
        .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
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
          .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
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
      .setFooter({ text: 'Version 1.0.8 | Made By Atlas' })
      .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

    if (trade.accepted) {
      embed.setDescription(`**Status:** ✅ Trade Accepted\n\n**Host:** ${trade.host}\n**Guest:** ${trade.acceptedUser}`);
    } else if (trade.offers.length > 0) {
      embed.setDescription(`**Status:** Awaiting Host Decision\n\n**Host:** ${trade.host}`);
    } else {
      embed.setDescription(`**Status:** Waiting for offers\n\n**Host:** ${trade.host}`);
    }

    const hostItemsText = trade.hostItems.length > 0 ? trade.hostItems.map(item => 
      typeof item === 'object' ? `${item.name} x${item.quantity}` : item
    ).join('\n') : 'None';
    embed.addFields({
      name: `Host${trade.hostDiamonds > 0 ? ` (+ ${trade.hostDiamonds} 💎)` : ''}`,
      value: hostItemsText || 'None',
      inline: true
    });

    if (trade.offers.length > 0 && !trade.accepted) {
      const lastOffer = trade.offers[trade.offers.length - 1];
      const guestItemsText = lastOffer.items.length > 0 ? lastOffer.items.map(item => 
        typeof item === 'object' ? `${item.name} x${item.quantity}` : item
      ).join('\n') : 'None';
      embed.addFields({
        name: `${lastOffer.user.username}${lastOffer.diamonds > 0 ? ` (+ ${lastOffer.diamonds} 💎)` : ''}`,
        value: guestItemsText || 'None',
        inline: true
      });
    } else if (trade.accepted) {
      const acceptedOffer = trade.offers.find(o => o.user.id === trade.acceptedUser.id);
      if (acceptedOffer) {
        const guestItemsText = acceptedOffer.items.length > 0 ? acceptedOffer.items.map(item => 
          typeof item === 'object' ? `${item.name} x${item.quantity}` : item
        ).join('\n') : 'None';
        embed.addFields({
          name: `${acceptedOffer.user.username}${acceptedOffer.diamonds > 0 ? ` (+ ${acceptedOffer.diamonds} 💎)` : ''}`,
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

      components.push(new ActionRowBuilder().addComponents(offerButton));
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
  auctions.delete(channel.id);

  if (auction.bids.length === 0) {
    return channel.send('Auction ended with no bids.');
  }

  // Find winner: highest diamonds, if tie, first bid
  auction.bids.sort((a, b) => b.diamonds - a.diamonds || auction.bids.indexOf(a) - auction.bids.indexOf(b));
  const winner = auction.bids[0];

  const embed = new EmbedBuilder()
    .setTitle('Auction Ended!')
    .setDescription(`**Title:** ${auction.title}\n**Winner:** ${winner.user}\n**Bid:** ${winner.diamonds} 💎${winner.items ? ` and ${winner.items}` : ''}`)
    .setColor(0xff0000);

  channel.send({ embeds: [embed] });
}

client.login(process.env.TOKEN || config.token);
