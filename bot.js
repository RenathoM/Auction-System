const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandOptionType } = require('discord.js');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let pinAllAuctions = false;

const auctions = new Map(); // channelId -> { host, title, description, model, time, startingPrice, bids: [{user, diamonds, items}], timer, started, channelId, messageId, updateInterval }

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
      name: 'pinallauctions',
      description: 'Toggle pinning of all future auctions (admin only)'
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

    if (auction.model === 'items' && diamonds > 0) return message.reply('This auction is items only.');
    if (auction.model === 'diamonds' && items) return message.reply('This auction is diamonds only.');

    // Add bid
    auction.bids.push({ user: message.author, diamonds, items });
    message.reply(`Bid placed: ${diamonds} 💎${items ? ` and ${items}` : ''}`);
  }
});

function parseBid(str) {
  str = str.replace(/,/g, '');
  if (str.includes('K')) {
    return parseInt(str.replace('K', '')) * 1000;
  }
  return parseInt(str);
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup') {
      const embed = new EmbedBuilder()
        .setTitle('Auction System Setup')
        .setDescription('Welcome to the live auction system!\n\n**How it works:**\n- Auctions are held per channel to avoid conflicts.\n- Bidding can be done via text (e.g., "bid 10000") or slash commands.\n- The auction ends automatically after the set time, or can be ended early.\n- Winner is the highest bidder (diamonds first, then first bid if tie).\n\nClick the button below to create a new auction.')
        .setColor(0x00ff00);

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
        .setPlaceholder('10000 or 10K')
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
        .setDescription(`Title: ${auction.title}\nDescription: ${auction.description}\nModel: ${auction.model}\nStarting Price: ${auction.startingPrice} 💎\nTime Left: ${Math.max(0, auction.time - Math.floor((Date.now() - auction.started) / 1000))} seconds\nBids: ${auction.bids.length}`)
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

      try {
        const message = await interaction.channel.messages.fetch(messageId);
        await message.delete();
      } catch (e) {
        // ignore if message not found
      }
      auctions.delete(auction.channelId);
      interaction.reply({ content: 'Auction deleted.', ephemeral: true });
    }

    if (commandName === 'endauctionadmin') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      const messageId = interaction.options.getString('messageid');
      const auction = Array.from(auctions.values()).find(a => a.messageId === messageId);
      if (!auction) return interaction.reply({ content: 'Auction not found.', ephemeral: true });

      clearTimeout(auction.timer);
      clearInterval(auction.updateInterval);
      await endAuction(interaction.guild.channels.cache.get(auction.channelId));
      interaction.reply({ content: 'Auction ended.', ephemeral: true });
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
        const updatedEmbed = new EmbedBuilder()
          .setTitle(auction.title)
          .setDescription(`${auction.description}\n\n**Looking For:** ${auction.model}\n**Starting Price:** ${auction.startingPrice} 💎\n**Time Remaining:** ${remaining}s`)
          .setColor(0x00ff00);
        try {
          const channel = interaction.guild.channels.cache.get(auction.channelId);
          const message = await channel.messages.fetch(auction.messageId);
          await message.edit({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bid_button').setLabel('Bid').setStyle(ButtonStyle.Primary))] });
        } catch (e) {
          // ignore
        }
      }, 1000);
      interaction.reply({ content: 'Auction restarted.', ephemeral: true });
    }

    if (commandName === 'pinallauctions') {
      if (!hasAdminRole) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      pinAllAuctions = !pinAllAuctions;
      interaction.reply({ content: `Pinning of all auctions is now ${pinAllAuctions ? 'enabled' : 'disabled'}.`, ephemeral: true });
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
        .setPlaceholder('10000 or 10K')
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

      const timeInput = new TextInputBuilder()
        .setCustomId('time')
        .setLabel('Time (seconds)')
        .setStyle(TextInputStyle.Short)
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
        new ActionRowBuilder().addComponents(timeInput),
        new ActionRowBuilder().addComponents(priceInput),
        new ActionRowBuilder().addComponents(modelInput)
      );

      await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'bid_modal') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });

      const diamondsStr = interaction.fields.getTextInputValue('diamonds');
      const items = interaction.fields.getTextInputValue('items') || '';

      let diamonds = 0;
      if (diamondsStr) {
        diamonds = parseBid(diamondsStr);
      }

      if (auction.model === 'items' && diamonds > 0) return interaction.reply({ content: 'This auction is items only.', ephemeral: true });
      if (auction.model === 'diamonds' && items) return interaction.reply({ content: 'This auction is diamonds only.', ephemeral: true });
      if (auction.model === 'diamonds' && diamonds === 0) return interaction.reply({ content: 'Please enter diamonds.', ephemeral: true });
      if (auction.model === 'items' && !items) return interaction.reply({ content: 'Please enter items.', ephemeral: true });

      auction.bids.push({ user: interaction.user, diamonds, items });
      interaction.reply(`Bid placed: ${diamonds > 0 ? `${diamonds} 💎` : ''}${items ? ` and ${items}` : ''}`);
    }

    if (interaction.customId === 'auction_modal') {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const timeStr = interaction.fields.getTextInputValue('time');
      const startingPriceStr = interaction.fields.getTextInputValue('starting_price');
      const model = interaction.fields.getTextInputValue('model').toLowerCase();

      if (!['diamonds', 'items', 'both'].includes(model)) return interaction.reply({ content: 'Invalid model. Use diamonds, items, or both.', ephemeral: true });
      const time = parseInt(timeStr);
      if (isNaN(time) || time <= 0) return interaction.reply({ content: 'Invalid time.', ephemeral: true });
      const startingPrice = parseInt(startingPriceStr);
      if (isNaN(startingPrice) || startingPrice < 0) return interaction.reply({ content: 'Invalid starting price.', ephemeral: true });

      if (Array.from(auctions.values()).some(a => a.channelId === interaction.channel.id)) {
        return interaction.reply({ content: 'An auction is already running in this channel.', ephemeral: true });
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

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${description}\n\n**Looking For:** ${model}\n**Starting Price:** ${startingPrice} 💎\n**Time Remaining:** ${time}s`)
        .setColor(0x00ff00);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('bid_button')
            .setLabel('Bid')
            .setStyle(ButtonStyle.Primary)
        );

      const message = await interaction.reply({ embeds: [embed], components: [row] });
      auction.messageId = message.id;
      auctions.set(interaction.channel.id, auction);

      // Start timer
      auction.timer = setTimeout(async () => {
        clearInterval(auction.updateInterval);
        await endAuction(interaction.channel);
      }, time * 1000);

      // Update embed every second
      auction.updateInterval = setInterval(async () => {
        const remaining = Math.max(0, Math.ceil((auction.started.getTime() + auction.time * 1000 - Date.now()) / 1000));
        if (remaining <= 0) {
          clearInterval(auction.updateInterval);
          return;
        }
        const updatedEmbed = new EmbedBuilder()
          .setTitle(auction.title)
          .setDescription(`${auction.description}\n\n**Looking For:** ${auction.model}\n**Starting Price:** ${auction.startingPrice} 💎\n**Time Remaining:** ${remaining}s`)
          .setColor(0x00ff00);
        try {
          await message.edit({ embeds: [updatedEmbed], components: [row] });
        } catch (e) {
          // ignore if message deleted
        }
      }, 1000);

      // Pin if enabled
      if (pinAllAuctions) {
        try {
          await message.pin();
        } catch (e) {
          // ignore pin errors
        }
      }
    }
  }
});

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
