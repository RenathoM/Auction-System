const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandOptionType } = require('discord.js');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const auctions = new Map(); // channelId -> { host, item, model, bids: [{user, diamonds, items}], timer, started }

client.once('ready', async () => {
  console.log('Auction Bot is ready!');

  // Register slash commands
  const commands = [
    {
      name: 'startauction',
      description: 'Start a new auction',
      options: [
        {
          name: 'item',
          type: ApplicationCommandOptionType.String,
          description: 'The item being auctioned',
          required: true
        },
        {
          name: 'model',
          type: ApplicationCommandOptionType.String,
          description: 'Auction model: diamonds, items, or both',
          required: true,
          choices: [
            { name: 'Diamonds only', value: 'diamonds' },
            { name: 'Items only', value: 'items' },
            { name: 'Both', value: 'both' }
          ]
        }
      ]
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
    }
  ];

  await client.application.commands.set(commands);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const auction = auctions.get(message.channel.id);
  if (!auction) return;

  // Parse bid messages
  const bidRegex = /I'll bid (\d+(?:,\d{3})*|\d+K?)(?:\s+and (.+))?/i;
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

    if (commandName === 'startauction') {
      const item = interaction.options.getString('item');
      const model = interaction.options.getString('model');

      if (auctions.has(interaction.channel.id)) {
        return interaction.reply({ content: 'An auction is already running in this channel.', ephemeral: true });
      }

      const auction = {
        host: interaction.user,
        item,
        model,
        bids: [],
        started: new Date()
      };

      auctions.set(interaction.channel.id, auction);

      const embed = new EmbedBuilder()
        .setTitle('Auction Started!')
        .setDescription(`Item: ${item}\nModel: ${model}\nTime: ${config.auctionTime} seconds`)
        .setColor(0x00ff00);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('bid_button')
            .setLabel('Bid')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });

      // Start timer
      auction.timer = setTimeout(async () => {
        await endAuction(interaction.channel);
      }, config.auctionTime * 1000);
    }

    if (commandName === 'bid') {
      const auction = auctions.get(interaction.channel.id);
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
      const auction = auctions.get(interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });
      if (auction.host.id !== interaction.user.id) return interaction.reply({ content: 'Only the host can end the auction.', ephemeral: true });

      clearTimeout(auction.timer);
      await endAuction(interaction.channel);
      interaction.reply('Auction ended by host.');
    }

    if (commandName === 'auctionstatus') {
      const auction = auctions.get(interaction.channel.id);
      if (!auction) return interaction.reply({ content: 'No auction running.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('Auction Status')
        .setDescription(`Item: ${auction.item}\nModel: ${auction.model}\nBids: ${auction.bids.length}`)
        .setColor(0x0000ff);

      interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'bid_button') {
      // Same as /bid
      const auction = auctions.get(interaction.channel.id);
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
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'bid_modal') {
      const auction = auctions.get(interaction.channel.id);
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
  }
});

async function endAuction(channel) {
  const auction = auctions.get(channel.id);
  if (!auction) return;

  auctions.delete(channel.id);

  if (auction.bids.length === 0) {
    return channel.send('Auction ended with no bids.');
  }

  // Find winner: highest diamonds, if tie, first bid
  auction.bids.sort((a, b) => b.diamonds - a.diamonds || auction.bids.indexOf(a) - auction.bids.indexOf(b));
  const winner = auction.bids[0];

  const embed = new EmbedBuilder()
    .setTitle('Auction Ended!')
    .setDescription(`Item: ${auction.item}\nWinner: ${winner.user}\nBid: ${winner.diamonds} 💎${winner.items ? ` and ${winner.items}` : ''}`)
    .setColor(0xff0000);

  channel.send({ embeds: [embed] });
}

client.login(config.token);