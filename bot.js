const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandOptionType, MessageFlags, StringSelectMenuBuilder, userMention } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const redis = require('redis');

// Function to increment version automatically
function incrementVersion(currentVersion) {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length !== 3) return '1.0.0';
  
  let [major, minor, patch] = parts;
  
  if (patch < 9) {
    patch++;
  } else {
    patch = 0;
    if (minor < 9) {
      minor++;
    } else {
      minor = 0;
      major++;
    }
  }
  
  return `${major}.${minor}.${patch}`;
}

// Function to update version file
function updateVersionFile(category, newVersion) {
  try {
    const versionFile = require('./version.json');
    versionFile[category] = newVersion;
    versionFile.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./version.json', JSON.stringify(versionFile, null, 2));
    return true;
  } catch (error) {
    console.error('Error updating version file:', error);
    return false;
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Redis client
const redisClient = redis.createClient({
  url: 'redis://default:GXpaeZBLEimkAjhcFwHsXfbyFbkpdMab@switchback.proxy.rlwy.net:39315'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

// Error logging system
const ERROR_LOG_CHANNEL = '1462804742366298112';
const ERROR_CODES = {
  // Permission errors (01-05)
  'E01': 'You do not have permission to use this command',
  'E02': 'Only the auction host can perform this action',
  'E03': 'Only the trade host can perform this action',
  'E04': 'You cannot make offers on your own trade',
  'E05': 'Only administrators can use this command',
  
  // Trade errors (06-15)
  'E06': 'You cannot create a trade with more than 100 items',
  'E07': 'No trade found with that ID',
  'E08': 'Trade already accepted by another user',
  'E09': 'Invalid trade offer',
  'E10': 'Trade has expired',
  'E11': 'You must select at least one item',
  'E12': 'Maximum quantity exceeded for this item',
  'E13': 'Insufficient diamonds',
  'E14': 'Cannot add more items to this trade',
  'E15': 'Invalid offer amount',
  
  // Auction errors (16-25)
  'E16': 'No auction running in this channel',
  'E17': 'Auction has already started',
  'E18': 'Auction has expired',
  'E19': 'Bid must be higher than current bid',
  'E20': 'Invalid bid amount',
  'E21': 'Cannot bid on your own auction',
  'E22': 'Auction already has a winner',
  'E23': 'No bids placed on this auction',
  'E24': 'Cannot accept an offer without bids',
  'E25': 'Auction setup requires valid parameters',
  
  // Inventory errors (26-35)
  'E26': 'Inventory not found',
  'E27': 'Item not found in inventory',
  'E28': 'Cannot remove item from inventory',
  'E29': 'Inventory is empty',
  'E30': 'Invalid inventory data',
  'E31': 'Cannot edit another user\'s inventory',
  'E32': 'Item quantity must be at least 1',
  'E33': 'Maximum items reached (100)',
  'E34': 'Inventory update failed',
  'E35': 'Cannot transfer items',
  
  // Giveaway errors (36-45)
  'E36': 'No giveaway found',
  'E37': 'Giveaway has expired',
  'E38': 'You already entered this giveaway',
  'E39': 'Giveaway setup requires valid parameters',
  'E40': 'Cannot end giveaway that hasn\'t started',
  'E41': 'No entries in this giveaway',
  'E42': 'Giveaway already ended',
  'E43': 'Invalid giveaway configuration',
  'E44': 'Cannot join your own giveaway',
  'E45': 'Giveaway item limit exceeded',
  
  // System errors (46-55)
  'E46': 'Failed to save data to Redis',
  'E47': 'Failed to load data from Redis',
  'E48': 'Database connection error',
  'E49': 'Invalid command parameters',
  'E50': 'An unexpected error occurred. Please try again later',
  'E51': 'Message not found',
  'E52': 'Channel not found',
  'E53': 'User not found',
  'E54': 'Operation timed out',
  'E55': 'Rate limit exceeded - try again in a moment',
  'E99': 'An unexpected error occurred. Please try again.',
  
  // File upload errors (56-60)
  'E56': 'Please upload an image file',
  'E57': 'Trade proof channel not found',
  'E58': 'Trade no longer exists',
  'E59': 'Auction proof channel not found',
  'E60': 'Auction no longer exists',
  
  // Giveaway proof errors (61-65)
  'E61': 'Giveaway proof channel not found',
  'E62': 'Giveaway no longer exists',
  'E63': 'Invalid proof type',
  'E64': 'No bot messages found in this channel',
  'E65': 'An error occurred while clearing bot messages',
  
  // Additional errors (66-80)
  'E64': 'This trade has already been accepted',
  'E65': 'Cannot decline offers after the trade has been accepted',
  'E66': 'Trade offer has been declined',
  'E67': 'Please use the file upload feature. Reply to this message with an image attachment',
  'E68': 'Please provide a valid image URL',
  'E69': 'Giveaway channel not found',
  'E70': 'Giveaway message not found',
  'E71': 'Error processing proof image',
  'E72': 'Only the host or admin can perform this action',
  'E73': 'Since there\'s already a bid with only diamonds, you can only add items to your bid',
  'E74': 'An auction is already running in the server. Please wait for it to end',
  'E75': 'Redirect channel not found',
  'E76': 'Please enter a valid amount of diamonds',
  'E77': 'Invalid model. Use diamonds, items/offer, or both',
  'E78': 'Invalid starting price',
  'E79': 'Your bid must be higher than the current highest bid',
  'E80': 'Please provide exactly the correct number of quantities',
  
  // Critical missing error codes (81-85)
  'E81': 'You have reached your maximum trade creation limit',
  'E82': 'You have reached your maximum auction creation limit',
  'E83': 'You have reached your maximum giveaway creation limit',
  'E84': 'No items available to remove',
  'E85': 'Invalid duration. Please enter a valid time format'
};

// Bot Logs System
const botLogs = {
  logs: [],
  addLog: function(type, message, userId = null, details = {}) {
    const logEntry = {
      id: this.logs.length + 1,
      type,
      message,
      userId,
      timestamp: new Date().toISOString(),
      details
    };
    this.logs.push(logEntry);
    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs.shift();
    }
    return logEntry;
  },
  getLogs: function(type = null, limit = 10) {
    let filtered = this.logs;
    if (type) {
      filtered = filtered.filter(log => log.type === type);
    }
    return filtered.slice(-limit).reverse();
  },
  getLogDescriptions: function() {
    return {
      'PROOF_SUCCESS': 'Proof image successfully uploaded and added to embed thumbnail',
      'PROOF_ERROR': 'Error occurred during proof upload process',
      'PROOF_TIMEOUT': 'Proof upload timed out, trade/auction marked as incomplete',
      'PROOF_REMINDER': 'Reminder sent to users about pending proof upload',
      'TRADE_CREATED': 'New trade offer created',
      'TRADE_ACCEPTED': 'Trade offer accepted by user',
      'TRADE_DECLINED': 'Trade offer declined by user',
      'TRADE_DELETED': 'Trade deleted by user or admin',
      'AUCTION_STARTED': 'New auction started',
      'AUCTION_ENDED': 'Auction ended with winner',
      'AUCTION_BID': 'Bid placed on auction',
      'AUCTION_TIMEOUT': 'Auction ended due to timeout',
      'GIVEAWAY_STARTED': 'New giveaway started',
      'GIVEAWAY_ENDED': 'Giveaway ended with winner',
      'INVENTORY_CREATED': 'User inventory created or updated',
      'ADMIN_COMMAND': 'Admin command executed',
      'PERMISSION_DENIED': 'User attempted action without proper permissions',
      'INVALID_INPUT': 'User provided invalid input for command',
      'SUSPENSION_APPLIED': 'User suspended for failing to upload proof within timeout',
      'SUSPENSION_REMOVED': 'User suspension automatically removed after duration expired',
    };
  }
};

// Error frequency tracker for multiple errors in short time
const errorFrequency = new Map();
const MULTIPLE_ERROR_THRESHOLD = 60000; // 60 seconds
const ALERT_CHANNEL = '1461506733833846958';
const ALERT_USER = '566300801476329472';

// Suspension system constants
const SUSPENSION_DURATION = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const SUSPENSION_ROLES = {
  TRADE: '1462882529810841805',
  GIVEAWAY: '1462882439075598618',
  AUCTION: '1462882283735351519'
};

// Suspension tracking: userId -> { type, startTime, roleId }
const userSuspensions = new Map();

// Suspension embed tracking: userId -> messageId
const suspensionEmbeds = new Map();

// Function to get suspension restrictions text
function getSuspensionRestrictions(type) {
  const restrictions = {
    TRADE: '• Cannot create new trades\n• Cannot make offers on other users\' trades\n• Cannot accept or decline own trades',
    GIVEAWAY: '• Cannot create new giveaways\n• Cannot participate in other users\' giveaways',
    AUCTION: '• Cannot create new auctions\n• Cannot bid on other users\' auctions'
  };
  return restrictions[type] || 'Unknown restrictions';
}

// Function to parse duration string (e.g., "1h", "30m", "2d") to milliseconds
function parseDuration(durationStr) {
  const regex = /^(\d+)([smhd])$/i;
  const match = durationStr.match(regex);
  if (!match) return SUSPENSION_DURATION; // Default to 24 hours

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value * 1000; // seconds
    case 'm': return value * 60 * 1000; // minutes
    case 'h': return value * 60 * 60 * 1000; // hours
    case 'd': return value * 24 * 60 * 60 * 1000; // days
    default: return SUSPENSION_DURATION;
  }
}

// Function to format duration in milliseconds to readable string
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

// Function to apply suspension to a user
async function applySuspension(guild, userId, type, adminId = null, customDuration = null, customReason = null) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const roleId = SUSPENSION_ROLES[type];
    if (!roleId) return;

    // Check if already suspended
    const existingSuspension = userSuspensions.get(userId);
    let duration = customDuration ? parseDuration(customDuration) : SUSPENSION_DURATION;
    let startTime = Date.now();

    if (existingSuspension && existingSuspension.type === type) {
      // Add to existing duration
      const remainingTime = (existingSuspension.startTime + existingSuspension.duration) - Date.now();
      duration = Math.max(0, remainingTime) + duration;
      startTime = Date.now() - (existingSuspension.duration - remainingTime); // Adjust start time to keep end time correct
    } else {
      // Add role if not already suspended
      await member.roles.add(roleId).catch(() => null);
    }

    // Record suspension
    userSuspensions.set(userId, {
      type,
      startTime,
      roleId,
      duration
    });

    // Send suspension embed to alert channel
    const alertChannel = guild.channels.cache.get(ALERT_CHANNEL);
    if (alertChannel) {
      const isAdminSuspension = adminId !== null;
      const adminMember = adminId ? await guild.members.fetch(adminId).catch(() => null) : null;

      const suspensionEmbed = new EmbedBuilder()
        .setTitle(isAdminSuspension ? '🚫 User Suspension Applied (Admin)' : '🚫 User Suspension Applied')
        .setColor(0xff0000)
        .setDescription(isAdminSuspension
          ? `A user has been suspended by an administrator.`
          : `A user has been suspended for failing to upload proof within the timeout period.`)
        .addFields(
          { name: '👤 User', value: `<@${userId}> (${userId})`, inline: true },
          { name: '🏷️ Type', value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
          { name: '⏰ Duration', value: formatDuration(duration), inline: true },
          { name: '🎭 Role Added', value: `<@&${roleId}>`, inline: true },
          { name: '📅 Suspended At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: '⏳ Expires At', value: `<t:${Math.floor((startTime + duration) / 1000)}:F>`, inline: true },
          { name: '📋 Reason', value: customReason || `Failed to upload proof image for ${type} within 9 minutes timeout`, inline: false },
          { name: '🚫 Restrictions', value: getSuspensionRestrictions(type), inline: false }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: 'Click "Remove Suspension" to manually remove (Admin Only)' })
        .setTimestamp();

      if (isAdminSuspension && adminMember) {
        suspensionEmbed.addFields(
          { name: '👮‍♂️ Suspended By', value: `${adminMember.user.tag} (${adminId})`, inline: true }
        );
      }

      const removeButton = new ButtonBuilder()
        .setCustomId(`remove_suspension_${userId}`)
        .setLabel('Remove Suspension')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(removeButton);

      const message = await alertChannel.send({ embeds: [suspensionEmbed], components: [row] });
      suspensionEmbeds.set(userId, message.id);
    }

    // Schedule role removal
    setTimeout(async () => {
      await removeSuspension(guild, userId);
    }, duration);

    botLogs.addLog('SUSPENSION_APPLIED', `User suspended for ${type}${adminId ? ` by admin ${adminId}` : ' proof timeout'}`, userId, { type, duration, adminId, reason: customReason });
  } catch (e) {
    console.error('Error applying suspension:', e);
  }
}

// Function to remove suspension from a user
async function removeSuspension(guild, userId) {
  try {
    const suspension = userSuspensions.get(userId);
    if (!suspension) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (member && suspension.roleId) {
      await member.roles.remove(suspension.roleId).catch(() => null);
    }

    // Update suspension embed to green (expired)
    const embedMessageId = suspensionEmbeds.get(userId);
    if (embedMessageId) {
      const alertChannel = guild.channels.cache.get(ALERT_CHANNEL);
      if (alertChannel) {
        try {
          const message = await alertChannel.messages.fetch(embedMessageId);
          if (message && message.embeds.length > 0) {
            const updatedEmbed = EmbedBuilder.from(message.embeds[0])
              .setTitle('✅ User Suspension Expired')
              .setColor(0x00ff00)
              .setDescription('This user\'s suspension has automatically expired.')
              .addFields(
                { name: '📅 Expired At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
              )
              .setFooter({ text: 'Suspension automatically removed' });

            await message.edit({ embeds: [updatedEmbed], components: [] });
          }
        } catch (e) {
          // Message might have been deleted, ignore
        }
      }
      suspensionEmbeds.delete(userId);
    }

    userSuspensions.delete(userId);
    botLogs.addLog('SUSPENSION_REMOVED', `User suspension expired for ${suspension.type}`, userId, { type: suspension.type });
  } catch (e) {
    console.error('Error removing suspension:', e);
  }
}

// Function to manually remove suspension (admin only)
async function manualSuspensionRemoval(guild, userId, adminUserId, reason = null) {
  try {
    const suspension = userSuspensions.get(userId);
    if (!suspension) return false;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (member && suspension.roleId) {
      await member.roles.remove(suspension.roleId).catch(() => null);
    }

    // Update suspension embed to green (manually removed)
    const embedMessageId = suspensionEmbeds.get(userId);
    if (embedMessageId) {
      const alertChannel = guild.channels.cache.get(ALERT_CHANNEL);
      if (alertChannel) {
        try {
          const message = await alertChannel.messages.fetch(embedMessageId);
          if (message && message.embeds.length > 0) {
            const adminMember = await guild.members.fetch(adminUserId).catch(() => null);
            const updatedEmbed = EmbedBuilder.from(message.embeds[0])
              .setTitle('✅ User Suspension Manually Removed')
              .setColor(0x00ff00)
              .setDescription('This user\'s suspension has been manually removed by an admin.')
              .addFields(
                { name: '👮‍♂️ Removed By', value: adminMember ? `${adminMember.user.tag} (${adminUserId})` : `<@${adminUserId}> (${adminUserId})`, inline: true },
                { name: '📅 Removed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
              )
              .setFooter({ text: 'Suspension manually removed by admin' });

            if (reason) {
              updatedEmbed.addFields(
                { name: '📋 Reason', value: reason, inline: false }
              );
            }

            await message.edit({ embeds: [updatedEmbed], components: [] });
          }
        } catch (e) {
          // Message might have been deleted, ignore
        }
      }
      suspensionEmbeds.delete(userId);
    }

    userSuspensions.delete(userId);
    botLogs.addLog('SUSPENSION_REMOVED', `User suspension manually removed by admin ${adminUserId} for ${suspension.type}${reason ? ` - ${reason}` : ''}`, userId, { type: suspension.type, adminId: adminUserId, reason });
    return true;
  } catch (e) {
    console.error('Error manually removing suspension:', e);
    return false;
  }
}

// Function to check if user is suspended for a specific activity
function checkSuspension(userId, activityType) {
  const suspension = userSuspensions.get(userId);
  if (!suspension) return null;

  // Check if suspension applies to this activity
  const applicableTypes = {
    'trade': ['TRADE'],
    'giveaway': ['GIVEAWAY'],
    'auction': ['AUCTION']
  };

  if (!applicableTypes[activityType]?.includes(suspension.type)) return null;

  const duration = suspension.duration || SUSPENSION_DURATION;
  const timeRemaining = duration - (Date.now() - suspension.startTime);
  if (timeRemaining <= 0) {
    // Suspension expired, remove it
    userSuspensions.delete(userId);
    return null;
  }

  return {
    type: suspension.type,
    timeRemaining,
    reason: `Proof timeout for ${suspension.type.toLowerCase()}`
  };
}

// Function to remove suspension from a user
async function removeSuspension(guild, userId) {
  try {
    const suspension = userSuspensions.get(userId);
    if (!suspension) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (member && suspension.roleId) {
      await member.roles.remove(suspension.roleId).catch(() => null);
    }

    userSuspensions.delete(userId);
    botLogs.addLog('SUSPENSION_REMOVED', `User suspension expired for ${suspension.type}`, userId, { type: suspension.type });
  } catch (e) {
    console.error('Error removing suspension:', e);
  }
}

// Proof upload tracking system (for timeouts)
const proofUploadTracking = new Map(); // messageId -> { type, hostId, guestId, reminderCount, reminderTimestamp }

// Waiting for proof uploads
const waitingForProofUploads = new Map(); // userId -> proofData

const PROOF_UPLOAD_TIMEOUT = 540000; // 9 minutes (3 reminders every 3 minutes)
const PROOF_REMINDER_INTERVAL = 180000; // 3 minutes between reminders
const PROOF_MAX_REMINDERS = 3; // Maximum 3 reminders

// Item count validation system
const itemCountTracking = new Map(); // userId -> { offerTradeCount, inventoryCount, giveawayCount, tradeOfferCount, timestamp }

// Function to track item count when added to menu
function trackItemCount(userId, itemType, count) {
  if (!itemCountTracking.has(userId)) {
    itemCountTracking.set(userId, {});
  }
  
  const userTracking = itemCountTracking.get(userId);
  userTracking[itemType] = count;
  userTracking.timestamp = Date.now();
}

// Function to validate item count when sent to embed
async function validateItemCount(interaction, itemType, receivedCount, itemsList) {
  const userTracking = itemCountTracking.get(interaction.user.id);
  
  if (!userTracking || userTracking[itemType] === undefined) {
    return true; // First time, no validation needed
  }
  
  const expectedCount = userTracking[itemType];
  
  if (receivedCount !== expectedCount) {
    // CRITICAL ERROR: Item count mismatch
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🚨 CRITICAL ITEM COUNT MISMATCH')
      .setDescription('**Possible manipulation attempt detected!**')
      .addFields(
        { name: '**USER**', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
        { name: '**ITEM TYPE**', value: `\`\`\`${itemType}\`\`\``, inline: true },
        { name: '**EXPECTED COUNT**', value: `\`\`\`${expectedCount}\`\`\``, inline: true },
        { name: '**RECEIVED COUNT**', value: `\`\`\`${receivedCount}\`\`\``, inline: true },
        { name: '**DIFFERENCE**', value: `\`\`\`${receivedCount - expectedCount}\`\`\``, inline: true },
        { name: '**ITEMS RECEIVED**', value: `\`\`\`${JSON.stringify(itemsList.slice(0, 10)).substring(0, 1024)}\`\`\``, inline: false },
        { name: '**TIMESTAMP**', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        { name: '**GUILD ID**', value: `\`\`\`${interaction.guild.id}\`\`\``, inline: true }
      );
    
    try {
      const logChannel = await client.channels.fetch(ERROR_LOG_CHANNEL).catch(() => null);
      if (logChannel) {
        await logChannel.send({ 
          content: `<@${ALERT_USER}> **SECURITY ALERT**`,
          embeds: [errorEmbed] 
        });
      }
    } catch (error) {
      console.error('Failed to send item count validation error:', error);
    }
    
    return false;
  }
  
  return true;
}

// Function to log errors to Discord channel
async function logError(interaction, errorCode, errorMessage, context = {}) {
  try {
    const channel = await client.channels.fetch(ERROR_LOG_CHANNEL).catch(() => null);
    if (!channel) return;
    
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ Error Report')
      .addFields(
        { name: 'User', value: `${userMention(interaction.user.id)} (${interaction.user.id})`, inline: true },
        { name: 'Error Code', value: `\`${errorCode}\``, inline: true },
        { name: 'Message', value: errorMessage || 'No additional info', inline: false },
        { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      );
    
    if (context.commandName) embed.addFields({ name: 'Command', value: context.commandName, inline: true });
    if (context.channelId) embed.addFields({ name: 'Channel', value: `<#${context.channelId}>`, inline: true });
    if (Object.keys(context).length > 0 && !context.commandName && !context.channelId) {
      embed.addFields({ name: 'Context', value: JSON.stringify(context).substring(0, 1024), inline: false });
    }
    
    await channel.send({ embeds: [embed] });
    
    // Track error frequency for multiple occurrences
    trackErrorFrequency(errorCode);
  } catch (error) {
    console.error('Failed to log error to Discord:', error);
  }
}

// Function to track error frequency and alert on multiple occurrences
async function trackErrorFrequency(errorCode) {
  const now = Date.now();
  
  if (!errorFrequency.has(errorCode)) {
    errorFrequency.set(errorCode, []);
  }
  
  const errorList = errorFrequency.get(errorCode);
  
  // Remove timestamps older than 60 seconds
  const recentErrors = errorList.filter(entry => now - entry.timestamp < MULTIPLE_ERROR_THRESHOLD);
  recentErrors.push({ timestamp: now });
  errorFrequency.set(errorCode, recentErrors);
  
  const errorCount = recentErrors.length;
  
  // Alert if 4-15 errors occurred in less than 60 seconds
  if (errorCount >= 4 && errorCount <= 15) {
    try {
      const alertChannel = await client.channels.fetch(ALERT_CHANNEL).catch(() => null);
      if (!alertChannel) return;
      
      const alertEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🚨 **MULTIPLE ERROR ALERT**')
        .setThumbnail('https://media.discordapp.net/attachments/1461506733833846958/1462838334207557693/75e6b309-4e2b-48c6-9046-23df37b6c836.gif?ex=696fa5dd&is=696e545d&hm=00a95ab257adb2f266094f7f1eeae4f094c01d1f564402575b0897947601635b&=&width=1006&height=1006')
        .addFields(
          { name: '**ERROR CODE**', value: `\`\`\`${errorCode}\`\`\``, inline: true },
          { name: '**OCCURRENCES**', value: `\`\`\`${errorCount}\`\`\``, inline: true },
          { name: '**DESCRIPTION**', value: `\`\`\`${ERROR_CODES[errorCode] || 'UNKNOWN ERROR'}\`\`\``, inline: false }
        )
        .addFields(
          { name: '**TIME WINDOW**', value: '**LAST 60 SECONDS**', inline: true },
          { name: '**STATUS**', value: '**CRITICAL**', inline: true }
        )
        .addFields(
          { name: '**DASHBOARD**', value: '[CLICK HERE TO VIEW](https://railway.com/project/cef07fa9-9987-475d-bced-8e18f568a7e4?environmentId=fde4a8a9-a67d-409f-be0f-d06e1818f2cb)', inline: false }
        );
      
      await alertChannel.send({ 
        content: `<@${ALERT_USER}>`,
        embeds: [alertEmbed] 
      });
    } catch (error) {
      console.error('Failed to send error frequency alert:', error);
    }
  }
}

// Function to send user-friendly error message
async function sendErrorReply(interaction, errorCode, customMessage = null) {
  const message = customMessage || ERROR_CODES[errorCode] || 'An error occurred';
  const formattedMessage = `${message} | Error (\`${errorCode}\`)`;
  
  try {
    if (interaction.deferred) {
      await interaction.editReply({ content: `⚠️ ${formattedMessage}`, flags: MessageFlags.Ephemeral });
    } else if (interaction.replied) {
      await interaction.followUp({ content: `⚠️ ${formattedMessage}`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: `⚠️ ${formattedMessage}`, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error('Failed to send error reply:', error);
  }
  
  await logError(interaction, errorCode, formattedMessage);
}

let redirectChannelId = config.defaultAuctionChannelId || null;
let redirectTradeChannelId = config.defaultTradeChannelId || null;
let redirectInventoryChannelId = null;
let redirectGiveawayChannelId = '1462190801198252226';

const auctions = new Map(); // channelId -> { host, title, description, model, time, startingPrice, bids: [{user, diamonds, items}], timer, started, channelId, messageId, updateInterval }
const finishedAuctions = new Map(); // messageId -> { host, title, winner, diamonds, items, channelId, auctionMessageId }
const finishedGiveaways = new Map(); // messageId -> { host, winner, items, channelId }
const trades = new Map(); // messageId -> { host, hostDiamonds, hostItems, offers: [{user, diamonds, items, timestamp}], channelId, messageId, accepted: false, acceptedUser: null }
const inventories = new Map(); // userId -> { messageId, channelId, items, diamonds, lookingFor, robloxUsername, lastEdited }
const userTradeCount = new Map(); // userId -> count of active trades
const userGiveawayCount = new Map(); // userId -> count of active giveaways
const giveaways = new Map(); // messageId -> { host, items: [{name, quantity}], channelId, messageId, entries: [{user, items}], duration, expiresAt }

// Item categories for trades
const itemCategories = {
  huges: {
    'Black Hole Huges': ['HugeBlackHoleAngelus', 'HugeRainbowBlackHoleAngelus'],
    'Snow Globe Huges': ['HugeSnowGlobeHamster', 'HugeRainbowSnowGlobeHamster', 'HugeSnowGlobeCat', 'HugeRainbowSnowGlobeCat'],
    'Ice Cube Huges': ['HugeIceCubeGingerbreadCorgi', 'HugeRainbowIceCubeGingerbreadCorgi', 'HugeIceCubeCookieCutCat', 'HugeRainbowIceCubeCookieCutCat'],
    'Jelly Huges': ['HugeJellyDragon', 'HugeRainbowJellyDragon', 'HugeJellyKitsune', 'HugeRainbowJellyKitsune'],
    'Blazing Huges': ['HugeBlazingShark', 'HugeRainbowBlazingShark', 'HugeBlazingBat', 'HugeRainbowBlazingBat'],
    'Unicorn Huges': ['HugeElectricUnicorn', 'HugeRainbowElectricUnicorn'],
    'Event Huges': ['HugePartyCat', 'HugeGoldenPartyCat', 'HugeRainbowPartyCat', 'HugePartyDragon', 'HugeGoldenPartyDragon', 'HugeRainbowPartyDragon', 'HugeHellRock', 'HugeGoldenHellRock', 'HugeRainbowHellRock'],
    'Christmas.1 Huges': ['HugePresentChestMimic', 'HugeRainbowPresentChestMimic', 'HugeGingerbreadAngelus', 'HugeGoldenGingerbreadAngelus', 'HugeRainbowGingerbreadAngelus', 'HugeNorthPoleWolf', 'HugeGoldenNorthPoleWolf', 'HugeRainbowNorthPoleWolf'],
    'Christmas.2 Huges': ['HugeIcyPhoenix', 'HugeGoldenIcyPhoenix', 'HugeRainbowIcyPhoenix'],
    'Map Huges': ['HugeChestMimic', 'HugeGoldenChestMimic', 'HugeRainbowChestMimic', 'HugeSorcererCat', 'HugeGoldenSorcererCat', 'HugeRainbowSorcererCat', 'HugeDominusAzureus', 'HugeGoldenDominusAzureus', 'HugeRainbowDominusAzureus','HugePropellerCat', 'HugeGoldenPropellerCat', 'HugeRainbowPropellerCat', 'HugePropellerDog', 'HugeGoldenPropellerDog', 'HugeRainbowPropellerDog', 'HugeNinjaCat', 'HugeGoldenNinjaCat', 'HugeRainbowNinjaCat', 'HugeFantasyChestMimic', 'HugeGoldenFantasyChestMimic', 'HugeStormAgony', 'HugeGoldenStormAgony', 'HugeRainbowStormAgony']
  },
  exclusives: ['BlazingShark', 'BlazingGoldenShark', 'BlazingRainbowShark', 'BlazingBat', 'BlazingGoldenBat', 'BlazingRainbowBat', 'BlazingCorgi', 'BlazingGoldenCorgi', 'BlazingRainbowCorgi', 'IceCubeGingerbreadCat', 'IceCubeGoldenGingerbreadCat', 'IceCubeRainbowGingerbreadCat', 'IceCubeGingerbreadCorgi', 'IceCubeGoldenGingerbreadCorgi', 'IceCubeRainbowGingerbreadCorgi', 'IceCubeCookieCuteCat', 'IceCubeGoldenCookieCuteCat', 'IceCubeRainbowCookieCuteCat', 'SnowGlobeCat', 'SnowGlobeGoldenCat', 'SnowGlobeRainbowCat', 'SnowGlobeAxolotl', 'SnowGlobeGoldenAxolotl', 'SnowGlobeRainbowAxolotl', 'SnowGlobeHamster', 'SnowGlobeGoldenHamster', 'SnowGlobeRainbowHamster', 'JellyCat', 'JellyGoldenCat', 'JellyRainbowCat', 'JellyBunny', 'JellyGoldenBunny', 'JellyRainbowBunny', 'JellyCorgi', 'JellyGoldenCorgi', 'JellyRainbowCorgi', 'BlackHoleAxolotl', 'BlackHoleGoldenAxolotl', 'BlackHoleRainbowAxolotl', 'BlackHoleImmortuus', 'BlackHoleGoldenImmortuus', 'BlackHoleRainbowImmortuus', 'BlackHoleKitsune', 'BlackHoleGoldenKitsune', 'BlackHoleRainbowKitsune', 'MajesticUnicorn', 'StuntUnicorn', 'AnimeUnicorn'],
  eggs: ['HypeEgg', 'BlazingEgg', 'IceCubeEgg', 'SnowGlobeEgg', 'JellyEgg', 'BlackHoleEgg', 'UnicornEgg'],
  gifts: ['LikeGoalLootbox', '2026LootBox', 'CastleLootbox']
};

// Giveaway item categories (for /setupgiveaway)
const giveawayItemCategories = {
  diamonds: [],
  huges: {
    'Black Hole Huges': ['HugeBlackHoleAngelus', 'HugeRainbowBlackHoleAngelus'],
    'Snow Globe Huges': ['HugeSnowGlobeHamster', 'HugeRainbowSnowGlobeHamster', 'HugeSnowGlobeCat', 'HugeRainbowSnowGlobeCat'],
    'Ice Cube Huges': ['HugeIceCubeGingerbreadCorgi', 'HugeRainbowIceCubeGingerbreadCorgi', 'HugeIceCubeCookieCutCat', 'HugeRainbowIceCubeCookieCutCat'],
    'Jelly Huges': ['HugeJellyDragon', 'HugeRainbowJellyDragon', 'HugeJellyKitsune', 'HugeRainbowJellyKitsune'],
    'Blazing Huges': ['HugeBlazingShark', 'HugeRainbowBlazingShark', 'HugeBlazingBat', 'HugeRainbowBlazingBat'],
    'Unicorn Huges': ['HugeElectricUnicorn', 'HugeRainbowElectricUnicorn'],
    'Event Huges': ['HugePartyCat', 'HugeGoldenPartyCat', 'HugeRainbowPartyCat', 'HugePartyDragon', 'HugeGoldenPartyDragon', 'HugeRainbowPartyDragon', 'HugeHellRock', 'HugeGoldenHellRock', 'HugeRainbowHellRock'],
    'Christmas.1 Huges': ['HugePresentChestMimic', 'HugeRainbowPresentChestMimic', 'HugeGingerbreadAngelus', 'HugeGoldenGingerbreadAngelus', 'HugeRainbowGingerbreadAngelus', 'HugeNorthPoleWolf', 'HugeGoldenNorthPoleWolf', 'HugeRainbowNorthPoleWolf'],
    'Christmas.2 Huges': ['HugeIcyPhoenix', 'HugeGoldenIcyPhoenix', 'HugeRainbowIcyPhoenix'],
    'Map Huges': ['HugeChestMimic', 'HugeGoldenChestMimic', 'HugeRainbowChestMimic', 'HugeSorcererCat', 'HugeGoldenSorcererCat', 'HugeRainbowSorcererCat', 'HugeDominusAzureus', 'HugeGoldenDominusAzureus', 'HugeRainbowDominusAzureus','HugePropellerCat', 'HugeGoldenPropellerCat', 'HugeRainbowPropellerCat', 'HugePropellerDog', 'HugeGoldenPropellerDog', 'HugeRainbowPropellerDog', 'HugeNinjaCat', 'HugeGoldenNinjaCat', 'HugeRainbowNinjaCat', 'HugeFantasyChestMimic', 'HugeGoldenFantasyChestMimic', 'HugeStormAgony', 'HugeGoldenStormAgony', 'HugeRainbowStormAgony']
  },
  exclusives: ['BlazingShark', 'BlazingGoldenShark', 'BlazingRainbowShark', 'BlazingBat', 'BlazingGoldenBat', 'BlazingRainbowBat', 'BlazingCorgi', 'BlazingGoldenCorgi', 'BlazingRainbowCorgi', 'IceCubeGingerbreadCat', 'IceCubeGoldenGingerbreadCat', 'IceCubeRainbowGingerbreadCat', 'IceCubeGingerbreadCorgi', 'IceCubeGoldenGingerbreadCorgi', 'IceCubeRainbowGingerbreadCorgi', 'IceCubeCookieCuteCat', 'IceCubeGoldenCookieCuteCat', 'IceCubeRainbowCookieCuteCat', 'SnowGlobeCat', 'SnowGlobeGoldenCat', 'SnowGlobeRainbowCat', 'SnowGlobeAxolotl', 'SnowGlobeGoldenAxolotl', 'SnowGlobeRainbowAxolotl', 'SnowGlobeHamster', 'SnowGlobeGoldenHamster', 'SnowGlobeRainbowHamster', 'JellyCat', 'JellyGoldenCat', 'JellyRainbowCat', 'JellyBunny', 'JellyGoldenBunny', 'JellyRainbowBunny', 'JellyCorgi', 'JellyGoldenCorgi', 'JellyRainbowCorgi', 'BlackHoleAxolotl', 'BlackHoleGoldenAxolotl', 'BlackHoleRainbowAxolotl', 'BlackHoleImmortuus', 'BlackHoleGoldenImmortuus', 'BlackHoleRainbowImmortuus', 'BlackHoleKitsune', 'BlackHoleGoldenKitsune', 'BlackHoleRainbowKitsune', 'MajesticUnicorn', 'StuntUnicorn', 'AnimeUnicorn'],
  eggs: ['HypeEgg', 'BlazingEgg', 'IceCubeEgg', 'SnowGlobeEgg', 'JellyEgg', 'BlackHoleEgg', 'UnicornEgg'],
  gifts: ['LikeGoalLootbox', '2026LootBox', 'CastleLootbox']
};

// Item emojis mapping - customize with your server emojis
const itemEmojis = {
  //Huges
  'HugeBlackHoleAngelus': '<:HugeBlackHoleAngelus:1462562528440615114>',
  'HugeRainbowBlackHoleAngelus': '<:HugeBlackHoleAngelus:1462579047421841460>',
  'HugeSnowGlobeHamster': '<:HugeSnowGlobeHamster:1462562491753038110>',
  'HugeRainbowSnowGlobeHamster': '<:HugeRainbowSnowGlobeHamster:1462579018422292637>',
  'HugeSnowGlobeCat': '<:HugeSnowGlobeCat:1462562512405921884>',
  'HugeRainbowSnowGlobeCat': '<:HugeRainbowSnowGlobeCat:1462579034708902104>',
  'HugeIceCubeGingerbreadCorgi': '<:HugeIceCubeGingerbreadCorgi:1462562531741794629>',
  'HugeRainbowIceCubeGingerbreadCorgi': '<:HugeRainbowIceCubeGingerbreadCor:1462579051117150421>',
  'HugeIceCubeCookieCutCat': '<:HugeIceCubeCookieCutCat:1462562497755086880>',
  'HugeRainbowIceCubeCookieCutCat': '<:HugeRainbowIceCubeCookieCat:1462579024957280442>',
  'HugeJellyDragon': '<:HugeJellyDragon:1462562533406670869>',
  'HugeRainbowJellyDragon': '<:HugeRainbowJellyDragon:1462579052488687893>',
  'HugeJellyKitsune': '<:HugeJellyKitsune:1462562518911156346>',
  'HugeRainbowJellyKitsune': '<:HugeRainbowJellyKitsune:1462579039750586585>',
  'HugeBlazingShark': '<:HugeBlazingShark:1462562515753111583>',
  'HugeRainbowBlazingShark': '<:HugeRainbowBlazingShark:1462579037950967942>',
  'HugeBlazingBat': '<:HugeBlazingBat:1462562523302727777>',
  'HugeRainbowBlazingBat': '<:HugeRainbowBlazingBat:1462579043990769705>',
  'HugePartyCat': '<:HugePartyCat:1462562489957879939>',
  'HugeGoldenPartyCat': '<:HugeGoldenPartyCat:1462562103993958643>',
  'HugeRainbowPartyCat': '<:HugeRainbowPartyCat:1462582059863117844>',
  'HugePartyDragon': '<:HugePartyDragon:1462562495871975487>',
  'HugeGoldenPartyDragon': '<:HugeGoldenPartyDragon:1462562493745332427>',
  'HugeRainbowPartyDragon': '<:HugeRainbowPartyDragon:1462579022327451731>',
  'HugeHellRock': '<:HugeHellRock:1462562487923642389>',
  'HugeGoldenHellRock': '<:HugeGoldenHellRock:1462562520429625649>',
  'HugeRainbowHellRock': '<:HugeRainbowHellRock:1462579020079300751>',
  'HugeNinjaCat': '<:HugeNinjaCat:1462562521784385618>',
  'HugeGoldenNinjaCat': '<:HugeGoldenNinjaCat:1462562517334360229>',
  'HugeRainbowNinjaCat': '<:HugeRainbowNinjaCat:1462579041734361130>',
  'HugePresentChestMimic': '<:HugePresentChestMimic:1462562510468157636>',
  'HugeRainbowPresentChestMimic': '<:HugeRainbowPresentChestMimic:1462579032984912025>',
  'HugeGingerbreadAngelus': '<:HugeGingerbreadAngelus:1462562501156667553>',
  'HugeGoldenGingerbreadAngelus': '<:HugeGoldenGingerbreadAngelus:1462562499739254946>',
  'HugeRainbowGingerbreadAngelus': '<:HugeRainbowGingerbreadAngelus:1462579026458837014>',
  'HugeNorthPoleWolf': '<:HugeNorthPoleWolf:1462562502767411312>',
  'HugeGoldenNorthPoleWolf': '<:HugeGoldenNorthPoleWolf:1462562504315244829>',
  'HugeRainbowNorthPoleWolf': '<:HugeRainbowNorthPoleWolf:1462579029025493084>',
  'HugeIcyPhoenix': '<:HugeIcyPhoenix:1462562507599118530>',
  'HugeGoldenIcyPhoenix': '<:HugeGoldenIcyPhoenix:1462562506106081312>',
  'HugeRainbowIcyPhoenix': '<:HugeRainbowIcyPhoenix:1462579031047409810>',
  'HugeChestMimic': '<:HugeChestMimic:1462562530265399469>',
  'HugeGoldenChestMimic': '<:HugeGoldenChestMimic:1462562105617285233>',
  'HugeRainbowChestMimic': '<:HugeRainbowChestMimic:1462579049149759649>',
  'HugeSorcererCat': '<:HugeSorcererCat:1462562514150883432>',
  'HugeGoldenSorcererCat': '<:HugeGoldenSorcererCat:1462562107307589652>',
  'HugeRainbowSorcererCat': '<:HugeRainbowSorcererCat:1462579036562784256>',
  'HugePropellerCat': '<:HugePropellerCat:1462562526704177328>',
  'HugeGoldenPropellerCat': '<:HugeGoldenPropellerCat:1462562094305247316>',
  'HugeRainbowPropellerCat': '<:HugeRainbowPropellerCat:1462579226975670405>',
  'HugePropellerDog': '<:HugePropellerDog:1462562122428055594>',
  'HugeGoldenPropellerDog': '<:HugeGoldenPropellerDog:1462562124239994890>',
  'HugeRainbowPropellerDog': '<:HugeRainbowPropellerDog:1462579055986737346>',
  'HugeDominusAzureus': '<:HugeDominusAzureus:1462562525382967420>',
  'HugeGoldenDominusAzureus': '<:HugeGoldenDominusAzureus:1462562109702279218>',
  'HugeRainbowDominusAzureus': '<:HugeRainbowDominusAzureus:1462579045844914289>',
  'HugeFantasyChestMimic': '<:HugeFantasyChestMimic:1462562120842477748>',
  'HugeGoldenFantasyChestMimic': '<:HugeGoldenFantasyChestMimic:1462562119483527209>',
  'HugeRainbowFantasyChestMimic': '<:HugeRainbowFantasyChestMimic:1462579054115946609>',

  'HugeStormAgony': '<:HugeStormAgony:1462561984598769865>',
  'HugeGoldenStormAgony': '<:HugeGoldenStormAgony:1462561986511372378>',
  'HugeRainbowStormAgony': '<:HugeRainbowStormAgony:1462579059329466610>',
  'HugeElectricUnicorn': '<:HugeElectricUnicorn:1462561982904537199>',
  'HugeRainbowElectricUnicorn': '<:HugeRainbowElectricUnicorn:1462579057353822314>',

  // Exclusives
  'BlazingShark': '<:BlazingShark:1462562761018970122>',
  'BlazingBat': '<:BlazingBat:1462562765741752524>',
  'BlazingCorgi': '<:BlazingCorgi:1462562763909107906>',
  'IceCubeGingerbreadCat': '<:IceCubeGingerbreadCat:1462562784851005525>',
  'IceCubeCookieCuteCat': '<:IceCubeCookieCuteCat:1462562786755215555>',
  'IceCubeGingerbreadCorgi': '<:IceCubeGingerbreadCorgi:1462562783655759882>',
  'SnowGlobeCat': '<:SnowGlobeCat:1462562782305189970>',
  'SnowGlobeAxolotl': '<:SnowGlobeAxolotl:1462562767126139055>',
  'SnowGlobeHamster': '<:SnowGlobeHamster:1462562769223024742>',
  'JellyCat': '<:JellyCat:1462562780535066655>',
  'JellyBunny': '<:JellyBunny:1462562778224001215>',
  'JellyCorgi': '<:JellyCorgi:1462562771135758480>',
  'BlackHoleAxolotl': '<:BlackHoleAxolotl:1462562758338941092>',
  'BlackHoleImmortuus': '<:BlackHoleImmortuus:1462562756728193298>',
  'BlackHoleKitsune': '<:BlackHoleKitsune:1462562755050733648>',
  'MajesticUnicorn': '<:MajesticUnicorn:1462579522238025868>',
  'StuntUnicorn': '<:StuntUnicorn:1462579525090279514>',
  'AnimeUnicorn': '<:AnimeUnicorn:1462579526801555456>',

  // Eggs
  'HypeEgg': '<:HypeEgg:1462562750076157952>',
  'BlazingEgg': '<:BlazingEgg:1462562117097099385>',
  'IceCubeEgg': '<:IceCubeEgg:1462562536762380482>',
  'SnowGlobeEgg': '<:SnowGlobeEgg:1462562538792161300>',
  'JellyEgg': '<:JellyEgg:1462562751963463772>',
  'BlackHoleEgg': '<:BlackHoleEgg:1462562753431736474>',
  'UnicornEgg': '<:UnicornEgg:1462563572180713585>',

  // Gifts
  'LikeGoalLootbox': '<:LikeGoalLootbox:1462562535105495213>',
  '2026LootBox': '<:2026LootBox:1462562111711350865>',
  'CastleLootbox': '<:CastleLootbox:1462562114878046361>',
};

// Helper functions
function getItemEmoji(itemName) {
  return itemEmojis[itemName] || undefined;
}

function formatItemName(itemName) {
  // Convert "HugeBlackHoleAngelus" to "Huge Black Hole Angelus"
  return itemName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert space between lowercase and uppercase
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // Insert space between multiple capitals
    .trim();
}

function formatItemsText(items) {
  // Format items with emoji and name
  if (!items || items.length === 0) return 'None';
  
  const text = items.map(item => {
    if (typeof item === 'object') {
      // Special handling for Diamonds - use formatBid for abbreviations
      if (item.name === '💎 Diamonds') {
        const abbreviatedValue = formatBid(item.quantity);
        return `💎 **Diamonds** (**${abbreviatedValue} 💎**)`;
      }
      
      const emoji = getItemEmoji(item.name) || '';
      const formattedName = formatItemName(item.name);
      return `${emoji} **${formattedName}** (**x${item.quantity}**)`;
    } else {
      const emoji = getItemEmoji(item) || '';
      const formattedName = formatItemName(item);
      return `${emoji} **${formattedName}**`;
    }
  }).join('\n');

  // Truncate if too long for Discord embed field (4096 limit)
  if (text.length > 4000) {
    return text.substring(0, 4000) + '...';
  }
  return text;
}

// Helper function to format items list with emoji and abbreviations
function formatItemsList(items) {
  if (!items || items.length === 0) return 'None';
  
  return items.map(item => {
    // Special handling for Diamonds - use formatBid for abbreviations
    if (item.name === '💎 Diamonds') {
      const abbreviatedValue = formatBid(item.quantity);
      return `💎 **Diamonds** (${abbreviatedValue} 💎)`;
    }
    
    const emoji = getItemEmoji(item.name) || '';
    const formattedName = formatItemName(item.name);
    return `${emoji} **${formattedName}** (x${item.quantity})`;
  }).join('\n');
}

// Helper function to paginate items for trade offer (max 10 items per page to avoid embed overflow)
function paginateTradeItems(items, page = 1, itemsPerPage = 10) {
  if (!items || items.length === 0) {
    return { items: [], page: 1, totalPages: 1, text: 'None' };
  }
  
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const validPage = Math.max(1, Math.min(page, totalPages));
  const start = (validPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = items.slice(start, end);
  
  const text = pageItems.map(item => {
    if (item.name === '💎 Diamonds') {
      const abbreviatedValue = formatBid(item.quantity);
      return `💎 **Diamonds** (${abbreviatedValue} 💎)`;
    }
    
    const emoji = getItemEmoji(item.name) || '';
    const formattedName = formatItemName(item.name);
    return `${emoji} **${formattedName}** (x${item.quantity})`;
  }).join('\n');
  
  return { 
    items: pageItems, 
    page: validPage, 
    totalPages: totalPages,
    text: text,
    hasMultiplePages: totalPages > 1
  };
}

// Function to detect and log when items are lost between selection and posting
function validateItemsNotLost(interaction, operationType, expectedCount, actualItems) {
  if (expectedCount > 0 && (!actualItems || actualItems.length === 0)) {
    // Items were lost! Send critical log
    const errorMessage = `🚨 **ITEM LOSS DETECTED** 🚨\n` +
      `**User:** <@${interaction.user.id}> (${interaction.user.id})\n` +
      `**Operation:** ${operationType}\n` +
      `**Expected Items:** ${expectedCount}\n` +
      `**Actual Items:** 0\n` +
      `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
      `**Guild:** ${interaction.guild?.name} (${interaction.guild?.id})\n` +
      `**Channel:** ${interaction.channel?.name} (${interaction.channel?.id})\n` +
      `\n**Possible Cause:** Items array was cleared or deleted before posting embed`;
    
    // Log to console with red color indicator
    console.error(`\n❌ CRITICAL: Item Loss Detected for user ${interaction.user.id} in ${operationType}\n`);
    console.error(`Expected: ${expectedCount}, Got: 0\n`);
    
    // Send to error log channel
    const errorLogChannelId = '1462804742366298112';
    const client = interaction.client;
    if (client && errorLogChannelId) {
      const errorLogChannel = client.channels.cache.get(errorLogChannelId);
      if (errorLogChannel) {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🚨 Critical: Item Loss Detected')
          .setDescription(errorMessage)
          .setFooter({ text: `Timestamp: ${Date.now()}` });
        
        errorLogChannel.send({ embeds: [embed] }).catch(err => {
          console.error('Failed to send item loss log:', err);
        });
      }
    }
    
    return false;
  }
  return true;
}

// Helper function to add fields safely to embed (prevents invalid fields)
// Tracking for addFieldSafely errors
const addFieldSafelyErrors = [];
const MAX_ERROR_LOG_SIZE = 100;

// Helper function to safely add fields to embed with comprehensive error logging
function addFieldSafely(embed, name, value, inline = false) {
  const timestamp = Date.now();
  const errorContext = {
    timestamp: timestamp,
    date: new Date(timestamp).toISOString(),
    name: name,
    value: value,
    inline: inline,
    errors: []
  };

  try {
    // Validate field name
    if (!name || name.toString().trim() === '') {
      const errorMsg = 'Field name is empty or invalid';
      errorContext.errors.push({
        type: 'INVALID_NAME',
        message: errorMsg,
        value: name
      });
      console.warn(`[addFieldSafely] ${errorMsg}`, { name, value });
      return false;
    }

    // Validate field value
    let sanitizedValue = value;
    if (!value || value.toString().trim() === '') {
      sanitizedValue = 'None';
      errorContext.errors.push({
        type: 'EMPTY_VALUE',
        message: 'Field value was empty, using default "None"',
        originalValue: value
      });
    }

    // Convert to string and validate type
    try {
      sanitizedValue = sanitizedValue.toString();
    } catch (typeError) {
      errorContext.errors.push({
        type: 'TYPE_CONVERSION_ERROR',
        message: `Failed to convert value to string: ${typeError.message}`,
        originalValue: value,
        error: typeError.message
      });
      console.error(`[addFieldSafely] Type conversion error`, { name, value, error: typeError.message });
      return false;
    }

    // Truncate to Discord limits
    const originalNameLength = name.toString().length;
    const originalValueLength = sanitizedValue.length;
    
    name = name.toString().substring(0, 256);
    sanitizedValue = sanitizedValue.substring(0, 1024);

    if (originalNameLength > 256 || originalValueLength > 1024) {
      errorContext.errors.push({
        type: 'TRUNCATED',
        message: 'Field was truncated to Discord limits',
        originalNameLength: originalNameLength,
        truncatedNameLength: name.length,
        originalValueLength: originalValueLength,
        truncatedValueLength: sanitizedValue.length
      });
      console.warn(`[addFieldSafely] Field truncated to Discord limits`, {
        name: name.substring(0, 50) + '...',
        originalNameLen: originalNameLength,
        originalValueLen: originalValueLength
      });
    }

    // Try to add field
    try {
      embed.addFields({ name, value: sanitizedValue, inline });
      
      // Log if there were warnings but success
      if (errorContext.errors.length > 0) {
        console.log(`[addFieldSafely] Field added with warnings:`, {
          name: name.substring(0, 50),
          warnings: errorContext.errors.length
        });
      }
      
      return true;
    } catch (embedError) {
      errorContext.errors.push({
        type: 'EMBED_ADD_FAILED',
        message: `EmbedBuilder.addFields() failed: ${embedError.message}`,
        error: embedError.message,
        stack: embedError.stack
      });
      
      // Log to console with full context
      console.error(`[addFieldSafely] CRITICAL: Failed to add field to embed`, {
        name: name.substring(0, 100),
        value: sanitizedValue.substring(0, 100),
        inline: inline,
        error: embedError.message,
        errorCode: embedError.code
      });
      
      // Add to error tracking
      addFieldSafelyErrors.push(errorContext);
      if (addFieldSafelyErrors.length > MAX_ERROR_LOG_SIZE) {
        addFieldSafelyErrors.shift();
      }
      
      return false;
    }
  } catch (unexpectedError) {
    errorContext.errors.push({
      type: 'UNEXPECTED_ERROR',
      message: `Unexpected error in addFieldSafely: ${unexpectedError.message}`,
      error: unexpectedError.message,
      stack: unexpectedError.stack
    });
    
    console.error(`[addFieldSafely] UNEXPECTED ERROR`, {
      name: String(name).substring(0, 50),
      error: unexpectedError.message,
      stack: unexpectedError.stack
    });
    
    addFieldSafelyErrors.push(errorContext);
    if (addFieldSafelyErrors.length > MAX_ERROR_LOG_SIZE) {
      addFieldSafelyErrors.shift();
    }
    
    return false;
  }
}

// Function to get addFieldSafely error logs
function getAddFieldErrors() {
  return {
    total: addFieldSafelyErrors.length,
    errors: addFieldSafelyErrors,
    summary: {
      invalidNames: addFieldSafelyErrors.filter(e => e.errors.some(err => err.type === 'INVALID_NAME')).length,
      emptyValues: addFieldSafelyErrors.filter(e => e.errors.some(err => err.type === 'EMPTY_VALUE')).length,
      typeErrors: addFieldSafelyErrors.filter(e => e.errors.some(err => err.type === 'TYPE_CONVERSION_ERROR')).length,
      truncated: addFieldSafelyErrors.filter(e => e.errors.some(err => err.type === 'TRUNCATED')).length,
      embedFailed: addFieldSafelyErrors.filter(e => e.errors.some(err => err.type === 'EMBED_ADD_FAILED')).length,
      unexpected: addFieldSafelyErrors.filter(e => e.errors.some(err => err.type === 'UNEXPECTED_ERROR')).length
    }
  };
}

// Function to send addFieldSafely errors to Discord log channel
async function logAddFieldSafelyErrors(client) {
  try {
    const errorLog = getAddFieldErrors();
    if (errorLog.total === 0) return;

    const logChannel = await client.channels.fetch(ERROR_LOG_CHANNEL).catch(() => null);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('⚠️ addFieldSafely Error Report')
      .setDescription(`Total Errors: **${errorLog.total}**`)
      .addFields(
        { name: 'Invalid Names', value: `${errorLog.summary.invalidNames}`, inline: true },
        { name: 'Empty Values', value: `${errorLog.summary.emptyValues}`, inline: true },
        { name: 'Type Errors', value: `${errorLog.summary.typeErrors}`, inline: true },
        { name: 'Truncated Fields', value: `${errorLog.summary.truncated}`, inline: true },
        { name: 'Embed Add Failed', value: `${errorLog.summary.embedFailed}`, inline: true },
        { name: 'Unexpected Errors', value: `${errorLog.summary.unexpected}`, inline: true }
      )
      .setFooter({ text: `Last Error: ${new Date(errorLog.errors[errorLog.errors.length - 1]?.timestamp).toISOString()}` });

    // Add recent error details
    const recentErrors = errorLog.errors.slice(-5);
    if (recentErrors.length > 0) {
      const errorDetails = recentErrors.map((err, idx) => 
        `**Error ${idx + 1}**: ${err.errors.map(e => e.type).join(', ')}\n` +
        `Name: \`${err.name.substring(0, 50)}\`\n` +
        `Time: <t:${Math.floor(err.timestamp / 1000)}:F>`
      ).join('\n\n');
      
      embed.addFields({ name: 'Recent Errors (Last 5)', value: errorDetails.substring(0, 1024), inline: false });
    }

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[logAddFieldSafelyErrors] Failed to log errors:', error.message);
  }
}

// Helper function to create standard embed footer and thumbnail
function getStandardEmbedFooter() {
  return {
    text: 'Version 1.1.3 | Made By Atlas'
  };
}

function getStandardThumbnail() {
  return 'https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hc=0e79de3b74f088fb71edf1e20ae0df9f&ct=1704729600';
}

// Helper function to check if user has admin role
function hasAdminRole(member) {
  const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
  return member.roles.cache.some(role => adminRoles.includes(role.id));
}

// Helper function to create category select menu
function createCategorySelectMenu(customId, placeholder = 'Select item category') {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions([
      { label: 'Diamonds', value: 'diamonds', emoji: '💎' },
      { label: 'Huges', value: 'huges', emoji: '🔥' },
      { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
      { label: 'Eggs', value: 'eggs', emoji: '🥚' },
      { label: 'Gifts', value: 'gifts', emoji: '🎁' }
    ]);
}

// Helper function to create huge subcategory select menu
function createHugeSubcategorySelectMenu(customId) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Select a Huge subcategory')
    .addOptions(Object.keys(itemCategories.huges).map(sub => ({
      label: sub,
      value: sub
    })));
}

// Helper function to create item select menu
function createItemSelectMenu(customId, items, placeholder = 'Select items', maxValues = 25) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMaxValues(Math.min(items.length, maxValues))
    .addOptions(items.map(item => ({ 
      label: formatItemName(item), 
      value: item,
      emoji: getItemEmoji(item)
    })));
}

// Helper function to create diamonds modal
function createDiamondsModal(customId, title = 'Add Diamonds') {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title);

  const diamondsInput = new TextInputBuilder()
    .setCustomId(`${customId}_diamonds_input`)
    .setLabel('Amount of Diamonds')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 5000, 10K, 1M')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(diamondsInput);
  modal.addComponents(row);
  
  return modal;
}

// Helper function to create quantity selection modal
function createQuantityModal(customId, itemCount) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Select Quantities');

  const quantitiesInput = new TextInputBuilder()
    .setCustomId('quantities')
    .setLabel(`Quantities for ${itemCount} items (comma separated)`)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('1,1,1... (one per item)')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(quantitiesInput);
  modal.addComponents(row);
  
  return modal;
}

// Helper function to create continue selection menu
function createContinueSelectMenu(customId, confirmLabel = '✅ Confirm') {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('What would you like to do?')
    .addOptions([
      { label: confirmLabel, value: 'confirm' },
      { label: '➕ Add Another Category', value: 'add_category' },
      { label: '❌ Remove Items', value: 'remove_items' }
    ]);
}

// Save data every 5 minutes and reload without losing active embeds
setInterval(async () => {
  await saveAndReloadData();
}, 5 * 60 * 1000);

async function saveAndReloadData() {
  try {
    console.log('Starting auto save and reload...');
    
    // First, save current data
    await saveData();
    
    // Store current active data before loading
    const currentTrades = new Map(trades);
    const currentAuctions = new Map(auctions);
    const currentGiveaways = new Map(giveaways);
    const currentInventories = new Map(inventories);
    const currentUserTradeCount = new Map(userTradeCount);
    const currentUserGiveawayCount = new Map(userGiveawayCount);
    const currentFinishedAuctions = new Map(finishedAuctions);
    const currentFinishedGiveaways = new Map(finishedGiveaways);
    
    // Load data from Redis
    await loadData();
    
    // Merge data - keep current active data, only add missing data
    // For trades, auctions, giveaways - keep current active ones, add any missing from Redis
    for (const [key, value] of currentTrades) {
      if (!trades.has(key)) {
        trades.set(key, value);
      }
    }
    
    for (const [key, value] of currentAuctions) {
      if (!auctions.has(key)) {
        auctions.set(key, value);
      }
    }
    
    for (const [key, value] of currentGiveaways) {
      if (!giveaways.has(key)) {
        giveaways.set(key, value);
      }
    }
    
    // For inventories, user counts, and finished items - merge both ways
    for (const [key, value] of currentInventories) {
      if (!inventories.has(key)) {
        inventories.set(key, value);
      }
    }
    
    for (const [key, value] of currentUserTradeCount) {
      if (!userTradeCount.has(key)) {
        userTradeCount.set(key, value);
      }
    }
    
    for (const [key, value] of currentUserGiveawayCount) {
      if (!userGiveawayCount.has(key)) {
        userGiveawayCount.set(key, value);
      }
    }
    
    for (const [key, value] of currentFinishedAuctions) {
      if (!finishedAuctions.has(key)) {
        finishedAuctions.set(key, value);
      }
    }
    
    for (const [key, value] of currentFinishedGiveaways) {
      if (!finishedGiveaways.has(key)) {
        finishedGiveaways.set(key, value);
      }
    }
    
    console.log('Auto save and reload completed successfully - active embeds preserved');
    
  } catch (error) {
    console.error('Error in auto save and reload:', error);
  }
}

async function saveData() {
  try {
    // Save inventories
    const inventoriesData = JSON.stringify(Array.from(inventories.entries()));
    redisClient.set('INVENTORYSAVES', inventoriesData);

    // Save trades
    const tradesData = JSON.stringify(Array.from(trades.entries()));
    redisClient.set('TRADESAVES', tradesData);

    // Save giveaways
    const giveawaysData = JSON.stringify(Array.from(giveaways.entries()));
    redisClient.set('GIVEAWAYSAVES', giveawaysData);

    // Save auctions
    const auctionsData = JSON.stringify(Array.from(auctions.entries()));
    redisClient.set('AUCTIONSAVES', auctionsData);

    // Save finished auctions
    const finishedAuctionsData = JSON.stringify(Array.from(finishedAuctions.entries()));
    redisClient.set('FINISHEDAUCTIONSAVES', finishedAuctionsData);

    // Save finished giveaways
    const finishedGiveawaysData = JSON.stringify(Array.from(finishedGiveaways.entries()));
    redisClient.set('FINISHEDGIVEAWAYSAVES', finishedGiveawaysData);

    // Save user counts
    const userTradeCountData = JSON.stringify(Array.from(userTradeCount.entries()));
    redisClient.set('USERTRADECOUNTSAVES', userTradeCountData);

    const userGiveawayCountData = JSON.stringify(Array.from(userGiveawayCount.entries()));
    redisClient.set('USERGIVEAWAYCOUNTSAVES', userGiveawayCountData);

    // Save suspensions
    const suspensionsData = JSON.stringify(Array.from(userSuspensions.entries()));
    redisClient.set('SUSPENSIONSAVES', suspensionsData);

    // Save suspension embeds
    const suspensionEmbedsData = JSON.stringify(Array.from(suspensionEmbeds.entries()));
    redisClient.set('SUSPENSIONEMBEDSSAVES', suspensionEmbedsData);

    // Save redirects
    const redirectsData = JSON.stringify({
      redirectChannelId,
      redirectTradeChannelId,
      redirectInventoryChannelId,
      redirectGiveawayChannelId
    });
    redisClient.set('REDIRECTSAVES', redirectsData);

    console.log('Data saved to Redis successfully');

    // Send detailed save report to admin channel
    try {
      const adminChannelId = '1461719381619904524';
      const channel = client.channels.cache.get(adminChannelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('💾 Save System - Report')
          .setColor('#00FF00')
          .setTimestamp()
          .setDescription('**Data successfully saved to Railway Redis**')
          .addFields(
            { name: '📦 Inventories', value: `${inventories.size} inventories saved`, inline: true },
            { name: '🔄 Trades', value: `${trades.size} active trades saved`, inline: true },
            { name: '🎉 Giveaways', value: `${giveaways.size} active giveaways saved`, inline: true },
            { name: '🏆 Auctions', value: `${auctions.size} active auctions saved`, inline: true },
            { name: '✅ Finished Auctions', value: `${finishedAuctions.size} finished auctions saved`, inline: true },
            { name: '🎁 Finished Giveaways', value: `${finishedGiveaways.size} finished giveaways saved`, inline: true },
            { name: '👥 Trade Counters', value: `${userTradeCount.size} users with trade counters`, inline: true },
            { name: '🎊 Giveaway Counters', value: `${userGiveawayCount.size} users with giveaway counters`, inline: true },
            { name: '⚠️ Suspensions', value: `${userSuspensions.size} active suspensions saved`, inline: true },
            { name: '🔧 Settings', value: `Redirects saved`, inline: true }
          )
          .setFooter({ text: 'Next automatic save in 5 minutes' });

        await channel.send({ embeds: [embed] });
      }
    } catch (embedError) {
      console.error('Error sending save report embed:', embedError);
    }
  } catch (error) {
    console.error('Error saving data to Redis:', error);
  }
}

async function loadData() {
  try {
    // Load inventories
    const inventoriesData = await redisClient.get('INVENTORYSAVES');
    if (inventoriesData) {
      const parsed = JSON.parse(inventoriesData);
      parsed.forEach(([key, value]) => {
        inventories.set(key, value);
      });
    }

    // Load trades
    const tradesData = await redisClient.get('TRADESAVES');
    if (tradesData) {
      const parsed = JSON.parse(tradesData);
      parsed.forEach(([key, value]) => {
        trades.set(key, value);
      });
    }

    // Load giveaways
    const giveawaysData = await redisClient.get('GIVEAWAYSAVES');
    if (giveawaysData) {
      const parsed = JSON.parse(giveawaysData);
      parsed.forEach(([key, value]) => {
        giveaways.set(key, value);
      });
    }

    // Load auctions
    const auctionsData = await redisClient.get('AUCTIONSAVES');
    if (auctionsData) {
      const parsed = JSON.parse(auctionsData);
      parsed.forEach(([key, value]) => {
        auctions.set(key, value);
      });
    }

    // Load finished auctions
    const finishedAuctionsData = await redisClient.get('FINISHEDAUCTIONSAVES');
    if (finishedAuctionsData) {
      const parsed = JSON.parse(finishedAuctionsData);
      parsed.forEach(([key, value]) => {
        finishedAuctions.set(key, value);
      });
    }

    // Load finished giveaways
    const finishedGiveawaysData = await redisClient.get('FINISHEDGIVEAWAYSAVES');
    if (finishedGiveawaysData) {
      const parsed = JSON.parse(finishedGiveawaysData);
      parsed.forEach(([key, value]) => {
        finishedGiveaways.set(key, value);
      });
    }

    // Load user counts
    const userTradeCountData = await redisClient.get('USERTRADECOUNTSAVES');
    if (userTradeCountData) {
      const parsed = JSON.parse(userTradeCountData);
      parsed.forEach(([key, value]) => {
        userTradeCount.set(key, value);
      });
    }

    const userGiveawayCountData = await redisClient.get('USERGIVEAWAYCOUNTSAVES');
    if (userGiveawayCountData) {
      const parsed = JSON.parse(userGiveawayCountData);
      parsed.forEach(([key, value]) => {
        userGiveawayCount.set(key, value);
      });
    }

    // Load redirects
    const redirectsData = await redisClient.get('REDIRECTSAVES');
    if (redirectsData) {
      const parsed = JSON.parse(redirectsData);
      if (parsed.redirectChannelId) redirectChannelId = parsed.redirectChannelId;
      if (parsed.redirectTradeChannelId) redirectTradeChannelId = parsed.redirectTradeChannelId;
      if (parsed.redirectInventoryChannelId) redirectInventoryChannelId = parsed.redirectInventoryChannelId;
      if (parsed.redirectGiveawayChannelId) redirectGiveawayChannelId = parsed.redirectGiveawayChannelId;
    }

    // Load suspensions
    const suspensionsData = await redisClient.get('SUSPENSIONSAVES');
    if (suspensionsData) {
      const parsed = JSON.parse(suspensionsData);
      parsed.forEach(([key, value]) => {
        userSuspensions.set(key, value);
      });
    }

    // Load suspension embeds
    const suspensionEmbedsData = await redisClient.get('SUSPENSIONEMBEDSSAVES');
    if (suspensionEmbedsData) {
      const parsed = JSON.parse(suspensionEmbedsData);
      parsed.forEach(([key, value]) => {
        suspensionEmbeds.set(key, value);
      });
    }

    console.log('Data loaded from Redis successfully');
  } catch (e) {
    console.error('Error loading data from Redis:', e);
  }
}

client.once('clientReady', async () => {
  console.log('Auction Bot is ready!');
  await loadData();

  // Register slash commands
  const commands = [
    {
      name: 'setupauction',
      description: 'Show auction setup information'
    },
    {
      name: 'update',
      description: 'Update auction, trade, and inventory embeds'
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
    {
      name: 'setupgiveaway',
      description: 'Show giveaway setup information (admin only)'
    },
    {
      name: 'savedata',
      description: 'Manually save all bot data to Redis (admin only)'
    },
    {
      name: 'clearbotmessages',
      description: 'Delete bot messages in this channel (admin only)',
      options: [
        {
          name: 'amount',
          type: ApplicationCommandOptionType.Integer,
          description: 'Number of bot messages to delete (1-100)',
          required: true,
          min_value: 1,
          max_value: 100
        }
      ]
    },
    {
      name: 'addfieldserrors',
      description: 'View addFieldSafely error logs (admin only)'
    },
    {
      name: 'botcmds',
      description: 'View all available bot commands'
    },
    {
      name: 'botlogs',
      description: 'View bot logs with pagination (admin only)',
      options: [
        {
          name: 'type',
          type: ApplicationCommandOptionType.String,
          description: 'Filter logs by type (PROOF_SUCCESS, PROOF_ERROR, PROOF_TIMEOUT, PROOF_REMINDER, etc.)',
          required: false
        }
      ]
    },
    {
      name: 'suspend',
      description: 'Suspend a user from a specific category (admin only)',
      options: [
        {
          name: 'user',
          type: ApplicationCommandOptionType.User,
          description: 'The user to suspend',
          required: true
        },
        {
          name: 'category',
          type: ApplicationCommandOptionType.String,
          description: 'The category to suspend from',
          required: true,
          choices: [
            { name: 'Trade', value: 'TRADE' },
            { name: 'Giveaway', value: 'GIVEAWAY' },
            { name: 'Auction', value: 'AUCTION' }
          ]
        },
        {
          name: 'time',
          type: ApplicationCommandOptionType.String,
          description: 'Suspension duration (e.g., 1h, 30m, 2d)',
          required: true
        }
      ]
    },
    {
      name: 'unsuspend',
      description: 'Remove suspension from a user (admin only)',
      options: [
        {
          name: 'user',
          type: ApplicationCommandOptionType.User,
          description: 'The user to unsuspend',
          required: true
        },
        {
          name: 'category',
          type: ApplicationCommandOptionType.String,
          description: 'The category to unsuspend from',
          required: true,
          choices: [
            { name: 'Trade', value: 'TRADE' },
            { name: 'Giveaway', value: 'GIVEAWAY' },
            { name: 'Auction', value: 'AUCTION' }
          ]
        },
        {
          name: 'reason',
          type: ApplicationCommandOptionType.String,
          description: 'Reason for unsuspension',
          required: true
        }
      ]
    }
  ];

  await client.application.commands.set(commands);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Check if user is waiting to upload proof (regular or admin)
  const userProofData = waitingForProofUploads.get(message.author.id);
  const hasAttachmentOrEmbed = message.attachments.size > 0 || (message.embeds.length > 0 && message.embeds[0]?.image);
  
  // Also check if message is in a private trade channel with image attachment
  const isTradePrivateChannel = message.channel?.name?.startsWith('trade-') && hasAttachmentOrEmbed;
  
  if ((userProofData || isTradePrivateChannel) && hasAttachmentOrEmbed) {
    console.log('Proof upload detected for user:', message.author.id, 'attachments:', message.attachments.size, 'embeds:', message.embeds.length, 'proofData:', userProofData, 'isPrivateChannel:', isTradePrivateChannel);
    console.log('Channel name:', message.channel?.name, 'Channel ID:', message.channel?.id);
    try {
    let proofData = userProofData;
    
    // If no proofData but in private channel, construct it from channel info
    if (!proofData && isTradePrivateChannel) {
      const channelParts = message.channel.name.split('-');
      console.log('Parsing private channel name:', message.channel.name, 'Parts:', channelParts);
      
      if (channelParts.length === 3 && channelParts[0] === 'trade') {
        const hostId = channelParts[1];
        const guestId = channelParts[2];
        console.log('Looking for trade with hostId:', hostId, 'guestId:', guestId);
        
        // Find the trade in the trades map
        let foundTrade = null;
        for (const [msgId, trade] of trades.entries()) {
          console.log('Checking trade:', msgId, 'host:', trade.host.id, 'accepted:', trade.acceptedUser?.id);
          if (trade.host.id === hostId && trade.acceptedUser?.id === guestId) {
            foundTrade = { messageId: msgId, trade: trade };
            console.log('Found matching trade!', msgId);
            break;
          }
        }
        
        if (foundTrade) {
          proofData = {
            type: 'trade',
            tradeMessageId: foundTrade.messageId,
            hostId: hostId,
            guestId: guestId,
            channelId: foundTrade.trade.channelId,
            privateChannelId: message.channel.id,
            description: '📦Trade Completed'
          };
          console.log('Constructed proofData from private channel:', proofData);
        } else {
          console.log('No trade found with this host/guest combination');
        }
      } else {
        console.log('Channel name format invalid for trade detection');
      }
    }
    
    if (!proofData) {
      console.log('No proof data found and not in valid trade private channel');
      return;
    }
    
    let attachment = message.attachments.first();
    let imageUrl = attachment?.url;
    
    if (!attachment && message.embeds.length > 0 && message.embeds[0].image) {
      imageUrl = message.embeds[0].image.url;
      console.log('Using embed image:', imageUrl);
    }
    
    if (!imageUrl) {
      console.log('No image found');
      return message.reply({ content: '⚠️ No image found. Please attach or embed an image.' });
    }

    // Verify it's an image
    const isImage = !attachment ? true : (attachment.contentType && attachment.contentType.startsWith('image/') || 
                   attachment.name && (attachment.name.toLowerCase().endsWith('.png') || attachment.name.toLowerCase().endsWith('.jpg') || attachment.name.toLowerCase().endsWith('.jpeg') || attachment.name.toLowerCase().endsWith('.gif')));
    if (!isImage) {
      const errorType = proofData?.type || 'unknown';
      botLogs.addLog('PROOF_ERROR', 'Invalid file type for proof upload', message.author.id, { type: errorType, contentType: attachment?.contentType, name: attachment?.name });
      return message.reply({ content: `⚠️ Please upload a valid image file (PNG, JPG, JPEG, GIF). | Error (E56)` });
    }

    const guild = message.guild;
    let proofChannel = null;
    let proofEmbed = null;
    let originalMessageId = null;
    const isAdminUpload = !!message.author.waitingForAdminProof;

    if (proofData.type === 'trade') {
      const tradeProofChannelId = '1461849745566990487';
      proofChannel = guild.channels.cache.get(tradeProofChannelId);

      if (!proofChannel) {
        waitingForProofUploads.delete(message.author.id);
        botLogs.addLog('PROOF_ERROR', 'Trade proof channel not found', message.author.id);
        return message.reply({ content: `⚠️ ${ERROR_CODES['E57']} | Error (E57)` });
      }

      // Get trade info
      const trade = trades.get(proofData.tradeMessageId);
      if (!trade) {
        waitingForProofUploads.delete(message.author.id);
        botLogs.addLog('PROOF_ERROR', 'Trade not found', message.author.id, { tradeId: proofData.tradeMessageId });
        return message.reply({ content: `⚠️ ${ERROR_CODES['E58']} | Error (E58)` });
      }

      originalMessageId = proofData.tradeMessageId;

      // Create proof embed
      proofEmbed = new EmbedBuilder()
        .setTitle('🔄 Trade Proof')
        .setDescription(`**Trade ID:** ${proofData.tradeMessageId}\n**Host:** <@${trade.host.id}>\n**Guest:** <@${trade.acceptedUser.id}>\n\n**Note:** ${proofData.description || '📦Trade Completed'}${isAdminUpload ? '\n\n**Uploaded by Admin:** ' + message.author.username : ''}`)
        .setColor(0x0099ff)
        .setImage(imageUrl)
        .setFooter({ text: `Submitted by ${message.author.displayName}` })
        .setTimestamp();
    } else if (proofData.type === 'auction') {
      const auctionProofChannelId = '1461849894615646309';
      proofChannel = guild.channels.cache.get(auctionProofChannelId);

      if (!proofChannel) {
        waitingForProofUploads.delete(message.author.id);
        botLogs.addLog('PROOF_ERROR', 'Auction proof channel not found', message.author.id);
        return message.reply({ content: `⚠️ ${ERROR_CODES['E59']} | Error (E59)` });
      }

      // Get auction info from finishedAuctions Map
      const auctionData = finishedAuctions.get(proofData.auctionProofMessageId);
      
      if (!auctionData) {
        waitingForProofUploads.delete(message.author.id);
        botLogs.addLog('PROOF_ERROR', 'Auction not found', message.author.id, { auctionId: proofData.auctionProofMessageId });
        return message.reply({ content: `⚠️ ${ERROR_CODES['E60']} | Error (E60)` });
      }

      originalMessageId = proofData.auctionProofMessageId;

      // Create proof embed for auction
      proofEmbed = new EmbedBuilder()
        .setTitle('🎪 Auction Proof')
        .setDescription(`**Title:** ${auctionData.title}\n**Host:** ${auctionData.host}\n**Winner:** ${auctionData.winner}\n**Bid:** ${formatBid(auctionData.diamonds)} 💎\n\n**Note:** ${proofData.description || '📦Trade Completed'}${isAdminUpload ? '\n\n**Uploaded by Admin:** ' + message.author.username : ''}`)
        .setColor(0x00ff00)
        .setImage(imageUrl)
        .setFooter({ text: `Submitted by ${message.author.displayName}` })
        .setTimestamp();
    } else if (proofData.type === 'giveaway') {
      const giveawayProofChannelId = '1462197194646880368';
      proofChannel = guild.channels.cache.get(giveawayProofChannelId);

      if (!proofChannel) {
        waitingForProofUploads.delete(message.author.id);
        botLogs.addLog('PROOF_ERROR', 'Giveaway proof channel not found', message.author.id);
        return message.reply({ content: `⚠️ ${ERROR_CODES['E61']} | Error (E61)` });
      }

      // Get giveaway info from finishedGiveaways Map
      const giveawayData = finishedGiveaways.get(proofData.giveawayProofMessageId);
      
      if (!giveawayData) {
        waitingForProofUploads.delete(message.author.id);
        botLogs.addLog('PROOF_ERROR', 'Giveaway not found', message.author.id, { giveawayId: proofData.giveawayProofMessageId });
        return message.reply({ content: `⚠️ ${ERROR_CODES['E62']} | Error (E62)` });
      }

      originalMessageId = proofData.giveawayProofMessageId;

      // Create proof embed for giveaway
      proofEmbed = new EmbedBuilder()
        .setTitle('🎁 Giveaway Proof')
        .setDescription(`**Host:** ${giveawayData.host}\n**Winner:** ${giveawayData.winner}\n\n**Note:** ${proofData.description || '📦Trade Completed'}`)
        .setColor(0xFF1493)
        .setImage(imageUrl)
        .setFooter({ text: `Submitted by ${message.author.displayName}` })
        .setTimestamp();
    } else {
      waitingForProofUploads.delete(message.author.id);
      botLogs.addLog('PROOF_ERROR', 'Invalid proof type', message.author.id, { type: proofData.type });
      return message.reply({ content: `⚠️ ${ERROR_CODES['E63']} | Error (E63)` });
    }

    // Send to proof channel with image attachment
    let imageBuffer;
    let fileName = 'proof.png';
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error('Failed to fetch image');
      imageBuffer = await imageResponse.arrayBuffer();
      if (attachment && attachment.name) {
        fileName = attachment.name;
      }
    } catch (fetchError) {
      console.error('Error fetching image:', fetchError);
      botLogs.addLog('PROOF_ERROR', 'Failed to download proof image', message.author.id, { error: fetchError.message });
      return message.reply({ content: '⚠️ Failed to download the image. Please try uploading again.' });
    }
    const imageFile = {
      attachment: Buffer.from(imageBuffer),
      name: fileName
    };
    
    const proofMessage = await proofChannel.send({ 
      embeds: [proofEmbed.setImage(`attachment://${imageFile.name}`)], 
      files: [imageFile] 
    }).catch(sendError => {
      console.error('Error sending proof message:', sendError);
      botLogs.addLog('PROOF_ERROR', 'Failed to send proof message', message.author.id, { error: sendError.message });
      throw new Error('Failed to send proof');
    });
    
    const newImageUrl = proofMessage.attachments.first()?.url;
    
    // Update the original embed with thumbnail
    try {
      const channel = guild.channels.cache.get(proofData.channelId || (proofData.type === 'trade' ? (trades.get(originalMessageId)?.channelId) : null));
      if (channel && originalMessageId) {
        const originalMessage = await channel.messages.fetch(originalMessageId).catch(() => null);
        if (originalMessage && originalMessage.embeds.length > 0) {
          const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
            .setThumbnail(newImageUrl || attachment.url);
          
          await originalMessage.edit({ embeds: [updatedEmbed] });
          botLogs.addLog('PROOF_SUCCESS', `Proof image added with thumbnail${isAdminUpload ? ' (admin upload)' : ''}`, message.author.id, { type: proofData.type });
        }
      }
    } catch (e) {
      console.error('Error updating original embed with thumbnail:', e);
      botLogs.addLog('PROOF_ERROR', 'Failed to update original embed', message.author.id, { error: e.message });
    }

    // Send a new message in the private channel with delete button
    try {
      const privateChannel = guild.channels.cache.get(proofData.privateChannelId);
      if (privateChannel) {
        const deleteButton = new ButtonBuilder()
          .setCustomId(`delete_channel_${proofData.privateChannelId}`)
          .setLabel('Delete Channel')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(deleteButton);
        await privateChannel.send({ content: '✅ **Proof submitted successfully!**\n\nYou can now delete this channel.', components: [row] });
      }
    } catch (e) {
      console.error('Error sending delete button message to private channel:', e);
      botLogs.addLog('PROOF_ERROR', 'Failed to send delete button message to private channel', message.author.id, { error: e.message });
    }

    // Mark as proof uploaded and clear tracking for this message
    const tracking = proofUploadTracking.get(originalMessageId);
    if (tracking) {
      tracking.proofUploaded = true;
      if (tracking.timeout) clearTimeout(tracking.timeout);
      if (tracking.reminderIntervals) {
        tracking.reminderIntervals.forEach(id => clearInterval(id));
      }
    }
    proofUploadTracking.delete(originalMessageId);
    message.reply(`✅ Proof image has been submitted and recorded!${isAdminUpload ? ' (Admin upload)' : ''}`);
    waitingForProofUploads.delete(message.author.id);
    return;
    } catch (e) {
      console.error('Error processing proof upload:', e);
      botLogs.addLog('PROOF_ERROR', 'Failed to process proof upload', message.author.id, { error: e.message });
      message.reply({ content: '⚠️ An error occurred while processing your proof image. Please try again.' });
      waitingForProofUploads.delete(message.author.id);
    }
  }

  // Parse bid messages
  const bidRegex = /bid (\d+(?:,\d{3})*|\d+K?)(?:\s+and (.+))?/i;
  const match = message.content.match(bidRegex);
  if (match) {
    const diamondsStr = match[1];
    const items = match[2] || '';
    const diamonds = parseBid(diamondsStr);

    if (auction.model === 'items' && diamonds > 0) return message.reply('This auction is offers only.');
    if (auction.model === 'diamonds' && items) return message.reply('This auction is diamonds only.');

    // Additional check for 'both' model: if there's a previous bid with only diamonds, don't allow adding diamonds
    if (auction.model === 'both' && diamonds > 0 && auction.bids.some(bid => bid.diamonds > 0 && !bid.items)) {
      return message.reply('Since there\'s already a bid with only diamonds, you can only add items to your bid.');
    }

    // Add bid
    auction.bids.push({ user: message.author, diamonds, items });
    message.reply(`Bid placed: ${formatBid(diamonds)} 💎${items ? ` and ${items}` : ''}`);
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

// Function to start proof upload timeout
function startProofUploadTimeout(messageId, guild, proofData) {
  try {
    // Clear existing timeout if any
    if (proofUploadTracking.has(messageId)) {
      const existing = proofUploadTracking.get(messageId);
      if (existing.timeout) clearTimeout(existing.timeout);
      if (existing.reminderIntervals) {
        existing.reminderIntervals.forEach(id => clearInterval(id));
      }
    }

    const trackingData = {
      type: proofData.type,
      hostId: proofData.hostId,
      guestId: proofData.guestId,
      reminderCount: 0,
      reminderTimestamp: Date.now()
    };

    proofUploadTracking.set(messageId, trackingData);

    // Set timeout for 3 minutes
    const timeoutId = setTimeout(async () => {
      try {
        const tracking = proofUploadTracking.get(messageId);
        if (!tracking || tracking.proofUploaded) return;

        // Mark as trade not completed - change color to red and remove buttons, add admin upload button
        let trade, channel, message;
        
        if (proofData.type === 'trade') {
          trade = trades.get(messageId);
          if (trade) {
            channel = guild.channels.cache.get(trade.channelId);
            if (channel) {
              message = await channel.messages.fetch(messageId).catch(() => null);
              if (message && message.embeds.length > 0) {
                const adminUploadButton = new ButtonBuilder()
                  .setCustomId(`admin_upload_proof_trade_${messageId}`)
                  .setLabel('Admin Upload Proof')
                  .setStyle(ButtonStyle.Danger);
                
                const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                  .setColor(0xff0000)
                  .setDescription(`**Status:** ❌ Trade Not Completed (Proof Timeout)\n\n**Host:** <@${trade.host.id}>\n**Guest:** <@${trade.acceptedUser.id}>`);
                
                await message.edit({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(adminUploadButton)] }).catch(() => null);
                botLogs.addLog('PROOF_TIMEOUT', 'Trade marked as not completed due to proof timeout', null, { tradeId: messageId });
                
                // Apply suspensions to both users
                await applySuspension(guild, trade.host.id, 'TRADE');
                await applySuspension(guild, trade.acceptedUser.id, 'TRADE');
              }
            }
          }
        } else if (proofData.type === 'auction') {
          // For auction, mark as failed and add admin upload button
          const auctionData = finishedAuctions.get(messageId);
          if (auctionData) {
            channel = guild.channels.cache.get(auctionData.channelId);
            if (channel) {
              message = await channel.messages.fetch(messageId).catch(() => null);
              if (message && message.embeds.length > 0) {
                const adminUploadButton = new ButtonBuilder()
                  .setCustomId(`admin_upload_proof_auction_${messageId}`)
                  .setLabel('Admin Upload Proof')
                  .setStyle(ButtonStyle.Danger);
                
                const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                  .setColor(0xff0000)
                  .setDescription(`**Status:** ❌ Auction Proof Not Submitted`);
                
                await message.edit({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(adminUploadButton)] }).catch(() => null);
                botLogs.addLog('PROOF_TIMEOUT', 'Auction marked as proof failed', null, { auctionId: messageId });
                
                // Apply suspensions to both users
                await applySuspension(guild, auctionData.host.id, 'AUCTION');
                const winnerId = auctionData.winner.split('<@')[1]?.split('>')[0];
                if (winnerId) await applySuspension(guild, winnerId, 'AUCTION');
              }
            }
          }
        } else if (proofData.type === 'giveaway') {
          // For giveaway, mark as failed and add admin upload button
          const giveawayData = finishedGiveaways.get(messageId);
          if (giveawayData) {
            channel = guild.channels.cache.get(giveawayData.channelId);
            if (channel) {
              message = await channel.messages.fetch(messageId).catch(() => null);
              if (message && message.embeds.length > 0) {
                const adminUploadButton = new ButtonBuilder()
                  .setCustomId(`admin_upload_proof_giveaway_${messageId}`)
                  .setLabel('Admin Upload Proof')
                  .setStyle(ButtonStyle.Danger);
                
                const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                  .setColor(0xff0000)
                  .setDescription(`**Status:** ❌ Giveaway Proof Not Submitted`);
                
                await message.edit({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(adminUploadButton)] }).catch(() => null);
                botLogs.addLog('PROOF_TIMEOUT', 'Giveaway marked as proof failed', null, { giveawayId: messageId });
                
                // Apply suspensions to both users
                await applySuspension(guild, giveawayData.host.id, 'GIVEAWAY');
                await applySuspension(guild, giveawayData.winner.id, 'GIVEAWAY');
              }
            }
          }
        }
      } catch (e) {
        console.error('Error in proof timeout:', e);
      }
      
      proofUploadTracking.delete(messageId);
    }, PROOF_UPLOAD_TIMEOUT);

    trackingData.timeout = timeoutId;

    // Set reminders (3 times, one every 3 minutes: at 3min, 6min, 9min)
    const reminderIntervals = [];
    let reminderCount = 0;
    const reminderTimes = [3 * 60 * 1000, 6 * 60 * 1000, 9 * 60 * 1000]; // 3, 6, 9 minutes

    reminderTimes.forEach((delayTime) => {
      const reminderId = setTimeout(async () => {
        try {
          reminderCount++;
          const tracking = proofUploadTracking.get(messageId);
          if (!tracking || tracking.proofUploaded) {
            return;
          }

          const channel = guild.channels.cache.get(proofData.channelId);
          if (channel) {
            const timeRemaining = Math.ceil((PROOF_UPLOAD_TIMEOUT - (Date.now() - trackingData.reminderTimestamp)) / 1000);
            const timeMinutes = Math.ceil(timeRemaining / 60);
            
            let message = `⏰ **Proof Upload Reminder (${reminderCount}/${PROOF_MAX_REMINDERS})**\n\n`;
            
            if (proofData.type === 'trade') {
              message += `<@${proofData.hostId}> and <@${proofData.guestId}>, please upload the proof image for your trade.\n\n`;
            } else {
              message += `<@${proofData.hostId}> and <@${proofData.guestId}>, please upload the proof image for your ${proofData.type}.\n\n`;
            }
            
            message += `⏱️ Time remaining: ${timeMinutes} minute${timeMinutes !== 1 ? 's' : ''}\n`;
            message += `📸 Upload the image in this channel to complete the proof.`;
            
            await channel.send(message).catch(() => null);
            botLogs.addLog('PROOF_REMINDER', `Reminder ${reminderCount}/${PROOF_MAX_REMINDERS} sent`, null, { type: proofData.type, messageId, delayMinutes: delayTime / 60000 });
          }
        } catch (e) {
          console.error('Error in reminder timeout:', e);
        }
      }, delayTime);
      
      reminderIntervals.push(reminderId);
    });

    trackingData.reminderIntervals = reminderIntervals;

  } catch (e) {
    console.error('Error starting proof upload timeout:', e);
  }
}

function parseDuration(str) {
  str = str.toString().trim().toLowerCase();
  
  // Check for time units
  const secondsMatch = str.match(/^(\d+(?:\.\d+)?)\s*s$/);
  const minutesMatch = str.match(/^(\d+(?:\.\d+)?)\s*m$/);
  const hoursMatch = str.match(/^(\d+(?:\.\d+)?)\s*h$/);
  
  let minutes = 0;
  
  if (secondsMatch) {
    const seconds = parseFloat(secondsMatch[1]);
    minutes = Math.ceil(seconds / 60);
  } else if (minutesMatch) {
    minutes = Math.ceil(parseFloat(minutesMatch[1]));
  } else if (hoursMatch) {
    minutes = Math.ceil(parseFloat(hoursMatch[1]) * 60);
  } else {
    // If no unit, assume it's minutes
    minutes = parseInt(str);
  }
  
  return minutes;
}

async function logAdminCommand(interaction, commandName) {
  const logChannel = interaction.guild.channels.cache.get('1462502375607632126');
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('Admin Command Executed')
    .setDescription(`**Command:** /${commandName}\n**User:** ${interaction.user}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
    .setColor(0xF1C40F)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setupauction') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const versionFile = require('./version.json');
      const version = versionFile.auction || '1.0.0';

      const embed = new EmbedBuilder()
        .setTitle('Auction System Setup')
        .setDescription('Welcome to the live auction system!\n\n**How it works:**\n- Auctions are held per channel to avoid conflicts.\n- Bidding can be done via text (e.g., "bid 10000") or slash commands.\n- The auction ends automatically after the set time, or can be ended early.\n- Winner is the highest bidder (diamonds first, then first bid if tie).\n\nClick the button below to create a new auction.')
        .setColor(0x00ff00)
        .setFooter({ text: `Version ${version} | Made By Atlas` })
        .setThumbnail('https://media.discordapp.net/attachments/1461506733833846958/1462497977888280819/AuctionGif_1.gif?ex=696e68e1&is=696d1761&hm=cfc43df2b6ffe3b1bcaf20feb70b5e4ce5b85c2d061aa129ffdb55f8cf3e3e6c&=&width=1593&height=902');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_auction')
            .setLabel('Create Auction')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'update') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const versionFile = require('./version.json');

        // Increment versions automatically for all categories
        const categoriesToUpdate = [
          { key: 'auction', name: 'Auction' },
          { key: 'trade', name: 'Trade' },
          { key: 'inventory', name: 'Inventory' },
          { key: 'giveaway', name: 'Giveaway' }
        ];

        let versionChanges = [];

        for (const category of categoriesToUpdate) {
          const currentVersion = versionFile[category.key] || '1.0.0';
          const newVersion = incrementVersion(currentVersion);
          
          if (updateVersionFile(category.key, newVersion)) {
            versionChanges.push(`${category.name}: ${currentVersion} → ${newVersion}`);
          } else {
            versionChanges.push(`${category.name}: Failed to update version`);
          }
        }

        // Reload version file after updates
        delete require.cache[require.resolve('./version.json')];
        const updatedVersionFile = require('./version.json');

        // Define embeds to update with their respective version keys
        const categoriesToUpdateEmbeds = [
          {
            title: 'Auction System Setup',
            color: 0x00ff00,
            description: 'Welcome to the live auction system!\n\n**How it works:**\n- Auctions are held per channel to avoid conflicts.\n- Bidding can be done via text (e.g., "bid 10000") or slash commands.\n- The auction ends automatically after the set time, or can be ended early.\n- Winner is the highest bidder (diamonds first, then first bid if tie).\n\nClick the button below to create a new auction.',
            customId: 'create_auction',
            buttonLabel: 'Create Auction',
            versionKey: 'auction'
          },
          {
            title: 'Trade System Setup',
            color: 0x0099ff,
            description: 'Welcome to the live trade system!\n\n**How it works:**\n- Create a trade offer with items or diamonds.\n- Other users can place their offers in response.\n- Host can accept or decline offers.\n- Once accepted, both users are notified.\n\nClick the button below to create a new trade.',
            customId: 'create_trade',
            buttonLabel: 'Create Trade',
            versionKey: 'trade'
          },
          {
            title: '📦 Inventory System Setup',
            color: 0x00a8ff,
            description: 'Welcome to the inventory system!\n\n**How it works:**\n- Create your personal inventory with items you have in stock.\n- Set your diamond amount and describe what you\'re looking for.\n- Optionally add your Roblox username to display your avatar.\n- Other users can see your inventory and make offers!\n- Update anytime - your previous items stay saved if you don\'t remove them.\n\nClick the button below to create or edit your inventory.',
            customId: 'create_inventory',
            buttonLabel: 'Create Inventory',
            versionKey: 'inventory'
          },
          {
            title: '🎁 Giveaway System Setup',
            color: 0xFF1493,
            description: 'Welcome to the giveaway system!\n\n**How it works:**\n- Create a giveaway with items you want to give away.\n- Users can enter the giveaway by clicking the button.\n- Winners are selected randomly from all entries.\n- The role <@&1462168024151883836> will be mentioned when the giveaway starts!\n\nClick the button below to create a new giveaway.',
            customId: 'create_giveaway',
            buttonLabel: 'Create Giveaway',
            versionKey: 'giveaway'
          }
        ];

        let updatedCount = 0;
        let failedCount = 0;

        for (const category of categoriesToUpdateEmbeds) {
          try {
            // Get updated version from version.json for this category
            const version = updatedVersionFile[category.versionKey] || '1.0.0';

            // Search for messages with this embed title in all channels
            const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
            
            for (const [, channel] of channels) {
              try {
                const messages = await channel.messages.fetch({ limit: 100 });
                
                for (const [, message] of messages) {
                  if (message.embeds.length > 0) {
                    const embed = message.embeds[0];
                    if (embed.title === category.title) {
                      // Found the embed, update it
                      const newEmbed = new EmbedBuilder()
                        .setTitle(category.title)
                        .setDescription(category.description)
                        .setColor(category.color)
                        .setFooter({ text: `Version ${version} | Made By Atlas` })
                        .setThumbnail('https://media.discordapp.net/attachments/1461506733833846958/1462497977888280819/AuctionGif_1.gif?ex=696e68e1&is=696d1761&hm=cfc43df2b6ffe3b1bcaf20feb70b5e4ce5b85c2d061aa129ffdb55f8cf3e3e6c&=&width=1593&height=902');

                      const row = new ActionRowBuilder()
                        .addComponents(
                          new ButtonBuilder()
                            .setCustomId(category.customId)
                            .setLabel(category.buttonLabel)
                            .setStyle(ButtonStyle.Primary)
                        );

                      await message.edit({ embeds: [newEmbed], components: [row] });
                      updatedCount++;
                      break; // Found and updated, move to next category
                    }
                  }
                }
              } catch (e) {
                // Continue to next channel
              }
            }
          } catch (e) {
            failedCount++;
            console.error(`Error updating ${category.title}:`, e);
          }
        }

        const updateEmbed = new EmbedBuilder()
          .setTitle('✅ Embeds Updated with New Versions')
          .setDescription(`**Update Summary:**\n- ✅ Successfully updated: ${updatedCount} embed(s)\n- ❌ Failed: ${failedCount} embed(s)\n\n**Version Changes:**\n${versionChanges.map(change => `- ${change}`).join('\n')}\n\n**Current Versions:**\n- 🎪 Auction: v${updatedVersionFile.auction || '1.0.0'}\n- 🔄 Trade: v${updatedVersionFile.trade || '1.0.0'}\n- 📦 Inventory: v${updatedVersionFile.inventory || '1.0.0'}\n- 🎁 Giveaway: v${updatedVersionFile.giveaway || '1.0.0'}`)
          .setColor(0x00ff00)
          .setFooter({ text: `Last Updated: ${updatedVersionFile.lastUpdated || new Date().toISOString()} | Made By Atlas` });

        await interaction.editReply({ embeds: [updateEmbed] });
      } catch (error) {
        console.error('Error updating embeds:', error);
        await interaction.editReply({ content: 'An error occurred while updating the embeds.' });
      }
    }

    if (commandName === 'bid') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return sendErrorReply(interaction, 'E16');

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
      if (!auction) return sendErrorReply(interaction, 'E16');
      if (auction.host.id !== interaction.user.id) return sendErrorReply(interaction, 'E02');

      clearTimeout(auction.timer);
      await endAuction(interaction.channel);
      interaction.reply('Auction ended by host.');
    }

    if (commandName === 'auctionstatus') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return sendErrorReply(interaction, 'E16');

      const embed = new EmbedBuilder()
        .setTitle('Auction Status')
        .setDescription(`Title: ${auction.title}\nDescription: ${auction.description}\nModel: ${auction.model}\nStarting Price: ${formatBid(auction.startingPrice)} 💎\nTime Left: ${Math.max(0, auction.time - Math.floor((Date.now() - auction.started) / 1000))} seconds\nBids: ${auction.bids.length}`)
        .setColor(0x0000ff);

      interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
    const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));

    if (commandName === 'deleteauction') {
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const messageId = interaction.options.getString('messageid');
      const auction = Array.from(auctions.values()).find(a => a.messageId === messageId);
      if (!auction) return sendErrorReply(interaction, 'E07', 'Auction not found');

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
      await interaction.reply({ content: `Auction "${auction.title}" (from ${auction.host}) deleted by admin.`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === 'endauctionadmin') {
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const messageId = interaction.options.getString('messageid');
      const auction = Array.from(auctions.values()).find(a => a.messageId === messageId);
      if (!auction) return sendErrorReply(interaction, 'E07', 'Auction not found');

      clearTimeout(auction.timer);
      clearInterval(auction.updateInterval);
      const channel = interaction.guild.channels.cache.get(auction.channelId);
      await endAuction(channel);
      await interaction.reply({ content: `Auction "${auction.title}" (from ${auction.host}) ended by admin.`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === 'restartauction') {
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const messageId = interaction.options.getString('messageid');
      const auction = Array.from(auctions.values()).find(a => a.messageId === messageId);
      if (!auction) return sendErrorReply(interaction, 'E07', 'Auction not found');

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
          .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
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
      interaction.reply({ content: 'Auction restarted.', flags: MessageFlags.Ephemeral });
    }

    if (commandName === 'redirectauctions') {
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const channel = interaction.options.getChannel('channel');
      if (channel.type !== 0) return sendErrorReply(interaction, 'E49', 'Please select a text channel');
      redirectChannelId = channel.id;
      interaction.reply({ content: `All future auctions will be redirected to ${channel}.`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === 'redirecttrade') {
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const channel = interaction.options.getChannel('channel');
      if (channel.type !== 0) return sendErrorReply(interaction, 'E49', 'Please select a text channel');
      redirectTradeChannelId = channel.id;
      interaction.reply({ content: `All future trades will be redirected to ${channel}.`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === 'redirectinventory') {
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const channel = interaction.options.getChannel('channel');
      if (channel.type !== 0) return sendErrorReply(interaction, 'E49', 'Please select a text channel');
      redirectInventoryChannelId = channel.id;
      interaction.reply({ content: `All inventories will be posted to ${channel}.`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === 'setuptrade') {
      // Check admin permission first
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      // Check trade limit
      const isAdmin = true; // Already checked admin above
      const userTradeLimit = isAdmin ? 10 : 2;
      const currentTradeCount = userTradeCount.get(interaction.user.id) || 0;

      if (currentTradeCount >= userTradeLimit) {
        return sendErrorReply(interaction, 'E81', `You have reached your trade creation limit (${userTradeLimit}). ${isAdmin ? 'As an admin, you can have up to 10 active trades.' : 'Regular users can have up to 2 active trades.'}`);
      }

      const versionFile = require('./version.json');
      const version = versionFile.trade || '1.0.0';

      const embed = new EmbedBuilder()
        .setTitle('Trade System Setup')
        .setDescription('Welcome to the live trade system!\n\n**How it works:**\n- Create a trade offer with items or diamonds.\n- Other users can place their offers in response.\n- Host can accept or decline offers.\n- Once accepted, both users are notified.\n\nClick the button below to create a new trade.')
        .setColor(0x0099ff)
        .setFooter({ text: `Version ${version} | Made By Atlas` })
        .setThumbnail('https://media.discordapp.net/attachments/1461506733833846958/1462497977888280819/AuctionGif_1.gif?ex=696e68e1&is=696d1761&hm=cfc43df2b6ffe3b1bcaf20feb70b5e4ce5b85c2d061aa129ffdb55f8cf3e3e6c&=&width=1593&height=902');

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
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const messageId = interaction.options.getString('messageid');
      const trade = trades.get(messageId);
      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');

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
      interaction.reply({ content: `Trade from ${trade.host.displayName || trade.host.username} has been deleted.`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === 'accepttrade') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const messageId = interaction.options.getString('messageid');
      const trade = trades.get(messageId);
      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');

      if (trade.offers.length > 0) {
        return sendErrorReply(interaction, 'E08');
      }

      // Mark trade as cancelled
      trade.accepted = true;
      trade.acceptedUser = null;
      trade.adminCancelled = true;

      // Update embed
      await updateTradeEmbed(interaction.guild, trade, messageId);

      const channel = interaction.guild.channels.cache.get(trade.channelId);
      await channel.send(`⚠️ This trade has been cancelled by an admin.`);

      interaction.reply({ content: `Trade has been cancelled.`, flags: MessageFlags.Ephemeral });
    }

    if (commandName === 'setupinventory') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const versionFile = require('./version.json');
      const version = versionFile.inventory || '1.0.0';

      const embed = new EmbedBuilder()
        .setTitle('📦 Inventory System Setup')
        .setDescription('Welcome to the inventory system!\n\n**How it works:**\n- Create your personal inventory with items you have in stock.\n- Set your diamond amount and describe what you\'re looking for.\n- Optionally add your Roblox username to display your avatar.\n- Other users can see your inventory and make offers!\n- Update anytime - your previous items stay saved if you don\'t remove them.\n\nClick the button below to create or edit your inventory.')
        .setColor(0x00a8ff)
        .setFooter({ text: `Version ${version} | Made By Atlas` })
        .setThumbnail('https://media.discordapp.net/attachments/1461506733833846958/1462497977888280819/AuctionGif_1.gif?ex=696e68e1&is=696d1761&hm=cfc43df2b6ffe3b1bcaf20feb70b5e4ce5b85c2d061aa129ffdb55f8cf3e3e6c&=&width=1593&height=902');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_inventory')
            .setLabel('Create Inventory')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'setupgiveaway') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const versionFile = require('./version.json');
      const version = versionFile.giveaway || '1.0.0';

      const embed = new EmbedBuilder()
        .setTitle('🎁 Giveaway System Setup')
        .setDescription('Welcome to the giveaway system!\n\n**How it works:**\n- Create a giveaway with items you want to give away.\n- Users can enter the giveaway by clicking the button.\n- Winners are selected randomly from all entries.\n- The role <@&1462168024151883836> will be mentioned when the giveaway starts!\n\nClick the button below to create a new giveaway.')
        .setColor(0xFF1493)
        .setFooter({ text: `Version ${version} | Made By Atlas` })
        .setThumbnail('https://media.discordapp.net/attachments/1461506733833846958/1462497977888280819/AuctionGif_1.gif?ex=696e68e1&is=696d1761&hm=cfc43df2b6ffe3b1bcaf20feb70b5e4ce5b85c2d061aa129ffdb55f8cf3e3e6c&=&width=1593&height=902');

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_giveaway')
            .setLabel('Create Giveaway')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'savedata') {
      // Check if user has admin role (same as other admin commands)
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      try {
        await saveData();
        await interaction.reply({ content: '✅ All bot data has been successfully saved to Redis!', flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error('Error saving data:', error);
        await sendErrorReply(interaction, 'E46');
      }
    }

    if (commandName === 'suspend') {
      // Check if user has admin role
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const targetUser = interaction.options.getUser('user');
      const category = interaction.options.getString('category');
      const timeStr = interaction.options.getString('time');

      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Check if user is already suspended for this category
        const existingSuspension = checkSuspension(targetUser.id, category.toLowerCase());
        if (existingSuspension) {
          // Add time to existing suspension
          const additionalDuration = parseDuration(timeStr);
          const remainingTime = existingSuspension.timeRemaining;
          const newDuration = remainingTime + additionalDuration;
          
          // Update suspension
          userSuspensions.set(targetUser.id, {
            type: category.toUpperCase(),
            startTime: Date.now() - (existingSuspension.duration - remainingTime),
            roleId: existingSuspension.roleId,
            duration: newDuration
          });

          // Reschedule role removal
          setTimeout(async () => {
            await removeSuspension(interaction.guild, targetUser.id);
          }, newDuration);

          await interaction.editReply({ content: `✅ Added ${formatDuration(additionalDuration)} to <@${targetUser.id}>'s existing ${category} suspension. New total remaining: ${formatDuration(newDuration)}.` });
        } else {
          // Apply new suspension
          await applySuspension(interaction.guild, targetUser.id, category, interaction.user.id, parseDuration(timeStr), `Manually suspended by admin`);
          await interaction.editReply({ content: `✅ User <@${targetUser.id}> has been suspended for ${category} activities for ${formatDuration(parseDuration(timeStr))}.` });
        }
      } catch (error) {
        console.error('Error suspending user:', error);
        await interaction.editReply({ content: '❌ An error occurred while suspending the user.' });
      }
    }

    if (commandName === 'unsuspend') {
      // Check if user has admin role
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const targetUser = interaction.options.getUser('user');
      const category = interaction.options.getString('category');
      const reason = interaction.options.getString('reason');

      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Check if user is suspended for this category
        const suspension = checkSuspension(targetUser.id, category.toLowerCase());
        if (!suspension) {
          return await interaction.editReply({ content: `❌ User <@${targetUser.id}> is not suspended for ${category.toLowerCase()} activities.` });
        }

        // Remove suspension
        const success = await manualSuspensionRemoval(interaction.guild, targetUser.id, interaction.user.id, reason);
        if (success) {
          await interaction.editReply({ content: `✅ User <@${targetUser.id}> has been unsuspended from ${category} activities.` });
        } else {
          await interaction.editReply({ content: '❌ An error occurred while uns suspending the user.' });
        }
      } catch (error) {
        console.error('Error uns suspending user:', error);
        await interaction.editReply({ content: '❌ An error occurred while uns suspending the user.' });
      }
    }

    if (commandName === 'clearbotmessages') {
      // Check if user has admin role
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E01');

      await logAdminCommand(interaction, commandName);

      const amount = interaction.options.getInteger('amount');
      
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Fetch messages from the channel
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        
        // Filter bot messages
        const botMessages = messages.filter(msg => msg.author.id === client.user.id);
        
        // Get the specified amount of bot messages
        const messagesToDelete = botMessages.first(amount);
        
        if (messagesToDelete.length === 0) {
          return sendErrorReply(interaction, 'E64');
        }
        
        // Delete the messages
        let deletedCount = 0;
        for (const message of messagesToDelete) {
          try {
            await message.delete();
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete message ${message.id}:`, error);
          }
        }
        
        await interaction.editReply({ 
          content: `✅ Successfully deleted ${deletedCount} bot message(s) out of ${amount} requested.` 
        });
        
      } catch (error) {
        console.error('Error clearing bot messages:', error);
        await interaction.editReply({ content: `⚠️ ${ERROR_CODES['E65']} | Error (E65)` });
      }
    }

    if (commandName === 'addfieldserrors') {
      if (!hasAdminRole(interaction.member)) return sendErrorReply(interaction, 'E05');
      
      await logAdminCommand(interaction, commandName);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const errorLog = getAddFieldErrors();
        
        if (errorLog.total === 0) {
          await interaction.editReply({ content: '✅ No addFieldSafely errors logged.' });
          return;
        }

        // Create embed with error summary
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('⚠️ addFieldSafely Error Report')
          .setDescription(`Total Errors Logged: **${errorLog.total}**`)
          .addFields(
            { name: 'Invalid Names', value: `${errorLog.summary.invalidNames}`, inline: true },
            { name: 'Empty Values', value: `${errorLog.summary.emptyValues}`, inline: true },
            { name: 'Type Errors', value: `${errorLog.summary.typeErrors}`, inline: true },
            { name: 'Truncated Fields', value: `${errorLog.summary.truncated}`, inline: true },
            { name: 'Embed Add Failed', value: `${errorLog.summary.embedFailed}`, inline: true },
            { name: 'Unexpected Errors', value: `${errorLog.summary.unexpected}`, inline: true }
          );

        // Add recent errors (last 3)
        const recentErrors = errorLog.errors.slice(-3);
        if (recentErrors.length > 0) {
          let errorDetails = '';
          recentErrors.forEach((err, idx) => {
            const errorTypes = err.errors.map(e => e.type).join(', ');
            const timestamp = new Date(err.timestamp).toLocaleString();
            errorDetails += `**[${idx + 1}] ${errorTypes}**\n`;
            errorDetails += `Name: \`${err.name.substring(0, 40)}\`\n`;
            errorDetails += `Time: ${timestamp}\n`;
            
            err.errors.forEach(errDetail => {
              errorDetails += `  • ${errDetail.message}\n`;
            });
            errorDetails += '\n';
          });
          
          embed.addFields({ 
            name: 'Recent Errors (Last 3)', 
            value: errorDetails.substring(0, 1024) || 'No recent errors',
            inline: false 
          });
        }

        embed.setFooter({ text: `Max logs: ${MAX_ERROR_LOG_SIZE} | Use /addfieldserrors to refresh` });

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error in addfieldserrors command:', error);
        await sendErrorReply(interaction, 'E50');
      }
    }

    if (commandName === 'botcmds') {
      const pages = [
        {
          title: '🎪 Auction Commands',
          color: 0x00ff00,
          fields: [
            { name: '/setupauction', value: 'Show auction setup information and create new auction (admin only)', inline: false },
            { name: '/bid', value: 'Place a bid on the current auction', inline: false },
            { name: '/endauction', value: 'End the current auction (host only)', inline: false },
            { name: '/auctionstatus', value: 'View current auction status', inline: false },
            { name: '/deleteauction [messageid]', value: 'Delete an auction (admin only)', inline: false },
            { name: '/endauctionadmin [messageid]', value: 'End an auction timer (admin only)', inline: false },
            { name: '/redirectauctions [channel]', value: 'Redirect all future auctions to a specific channel (admin only)', inline: false }
          ]
        },
        {
          title: '🔄 Trade Commands',
          color: 0x0099ff,
          fields: [
            { name: '/setuptrade', value: 'Show trade setup information and create new trade (admin only)', inline: false },
            { name: '/redirecttrade [channel]', value: 'Redirect all future trades to a specific channel (admin only)', inline: false },
            { name: '/deletetrade [messageid]', value: 'Delete a trade by message ID (admin only)', inline: false },
            { name: '/accepttrade [messageid]', value: 'Accept a trade by message ID (admin only)', inline: false }
          ]
        },
        {
          title: '📦 Inventory & 🎁 Giveaway Commands',
          color: 0x00a8ff,
          fields: [
            { name: '/setupinventory', value: 'Create or view your inventory (admin only)', inline: false },
            { name: '/redirectinventory [channel]', value: 'Set the channel for inventories (admin only)', inline: false },
            { name: '/setupgiveaway', value: 'Show giveaway setup and create new giveaway (admin only)', inline: false }
          ]
        },
        {
          title: '⚙️ Utility Commands',
          color: 0xffa500,
          fields: [
            { name: '/update', value: 'Update auction, trade, and inventory embeds (admin only)', inline: false },
            { name: '/savedata', value: 'Manually save all bot data to Redis (admin only)', inline: false },
            { name: '/clearbotmessages [amount]', value: 'Delete bot messages in this channel (admin only)', inline: false },
            { name: '/suspend [user] [category] [time]', value: 'Suspend a user from trades/giveaways/auctions (admin only)', inline: false },
            { name: '/unsuspend [user] [category] [reason]', value: 'Remove suspension from a user (admin only)', inline: false },
            { name: '/botcmds', value: 'View all available bot commands', inline: false }
          ]
        }
      ];

      let currentPage = 0;

      const createEmbed = (pageIndex) => {
        const page = pages[pageIndex];
        return new EmbedBuilder()
          .setTitle(page.title)
          .setColor(page.color)
          .setDescription(`Commands List (Page ${pageIndex + 1}/${pages.length})`)
          .addFields(page.fields)
          .setFooter({ text: `Page ${pageIndex + 1}/${pages.length} | Made By Atlas` })
          .setThumbnail('https://media.discordapp.net/attachments/1461506733833846958/1462497977888280819/AuctionGif_1.gif?ex=696e68e1&is=696d1761&hm=cfc43df2b6ffe3b1bcaf20feb70b5e4ce5b85c2d061aa129ffdb55f8cf3e3e6c&=&width=1593&height=902');
      };

      const createButtons = (pageIndex) => {
        const row = new ActionRowBuilder();
        
        if (pageIndex > 0) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`botcmds_prev_${pageIndex}`)
              .setLabel('← Previous')
              .setStyle(ButtonStyle.Primary)
          );
        }

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`botcmds_page`)
            .setLabel(`${pageIndex + 1}/${pages.length}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        if (pageIndex < pages.length - 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`botcmds_next_${pageIndex}`)
              .setLabel('Next →')
              .setStyle(ButtonStyle.Primary)
          );
        }

        return row;
      };

      const embed = createEmbed(currentPage);
      const buttons = createButtons(currentPage);

      await interaction.reply({ embeds: [embed], components: [buttons] });
    }

    if (commandName === 'botlogs') {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E05');

      const typeFilter = interaction.options.getString('type');
      const logs = botLogs.getLogs(typeFilter, 100); // Get up to 100 logs

      if (logs.length === 0) {
        return interaction.reply({ content: 'No logs found.', flags: MessageFlags.Ephemeral });
      }

      const ITEMS_PER_PAGE = 10;
      const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
      const descriptions = botLogs.getLogDescriptions();

      const createLogEmbed = (page) => {
        const start = page * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageLogs = logs.slice(start, end);

        const embed = new EmbedBuilder()
          .setTitle('Bot Logs')
          .setColor(0x3498db)
          .setFooter({ text: `Page ${page + 1}/${totalPages} | Total Logs: ${logs.length}` })
          .setTimestamp();

        if (typeFilter) {
          embed.setDescription(`**Filtered by type:** ${typeFilter}\n**Description:** ${descriptions[typeFilter] || 'No description available'}`);
        }

        pageLogs.forEach(log => {
          const timestamp = new Date(log.timestamp).toLocaleString('pt-BR');
          const userMention = log.userId ? `<@${log.userId}>` : 'System';
          const details = log.details && Object.keys(log.details).length > 0 ? 
            `\nDetails: ${JSON.stringify(log.details, null, 2)}` : '';

          embed.addFields({
            name: `${log.type} #${log.id}`,
            value: `**User:** ${userMention}\n**Time:** ${timestamp}\n**Message:** ${log.message}${details}`,
            inline: false
          });
        });

        return embed;
      };

      const createButtons = (page) => {
        const row = new ActionRowBuilder();
        
        if (page > 0) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`botlogs_prev_${page}`)
              .setLabel('← Previous')
              .setStyle(ButtonStyle.Primary)
          );
        }

        row.addComponents(
          new ButtonBuilder()
              .setCustomId('botlogs_page')
              .setLabel(`${page + 1}/${totalPages}`)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
        );

        if (page < totalPages - 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`botlogs_next_${page}`)
              .setLabel('Next →')
              .setStyle(ButtonStyle.Primary)
          );
        }

        return row;
      };

      let currentPage = 0;
      const embed = createLogEmbed(currentPage);
      const buttons = createButtons(currentPage);

      await interaction.reply({ embeds: [embed], components: buttons.length > 1 ? [buttons] : [] });
    }
  }

  if (interaction.isButton()) {
    // Handle botcmds pagination
    if (interaction.customId.startsWith('botcmds_')) {
      const pages = [
        {
          title: '🎪 Auction Commands',
          color: 0x00ff00,
          fields: [
            { name: '/setupauction', value: 'Show auction setup information and create new auction (admin only)', inline: false },
            { name: '/bid', value: 'Place a bid on the current auction', inline: false },
            { name: '/endauction', value: 'End the current auction (host only)', inline: false },
            { name: '/auctionstatus', value: 'View current auction status', inline: false },
            { name: '/deleteauction [messageid]', value: 'Delete an auction (admin only)', inline: false },
            { name: '/endauctionadmin [messageid]', value: 'End an auction timer (admin only)', inline: false },
            { name: '/redirectauctions [channel]', value: 'Redirect all future auctions to a specific channel (admin only)', inline: false }
          ]
        },
        {
          title: '🔄 Trade Commands',
          color: 0x0099ff,
          fields: [
            { name: '/setuptrade', value: 'Show trade setup information and create new trade (admin only)', inline: false },
            { name: '/redirecttrade [channel]', value: 'Redirect all future trades to a specific channel (admin only)', inline: false },
            { name: '/deletetrade [messageid]', value: 'Delete a trade by message ID (admin only)', inline: false },
            { name: '/accepttrade [messageid]', value: 'Accept a trade by message ID (admin only)', inline: false }
          ]
        },
        {
          title: '📦 Inventory & 🎁 Giveaway Commands',
          color: 0x00a8ff,
          fields: [
            { name: '/setupinventory', value: 'Create or view your inventory (admin only)', inline: false },
            { name: '/redirectinventory [channel]', value: 'Set the channel for inventories (admin only)', inline: false },
            { name: '/setupgiveaway', value: 'Show giveaway setup and create new giveaway (admin only)', inline: false }
          ]
        },
        {
          title: '⚙️ Utility Commands',
          color: 0xffa500,
          fields: [
            { name: '/update', value: 'Update auction, trade, and inventory embeds (admin only)', inline: false },
            { name: '/savedata', value: 'Manually save all bot data to Redis (admin only)', inline: false },
            { name: '/clearbotmessages [amount]', value: 'Delete bot messages in this channel (admin only)', inline: false },
            { name: '/suspend [user] [category] [time]', value: 'Suspend a user from trades/giveaways/auctions (admin only)', inline: false },
            { name: '/unsuspend [user] [category] [reason]', value: 'Remove suspension from a user (admin only)', inline: false },
            { name: '/botcmds', value: 'View all available bot commands', inline: false }
          ]
        }
      ];

      let currentPage = 0;
      if (interaction.customId.includes('_prev_')) {
        currentPage = parseInt(interaction.customId.split('_prev_')[1]) - 1;
      } else if (interaction.customId.includes('_next_')) {
        currentPage = parseInt(interaction.customId.split('_next_')[1]) + 1;
      }

      const createEmbed = (pageIndex) => {
        const page = pages[pageIndex];
        return new EmbedBuilder()
          .setTitle(page.title)
          .setColor(page.color)
          .setDescription(`Commands List (Page ${pageIndex + 1}/${pages.length})`)
          .addFields(page.fields)
          .setFooter({ text: `Page ${pageIndex + 1}/${pages.length} | Made By Atlas` })
          .setThumbnail('https://media.discordapp.net/attachments/1461506733833846958/1462497977888280819/AuctionGif_1.gif?ex=696e68e1&is=696d1761&hm=cfc43df2b6ffe3b1bcaf20feb70b5e4ce5b85c2d061aa129ffdb55f8cf3e3e6c&=&width=1593&height=902');
      };

      const createButtons = (pageIndex) => {
        const row = new ActionRowBuilder();
        
        if (pageIndex > 0) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`botcmds_prev_${pageIndex}`)
              .setLabel('← Previous')
              .setStyle(ButtonStyle.Primary)
          );
        }

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`botcmds_page`)
            .setLabel(`${pageIndex + 1}/${pages.length}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        if (pageIndex < pages.length - 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`botcmds_next_${pageIndex}`)
              .setLabel('Next →')
              .setStyle(ButtonStyle.Primary)
          );
        }

        return row;
      };

      const embed = createEmbed(currentPage);
      const buttons = createButtons(currentPage);

      await interaction.update({ embeds: [embed], components: [buttons] });
      return;
    }

    // Handle botlogs pagination
    if (interaction.customId.startsWith('botlogs_')) {
      const typeFilter = interaction.message.embeds[0].description?.match(/Filtered by type: (\w+)/)?.[1];
      const logs = botLogs.getLogs(typeFilter, 100);

      const ITEMS_PER_PAGE = 10;
      const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
      const descriptions = botLogs.getLogDescriptions();

      let currentPage = 0;
      if (interaction.customId.includes('_prev_')) {
        currentPage = parseInt(interaction.customId.split('_prev_')[1]) - 1;
      } else if (interaction.customId.includes('_next_')) {
        currentPage = parseInt(interaction.customId.split('_next_')[1]) + 1;
      }

      const createLogEmbed = (page) => {
        const start = page * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageLogs = logs.slice(start, end);

        const embed = new EmbedBuilder()
          .setTitle('Bot Logs')
          .setColor(0x3498db)
          .setFooter({ text: `Page ${page + 1}/${totalPages} | Total Logs: ${logs.length}` })
          .setTimestamp();

        if (typeFilter) {
          embed.setDescription(`**Filtered by type:** ${typeFilter}\n**Description:** ${descriptions[typeFilter] || 'No description available'}`);
        }

        pageLogs.forEach(log => {
          const timestamp = new Date(log.timestamp).toLocaleString('pt-BR');
          const userMention = log.userId ? `<@${log.userId}>` : 'System';
          const details = log.details && Object.keys(log.details).length > 0 ? 
            `\nDetails: ${JSON.stringify(log.details, null, 2)}` : '';

          embed.addFields({
            name: `${log.type} #${log.id}`,
            value: `**User:** ${userMention}\n**Time:** ${timestamp}\n**Message:** ${log.message}${details}`,
            inline: false
          });
        });

        return embed;
      };

      const createButtons = (page) => {
        const row = new ActionRowBuilder();
        
        if (page > 0) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`botlogs_prev_${page}`)
              .setLabel('← Previous')
              .setStyle(ButtonStyle.Primary)
          );
        }

        row.addComponents(
          new ButtonBuilder()
            .setCustomId('botlogs_page')
            .setLabel(`${page + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
          );
        
        if (page < totalPages - 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`botlogs_next_${page}`)
              .setLabel('Next →')
              .setStyle(ButtonStyle.Primary)
          );
        }

        return row;
      };

      const embed = createLogEmbed(currentPage);
      const buttons = createButtons(currentPage);

      await interaction.update({ embeds: [embed], components: buttons.length > 1 ? [buttons] : [] });
    }

    if (interaction.customId === 'bid_button') {
      // Check suspension
      const suspension = checkSuspension(interaction.user.id, 'auction');
      if (suspension) {
        const hours = Math.floor(suspension.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((suspension.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ 
          content: `❌ **Suspended from Auction Activities**\n\n**Reason:** ${suspension.reason}\n**Time Remaining:** ${hours}h ${minutes}m\n\nYou cannot bid on auctions during suspension.`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return sendErrorReply(interaction, 'E16');

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
      if (!auction) return sendErrorReply(interaction, 'E16');

      if (auction.bids.length === 0) return sendErrorReply(interaction, 'E23');

      // Sort bids by diamonds descending
      const sortedBids = auction.bids.sort((a, b) => b.diamonds - a.diamonds);

      const bidList = sortedBids.map(bid => {
        const secondsAgo = Math.floor((Date.now() - bid.timestamp) / 1000);
        let timeAgo;
        if (secondsAgo < 60) timeAgo = `${secondsAgo} seconds ago`;
        else if (secondsAgo < 3600) timeAgo = `${Math.floor(secondsAgo / 60)} minutes ago`;
        else timeAgo = `${Math.floor(secondsAgo / 3600)} hours ago`;
        return `${bid.user.username}: ${formatBid(bid.diamonds)} 💎 - ${timeAgo}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('Bid List')
        .setDescription(bidList)
        .setColor(0x00ff00)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId.startsWith('giveaway_enter_')) {
      // Check suspension
      const suspension = checkSuspension(interaction.user.id, 'giveaway');
      if (suspension) {
        const hours = Math.floor(suspension.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((suspension.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ 
          content: `❌ **Suspended from Giveaway Activities**\n\n**Reason:** ${suspension.reason}\n**Time Remaining:** ${hours}h ${minutes}m\n\nYou cannot participate in giveaways during suspension.`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      const messageId = interaction.message.id;
      const giveaway = giveaways.get(messageId);
      if (!giveaway) return sendErrorReply(interaction, 'E36', 'Giveaway not found');

      // Check if user is the giveaway host
      if (giveaway.host.id === interaction.user.id) {
        return await sendErrorReply(interaction, 'E44');
      }

      // Check if user already entered
      const alreadyEntered = giveaway.entries.some(entry => entry.user.id === interaction.user.id);
      if (alreadyEntered) {
        return await sendErrorReply(interaction, 'E38');
      }

      // Check if user has special role for x2 entries
      const specialRoleId = '1461534174589485197';
      const hasSpecialRole = interaction.member.roles.cache.has(specialRoleId);
      const entryCount = hasSpecialRole ? 2 : 1;

      // Add entry(ies)
      for (let i = 0; i < entryCount; i++) {
        giveaway.entries.push({
          user: interaction.user,
          enteredAt: Date.now(),
          multiplier: hasSpecialRole ? 2 : 1
        });
      }

      const message = hasSpecialRole 
        ? `✅ You have entered the giveaway with **x2 entries** due to your special role! Total entries: ${giveaway.entries.length}`
        : `✅ You have entered the giveaway! Total entries: ${giveaway.entries.length}`;

      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId.startsWith('giveaway_entries_')) {
      const messageId = interaction.customId.replace('giveaway_entries_', '');
      const giveaway = giveaways.get(messageId);
      if (!giveaway) return sendErrorReply(interaction, 'E36', 'Giveaway not found');

      // Create entries list
      let entriesList = 'No entries yet.';
      if (giveaway.entries.length > 0) {
        // Group entries by user to show multipliers
        const userEntries = {};
        giveaway.entries.forEach((entry) => {
          if (!userEntries[entry.user.id]) {
            userEntries[entry.user.id] = {
              user: entry.user,
              count: 0,
              multiplier: entry.multiplier || 1
            };
          }
          userEntries[entry.user.id].count++;
        });
        
        entriesList = Object.values(userEntries)
          .map((data, idx) => {
            const userDisplay = data.user.displayName || data.user.username;
            const multiplierText = data.multiplier === 2 ? ' (x2)' : '';
            return `${idx + 1}. ${userDisplay}${multiplierText}`;
          })
          .join('\n');
      }

      const entriesEmbed = new EmbedBuilder()
        .setTitle('🎁 Giveaway Entries')
        .setDescription(entriesList)
        .setColor(0xFF1493)
        .setFooter({ text: `Total: ${giveaway.entries.length} ${giveaway.entries.length === 1 ? 'entry' : 'entries'}` });

      await interaction.reply({ embeds: [entriesEmbed], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId.startsWith('giveaway_page_prev_') || interaction.customId.startsWith('giveaway_page_next_')) {
      const messageId = interaction.message.id;
      const giveaway = giveaways.get(messageId);
      
      if (!giveaway) {
        await interaction.reply({ content: 'Giveaway not found.', flags: MessageFlags.Ephemeral });
        return;
      }

      const currentPage = giveaway.currentPage || 1;
      const itemsPerPage = giveaway.itemsPerPage || 10;
      const totalPages = Math.ceil(giveaway.items.length / itemsPerPage);
      let newPage = currentPage;

      if (interaction.customId.startsWith('giveaway_page_prev_') && currentPage > 1) newPage--;
      if (interaction.customId.startsWith('giveaway_page_next_') && currentPage < totalPages) newPage++;

      giveaway.currentPage = newPage;

      // Get paginated items
      const paginationData = paginateTradeItems(giveaway.items, newPage, itemsPerPage);

      // Recreate giveaway embed
      const embed = new EmbedBuilder()
        .setTitle('🎁 Giveaway')
        .setDescription(giveaway.description ? `**${giveaway.description}**\n\n**Click the button below to enter the giveaway!**` : '**Click the button below to enter the giveaway!**')
        .setColor(0xFF1493)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      const giveawayItemsField = totalPages > 1 
        ? `${paginationData.text}\\n\\n*Page ${newPage}/${totalPages}*`
        : paginationData.text;

      addFieldSafely(embed, 'Giveaway Items', giveawayItemsField, false);
      addFieldSafely(embed, 'Hosted by', giveaway.host.toString(), false);
      
      if (giveaway.description) {
        addFieldSafely(embed, 'Description', giveaway.description, false);
      }

      addFieldSafely(embed, 'Time Remaining', 'Calculating...', false);

      // Recreate buttons
      const enterButton = new ButtonBuilder()
        .setCustomId(`giveaway_enter_${messageId}`)
        .setLabel('Enter Giveaway')
        .setStyle(ButtonStyle.Success);

      const entriesButton = new ButtonBuilder()
        .setCustomId(`giveaway_entries_${messageId}`)
        .setLabel(`${giveaway.entries.length || 0} Entries`)
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(enterButton, entriesButton);
      const components = [row];

      // Add pagination buttons
      if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`giveaway_page_prev_${messageId}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 1),
          new ButtonBuilder().setCustomId(`giveaway_page_next_${messageId}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(newPage === totalPages)
        );
        components.push(paginationRow);
      }

      await interaction.update({ embeds: [embed], components });
      return;
    }

    if (interaction.customId.startsWith('giveaway_end_')) {
      const messageId = interaction.customId.replace('giveaway_end_', '');
      const giveaway = giveaways.get(messageId);
      if (!giveaway) return sendErrorReply(interaction, 'E36', 'Giveaway not found');

      if (giveaway.host.id !== interaction.user.id) {
        const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
        const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
        if (!hasAdminRole) return sendErrorReply(interaction, 'E72');
      }

      // Clear update interval
      if (giveaway.updateInterval) {
        clearInterval(giveaway.updateInterval);
      }

      // Update the original giveaway embed to show "Ended by host"
      try {
        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        if (channel) {
          const message = await channel.messages.fetch(messageId);
          if (message) {
            const endedEmbed = new EmbedBuilder()
              .setTitle('🎁 Giveaway')
              .setDescription(giveaway.description ? `**${giveaway.description}**\n\n**Ended by host**` : '**Ended by host**')
              .setColor(0xFF0000) // Red color
              .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
              .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

            const giveawayItemsText = formatItemsText(giveaway.items);

            addFieldSafely(endedEmbed, 'Giveaway Items', giveawayItemsText, false);

            addFieldSafely(endedEmbed, 'Hosted by', giveaway.host.toString(), false);

            addFieldSafely(endedEmbed, 'Status', 'Ended by host', false);

            // Disable all buttons
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('disabled_enter')
                .setLabel('Enter Giveaway')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('disabled_entries')
                .setLabel(`${giveaway.entries.length} ${giveaway.entries.length === 1 ? 'Entry' : 'Entries'}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('disabled_end')
                .setLabel('End Giveaway')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
            );

            await message.edit({ embeds: [endedEmbed], components: [disabledRow] });
          }
        }
      } catch (error) {
        console.error('Error updating giveaway embed:', error);
      }

      if (giveaway.entries.length === 0) {
        giveaways.delete(messageId);
        // Decrement giveaway count for host
        const hostId = giveaway.host.id;
        userGiveawayCount.set(hostId, Math.max(0, (userGiveawayCount.get(hostId) || 1) - 1));
        return sendErrorReply(interaction, 'E41');
      }

      // Select random winner
      const randomIndex = Math.floor(Math.random() * giveaway.entries.length);
      const winner = giveaway.entries[randomIndex];

      // Create winner embed
      const embed = new EmbedBuilder()
        .setTitle('🎁 Giveaway Ended!')
        .setColor(0xFF1493)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' });

      // Winner field
      addFieldSafely(embed, 'Winner', `**${winner.user}**`, false);

      // List items with proper formatting (bold + abbrev for diamonds)
      const itemsText = giveaway.items && giveaway.items.length > 0 ? formatItemsText(giveaway.items) : 'None';
      addFieldSafely(embed, 'Giveaway Items', itemsText, false);

      addFieldSafely(embed, 'Total Entries', giveaway.entries.length.toString(), true);

      // Create private channel for giveaway
      const host = await interaction.guild.members.fetch(giveaway.host.id);
      const winnerMember = await interaction.guild.members.fetch(winner.user.id);
      const channelName = `giveaway-${giveaway.host.id}-${winner.user.id}`;
      const createGiveawayChannel = interaction.guild.channels.cache.get('1462190673834020904');
      const giveawayChannel = await interaction.guild.channels.create({
        name: channelName,
        type: 0, // text channel
        parent: '1462173760529633383',
        position: createGiveawayChannel ? createGiveawayChannel.position + 1 : 0,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel'],
          },
          {
            id: giveaway.host.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          },
          {
            id: winner.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          },
        ],
      });

      // Send DMs
      try {
        await host.send(`🎉 Your giveaway has ended! The winner is <@${winner.user.id}>! Check the channel: ${giveawayChannel}`);
      } catch (e) {
        console.error('Error sending DM to host:', e);
      }
      try {
        await winnerMember.send(`🎉 Congratulations! You won the giveaway hosted by <@${giveaway.host.id}>! Check the channel: ${giveawayChannel}`);
      } catch (e) {
        console.error('Error sending DM to winner:', e);
      }

      // Send embed in the new channel
      const proofEmbed = new EmbedBuilder()
        .setTitle('Giveaway Proof Required')
        .setDescription(`**Host:** <@${giveaway.host.id}>\n**Winner:** <@${winner.user.id}>\n\nPlease upload proof image of the completed giveaway.`)
        .setColor(0xffa500)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' });

      const proofButton = new ButtonBuilder()
        .setCustomId(`upload_proof_giveaway_${Date.now()}`)
        .setLabel('Upload Proof Image')
        .setStyle(ButtonStyle.Primary);

      const proofMessageInChannel = await giveawayChannel.send({ embeds: [proofEmbed], components: [new ActionRowBuilder().addComponents(proofButton)] });

      // Store finished giveaway data for proof handler
      finishedGiveaways.set(proofMessageInChannel.id, {
        host: giveaway.host,
        winner: winner.user,
        items: giveaway.items,
        channelId: giveaway.channelId,
        giveawayChannelId: giveawayChannel.id
      });

      // Notify in original channel
      const channel = interaction.guild.channels.cache.get(giveaway.channelId);
      await channel.send(`🎉 Giveaway ended! Winner: ${winner.user}. Check your DMs for the giveaway channel.`);

      // Decrement giveaway count for host
      const hostId = giveaway.host.id;
      userGiveawayCount.set(hostId, Math.max(0, (userGiveawayCount.get(hostId) || 1) - 1));
      
      // Delete giveaway
      giveaways.delete(messageId);
      
      await interaction.reply({ content: 'Giveaway ended!', flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'trade_page_prev' || interaction.customId === 'trade_page_next') {
      const currentPage = interaction.user.currentTradePage || 1;
      const totalPages = Math.ceil(interaction.user.tradeItems.length / 15);
      let newPage = currentPage;
      if (interaction.customId === 'trade_page_prev' && currentPage > 1) newPage--;
      if (interaction.customId === 'trade_page_next' && currentPage < totalPages) newPage++;
      interaction.user.currentTradePage = newPage;

      const ITEMS_PER_PAGE = 15;
      const start = (newPage - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const pageItems = interaction.user.tradeItems.slice(start, end);
      const itemsList = formatItemsList(pageItems);                                         //\nWhat would you like to do?
      const description = `**Selected Items (Page ${newPage}/${totalPages}):**\n${itemsList}\n`;

      const embed = new EmbedBuilder().setDescription(description);

      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId('trade_continue_select')
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Confirm and Proceed', value: 'confirm_items' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      const components = [row];
      if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('trade_page_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 1),
          new ButtonBuilder().setCustomId('trade_page_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(newPage === totalPages)
        );
        components.push(paginationRow);
      }

      await interaction.update({ embeds: [embed], components });
      return;
    }

    if (interaction.customId === 'create_auction') {
      // Check suspension
      const suspension = checkSuspension(interaction.user.id, 'auction');
      if (suspension) {
        const hours = Math.floor(suspension.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((suspension.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ 
          content: `❌ **Suspended from Auction Activities**\n\n**Reason:** ${suspension.reason}\n**Time Remaining:** ${hours}h ${minutes}m\n\nYou cannot create auctions during suspension.`, 
          flags: MessageFlags.Ephemeral 
        });
      }

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

    if (interaction.customId.startsWith('admin_upload_proof_giveaway_')) {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E05');

      const messageId = interaction.customId.replace('admin_upload_proof_giveaway_', '');
      const giveawayData = finishedGiveaways.get(messageId);
      if (!giveawayData) return sendErrorReply(interaction, 'E07', 'Giveaway not found');

      // Show instruction to upload image file
      const uploadButton = new ButtonBuilder()
        .setCustomId(`admin_upload_proof_file_giveaway_${messageId}`)
        .setLabel('📎 Admin Upload Image (PNG/JPG)')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(uploadButton);

      // Store state for admin file upload
      interaction.user.waitingForAdminProof = {
        giveawayMessageId: messageId,
        type: 'giveaway',
        channelId: giveawayData.channelId,
        hostId: giveawayData.host.id,
        guestId: giveawayData.winner.id,
        timestamp: Date.now()
      };

      await interaction.reply({
        content: '📸 **Admin Upload Proof Image**\n\nAs an admin, you can upload the proof image for this giveaway. Please send your proof image (PNG or JPG) in the next message in this channel.',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.customId === 'create_trade') {
      // Check suspension
      const suspension = checkSuspension(interaction.user.id, 'trade');
      if (suspension) {
        const hours = Math.floor(suspension.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((suspension.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ 
          content: `❌ **Suspended from Trade Activities**\n\n**Reason:** ${suspension.reason}\n**Time Remaining:** ${hours}h ${minutes}m\n\nYou cannot create trades during suspension.`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      // Check trade limit
      const specialRoleId = '1461534174589485197';
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      
      const hasSpecialRole = interaction.member.roles.cache.has(specialRoleId);
      const isAdmin = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      
      const userId = interaction.user.id;
      const currentTrades = userTradeCount.get(userId) || 0;
      const maxTrades = isAdmin ? Infinity : (hasSpecialRole ? 5 : 1);
      
      if (currentTrades >= maxTrades) {
        return interaction.reply({ 
          content: `You have reached the maximum number of simultaneous trades (${maxTrades}).`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      // Show category selection
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('trade_category_select')
        .setPlaceholder('Select an item category')
        .addOptions([
	  { label: 'Diamonds', value: 'diamonds', emoji: '💎' },
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      await interaction.reply({ content: 'Select an item category to add to your trade offer:', components: [row], flags: MessageFlags.Ephemeral });
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
          { label: 'Gifts', value: 'gifts', emoji: '🎁' },
          { label: 'Diamonds', value: 'diamonds', emoji: '💎' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      await interaction.reply({ content: 'Select an item category to add to your inventory:', components: [row], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'create_giveaway') {
      // Check suspension
      const suspension = checkSuspension(interaction.user.id, 'giveaway');
      if (suspension) {
        const hours = Math.floor(suspension.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((suspension.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ 
          content: `❌ **Suspended from Giveaway Activities**\n\n**Reason:** ${suspension.reason}\n**Time Remaining:** ${hours}h ${minutes}m\n\nYou cannot create giveaways during suspension.`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      // Check if user has the required role to create giveaway
      const giveawayCreatorRoleId = '1461798386201006324';
      const specialRoleId = '1461534174589485197';
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      
      const hasGiveawayRole = interaction.member.roles.cache.has(giveawayCreatorRoleId);
      const hasSpecialRole = interaction.member.roles.cache.has(specialRoleId);
      const isAdmin = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      
      if (!hasGiveawayRole && !hasSpecialRole && !isAdmin) {
        return sendErrorReply(interaction, 'E01');
      }

      // Check giveaway limit
      const userId = interaction.user.id;
      const currentGiveaways = userGiveawayCount.get(userId) || 0;
      const maxGiveaways = isAdmin ? Infinity : (hasSpecialRole ? 3 : 1);
      
      if (currentGiveaways >= maxGiveaways) {
        return sendErrorReply(interaction, 'E83', `You have reached the maximum number of simultaneous giveaways (${maxGiveaways}).`);
      }

      // Initialize giveaway items for this user
      interaction.user.giveawayItems = [];

      // Show category selection for giveaway
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('giveaway_category_select')
        .setPlaceholder('Select an item category')
        .addOptions([
          { label: 'Diamonds', value: 'diamonds', emoji: '💎' },
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      await interaction.reply({ content: 'Select an item category to add to your giveaway:', components: [row], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'trade_offer_button') {
      // Check suspension
      const suspension = checkSuspension(interaction.user.id, 'trade');
      if (suspension) {
        const hours = Math.floor(suspension.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((suspension.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ 
          content: `❌ **Suspended from Trade Activities**\n\n**Reason:** ${suspension.reason}\n**Time Remaining:** ${hours}h ${minutes}m\n\nYou cannot make offers on trades during suspension.`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      const trade = trades.get(interaction.message.id);
      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');

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

    if (interaction.customId.startsWith('trade_view_offers_')) {
      try {
        const parts = interaction.customId.replace('trade_view_offers_', '').split('_');
        const messageId = parts[0];
        const page = parseInt(parts[1]) || 1;
        const trade = trades.get(messageId);
        if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');
        if (trade.host.id !== interaction.user.id) return sendErrorReply(interaction, 'E03');

        const offersPerPage = 5;
        const totalPages = Math.ceil(trade.offers.length / offersPerPage);
        const validPage = Math.max(1, Math.min(page, totalPages));
        const start = (validPage - 1) * offersPerPage;
        const end = start + offersPerPage;
        const pageOffers = trade.offers.slice(start, end);

        // Create embed showing offers for this page
        const embed = new EmbedBuilder()
          .setTitle('Trade Offers')
          .setDescription(`Select an offer to accept or decline. Page ${validPage}/${totalPages}`)
          .setColor(0x0099ff)
          .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
          .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

        const components = [];
        pageOffers.forEach((offer, index) => {
          const globalIndex = start + index;
          const offerText = `${offer.user.username}${offer.diamonds > 0 ? ` (+ ${formatBid(offer.diamonds)} 💎)` : ''}\n${formatItemsText(offer.items)}`;
          addFieldSafely(embed, `Offer ${globalIndex + 1} by ${offer.user.username}`, offerText, false);

          const acceptButton = new ButtonBuilder()
            .setCustomId(`trade_accept_offer_${messageId}_${globalIndex}`)
            .setLabel(`Accept Offer ${globalIndex + 1}`)
            .setStyle(ButtonStyle.Success);

          const declineButton = new ButtonBuilder()
            .setCustomId(`trade_decline_offer_${messageId}_${globalIndex}`)
            .setLabel(`Decline Offer ${globalIndex + 1}`)
            .setStyle(ButtonStyle.Danger);

          components.push(new ActionRowBuilder().addComponents(acceptButton, declineButton));
        });

        // Add pagination buttons if needed
        if (totalPages > 1) {
          const prevButton = new ButtonBuilder()
            .setCustomId(`trade_view_offers_${messageId}_${validPage - 1}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(validPage === 1);

          const nextButton = new ButtonBuilder()
            .setCustomId(`trade_view_offers_${messageId}_${validPage + 1}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(validPage === totalPages);

          components.push(new ActionRowBuilder().addComponents(prevButton, nextButton));
        }

        await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error('Error displaying trade offers:', error);
        await sendErrorReply(interaction, 'E99', 'An error occurred while loading offers. Please try again.');
      }
    }

    if (interaction.customId.startsWith('trade_accept_offer_')) {
      try {
      // Check suspension
      const suspension = checkSuspension(interaction.user.id, 'trade');
      if (suspension) {
        const hours = Math.floor(suspension.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((suspension.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ 
          content: `❌ **Suspended from Trade Activities**\n\n**Reason:** ${suspension.reason}\n**Time Remaining:** ${hours}h ${minutes}m\n\nYou cannot accept trades during suspension.`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      const parts = interaction.customId.replace('trade_accept_offer_', '').split('_');
      const messageId = parts[0];
      const offerIndex = parseInt(parts[1]);
      const trade = trades.get(messageId);
      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');
      if (trade.accepted) return sendErrorReply(interaction, 'E64', 'This trade has already been accepted');
      if (trade.host.id !== interaction.user.id) return sendErrorReply(interaction, 'E03');
      if (offerIndex < 0 || offerIndex >= trade.offers.length) return sendErrorReply(interaction, 'E09', 'Invalid offer');

      const acceptedOffer = trade.offers[offerIndex];
      trade.accepted = true;
      trade.acceptedUser = acceptedOffer.user;

      // Create private channel for trade
      const host = await interaction.guild.members.fetch(trade.host.id);
      const guest = await interaction.guild.members.fetch(acceptedOffer.user.id);
      const channelName = `trade-${trade.host.id}-${acceptedOffer.user.id}`;
      const createTradeChannel = interaction.guild.channels.cache.get('1461777388927979692');
      const tradeChannel = await interaction.guild.channels.create({
        name: channelName,
        type: 0, // text channel
        parent: '1461777463821729845',
        position: createTradeChannel ? createTradeChannel.position + 1 : 0,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel'],
          },
          {
            id: trade.host.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          },
          {
            id: acceptedOffer.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          },
        ],
      });

      // Send DMs
      try {
        await host.send(`✅ Your trade offer has been accepted by <@${acceptedOffer.user.id}>! Check the channel: ${tradeChannel}`);
      } catch (e) {
        console.error('Error sending DM to host:', e);
      }
      try {
        await guest.send(`✅ Your trade offer has been accepted by <@${trade.host.id}>! Check the channel: ${tradeChannel}`);
      } catch (e) {
        console.error('Error sending DM to guest:', e);
      }

      // Send embed in the new channel
      const proofEmbed = new EmbedBuilder()
        .setTitle('Trade Proof Required')
        .setDescription(`**Host:** <@${trade.host.id}>\n**Guest:** <@${acceptedOffer.user.id}>\n\nPlease upload proof image of the completed trade.`)
        .setColor(0xffa500)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' });

      const proofButton = new ButtonBuilder()
        .setCustomId(`upload_proof_trade_${messageId}`)
        .setLabel('Upload Proof Image')
        .setStyle(ButtonStyle.Primary);

      await tradeChannel.send({ embeds: [proofEmbed], components: [new ActionRowBuilder().addComponents(proofButton)] });

      // Update embed
      await updateTradeEmbed(interaction.guild, trade, messageId);

      await interaction.reply({ content: 'Trade accepted!', flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error('Error accepting trade offer:', error);
        await sendErrorReply(interaction, 'E99', 'An error occurred while accepting the offer. Please try again.');
      }
    }

    if (interaction.customId.startsWith('trade_decline_offer_')) {
      try {
      // Check suspension
      const suspension = checkSuspension(interaction.user.id, 'trade');
      if (suspension) {
        const hours = Math.floor(suspension.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((suspension.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ 
          content: `❌ **Suspended from Trade Activities**\n\n**Reason:** ${suspension.reason}\n**Time Remaining:** ${hours}h ${minutes}m\n\nYou cannot decline trades during suspension.`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      const parts = interaction.customId.replace('trade_decline_offer_', '').split('_');
      const messageId = parts[0];
      const offerIndex = parseInt(parts[1]);
      const trade = trades.get(messageId);
      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');
      if (trade.accepted) return sendErrorReply(interaction, 'E65', 'Cannot decline offers after the trade has been accepted');
      if (trade.host.id !== interaction.user.id) return sendErrorReply(interaction, 'E03');
      if (offerIndex < 0 || offerIndex >= trade.offers.length) return sendErrorReply(interaction, 'E09', 'Invalid offer');

      const declinedOffer = trade.offers[offerIndex];

      // Send DM to declined user
      try {
        const declinedUser = await interaction.guild.members.fetch(declinedOffer.user.id);
        await declinedUser.send(`❌ Your trade offer for the trade hosted by <@${trade.host.id}> has been declined.`);
      } catch (e) {
        console.error('Error sending DM to declined user:', e);
      }

      // Remove the offer
      trade.offers.splice(offerIndex, 1);

      // Update embed
      await updateTradeEmbed(interaction.guild, trade, messageId);

      await interaction.reply({ content: 'Offer declined!', flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error('Error declining trade offer:', error);
        await sendErrorReply(interaction, 'E99', 'An error occurred while declining the offer. Please try again.');
      }
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

      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');
      if (trade.host.id !== interaction.user.id) return sendErrorReply(interaction, 'E03');

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
      await interaction.reply({ content: 'Trade deleted!', flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId.startsWith('upload_proof_trade_')) {
      const messageId = interaction.customId.replace('upload_proof_trade_', '');
      const trade = trades.get(messageId);
      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');

      // Check if user is host or accepted user
      if (trade.host.id !== interaction.user.id && trade.acceptedUser.id !== interaction.user.id) {
        return sendErrorReply(interaction, 'E02');
      }

      // Store state for file upload
      waitingForProofUploads.set(interaction.user.id, {
        tradeMessageId: messageId,
        type: 'trade',
        channelId: trade.channelId,
        privateChannelId: interaction.channelId,
        hostId: trade.host.id,
        guestId: trade.acceptedUser.id,
        timestamp: Date.now()
      });
      console.log('Set waitingForProof for user:', interaction.user.id, waitingForProofUploads.get(interaction.user.id));

      await interaction.deferUpdate();

      await interaction.followUp({
        content: '📸 **Upload Proof Image**\n\nPlease send your proof image (PNG or JPG) in the next message in this channel. The image will be automatically captured and linked to your trade.',
        flags: 64
      });

      // Start timeout system
      startProofUploadTimeout(messageId, interaction.guild, {
        type: 'trade',
        hostId: trade.host.id,
        guestId: trade.acceptedUser.id,
        channelId: interaction.channelId
      });
    }

    if (interaction.customId.startsWith('upload_proof_auction_')) {
      // Get auction data for tracking
      const messageId = interaction.message?.id;
      const auctionData = finishedAuctions.get(messageId);
      const hostId = auctionData?.host?.id || null;
      const winnerId = auctionData?.winner?.split('<@')[1]?.split('>')[0] || null;

      // Store state for file upload
      waitingForProofUploads.set(interaction.user.id, {
        auctionProofMessageId: interaction.message?.id || null,
        type: 'auction',
        privateChannelId: interaction.channelId,
        hostId: hostId,
        guestId: winnerId,
        timestamp: Date.now()
      });

      await interaction.deferUpdate();

      await interaction.followUp({
        content: '📸 **Upload Proof Image**\n\nPlease send your proof image (PNG or JPG) in the next message in this channel. The image will be automatically captured and linked to your auction.',
        flags: 64
      });

      // Start timeout system
      if (messageId && hostId && winnerId) {
        startProofUploadTimeout(messageId, interaction.guild, {
          type: 'auction',
          hostId: hostId,
          guestId: winnerId,
          channelId: interaction.channelId
        });
      }
    }

    if (interaction.customId.startsWith('upload_proof_giveaway_')) {
      // Get giveaway data
      const messageId = interaction.message.id;
      const giveawayData = finishedGiveaways.get(messageId);
      if (!giveawayData) return sendErrorReply(interaction, 'E36', 'Giveaway not found');

      // Check if user is host or winner
      if (giveawayData.host.id !== interaction.user.id && giveawayData.winner.id !== interaction.user.id) {
        return sendErrorReply(interaction, 'E02');
      }

      // Store state for file upload
      waitingForProofUploads.set(interaction.user.id, {
        giveawayProofMessageId: messageId,
        type: 'giveaway',
        channelId: giveawayData.channelId,
        privateChannelId: interaction.channelId,
        hostId: giveawayData.host.id,
        guestId: giveawayData.winner.id,
        timestamp: Date.now()
      });

      await interaction.deferUpdate();

      await interaction.followUp({
        content: '📸 **Upload Proof Image**\n\nPlease send your proof image (PNG or JPG) in the next message in this channel. The image will be automatically captured and linked to your giveaway.',
        flags: 64
      });

      // Start timeout system
      startProofUploadTimeout(messageId, interaction.guild, {
        type: 'giveaway',
        hostId: giveawayData.host.id,
        guestId: giveawayData.winner.id,
        channelId: interaction.channelId
      });
    }

    if (interaction.customId.startsWith('delete_channel_')) {
      const channelId = interaction.customId.replace('delete_channel_', '');
      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) return sendErrorReply(interaction, 'E52', 'Channel not found');

      // Check if user is in the channel
      if (!channel.members.has(interaction.user.id)) return sendErrorReply(interaction, 'E02', 'You are not authorized to delete this channel');

      await interaction.deferUpdate();

      let countdown = 5;
      const updateButton = async () => {
        const deleteButton = new ButtonBuilder()
          .setCustomId(`delete_channel_${channelId}`)
          .setLabel(`Deleting channel in ${countdown}...`)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true);

        const row = new ActionRowBuilder().addComponents(deleteButton);
        await interaction.message.edit({ embeds: interaction.message.embeds, components: [row] });
      };

      await updateButton();

      const interval = setInterval(async () => {
        countdown--;
        if (countdown > 0) {
          try {
            await updateButton();
          } catch (e) {
            clearInterval(interval);
          }
        } else {
          clearInterval(interval);
          try {
            await channel.delete();
          } catch (e) {
            console.error('Error deleting channel:', e);
          }
        }
      }, 1000);
    }

    if (interaction.customId.startsWith('admin_upload_proof_trade_')) {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E05');

      const messageId = interaction.customId.replace('admin_upload_proof_trade_', '');
      const trade = trades.get(messageId);
      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');

      // Show instruction to upload image file
      const uploadButton = new ButtonBuilder()
        .setCustomId(`admin_upload_proof_file_trade_${messageId}`)
        .setLabel('📎 Admin Upload Image (PNG/JPG)')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(uploadButton);

      // Store state for admin file upload
      interaction.user.waitingForAdminProof = {
        tradeMessageId: messageId,
        type: 'trade',
        channelId: trade.channelId,
        hostId: trade.host.id,
        guestId: trade.acceptedUser.id,
        timestamp: Date.now()
      };

      await interaction.reply({
        content: '📸 **Admin Upload Proof Image**\n\nAs an admin, you can upload the proof image for this trade. Please send your proof image (PNG or JPG) in the next message in this channel.',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.customId.startsWith('admin_upload_proof_auction_')) {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E05');

      const messageId = interaction.customId.replace('admin_upload_proof_auction_', '');
      const auctionData = finishedAuctions.get(messageId);
      if (!auctionData) return sendErrorReply(interaction, 'E07', 'Auction not found');

      // Show instruction to upload image file
      const uploadButton = new ButtonBuilder()
        .setCustomId(`admin_upload_proof_file_auction_${messageId}`)
        .setLabel('📎 Admin Upload Image (PNG/JPG)')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(uploadButton);

      // Store state for admin file upload
      interaction.user.waitingForAdminProof = {
        auctionMessageId: messageId,
        type: 'auction',
        channelId: auctionData.channelId,
        hostId: auctionData.host.id,
        guestId: auctionData.winner.split('<@')[1]?.split('>')[0] || null,
        timestamp: Date.now()
      };

      await interaction.reply({
        content: '📸 **Admin Upload Proof Image**\n\nAs an admin, you can upload the proof image for this auction. Please send your proof image (PNG or JPG) in the next message in this channel.',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.customId.startsWith('remove_suspension_')) {
      const adminRoles = ['1461505505401896972', '1461481291118678087', '1461484563183435817'];
      const hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.id));
      if (!hasAdminRole) return sendErrorReply(interaction, 'E05');

      const targetUserId = interaction.customId.replace('remove_suspension_', '');
      
      const success = await manualSuspensionRemoval(interaction.guild, targetUserId, interaction.user.id);
      
      if (success) {
        await interaction.reply({ 
          content: `✅ Suspension manually removed for <@${targetUserId}> by ${interaction.user}.`, 
          flags: MessageFlags.Ephemeral 
        });
        botLogs.addLog('ADMIN_ACTION', 'Admin manually removed user suspension', interaction.user.id, { targetUserId });
      } else {
        await interaction.reply({ 
          content: `❌ Failed to remove suspension for <@${targetUserId}>. User may not be suspended.`, 
          flags: MessageFlags.Ephemeral 
        });
      }
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
          { label: 'Diamonds', value: 'diamonds', emoji: '💎' },
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

      const row = new ActionRowBuilder().addComponents(categorySelect);
      await interaction.reply({ content: 'Select an item category to add to your inventory:', components: [row], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId.startsWith('inventory_page_prev_') || interaction.customId.startsWith('inventory_page_next_')) {
      const messageId = interaction.message.id;
      const inventoryUserId = interaction.message.mentions.users.first()?.id || interaction.user.id;
      const inventory = inventories.get(inventoryUserId);
      
      if (!inventory || !inventory.items) {
        await interaction.reply({ content: 'Inventory not found.', flags: MessageFlags.Ephemeral });
        return;
      }

      const currentPage = inventory.currentPage || 1;
      const itemsPerPage = inventory.itemsPerPage || 10;
      const totalPages = Math.ceil(inventory.items.length / itemsPerPage);
      let newPage = currentPage;

      if (interaction.customId.startsWith('inventory_page_prev_') && currentPage > 1) newPage--;
      if (interaction.customId.startsWith('inventory_page_next_') && currentPage < totalPages) newPage++;

      inventory.currentPage = newPage;
      inventories.set(inventoryUserId, inventory);

      // Get paginated items
      const paginationData = paginateTradeItems(inventory.items, newPage, itemsPerPage);

      // Recreate inventory embed
      const embed = new EmbedBuilder()
        .setTitle('🎯 Inventory')
        .setColor(0x00b0f4);

      const avatarUrl = interaction.user.displayAvatarURL({ format: 'webp', size: 1024 });
      embed.setAuthor({ name: interaction.user.displayName || interaction.user.username, iconURL: avatarUrl });

      const inventoryItemsField = totalPages > 1 
        ? `${paginationData.text}\\n\\n*Page ${newPage}/${totalPages}*`
        : paginationData.text;

      addFieldSafely(embed,
        `Items${inventory.diamonds > 0 ? ` + ${formatBid(inventory.diamonds)} 💎` : 'None'}`,
        inventoryItemsField,
        false
      );

      if (inventory.lookingFor) {
        addFieldSafely(embed, 'Looking For', inventory.lookingFor, true);
      }

      // Update pagination buttons
      const updateButton = new ButtonBuilder()
        .setCustomId('inventory_update_button')
        .setLabel('Update Inventory')
        .setStyle(ButtonStyle.Primary);

      const deleteButton = new ButtonBuilder()
        .setCustomId('inventory_delete_button')
        .setLabel('Delete Items')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(updateButton, deleteButton);
      const components = [row];

      if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`inventory_page_prev_${messageId}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 1),
          new ButtonBuilder().setCustomId(`inventory_page_next_${messageId}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(newPage === totalPages)
        );
        components.push(paginationRow);
      }

      await interaction.update({ embeds: [embed], components });
      return;
    }

    if (interaction.customId === 'inventory_delete_button') {
      const inventory = inventories.get(interaction.user.id);
      if (!inventory || !inventory.items || inventory.items.length === 0) {
        return sendErrorReply(interaction, 'E29');
      }

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const deleteSelect = new StringSelectMenuBuilder()
        .setCustomId('inventory_delete_select')
        .setPlaceholder('Select items to delete')
        .setMinValues(1)
        .setMaxValues(Math.min(100, inventory.items.length));

      inventory.items.forEach((item, index) => {
        const emoji = getItemEmoji(item.name);
        deleteSelect.addOptions({
          label: `${formatItemName(item.name)} (x${item.quantity})`,
          value: `${index}`
        });
      });

      const row = new ActionRowBuilder().addComponents(deleteSelect);
      await interaction.reply({ content: 'Select items to delete from your inventory:', components: [row], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'inventory_delete_select') {
      const inventory = inventories.get(interaction.user.id);
      if (!inventory) {
        return sendErrorReply(interaction, 'E26', 'Inventory not found');
      }

      const indicesToDelete = interaction.values.map(v => parseInt(v)).sort((a, b) => b - a);
      
      indicesToDelete.forEach(index => {
        if (index >= 0 && index < inventory.items.length) {
          inventory.items.splice(index, 1);
        }
      });

      if (inventory.items.length === 0) {
        await interaction.reply({ content: 'All items deleted from your inventory!', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `${indicesToDelete.length} item(s) deleted from your inventory!`, flags: MessageFlags.Ephemeral });
      }
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'trade_category_select') {
      const category = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      let items = [];
      if (category === 'diamonds') {
        // Show modal for diamonds input
        const diamondsModal = new ModalBuilder()
          .setCustomId('trade_diamonds_modal')
          .setTitle('Add Diamonds');

        const diamondsInput = new TextInputBuilder()
          .setCustomId('diamonds_amount')
          .setLabel('Amount of Diamonds')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 5000, 10K, 1M')
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(diamondsInput);
        diamondsModal.addComponents(row1);

        await interaction.showModal(diamondsModal);
        return;
      } else if (category === 'huges') {
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
        .addOptions(items.slice(0, 25).map(item => ({ 
          label: formatItemName(item), 
          value: item,
          emoji: getItemEmoji(item)
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      const displayText = items.length > 25 ? `Select items from **${category}** category (showing 25 of ${items.length}):` : `Select items from **${category}** category:`;
      await interaction.reply({ content: displayText, components: [row], flags: 64 });
    }

    if (interaction.customId === 'trade_huge_subcategory_select') {
      const subcategory = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const items = itemCategories.huges[subcategory];
      const maxOptions = Math.min(items.length, 25);
      const itemsToShow = items.slice(0, maxOptions);
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`trade_item_select_huges_${subcategory}`)
        .setPlaceholder(`Select items from ${subcategory}`)
        .setMaxValues(maxOptions)
        .addOptions(itemsToShow.map(item => ({ 
          label: formatItemName(item), 
          value: item,
          emoji: getItemEmoji(item)
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${subcategory}**:`, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('trade_item_select_')) {
      const parts = interaction.customId.replace('trade_item_select_', '').split('_');
      let category = parts[0];
      let subcategory = parts.length > 1 ? parts.slice(1).join('_') : null;
      
      const selectedItems = interaction.values;

      // Validate that selected items don't exceed 25 (Discord limit)
      if (selectedItems.length > 25) {
        await sendErrorReply(interaction, 'E06', `You selected ${selectedItems.length} items, but the maximum is 25 items per select menu. (Discord Limit)`);
        return;
      }

      // Store items selection
      interaction.user.selectedTradeItems = selectedItems;
      interaction.user.selectedTradeCategory = category;
      interaction.user.selectedTradeSubcategory = subcategory;

      // Show quantity selection modal
      const quantityModal = new ModalBuilder()
        .setCustomId(`trade_item_quantities_modal`)
        .setTitle('Select Quantities');

      const quantitiesInput = new TextInputBuilder()
        .setCustomId('quantities')
        .setLabel(`Quantities for ${interaction.user.selectedTradeItems.length} items (comma separated)`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('1,1,1... (one per item)')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(quantitiesInput);
      quantityModal.addComponents(row);

      await interaction.showModal(quantityModal);
    }

    if (interaction.customId.startsWith('offer_category_select_')) {
      const messageId = interaction.customId.replace('offer_category_select_', '');
      const category = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      if (category === 'diamonds') {
        const diamondsModal = new ModalBuilder()
          .setCustomId(`offer_diamonds_modal_${messageId}`)
          .setTitle('Add Diamonds to Offer');

        const diamondsInput = new TextInputBuilder()
          .setCustomId('offer_diamonds_amount')
          .setLabel('Amount of Diamonds')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 5000, 10K, 1M')
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(diamondsInput);
        diamondsModal.addComponents(row1);

        await interaction.showModal(diamondsModal);
        return;
      } else if (category === 'huges') {
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
      const maxOptions = Math.min(items.length, 25);
      const itemsToShow = items.slice(0, maxOptions);
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_item_select_${messageId}_${category}`)
        .setPlaceholder(`Select items from ${category}`)
        .setMaxValues(maxOptions)
        .addOptions(itemsToShow.map(item => ({ 
          label: formatItemName(item), 
          value: item,
          emoji: getItemEmoji(item)
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      const displayText = items.length > 25 ? `Select items from **${category}** category (showing 25 of ${items.length}):` : `Select items from **${category}** category:`;
      await interaction.reply({ content: displayText, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('offer_huge_subcategory_select_')) {
      const messageId = interaction.customId.replace('offer_huge_subcategory_select_', '');
      const subcategory = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const items = itemCategories.huges[subcategory];
      const maxOptions = Math.min(items.length, 25);
      const itemsToShow = items.slice(0, maxOptions);
      
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_item_select_${messageId}_huges_${subcategory}`)
        .setPlaceholder(`Select items from ${subcategory}`)
        .setMaxValues(maxOptions)
        .addOptions(itemsToShow.map(item => ({ 
          label: formatItemName(item), 
          value: item,
          emoji: getItemEmoji(item)
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      const displayText = items.length > 25 ? `Select items from **${subcategory}** (showing ${maxOptions} of ${items.length}):` : `Select items from **${subcategory}**:`;
      await interaction.reply({ content: displayText, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('offer_item_select_')) {
      const parts = interaction.customId.replace('offer_item_select_', '').split('_');
      const messageId = parts[0];
      let category = parts[1];
      let subcategory = parts.length > 2 ? parts.slice(2).join('_') : null;
      const selectedItems = interaction.values;

      // Validate that selected items don't exceed 25 (Discord limit)
      if (selectedItems.length > 25) {
        await sendErrorReply(interaction, 'E06', `You selected ${selectedItems.length} items, but the maximum is 25 items per select menu. (Discord Limit)`);
        return;
      }

      // Store items selection
      interaction.user.selectedOfferItems = selectedItems;
      interaction.user.selectedOfferCategory = category;
      interaction.user.selectedOfferSubcategory = subcategory;
      interaction.user.selectedOfferMessageId = messageId;

      // Show quantity selection modal
      const quantityModal = new ModalBuilder()
        .setCustomId(`offer_item_quantities_modal_${messageId}`)
        .setTitle('Select Quantities');

      const quantitiesInput = new TextInputBuilder()
        .setCustomId('offer_quantities')
        .setLabel(`Quantities for ${selectedItems.length} items (comma separated)`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('1,1,1... (one per item)')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(quantitiesInput);
      quantityModal.addComponents(row);

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
          { label: 'Diamonds', value: 'diamonds', emoji: '💎' },
          { label: 'Huges', value: 'huges', emoji: '🔥' },
          { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
          { label: 'Eggs', value: 'eggs', emoji: '🥚' },
          { label: 'Gifts', value: 'gifts', emoji: '🎁' }
        ]);

        const row = new ActionRowBuilder().addComponents(categorySelect);
        await interaction.reply({ content: 'Select another item category:', components: [row], flags: 64 });
      } else if (choice === 'remove_items') {
        // Show a modal to remove items
        const itemsList = interaction.user.tradeItems || [];
        const { StringSelectMenuBuilder } = require('discord.js');
        
        const itemSelect = new StringSelectMenuBuilder()
          .setCustomId('trade_remove_item_select')
          .setPlaceholder('Select items to remove')
          .setMaxValues(Math.min(25, itemsList.length))
          .addOptions(itemsList.map((item, idx) => ({ 
            label: `${item.name} (x${item.quantity})`, 
            value: idx.toString()
          })));

        const row = new ActionRowBuilder().addComponents(itemSelect);
        await interaction.reply({ content: 'Select items to remove:', components: [row], flags: 64 });
      } else if (choice === 'confirm_items') {
        // Check if diamonds are already added as items
        const hasDiamonds = (interaction.user.tradeItems || []).some(item => item.name === '💎 Diamonds');
        
        // Move to diamonds and target user
        const diamondsModal = new ModalBuilder()
          .setCustomId('trade_setup_modal')
          .setTitle('Complete Your Trade Offer');

        // Only show diamonds input if not already added as items
        if (!hasDiamonds) {
          const diamondsInput = new TextInputBuilder()
            .setCustomId('trade_diamonds')
            .setLabel('Diamonds (optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('0')
            .setRequired(false);

          const row1 = new ActionRowBuilder().addComponents(diamondsInput);
          diamondsModal.addComponents(row1);
        }

        const userInput = new TextInputBuilder()
          .setCustomId('trade_target_user')
          .setLabel('Target User (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Leave empty for open trade')
          .setRequired(false);

        const row2 = new ActionRowBuilder().addComponents(userInput);
        
        if (!hasDiamonds) {
          diamondsModal.addComponents(row2);
        } else {
          diamondsModal.addComponents(row2);
        }

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
        // Check if diamonds are already added
        const offerItems = interaction.user.offerTradeItems || [];
        const hasDiamonds = offerItems.some(item => item.name === '💎 Diamonds');
        const onlyDiamonds = offerItems.length > 0 && offerItems.every(item => item.name === '💎 Diamonds');
        
        // If offer contains only diamonds, submit directly without modal
        if (onlyDiamonds) {
          const trade = trades.get(messageId);
          if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');

          // Check if user is the trade host
          if (trade.host.id === interaction.user.id) {
            return await sendErrorReply(interaction, 'E04');
          }

          // Add offer to trade
          trade.offers.push({
            user: interaction.user,
            diamonds: offerItems.reduce((sum, item) => sum + item.quantity, 0),
            items: [],
            timestamp: Date.now()
          });

          // Update trade embed to show grid layout
          await updateTradeEmbed(interaction.guild, trade, messageId);

          // Notify host of new offer
          const channel = interaction.guild.channels.cache.get(trade.channelId);
          if (channel) {
            await channel.send(`📢 <@${trade.host.id}>, you received an offer from <@${interaction.user.id}>!`);
          }

          await interaction.reply({ content: `Offer submitted! Host will accept or decline.`, flags: 64 });
          return;
        }
        
        // Move to diamonds and submit
        const diamondsModal = new ModalBuilder()
          .setCustomId(`offer_submit_modal_${messageId}`)
          .setTitle('Complete Your Offer');

        // Only show diamonds input if not already added
        if (!hasDiamonds) {
          const diamondsInput = new TextInputBuilder()
            .setCustomId('offer_diamonds')
            .setLabel('Diamonds (optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('0')
            .setRequired(false);

          const row1 = new ActionRowBuilder().addComponents(diamondsInput);
          diamondsModal.addComponents(row1);
        }
        
        // Store items in interaction metadata
        interaction.user.offerItems = offerItems;
        interaction.user.messageId = messageId;
        delete interaction.user.offerTradeItems;
        delete interaction.user.selectedOfferItems;
        delete interaction.user.selectedOfferCategory;
        delete interaction.user.selectedOfferSubcategory;
        delete interaction.user.selectedOfferMessageId;

        await interaction.showModal(diamondsModal);
      } else if (choice === 'remove_items') {
        // Show items to remove
        const items = interaction.user.offerTradeItems || [];
        if (items.length === 0) {
          return sendErrorReply(interaction, 'E84', 'No items to remove');
        }

        const { StringSelectMenuBuilder } = require('discord.js');
        
        const removeSelect = new StringSelectMenuBuilder()
          .setCustomId(`offer_remove_item_select_${messageId}`)
          .setPlaceholder('Select items to remove')
          .setMinValues(1)
          .setMaxValues(Math.min(100, items.length));

        items.forEach((item, index) => {
          const emoji = getItemEmoji(item.name);
          removeSelect.addOptions({
            label: `${formatItemName(item.name)} (x${item.quantity})`,
            value: `${index}`,
            emoji: emoji
          });
        });

        const row = new ActionRowBuilder().addComponents(removeSelect);
        await interaction.reply({ content: 'Select items to remove:', components: [row], flags: 64 });
      }
    }

    if (interaction.customId.startsWith('offer_remove_item_select_')) {
      const messageId = interaction.customId.replace('offer_remove_item_select_', '');
      const indices = interaction.values.map(v => parseInt(v)).sort((a, b) => b - a);
      const items = interaction.user.offerTradeItems || [];

      // Remove items in reverse order to maintain correct indices
      indices.forEach(index => {
        if (index >= 0 && index < items.length) {
          items.splice(index, 1);
        }
      });

      if (items.length === 0) {
        await interaction.reply({ content: 'All items removed. Please add items again.', flags: 64 });
        delete interaction.user.offerTradeItems;
      } else {
        // Redisplay the continue select
        const { StringSelectMenuBuilder } = require('discord.js');
        
        const continueSelect = new StringSelectMenuBuilder()
          .setCustomId(`offer_continue_select_${messageId}`)
          .setPlaceholder('What would you like to do?')
          .addOptions([
            { label: '✅ Confirm and Proceed', value: 'confirm_items' },
            { label: '➕ Add Another Category', value: 'add_category' },
            { label: '❌ Remove Items', value: 'remove_items' }
          ]);

        const row = new ActionRowBuilder().addComponents(continueSelect);
        
        const itemsList = formatItemsList(items);

        await interaction.reply({ 
          content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
          components: [row], 
          flags: 64 
        });
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
	          { label: 'Diamonds', value: 'diamonds', emoji: '💎' },
            { label: 'Huges', value: 'huges', emoji: '🔥' },
            { label: 'Exclusives', value: 'exclusives', emoji: '✨' },
            { label: 'Eggs', value: 'eggs', emoji: '🥚' },
            { label: 'Gifts', value: 'gifts', emoji: '🎁' },
          ]);

        const row = new ActionRowBuilder().addComponents(categorySelect);
        await interaction.reply({ content: 'Select another item category:', components: [row], flags: 64 });
      } else if (choice === 'continue_to_setup') {
        // Load previous inventory data to pre-fill modal
        const previousInventory = inventories.get(interaction.user.id);
        
        // Check if diamonds are already added as items
        const hasDiamonds = (interaction.user.inventoryItems || []).some(item => item.name === '💎 Diamonds');
        
        // Move to inventory setup modal
        const inventoryModal = new ModalBuilder()
          .setCustomId('inventory_setup_modal')
          .setTitle('Complete Your Inventory');

        // Only show diamonds input if not already added as items
        if (!hasDiamonds) {
          const diamondsInput = new TextInputBuilder()
            .setCustomId('inv_diamonds')
            .setLabel('Diamonds in stock (optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('0')
            .setValue(previousInventory ? previousInventory.diamonds.toString() : '0')
            .setRequired(false);

          const row1 = new ActionRowBuilder().addComponents(diamondsInput);
          inventoryModal.addComponents(row1);
        }

        const lookingForInput = new TextInputBuilder()
          .setCustomId('inv_looking_for')
          .setLabel('What are you looking for?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe what items/diamonds you\'re looking for')
          .setValue(previousInventory ? previousInventory.lookingFor : '')
          .setRequired(true);

        const robloxInput = new TextInputBuilder()
          .setCustomId('inv_roblox_username')
          .setLabel('Roblox username (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('YourRobloxUsername')
          .setValue(previousInventory ? previousInventory.robloxUsername : '')
          .setRequired(false);

        const row2 = new ActionRowBuilder().addComponents(lookingForInput);
        const row3 = new ActionRowBuilder().addComponents(robloxInput);

        if (!hasDiamonds) {
          inventoryModal.addComponents(row2, row3);
        } else {
          inventoryModal.addComponents(row2, row3);
        }
        
        delete interaction.user.selectedInventoryItems;
        delete interaction.user.selectedInventoryCategory;
        delete interaction.user.selectedInventorySubcategory;

        await interaction.showModal(inventoryModal);
      } else if (choice === 'remove_items') {
        // Show items to remove
        const items = interaction.user.inventoryItems || [];
        if (items.length === 0) {
          return sendErrorReply(interaction, 'E84', 'No items to remove');
        }

        const { StringSelectMenuBuilder } = require('discord.js');
        
        const removeSelect = new StringSelectMenuBuilder()
          .setCustomId('inventory_remove_item_select')
          .setPlaceholder('Select items to remove')
          .setMinValues(1)
          .setMaxValues(1);

        items.forEach((item, index) => {
          const emoji = getItemEmoji(item.name);
          removeSelect.addOptions({
            label: `${formatItemName(item.name)} (x${item.quantity})`,
            value: `${index}`,
            emoji: emoji
          });
        });

        const row = new ActionRowBuilder().addComponents(removeSelect);
        await interaction.reply({ content: 'Select items to remove:', components: [row], flags: 64 });
      }
    }

    if (interaction.customId === 'inventory_remove_item_select') {
      const indices = interaction.values.map(v => parseInt(v)).sort((a, b) => b - a);
      const items = interaction.user.inventoryItems || [];

      // Remove items in reverse order to maintain correct indices
      indices.forEach(index => {
        if (index >= 0 && index < items.length) {
          items.splice(index, 1);
        }
      });

      if (items.length === 0) {
        await interaction.reply({ content: 'All items removed. Please add items again.', flags: 64 });
        delete interaction.user.inventoryItems;
      } else {
        // Redisplay the continue select
        const { StringSelectMenuBuilder } = require('discord.js');
        
        const continueSelect = new StringSelectMenuBuilder()
          .setCustomId(`inventory_continue_select`)
          .setPlaceholder('What would you like to do?')
          .addOptions([
            { label: '✅ Continue to Next Step', value: 'continue_to_setup' },
            { label: '➕ Add Another Category', value: 'add_category' },
            { label: '❌ Remove Items', value: 'remove_items' }
          ]);

        const row = new ActionRowBuilder().addComponents(continueSelect);
        
        const currentPage = interaction.user.currentInventoryPage || 1;
        const totalPages = Math.ceil(items.length / 15);
        const start = (currentPage - 1) * 15;
        const end = start + 15;
        const pageItems = items.slice(start, end);
        const itemsList = formatItemsList(pageItems);

        const embed = new EmbedBuilder()                                                        //\nWhat would you like to do
          .setDescription(`**Selected Items (Page ${currentPage}/${totalPages}):**\n${itemsList}\n`)
          .setColor(0x00a8ff);

        const components = [row];
        if (totalPages > 1) {
          const paginationRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inventory_page_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
            new ButtonBuilder().setCustomId('inventory_page_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
          );
          components.push(paginationRow);
        }

        await interaction.reply({ 
          embeds: [embed],
          components, 
          flags: 64 
        });
      }
    }

    if (interaction.customId === 'giveaway_continue_select') {
      const choice = interaction.values[0];

      if (choice === 'add_category') {
        const { StringSelectMenuBuilder } = require('discord.js');
        
        const categorySelect = new StringSelectMenuBuilder()
          .setCustomId('giveaway_category_select')
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
      } else if (choice === 'create_giveaway') {
        // Move to giveaway setup modal
        const giveawayModal = new ModalBuilder()
          .setCustomId('giveaway_setup_modal')
          .setTitle('Create Your Giveaway');

        const descriptionInput = new TextInputBuilder()
          .setCustomId('gwa_description')
          .setLabel('Giveaway Description (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe the giveaway...')
          .setRequired(false);

        const durationInput = new TextInputBuilder()
          .setCustomId('gwa_duration')
          .setLabel('Duration (max 24 hours / 86400 seconds)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 60m, 1h, 3600s, or 1440')
          .setMinLength(1)
          .setMaxLength(4)
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(descriptionInput);
        const row2 = new ActionRowBuilder().addComponents(durationInput);

        giveawayModal.addComponents(row1, row2);
        
        delete interaction.user.selectedGiveawayItems;
        delete interaction.user.selectedGiveawayCategory;
        delete interaction.user.selectedGiveawaySubcategory;

        await interaction.showModal(giveawayModal);
      } else if (choice === 'remove_items') {
        // Show items to remove
        const items = interaction.user.giveawayItems || [];
        if (items.length === 0) {
          return sendErrorReply(interaction, 'E84', 'No items to remove');
        }

        const { StringSelectMenuBuilder } = require('discord.js');
        
        const removeSelect = new StringSelectMenuBuilder()
          .setCustomId('giveaway_remove_item_select')
          .setPlaceholder('Select items to remove')
          .setMinValues(1)
          .setMaxValues(Math.min(100, items.length));

        items.forEach((item, index) => {
          const emoji = getItemEmoji(item.name);
          removeSelect.addOptions({
            label: `${formatItemName(item.name)} (x${item.quantity})`,
            value: `${index}`,
            emoji: emoji
          });
        });

        const row = new ActionRowBuilder().addComponents(removeSelect);
        await interaction.reply({ content: 'Select items to remove:', components: [row], flags: 64 });
      }
    }

    if (interaction.customId === 'giveaway_remove_item_select') {
      const indices = interaction.values.map(v => parseInt(v)).sort((a, b) => b - a);
      const items = interaction.user.giveawayItems || [];

      // Remove items in reverse order to maintain correct indices
      indices.forEach(index => {
        if (index >= 0 && index < items.length) {
          items.splice(index, 1);
        }
      });

      if (items.length === 0) {
        await interaction.reply({ content: 'All items removed. Please add items again.', flags: 64 });
        delete interaction.user.giveawayItems;
      } else {
        // Redisplay the continue select
        const { StringSelectMenuBuilder } = require('discord.js');
        
        const continueSelect = new StringSelectMenuBuilder()
          .setCustomId(`giveaway_continue_select`)
          .setPlaceholder('What would you like to do?')
          .addOptions([
            { label: '✅ Create Giveaway', value: 'create_giveaway' },
            { label: '➕ Add Another Category', value: 'add_category' },
            { label: '❌ Remove Items', value: 'remove_items' }
          ]);

        const row = new ActionRowBuilder().addComponents(continueSelect);
        
        const currentPage = interaction.user.currentGiveawayPage || 1;
        const totalPages = Math.ceil(items.length / 15);
        const start = (currentPage - 1) * 15;
        const end = start + 15;
        const pageItems = items.slice(start, end);
        const itemsList = formatItemsList(pageItems);

        const embed = new EmbedBuilder()                                                        //\nWhat would you like to do
          .setDescription(`**Selected Items (Page ${currentPage}/${totalPages}):**\n${itemsList}\n`)
          .setColor(0xFF1493);

        const components = [row];
        if (totalPages > 1) {
          const paginationRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('giveaway_page_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
            new ButtonBuilder().setCustomId('giveaway_page_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
          );
          components.push(paginationRow);
        }

        await interaction.reply({ 
          embeds: [embed],
          components, 
          flags: 64 
        });
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
        .setMaxValues(Math.min(items.length, 100))
        .addOptions(items.map(item => ({ 
          label: formatItemName(item), 
          value: item,
          emoji: getItemEmoji(item)
        })));

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
        .setMaxValues(Math.min(items.length, 100))
        .addOptions(items.map(item => ({ 
          label: formatItemName(item), 
          value: item,
          emoji: getItemEmoji(item)
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${subcategory}**:`, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('inventory_item_select_')) {
      const parts = interaction.customId.replace('inventory_item_select_', '').split('_');
      let category = parts[0];
      let subcategory = parts.length > 1 ? parts.slice(1).join('_') : null;
      
      const selectedItems = interaction.values;

      // Store items selection - no longer limited to 25
      interaction.user.selectedInventoryItems = selectedItems;
      interaction.user.selectedInventoryCategory = category;
      interaction.user.selectedInventorySubcategory = subcategory;

      const quantityModal = new ModalBuilder()
        .setCustomId(`inventory_item_quantities_modal`)
        .setTitle('Select Quantities');

      const quantitiesInput = new TextInputBuilder()
        .setCustomId('inv_quantities')
        .setLabel(`Quantities for ${selectedItems.length} items (comma separated)`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('1,1,1... (one per item)')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(quantitiesInput);
      quantityModal.addComponents(row);

      await interaction.showModal(quantityModal);
    }

    if (interaction.customId === 'giveaway_category_select') {
      const category = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      if (category === 'diamonds') {
        
        // Show modal for diamonds input
        const diamondsModal = new ModalBuilder()
          .setCustomId('giveaway_diamonds_modal')
          .setTitle('Add Diamonds to Giveaway');

        const diamondsInput = new TextInputBuilder()
          .setCustomId('giveaway_diamonds_amount')
          .setLabel('Amount of Diamonds')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 5000, 10K, 1M')
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(diamondsInput);
        diamondsModal.addComponents(row1);

        await interaction.showModal(diamondsModal);
        return;
      }
      
      if (category === 'huges') {
        const subcategorySelect = new StringSelectMenuBuilder()
          .setCustomId('giveaway_huge_subcategory_select')
          .setPlaceholder('Select a Huge subcategory')
          .addOptions(Object.keys(giveawayItemCategories.huges).map(sub => ({
            label: sub,
            value: sub
          })));
        const row = new ActionRowBuilder().addComponents(subcategorySelect);
        await interaction.reply({ content: `Select a subcategory from **Huges**:`, components: [row], flags: 64 });
        return;
      }
      
      const items = giveawayItemCategories[category];
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`giveaway_item_select_${category}`)
        .setPlaceholder(`Select items from ${category}`)
        .setMaxValues(Math.min(items.length, 100))
        .addOptions(items.map(item => ({ 
          label: formatItemName(item), 
          value: item,
          emoji: getItemEmoji(item)
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${category}** category:`, components: [row], flags: 64 });
    }

    if (interaction.customId === 'giveaway_huge_subcategory_select') {
      const subcategory = interaction.values[0];
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const items = giveawayItemCategories.huges[subcategory];
      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`giveaway_item_select_huges_${subcategory}`)
        .setPlaceholder(`Select items from ${subcategory}`)
        .setMaxValues(Math.min(items.length, 100))
        .addOptions(items.map(item => ({ 
          label: formatItemName(item), 
          value: item,
          emoji: getItemEmoji(item)
        })));

      const row = new ActionRowBuilder().addComponents(itemSelect);
      await interaction.reply({ content: `Select items from **${subcategory}**:`, components: [row], flags: 64 });
    }

    if (interaction.customId.startsWith('giveaway_item_select_')) {
      const parts = interaction.customId.replace('giveaway_item_select_', '').split('_');
      let category = parts[0];
      let subcategory = parts.length > 1 ? parts.slice(1).join('_') : null;
      
      const selectedItems = interaction.values;

      // Store items selection - no longer limited to 25
      interaction.user.selectedGiveawayItems = selectedItems;
      interaction.user.selectedGiveawayCategory = category;
      interaction.user.selectedGiveawaySubcategory = subcategory;

      const quantityModal = new ModalBuilder()
        .setCustomId(`giveaway_item_quantities_modal`)
        .setTitle('Select Quantities');

      const quantitiesInput = new TextInputBuilder()
        .setCustomId('gwa_quantities')
        .setLabel(`Quantities for ${selectedItems.length} items (comma separated)`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('1,1,1... (one per item)')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(quantitiesInput);
      quantityModal.addComponents(row);

      await interaction.showModal(quantityModal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'trade_diamonds_modal') {
      const diamondsStr = interaction.fields.getTextInputValue('diamonds_amount');
      const diamonds = parseBid(diamondsStr);

      if (!interaction.user.tradeItems) {
        interaction.user.tradeItems = [];
      }

      // Check if diamonds already exist, if so replace quantity instead of adding
      const existingDiamondsIndex = interaction.user.tradeItems.findIndex(item => item.name === '💎 Diamonds');
      if (existingDiamondsIndex !== -1) {
        interaction.user.tradeItems[existingDiamondsIndex].quantity = diamonds;
      } else {
        interaction.user.tradeItems.push({ name: `💎 Diamonds`, quantity: diamonds });
      }

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId('trade_continue_select')
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Confirm and Proceed', value: 'confirm_items' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const currentPage = interaction.user.currentTradePage || 1;
      const totalPages = Math.ceil((interaction.user.tradeItems || []).length / 15);
      const start = (currentPage - 1) * 15;
      const end = start + 15;
      const pageItems = (interaction.user.tradeItems || []).slice(start, end);
      const itemsList = formatItemsList(pageItems);

      const embed = new EmbedBuilder()
        .setDescription(`**Selected Items (Page ${currentPage}/${totalPages}):**\n${itemsList}\n\nWhat would you like to do?`)
        .setColor(0x0099ff);

      const components = [row];
      if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('trade_page_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
          new ButtonBuilder().setCustomId('trade_page_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
        );
        components.push(paginationRow);
      }

      await interaction.reply({ 
        embeds: [embed],
        components, 
        flags: 64 
      });
      return;
    }

    if (interaction.customId === 'trade_remove_item_select') {
      const indicesToRemove = interaction.values.map(v => parseInt(v)).sort((a, b) => b - a);
      
      indicesToRemove.forEach(idx => {
        if (interaction.user.tradeItems && interaction.user.tradeItems[idx]) {
          interaction.user.tradeItems.splice(idx, 1);
        }
      });

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId('trade_continue_select')
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Confirm and Proceed', value: 'confirm_items' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const currentPage = interaction.user.currentTradePage || 1;
      const totalPages = Math.ceil((interaction.user.tradeItems || []).length / 15);
      const start = (currentPage - 1) * 15;
      const end = start + 15;
      const pageItems = (interaction.user.tradeItems || []).slice(start, end);
      const itemsList = pageItems.length > 0 ? formatItemsList(pageItems) : 'No items selected';

      const embed = new EmbedBuilder()
        .setDescription(`**Selected Items (Page ${currentPage}/${totalPages}):**\n${itemsList}\n\nWhat would you like to do?`)
        .setColor(0x0099ff);

      const components = [row];
      if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('trade_page_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
          new ButtonBuilder().setCustomId('trade_page_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
        );
        components.push(paginationRow);
      }

      await interaction.reply({ 
        embeds: [embed],
        components, 
        flags: 64 
      });
    }

    if (interaction.customId.startsWith('offer_diamonds_modal_')) {
      const messageId = interaction.customId.replace('offer_diamonds_modal_', '');
      const diamondsStr = interaction.fields.getTextInputValue('offer_diamonds_amount');
      const diamonds = parseBid(diamondsStr);

      if (!interaction.user.offerTradeItems) {
        interaction.user.offerTradeItems = [];
      }

      // Check if diamonds already exist, if so replace quantity instead of adding
      const existingDiamondsIndex = interaction.user.offerTradeItems.findIndex(item => item.name === '💎 Diamonds');
      if (existingDiamondsIndex !== -1) {
        interaction.user.offerTradeItems[existingDiamondsIndex].quantity = diamonds;
      } else {
        interaction.user.offerTradeItems.push({ name: `💎 Diamonds`, quantity: diamonds });
      }

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_continue_select_${messageId}`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Confirm and Proceed', value: 'confirm_items' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsList = formatItemsList(interaction.user.offerTradeItems);

      await interaction.reply({ 
        content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
        components: [row], 
        flags: 64 
      });
      return;
    }

    if (interaction.customId === 'inventory_diamonds_modal') {
      const diamondsStr = interaction.fields.getTextInputValue('inv_diamonds_amount');
      const diamonds = parseBid(diamondsStr);

      if (!interaction.user.inventoryItems) {
        interaction.user.inventoryItems = [];
      }

      // Check if diamonds already exist, if so replace quantity instead of adding
      const existingDiamondsIndex = interaction.user.inventoryItems.findIndex(item => item.name === '💎 Diamonds');
      if (existingDiamondsIndex !== -1) {
        interaction.user.inventoryItems[existingDiamondsIndex].quantity = diamonds;
      } else {
        interaction.user.inventoryItems.push({ name: `💎 Diamonds`, quantity: diamonds });
      }

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`inventory_continue_select`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Continue to Next Step', value: 'continue_to_setup' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsList = formatItemsList(interaction.user.inventoryItems);

      await interaction.reply({ 
        content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
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
      const quantitiesStr = interaction.fields.getTextInputValue('quantities');
      const quantities = quantitiesStr.split(',').map(q => parseInt(q.trim()) || 1);
      if (quantities.length !== selectedItems.length) {
        return sendErrorReply(interaction, 'E80', `Please provide exactly ${selectedItems.length} quantities separated by commas`);
      }
      const itemsWithQty = selectedItems.map((item, index) => {
        const qty = Math.max(1, quantities[index]);
        return { name: item, quantity: qty };
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
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const ITEMS_PER_PAGE = 15;
      const totalPages = Math.ceil(interaction.user.tradeItems.length / ITEMS_PER_PAGE);
      interaction.user.currentTradePage = 1;
      const currentPage = 1;
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const pageItems = interaction.user.tradeItems.slice(start, end);
      const itemsList = formatItemsList(pageItems);
      const description = `**Selected Items (Page ${currentPage}/${totalPages}):**\n${itemsList}\n\nWhat would you like to do?`;

      const embed = new EmbedBuilder().setDescription(description);
      const components = [row];
      if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('trade_page_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
          new ButtonBuilder().setCustomId('trade_page_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages)
        );
        components.push(paginationRow);
      }

      await interaction.reply({ 
        embeds: [embed],
        components, 
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
      const quantitiesStr = interaction.fields.getTextInputValue('offer_quantities');
      const quantities = quantitiesStr.split(',').map(q => parseInt(q.trim()) || 1);
      if (quantities.length !== selectedItems.length) {
        return sendErrorReply(interaction, 'E80', `Please provide exactly ${selectedItems.length} quantities separated by commas`);
      }
      const itemsWithQty = selectedItems.map((item, index) => {
        const qty = Math.max(1, quantities[index]);
        return { name: item, quantity: qty };
      });

      // Store in user's session
      if (!interaction.user.offerTradeItems) {
        interaction.user.offerTradeItems = [];
      }
      interaction.user.offerTradeItems = interaction.user.offerTradeItems.concat(itemsWithQty);
      
      // Track item count for validation
      trackItemCount(interaction.user.id, 'offerTradeCount', interaction.user.offerTradeItems.length);

      // Show option to add more categories or proceed
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`offer_continue_select_${messageId}`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Confirm and Proceed', value: 'confirm_items' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsList = formatItemsList(interaction.user.offerTradeItems);

      await interaction.reply({ 
        content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
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

      // Process quantities
      const quantitiesStr = interaction.fields.getTextInputValue('inv_quantities');
      const quantities = quantitiesStr.split(',').map(q => parseInt(q.trim()) || 1);
      if (quantities.length !== selectedItems.length) {
        return sendErrorReply(interaction, 'E80', `Please provide exactly ${selectedItems.length} quantities separated by commas`);
      }
      const itemsWithQty = selectedItems.map((item, index) => {
        const qty = Math.max(1, quantities[index]);
        return { name: item, quantity: qty };
      });

      if (!interaction.user.inventoryItems) {
        interaction.user.inventoryItems = [];
      }
      interaction.user.inventoryItems = interaction.user.inventoryItems.concat(itemsWithQty);
      
      // Track item count for validation
      trackItemCount(interaction.user.id, 'inventoryCount', interaction.user.inventoryItems.length);

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`inventory_continue_select`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Continue to Next Step', value: 'continue_to_setup' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsList = formatItemsList(interaction.user.inventoryItems);

      await interaction.reply({ 
        content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
        components: [row], 
        flags: 64 
      });
      return;
    }

    if (interaction.customId === 'giveaway_item_quantities_modal') {
      const selectedItems = interaction.user.selectedGiveawayItems || [];
      const category = interaction.user.selectedGiveawayCategory;
      const subcategory = interaction.user.selectedGiveawaySubcategory;

      // Process quantities
      const quantitiesStr = interaction.fields.getTextInputValue('gwa_quantities');
      const quantities = quantitiesStr.split(',').map(q => parseInt(q.trim()) || 1);
      if (quantities.length !== selectedItems.length) {
        return sendErrorReply(interaction, 'E80', `Please provide exactly ${selectedItems.length} quantities separated by commas`);
      }
      const itemsWithQty = selectedItems.map((item, index) => {
        const qty = Math.max(1, quantities[index]);
        return { name: item, quantity: qty };
      });

      if (!interaction.user.giveawayItems) {
        interaction.user.giveawayItems = [];
      }
      interaction.user.giveawayItems = interaction.user.giveawayItems.concat(itemsWithQty);
      
      // Track item count for validation
      trackItemCount(interaction.user.id, 'giveawayCount', interaction.user.giveawayItems.length);

      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId(`giveaway_continue_select`)
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Create Giveaway', value: 'create_giveaway' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsList = formatItemsList(interaction.user.giveawayItems);

      await interaction.reply({ 
        content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
        components: [row], 
        flags: 64 
      });
      return;
    }

    if (interaction.customId === 'inventory_setup_modal') {
  // Defer the reply to avoid timeout on long operations
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const diamondsStr = interaction.fields.fields.has('inv_diamonds') ? interaction.fields.getTextInputValue('inv_diamonds') : '0';
  const lookingFor = interaction.fields.getTextInputValue('inv_looking_for') || 'Not specified';
  const robloxInput = interaction.fields.getTextInputValue('inv_roblox_username') || '';

  let diamonds = 0;
  if (diamondsStr && diamondsStr !== '0') {
    diamonds = parseBid(diamondsStr);
  }

  // --- USERNAME TO ID CONVERSION LOGIC ---
  let robloxId = null;
  if (robloxInput) {
    // If input is only numbers, treat as ID. If not, search for ID by Name.
    if (!isNaN(robloxInput)) {
      robloxId = robloxInput;
    } else {
      // Helper function to get ID by name (see below)
      robloxId = await getRobloxId(robloxInput);
    }
  }

  const inventoryItems = interaction.user.inventoryItems || [];
  
  // Validate that items were not lost
  const itemCountBeforeDeletion = inventoryItems.length;
  validateItemsNotLost(interaction, 'Inventory Setup', itemCountBeforeDeletion, inventoryItems);

  delete interaction.user.inventoryItems;
  delete interaction.user.selectedInventoryItems;
  delete interaction.user.selectedInventoryCategory;
  delete interaction.user.selectedInventorySubcategory;
  
  // Validate item count before finalizing
  const isValid = await validateItemCount(interaction, 'inventoryCount', inventoryItems.length, inventoryItems);
  if (!isValid) {
    return sendErrorReply(interaction, 'E50', 'Item count validation failed. Please try again.');
  }
  
  delete interaction.user.inventoryItems;
  // ... (rest of your deletes)

  // Logic to delete previous inventory...
  const previousInventory = inventories.get(interaction.user.id);
  if (previousInventory) {
    try {
      const channel = interaction.guild.channels.cache.get(previousInventory.channelId);
      const message = await channel.messages.fetch(previousInventory.messageId);
      await message.delete();
    } catch (e) {}
  }

  // Criar o embed
  const embed = new EmbedBuilder()
    .setTitle('📦 Inventory')
    .setColor(0x00a8ff)
    .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
    .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

  // AUTHOR CONFIGURATION (Roblox Avatar)
  if (robloxId && robloxId !== 'null' && robloxId !== '' && !isNaN(robloxId)) {
    // Fetch user's Roblox avatar
    const avatarUrl = await getRobloxAvatarUrl(robloxId);
    
    if (avatarUrl) {
      console.log(`Loading Roblox avatar for user ${interaction.user.username} with ID ${robloxId}: ${avatarUrl}`);
      
      embed.setAuthor({ 
        name: interaction.member.displayName, 
        iconURL: avatarUrl 
      });
    } else {
      // If failed to get Roblox avatar, use Discord avatar
      console.log(`Failed to fetch Roblox avatar for ID ${robloxId}, using Discord avatar`);
      embed.setAuthor({ 
        name: interaction.member.displayName, 
        iconURL: interaction.user.displayAvatarURL() 
      });
    }
  } else {
    if (robloxInput) {
      console.log(`Failed to load Roblox avatar for username: ${robloxInput} (resolved ID: ${robloxId})`);
    }
    embed.setAuthor({ 
      name: interaction.member.displayName, 
      iconURL: interaction.user.displayAvatarURL() 
    });
  }

  // Rest of embed filling...
  // Paginate inventory items
  const inventoryPaginationData = paginateTradeItems(inventoryItems, 1, 10);
  const inventoryItemsField = inventoryPaginationData.totalPages > 1 
    ? `${inventoryPaginationData.text}\n\n*Page ${inventoryPaginationData.page}/${inventoryPaginationData.totalPages}*`
    : inventoryPaginationData.text;

  addFieldSafely(embed,
    `Items${diamonds > 0 ? ` + ${formatBid(diamonds)} 💎` : 'None'}`,
    inventoryItemsField,
    false
  );

  addFieldSafely(embed, 'Looking For', lookingFor, true);

  const now = new Date();
  // Adjust to GMT-5 (UTC-5)
  const gmt5Time = new Date(now.getTime() - (5 * 60 * 60 * 1000));
  const timeStr = `${gmt5Time.getDate()}/${gmt5Time.getMonth() + 1}/${gmt5Time.getFullYear()} at ${gmt5Time.getHours().toString().padStart(2, '0')}:${gmt5Time.getMinutes().toString().padStart(2, '0')}`;
  addFieldSafely(embed, 'Last Edited', timeStr, false);

  // Buttons and sending...
  const updateButton = new ButtonBuilder()
    .setCustomId('inventory_update_button')
    .setLabel('Update Inventory')
    .setStyle(ButtonStyle.Primary);

  const deleteButton = new ButtonBuilder()
    .setCustomId('inventory_delete_button')
    .setLabel('Delete Items')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(updateButton, deleteButton);
  const components = [row];

  // Add pagination buttons if there are multiple pages
  if (inventoryPaginationData.hasMultiplePages) {
    const paginationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`inventory_page_prev_${Date.now()}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`inventory_page_next_${Date.now()}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(inventoryPaginationData.page === inventoryPaginationData.totalPages)
    );
    components.push(paginationRow);
  }
  const targetChannel = redirectInventoryChannelId ? interaction.guild.channels.cache.get(redirectInventoryChannelId) : interaction.channel;
  
  let message;
  if (interaction.deferred) {
    // If we deferred earlier, use editReply for the deferred response
    const ephemeralMessage = await interaction.editReply({ embeds: [embed], components: [row] });
    // Send a public copy to the target channel if different from current channel
    if (targetChannel.id !== interaction.channel.id) {
      message = await targetChannel.send({ embeds: [embed], components: [row] });
    } else {
      message = ephemeralMessage;
    }
  } else {
    message = await targetChannel.send({ embeds: [embed], components: [row] });
  }

  // Salvar dados
  const inventoryData = {
    messageId: message.id,
    channelId: targetChannel.id,
    items: inventoryItems,
    diamonds: diamonds,
    lookingFor: lookingFor,
    robloxUsername: robloxInput, // guarda o que o user digitou
    lastEdited: gmt5Time
  };
  inventories.set(interaction.user.id, inventoryData);
}

// HELPER FUNCTION (Place outside interaction event)
async function getRobloxId(username) {
  try {
    if (!username || username.trim() === '') return null;
    
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username.trim()], excludeBannedUsers: true })
    });
    
    if (!response.ok) {
      console.error(`Roblox API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    if (data.data && data.data.length > 0 && data.data[0].id) {
      return data.data[0].id;
    }
    return null;
  } catch (e) {
    console.error('Error fetching Roblox ID:', e);
    return null;
  }
}

// Function to get Roblox avatar using official API
async function getRobloxAvatarUrl(userId) {
  try {
    if (!userId || isNaN(userId)) return null;
    
    const apiUrl = `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`;
    console.log(`Fetching Roblox avatar from API: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`Roblox API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Check if API returned data
    if (data.data && data.data.length > 0) {
      const avatarData = data.data[0];
      
      // Check if state is "Completed" and if there's imageUrl
      if (avatarData.state === 'Completed' && avatarData.imageUrl) {
        console.log(`✅ Avatar URL successfully obtained for user ${userId}`);
        return avatarData.imageUrl;
      } else {
        console.log(`⚠️ Avatar state: ${avatarData.state}`);
        return null;
      }
    }
    
    console.log(`⚠️ No avatar data returned by API`);
    return null;
  } catch (e) {
    console.error('Error fetching Roblox avatar URL:', e.message);
    return null;
  }
}
  
    if (interaction.customId === 'giveaway_setup_modal') {
      // Defer the reply to avoid timeout on long operations
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const giveawayItems = interaction.user.giveawayItems || [];
      const description = interaction.fields.getTextInputValue('gwa_description') || '';
      const durationStr = interaction.fields.getTextInputValue('gwa_duration');
      
      // Validate that items were not lost
      const itemCountBeforeDeletion = giveawayItems.length;
      validateItemsNotLost(interaction, 'Giveaway Setup', itemCountBeforeDeletion, giveawayItems);
      
      // Validate item count before finalizing
      const isValid = await validateItemCount(interaction, 'giveawayCount', giveawayItems.length, giveawayItems);
      if (!isValid) {
        return sendErrorReply(interaction, 'E50', 'Item count validation failed. Please try again.');
      }
      
      // Validate duration
      let duration = parseDuration(durationStr);
      const MAX_DURATION_MINUTES = 1440; // 24 hours = 1440 minutes = 86400 seconds
      
      if (isNaN(duration) || duration < 1 || duration > MAX_DURATION_MINUTES) {
        return sendErrorReply(interaction, 'E85', `Invalid duration. Please enter a time between 1 second and 24 hours (1440 minutes or 86400 seconds). Examples: 60s, 30m, 1h, 1440, etc.`);
      }
      
      delete interaction.user.giveawayItems;
      delete interaction.user.selectedGiveawayItems;
      delete interaction.user.selectedGiveawayCategory;
      delete interaction.user.selectedGiveawaySubcategory;

      // Create giveaway embed
      const embed = new EmbedBuilder()
        .setTitle('🎁 Giveaway')
        .setDescription(description ? `**${description}**\n\n**Click the button below to enter the giveaway!**` : '**Click the button below to enter the giveaway!**')
        .setColor(0xFF1493)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      // Format giveaway items with pagination
      const giveawayPaginationData = paginateTradeItems(giveawayItems, 1, 10);
      const giveawayItemsField = giveawayPaginationData.totalPages > 1 
        ? `${giveawayPaginationData.text}\n\n*Page ${giveawayPaginationData.page}/${giveawayPaginationData.totalPages}*`
        : giveawayPaginationData.text;

      addFieldSafely(embed, 'Giveaway Items', giveawayItemsField, false);

      addFieldSafely(embed, 'Hosted by', interaction.user.toString(), false);

      // Add creator description if provided
      if (description) {
        addFieldSafely(embed, 'Description',
          description,
        false
        );
      }

      // Add duration field
      addFieldSafely(embed, 'Time Remaining', 'Calculating...', false);

      // Calculate duration text for the reply message
      const durationHours = Math.floor(duration / 60);
      const durationMins = duration % 60;
      let durationText = '';
      if (durationHours > 0) durationText += `${durationHours}h `;
      if (durationMins > 0) durationText += `${durationMins}m`;
      if (!durationText) durationText = duration + 'm';

      // Store durationText in user object temporarily for use after setInterval
      const replyMessage = `Giveaway created! Posted to the channel with role mention! Duration: ${durationText}`;

      const enterButton = new ButtonBuilder()
        .setCustomId(`giveaway_enter_${Date.now()}`)
        .setLabel('Enter Giveaway')
        .setStyle(ButtonStyle.Success);

      const entriesButton = new ButtonBuilder()
        .setCustomId(`giveaway_entries_${Date.now()}`)
        .setLabel('0 Entries')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false);

      const endButton = new ButtonBuilder()
        .setCustomId(`giveaway_end_${Date.now()}`)
        .setLabel('End Giveaway')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(enterButton, entriesButton, endButton);

      const targetChannel = redirectGiveawayChannelId ? interaction.guild.channels.cache.get(redirectGiveawayChannelId) : interaction.channel;
      
      // Send ping message with role mention
      await targetChannel.send(`<@&${config.giveawayRoleId}> **New Giveaway Started!**`);
      
      const message = await targetChannel.send({ embeds: [embed], components: [row] });

      const expiresAt = Date.now() + (duration * 60 * 1000);
      const giveawayData = {
        host: interaction.user,
        items: giveawayItems,
        channelId: targetChannel.id,
        messageId: message.id,
        entries: [],
        duration: duration,
        expiresAt: expiresAt,
        updateInterval: null
      };

      giveaways.set(message.id, giveawayData);
      
      // Increment giveaway count for user
      const userId = interaction.user.id;
      userGiveawayCount.set(userId, (userGiveawayCount.get(userId) || 0) + 1);
      
      // Function to format remaining time
      const formatTimeRemaining = (expiresAt) => {
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        if (remaining <= 0) return 'Ending...';
        
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        
        let timeStr = '';
        if (hours > 0) timeStr += `${hours}h `;
        if (minutes > 0) timeStr += `${minutes}m `;
        timeStr += `${seconds}s`;
        return timeStr;
      };
      
      // Update embed every second
      const updateInterval = setInterval(async () => {
        try {
          const currentGiveaway = giveaways.get(message.id);
          if (!currentGiveaway) {
            clearInterval(updateInterval);
            return;
          }
          
          const remaining = Math.max(0, Math.ceil((currentGiveaway.expiresAt - Date.now()) / 1000));
          
          // Check if giveaway should end
          if (remaining <= 0) {
            clearInterval(updateInterval);
            giveaways.delete(message.id);
            userGiveawayCount.set(userId, Math.max(0, (userGiveawayCount.get(userId) || 1) - 1));
            
            // Auto-end the giveaway
            if (currentGiveaway.entries.length > 0) {
              const randomIndex = Math.floor(Math.random() * currentGiveaway.entries.length);
              const winner = currentGiveaway.entries[randomIndex];
              
              const endEmbed = new EmbedBuilder()
                .setTitle('🎁 Giveaway Ended!')
                .setColor(0xFF1493)
                .setFooter({ text: 'Version 1.1.3 | Made By Atlas' });
              
              // Winner field
              addFieldSafely(endEmbed, 'Winner', `**${winner.user}**`, false);
              
              const itemsText = currentGiveaway.items && currentGiveaway.items.length > 0 ? formatItemsText(currentGiveaway.items) : 'None';
              addFieldSafely(endEmbed, 'Giveaway Items', itemsText, false);
              
              addFieldSafely(endEmbed, 'Total Entries', currentGiveaway.entries.length.toString(), true);
              
              const channel = interaction.guild.channels.cache.get(currentGiveaway.channelId);
              if (channel) {
                await channel.send({ embeds: [endEmbed] });
                await channel.send(`🎉 Congratulations ${winner.user}! You won the giveaway!`);
              }
            }
            return;
          }
          
          // Update the embed with new time remaining
          const updatedEmbed = new EmbedBuilder()
            .setTitle('🎁 Giveaway')
            .setDescription(currentGiveaway.description ? `**${currentGiveaway.description}**\n\n**Click the button below to enter the giveaway!**` : '**Click the button below to enter the giveaway!**')
            .setColor(0xFF1493)
            .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
            .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');
          
          const giveawayItemsText = formatItemsText(currentGiveaway.items);
          
          addFieldSafely(updatedEmbed, 'Giveaway Items', giveawayItemsText, false);
          
          addFieldSafely(updatedEmbed, 'Hosted by', currentGiveaway.host.toString(), false);
          
          addFieldSafely(updatedEmbed, 'Time Remaining', formatTimeRemaining(currentGiveaway.expiresAt), false);
          
          // Update components with new entries count
          const entriesCount = currentGiveaway.entries.length;
          const enterBtn = new ButtonBuilder()
            .setCustomId(`giveaway_enter_${currentGiveaway.messageId}`)
            .setLabel('Enter Giveaway')
            .setStyle(ButtonStyle.Success);
          
          const entriesBtn = new ButtonBuilder()
            .setCustomId(`giveaway_entries_${currentGiveaway.messageId}`)
            .setLabel(`${entriesCount} ${entriesCount === 1 ? 'Entry' : 'Entries'}`)
            .setStyle(ButtonStyle.Secondary);
          
          const endBtn = new ButtonBuilder()
            .setCustomId(`giveaway_end_${currentGiveaway.messageId}`)
            .setLabel('End Giveaway')
            .setStyle(ButtonStyle.Danger);
          
          const row = new ActionRowBuilder().addComponents(enterBtn, entriesBtn, endBtn);
          
          await message.edit({ embeds: [updatedEmbed], components: [row] });
        } catch (error) {
          clearInterval(updateInterval);
          console.error('Error updating giveaway embed:', error);
        }
      }, 1000);
      
      giveawayData.updateInterval = updateInterval;

      if (interaction.deferred) {
        await interaction.editReply({ content: replyMessage });
      } else {
        await interaction.reply({ content: replyMessage, flags: 64 });
      }
      return;
    }

    if (interaction.customId === 'trade_setup_modal') {
      let diamondsStr = '0';
      try {
        diamondsStr = interaction.fields.getTextInputValue('trade_diamonds') || '0';
      } catch (e) {
        // Field not found - diamonds already added as items
        diamondsStr = '0';
      }
      
      const targetUsername = interaction.fields.getTextInputValue('trade_target_user') || '';

      let diamonds = 0;
      if (diamondsStr && diamondsStr !== '0') {
        diamonds = parseBid(diamondsStr);
      }

      const hostItems = interaction.user.tradeItems || [];
      
      // Validate that items were not lost (track item count before deletion)
      const itemCountBeforeDeletion = hostItems.length;
      validateItemsNotLost(interaction, 'Trade Offer Setup', itemCountBeforeDeletion, hostItems);
      
      delete interaction.user.tradeItems;
      delete interaction.user.selectedTradeItems;
      delete interaction.user.selectedTradeCategory;
      delete interaction.user.selectedTradeSubcategory;

      // Paginate items if more than 10
      const paginationData = paginateTradeItems(hostItems, 1, 10);

      // Create trade embed
      const embed = new EmbedBuilder()
        .setTitle('Trade Offer')
        .setDescription(`**Host:** <@${interaction.user.id}>\n**Status:** Waiting for offers`)
        .setColor(0x0099ff)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      // Format host items with pagination info
      const hostItemsField = paginationData.totalPages > 1 
        ? `${paginationData.text}\n\n*Page ${paginationData.page}/${paginationData.totalPages}*`
        : paginationData.text;
      
      addFieldSafely(embed, 
        `Host Items${diamonds > 0 ? ` + ${formatBid(diamonds)} 💎` : ''}`,
        hostItemsField,
        false
      );

      const offerButton = new ButtonBuilder()
        .setCustomId('trade_offer_button')
        .setLabel('Make Offer')
        .setStyle(ButtonStyle.Primary);

      const deleteButton = new ButtonBuilder()
        .setCustomId(`trade_delete_${Date.now()}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(offerButton, deleteButton);
      const components = [row];

      // Add pagination buttons if there are multiple pages
      if (paginationData.hasMultiplePages) {
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`trade_page_prev_${Date.now()}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`trade_page_next_${Date.now()}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(paginationData.page === paginationData.totalPages)
        );
        components.push(paginationRow);
      }

      const targetChannel = redirectTradeChannelId ? interaction.guild.channels.cache.get(redirectTradeChannelId) : interaction.channel;
      const message = await targetChannel.send({ embeds: [embed], components });

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
        currentPage: 1,
        itemsPerPage: 10
      };

      trades.set(message.id, trade);
      botLogs.addLog('TRADE_CREATED', 'New trade offer created', interaction.user.id, { tradeId: message.id, targetUsername, diamonds, itemsCount: hostItems.length });

      // Increment trade count for user
      const currentCount = userTradeCount.get(interaction.user.id) || 0;
      userTradeCount.set(interaction.user.id, currentCount + 1);

      await interaction.reply({ content: `Trade offer created in ${targetChannel}! ${targetUsername ? `Awaiting response from ${targetUsername}.` : 'Open for all users.'}`, flags: 64 });
      return;
    }

    if (interaction.customId.startsWith('trade_page_prev_') || interaction.customId.startsWith('trade_page_next_')) {
      const messageId = interaction.message.id;
      const trade = trades.get(messageId);
      
      if (!trade) {
        await interaction.reply({ content: 'Trade not found.', flags: MessageFlags.Ephemeral });
        return;
      }

      const currentPage = trade.currentPage || 1;
      const totalPages = Math.ceil(trade.hostItems.length / (trade.itemsPerPage || 10));
      let newPage = currentPage;

      if (interaction.customId.startsWith('trade_page_prev_') && currentPage > 1) newPage--;
      if (interaction.customId.startsWith('trade_page_next_') && currentPage < totalPages) newPage++;

      trade.currentPage = newPage;

      // Get paginated items
      const paginationData = paginateTradeItems(trade.hostItems, newPage, trade.itemsPerPage);

      // Update embed with new page
      const embed = new EmbedBuilder()
        .setTitle('Trade Offer')
        .setDescription(`**Host:** <@${trade.host.id}>\n**Status:** Waiting for offers`)
        .setColor(0x0099ff)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
        .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

      // Format with pagination info
      const hostItemsField = totalPages > 1 
        ? `${paginationData.text}\n\n*Page ${newPage}/${totalPages}*`
        : paginationData.text;

      addFieldSafely(embed,
        `Host Items${trade.hostDiamonds > 0 ? ` + ${formatBid(trade.hostDiamonds)} 💎` : ''}`,
        hostItemsField,
        false
      );

      // Update pagination buttons
      const offerButton = new ButtonBuilder()
        .setCustomId('trade_offer_button')
        .setLabel('Make Offer')
        .setStyle(ButtonStyle.Primary);

      const deleteButton = new ButtonBuilder()
        .setCustomId(`trade_delete_${interaction.message.createdTimestamp}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(offerButton, deleteButton);
      const components = [row];

      if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`trade_page_prev_${messageId}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 1),
          new ButtonBuilder().setCustomId(`trade_page_next_${messageId}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(newPage === totalPages)
        );
        components.push(paginationRow);
      }

      await interaction.update({ embeds: [embed], components });
      return;
    }

    if (interaction.customId.startsWith('offer_submit_modal_')) {
      // Defer the reply to avoid timeout on long operations
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const messageId = interaction.customId.replace('offer_submit_modal_', '');
      const diamondsStr = interaction.fields.getTextInputValue('offer_diamonds') || '0';

      let diamonds = 0;
      if (diamondsStr && diamondsStr !== '0') {
        diamonds = parseBid(diamondsStr);
      }

      const offerItems = interaction.user.offerItems || [];
      
      // Validate item count before finalizing
      const isValid = await validateItemCount(interaction, 'offerTradeCount', offerItems.length, offerItems);
      if (!isValid) {
        return sendErrorReply(interaction, 'E50', 'Item count validation failed. Please try again.');
      }
      
      delete interaction.user.offerItems;
      delete interaction.user.messageId;

      const trade = trades.get(messageId);
      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');

      // Check if user is the trade host
      if (trade.host.id === interaction.user.id) {
        return await sendErrorReply(interaction, 'E04');
      }

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
        await channel.send(`📢 <@${trade.host.id}>, you received an offer from <@${interaction.user.id}>!`);
      }

      if (interaction.deferred) {
        await interaction.editReply({ content: `Offer submitted! Host will accept or decline.` });
      } else {
        await interaction.reply({ content: `Offer submitted! Host will accept or decline.`, flags: 64 });
      }
      return;
    }

    if (interaction.customId === 'bid_modal') {
      const auction = Array.from(auctions.values()).find(a => a.channelId === interaction.channel.id);
      if (!auction) return sendErrorReply(interaction, 'E16');

      // Check if user is the auction host
      if (auction.host.id === interaction.user.id) {
        return await sendErrorReply(interaction, 'E21');
      }

      const diamondsStr = interaction.fields.getTextInputValue('diamonds');
      const items = interaction.fields.getTextInputValue('items') || '';

      let diamonds = 0;
      if (diamondsStr) {
        diamonds = parseBid(diamondsStr);
      }

      if (auction.model === 'items' && diamonds > 0) return sendErrorReply(interaction, 'E49', 'This auction is offers only');
      if (auction.model === 'diamonds' && items) return sendErrorReply(interaction, 'E49', 'This auction is diamonds only');
      if (auction.model === 'diamonds' && diamonds === 0) return sendErrorReply(interaction, 'E11');
      if (auction.model === 'items' && !items) return sendErrorReply(interaction, 'E11');

      // Additional check for 'both' model: if there's a previous bid with only diamonds, don't allow adding diamonds
      if (auction.model === 'both' && diamonds > 0 && auction.bids.some(bid => bid.diamonds > 0 && !bid.items)) {
        return sendErrorReply(interaction, 'E73');
      }

      // Check if bid is higher than current max
      const maxBid = auction.bids.length > 0 ? Math.max(...auction.bids.map(b => b.diamonds)) : auction.startingPrice;
      if (auction.model !== 'items' && diamonds <= maxBid) return sendErrorReply(interaction, 'E79', `Your bid must be higher than the current highest bid of ${formatBid(maxBid)} 💎`);

      auction.bids.push({ user: interaction.user, diamonds, items, timestamp: Date.now() });
      await interaction.reply(`Bid placed: ${diamonds > 0 ? `${formatBid(diamonds)} 💎` : ''}${items ? ` and ${items}` : ''}`);
    }

    if (interaction.customId === 'auction_modal') {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const startingPriceStr = interaction.fields.getTextInputValue('starting_price');
      const model = interaction.fields.getTextInputValue('model').toLowerCase();

      if (!['diamonds', 'items', 'both'].includes(model)) return sendErrorReply(interaction, 'E77');
      const time = 60; // Fixed to 60 seconds
      const startingPrice = parseBid(startingPriceStr);
      if (isNaN(startingPrice) || startingPrice < 0) return sendErrorReply(interaction, 'E78');

      if (auctions.size > 0) {
        return sendErrorReply(interaction, 'E74');
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
      if (!targetChannel) return sendErrorReply(interaction, 'E75');

      // Send ping message first
      await targetChannel.send('-# ||<@&1461741243427197132>||');

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${description}\n\n**Looking For:** ${model}\n**Starting Price:** ${formatBid(startingPrice)} 💎\n**Current Bid:** ${formatBid(startingPrice)} 💎\n**Time Remaining:** ${time}s\n**Hosted by:** ${interaction.user}`)
        .setColor(0x00ff00)
        .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
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
      botLogs.addLog('AUCTION_STARTED', 'New auction started', interaction.user.id, { auctionId: message.id, title, model, startingPrice, time });

      await interaction.reply({ content: `Auction "${title}" started in ${targetChannel}!`, flags: MessageFlags.Ephemeral });

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
          .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
          .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');
        try {
          await message.edit({ embeds: [updatedEmbed], components: [row] });
        } catch (e) {
          // ignore if message deleted
        }
      }, 1000);
    }

    if (interaction.customId.startsWith('proof_image_modal_trade_')) {
      const messageId = interaction.customId.replace('proof_image_modal_trade_', '');
      const imageUrl = interaction.fields.getTextInputValue('proof_image_url') || '';
      const description = interaction.fields.getTextInputValue('proof_description') || '';
      const trade = trades.get(messageId);

      if (!trade) return sendErrorReply(interaction, 'E07', 'Trade not found');

      // Validate URL
      if (!imageUrl) {
        return sendErrorReply(interaction, 'E68', 'Image URL is required');
      }

      // Add proof image to trade
      if (!trade.proofImages) {
        trade.proofImages = [];
      }

      trade.proofImages.push({
        url: imageUrl,
        uploadedBy: interaction.user.id,
        uploadedAt: new Date().toISOString(),
        description: description
      });

      // Save trade
      await redisClient.set(`trade_${messageId}`, JSON.stringify(trade));

      await interaction.reply({
        content: '✅ Proof image uploaded successfully!',
        ephemeral: true
      });
    }

    if (interaction.customId === 'proof_image_modal_auction') {
      const imageUrl = interaction.fields.getTextInputValue('proof_image_url') || '';
      const description = interaction.fields.getTextInputValue('proof_description') || '';

      // Validate URL
      if (!imageUrl) {
        return sendErrorReply(interaction, 'E68', 'Image URL is required');
      }

      // Store proof image in user's proof list
      if (!interaction.user.auctionProofs) {
        interaction.user.auctionProofs = [];
      }

      interaction.user.auctionProofs.push({
        url: imageUrl,
        uploadedAt: new Date().toISOString(),
        description: description,
        auctionMessageId: interaction.message?.id || null
      });

      await interaction.reply({
        content: '✅ Proof image uploaded successfully!',
        ephemeral: true
      });
    }


    if (interaction.customId === 'giveaway_diamonds_modal') {
      const diamondsStr = interaction.fields.getTextInputValue('giveaway_diamonds_amount');
      const diamonds = parseBid(diamondsStr);

      if (diamonds <= 0) {
        return sendErrorReply(interaction, 'E76');
      }

      // Store diamonds as item
      if (!interaction.user.giveawayItems) {
        interaction.user.giveawayItems = [];
      }
      
      // Check if diamonds already exist, if so replace quantity instead of adding
      const existingDiamondsIndex = interaction.user.giveawayItems.findIndex(item => item.name === '💎 Diamonds');
      if (existingDiamondsIndex !== -1) {
        interaction.user.giveawayItems[existingDiamondsIndex].quantity = diamonds;
      } else {
        interaction.user.giveawayItems.push({ name: '💎 Diamonds', quantity: diamonds });
      }

      // Show continue select
      const { StringSelectMenuBuilder } = require('discord.js');
      
      const continueSelect = new StringSelectMenuBuilder()
        .setCustomId('giveaway_continue_select')
        .setPlaceholder('What would you like to do?')
        .addOptions([
          { label: '✅ Create Giveaway', value: 'create_giveaway' },
          { label: '➕ Add Another Category', value: 'add_category' },
          { label: '❌ Remove Items', value: 'remove_items' }
        ]);

      const row = new ActionRowBuilder().addComponents(continueSelect);
      
      const itemsList = formatItemsList(interaction.user.giveawayItems);

      await interaction.reply({ 
        content: `**Selected Items:**\n${itemsList}\n\nWhat would you like to do?`,
        components: [row], 
        flags: 64 
      });
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
        embed.setDescription(`**Status:** ❌ Cancelled by an admin\n\n**Host:** <@${trade.host.id}>`);
      } else {
        embed.setDescription(`**Status:** ✅ Trade Accepted\n\n**Host:** <@${trade.host.id}>\n**Guest:** <@${trade.acceptedUser.id}>`);
      }
    } else {
      embed.setDescription(`**Status:** ${trade.offers.length > 0 ? `Received ${trade.offers.length} offer${trade.offers.length > 1 ? 's' : ''}` : 'Waiting for offers'}\n\n**Host:** <@${trade.host.id}>`);
    }

    // Paginate host items
    const hostPaginationData = paginateTradeItems(trade.hostItems, 1, 10);
    const hostItemsField = hostPaginationData.totalPages > 1 
      ? `${hostPaginationData.text}\n\n*Page 1/${hostPaginationData.totalPages}*`
      : hostPaginationData.text;

    addFieldSafely(embed,
      `Host${trade.hostDiamonds > 0 ? ` (+ ${formatBid(trade.hostDiamonds)} 💎)` : ''}`,
      hostItemsField,
      true
    );

    if (trade.accepted) {
      const acceptedOffer = trade.offers.find(o => o.user.id === trade.acceptedUser.id);
      if (acceptedOffer) {
        const acceptedPaginationData = paginateTradeItems(acceptedOffer.items, 1, 10);
        const acceptedItemsField = acceptedPaginationData.totalPages > 1 
          ? `${acceptedPaginationData.text}\n\n*Page 1/${acceptedPaginationData.totalPages}*`
          : acceptedPaginationData.text;

        addFieldSafely(embed,
          `${acceptedOffer.user.displayName || acceptedOffer.user.username}${acceptedOffer.diamonds > 0 ? ` (+ ${formatBid(acceptedOffer.diamonds)} 💎)` : ''}`,
          acceptedItemsField,
          true
        );
      }
    }

    let components = [];

    if (!trade.accepted && trade.offers.length > 0) {
      const viewOffersButton = new ButtonBuilder()
        .setCustomId(`trade_view_offers_${messageId}`)
        .setLabel(`View Offers (${trade.offers.length})`)
        .setStyle(ButtonStyle.Secondary);

      const deleteButton = new ButtonBuilder()
        .setCustomId(`trade_delete_${Date.now()}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      components.push(new ActionRowBuilder().addComponents(viewOffersButton, deleteButton));
    } else if (trade.accepted) {
      const deleteButton = new ButtonBuilder()
        .setCustomId(`trade_delete_${Date.now()}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

      components.push(new ActionRowBuilder().addComponents(deleteButton));
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

  // Update the active embed with winner and red color
  try {
    const message = await channel.messages.fetch(auction.messageId);
    const finalEmbed = new EmbedBuilder()
      .setTitle(auction.title)
      .setDescription(`${auction.description}\n\n**Looking For:** ${auction.model}\n**Starting Price:** ${formatBid(auction.startingPrice)} 💎\n**Winning Bid:** ${formatBid(winner.diamonds)} 💎${winner.items ? ` and ${winner.items}` : ''}\n**Winner:** ${winner.user}\n**Hosted by:** ${auction.host}`)
      .setColor(0xff0000) // Red color
      .setFooter({ text: 'Version 1.1.3 | Made By Atlas' })
      .setThumbnail('https://media.discordapp.net/attachments/1461378333278470259/1461514275976773674/B2087062-9645-47D0-8918-A19815D8E6D8.png?ex=696ad4bd&is=6969833d&hm=2f262b12ac860c8d92f40789893fda4f1ea6289bc5eb114c211950700eb69a79&=&format=webp&quality=lossless&width=1376&height=917');

    await message.edit({ embeds: [finalEmbed], components: [] }); // Remove buttons
  } catch (e) {
    console.error('Error updating auction embed:', e);
  }

  // Create private channel for auction
  const host = await channel.guild.members.fetch(auction.host.id);
  const winnerMember = await channel.guild.members.fetch(winner.user.id);
  const channelName = `auction-${auction.host.id}-${winner.user.id}`;
  const createAuctionChannel = channel.guild.channels.cache.get('1461496756171964583');
  const auctionChannel = await channel.guild.channels.create({
    name: channelName,
    type: 0, // text channel
    parent: '1461483410194436107',
    position: createAuctionChannel ? createAuctionChannel.position + 1 : 0,
    permissionOverwrites: [
      {
        id: channel.guild.id,
        deny: ['ViewChannel'],
      },
      {
        id: auction.host.id,
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
      },
      {
        id: winner.user.id,
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
      },
    ],
  });

  // Send DMs
  try {
    await host.send(`🏆 Your auction "${auction.title}" has ended! The winner is <@${winner.user.id}> with a bid of ${formatBid(winner.diamonds)} 💎${winner.items ? ` and ${winner.items}` : ''}! Check the channel: ${auctionChannel}`);
  } catch (e) {
    console.error('Error sending DM to host:', e);
  }
  try {
    await winnerMember.send(`🏆 Congratulations! You won the auction "${auction.title}" hosted by <@${auction.host.id}> with a bid of ${formatBid(winner.diamonds)} 💎${winner.items ? ` and ${winner.items}` : ''}! Check the channel: ${auctionChannel}`);
  } catch (e) {
    console.error('Error sending DM to winner:', e);
  }

  // Send embed in the new channel
  const proofEmbed = new EmbedBuilder()
    .setTitle('Auction Proof Required')
    .setDescription(`**Host:** <@${auction.host.id}>\n**Winner:** <@${winner.user.id}>\n**Bid:** ${formatBid(winner.diamonds)} 💎${winner.items ? ` and ${winner.items}` : ''}\n\nPlease upload proof image of the completed auction.`)
    .setColor(0xffa500)
    .setFooter({ text: 'Version 1.1.3 | Made By Atlas' });

  const proofButton = new ButtonBuilder()
    .setCustomId(`upload_proof_auction_${Date.now()}`)
    .setLabel('Upload Proof Image')
    .setStyle(ButtonStyle.Primary);

  const proofMessageInChannel = await auctionChannel.send({ embeds: [proofEmbed], components: [new ActionRowBuilder().addComponents(proofButton)] });

  // Store finished auction data for proof handler
  finishedAuctions.set(proofMessageInChannel.id, {
    host: auction.host,
    title: auction.title,
    winner: winner.user,
    diamonds: winner.diamonds,
    items: winner.items,
    channelId: channel.id,
    auctionChannelId: auctionChannel.id
  });

  // Notify in original channel
  await channel.send(`🏆 Auction "${auction.title}" ended! Winner: ${winner.user} with ${formatBid(winner.diamonds)} 💎${winner.items ? ` and ${winner.items}` : ''}. Check your DMs for the auction channel.`);
}

client.login(process.env.TOKEN);
