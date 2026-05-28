// src/commands/control/initialize.js
const { PermissionsBitField } = require('discord.js');
const config = require('../../utils/config');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:initialize');

/**
 * Deletes all messages in a text channel (handles bulk delete limits).
 */
async function clearChannel(channel) {
  if (!channel.manageable) return;
  let messages;
  do {
    messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size > 0) {
      await channel.bulkDelete(messages, true).catch(() => {});
    }
  } while (messages.size >= 100);
}

/**
 * Ensure the default role exists (or create one named 'member').
 */
async function ensureDefaultRole(guild) {
  const guildId = guild.id;
  let roleId = config.get(`defaultRole_${guildId}`);
  if (roleId) {
    const role = guild.roles.cache.get(roleId);
    if (role) return role;
  }

  const role = await guild.roles.create({
    name: 'member',
    color: '9b59b6',
    hoist: true,
    permissions: [],
    reason: 'Default role for new members (auto-created)',
  });

  try {
    await role.setPosition(1);
  } catch (err) {
    logger.warn(`Could not set default role position: ${err.message}`);
  }

  config.set(`defaultRole_${guildId}`, role.id);
  return role;
}

/**
 * Lock all channels so only the default role can interact.
 */
async function lockChannelsToDefaultRole(guild, defaultRole) {
  const channels = guild.channels.cache.filter(c => c.type === 0 || c.type === 2);
  const everyoneId = guild.roles.everyone.id;
  const defaultRoleId = defaultRole.id;

  for (const [, channel] of channels) {
    try {
      const overwrites = channel.permissionOverwrites.cache.map(o => o.toJSON());
      const filtered = overwrites.filter(o => o.id !== everyoneId && o.id !== defaultRoleId);

      // Deny @everyone
      filtered.push({
        id: everyoneId,
        deny: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
        ],
        allow: [],
      });

      // Allow default role
      filtered.push({
        id: defaultRoleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
        ],
        deny: [],
      });

      await channel.edit({ permissionOverwrites: filtered });
      logger.info(`Locked channel ${channel.name}`);
    } catch (err) {
      logger.error(`Failed to lock channel ${channel.name}: ${err.message}`);
    }
  }
}

module.exports = {
  name: 'initialize',
  description: 'Run the full server setup (Meteion role, stats channel, default role, channel lockdown).',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guild = message.guild;
    const botMember = guild.members.me;
    logger.info(`Initialize triggered by ${message.author.tag} in ${guild.name}`);

    // Permission checks
    if (!botMember.permissions.has('ManageRoles')) {
      return message.channel.send('<:Negative:1508838218043363419> I need **Manage Roles** permission.');
    }
    if (!botMember.permissions.has('ManageChannels')) {
      return message.channel.send('<:Negative:1508838218043363419> I need **Manage Channels** permission.');
    }

    const statusMessages = [];
    try {
      // -- Meteion role --
      let meteionRole = guild.roles.cache.find(r => r.name === 'Meteion');
      if (!meteionRole) {
        meteionRole = await guild.roles.create({
          name: 'Meteion',
          color: '215db1',
          hoist: false,
          permissions: [],
          reason: 'Bot admin role (initialization)',
        });
        try {
          const botHighest = botMember.roles.highest;
          if (botHighest) await meteionRole.setPosition(Math.max(1, botHighest.position - 1));
        } catch (err) {
          logger.warn(`Could not set Meteion position: ${err.message}`);
        }
        statusMessages.push('<:Positive:1508838207838486579> Meteion role created.');
      } else {
        statusMessages.push('ℹ️ Meteion role already exists.');
      }
      if (!botMember.roles.cache.has(meteionRole.id)) {
        await botMember.roles.add(meteionRole);
      }

      // -- Statistics channel --
      const statsName = '📊-statistics';
      let statsChannel = guild.channels.cache.find(c => c.name === statsName && c.type === 0);
      if (statsChannel) {
        await clearChannel(statsChannel).catch(() => {});
        statusMessages.push('ℹ️ Statistics channel cleared.');
      } else {
        statsChannel = await guild.channels.create({
          name: statsName,
          type: 0,
          permissionOverwrites: [{ id: guild.id, deny: [PermissionsBitField.Flags.SendMessages] }],
          reason: 'Server statistics',
        });
        statusMessages.push('<:Positive:1508838207838486579> Statistics channel created.');
      }

      const embed = {
        color: 0x215db1,
        title: '📊 Server Statistics',
        description: 'No data yet.',
        footer: { text: `Last updated: ${new Date().toLocaleString()}` },
      };
      const msg = await statsChannel.send({ embeds: [embed] });
      config.set(`statsChannel_${guild.id}`, statsChannel.id);
      config.set(`statsMessage_${guild.id}`, msg.id);

      // -- Default role & lockdown --
      const defaultRole = await ensureDefaultRole(guild);
      statusMessages.push(`<:Positive:1508838207838486579> Default role: ${defaultRole.name}`);

      await lockChannelsToDefaultRole(guild, defaultRole);
      statusMessages.push('<:Positive:1508838207838486579> Channels locked to default role.');

      await message.channel.send('<:moon:1508838061885362186> **Server initialization complete:**\n' + statusMessages.join('\n'));
      logger.info(`Initialize completed in ${guild.name}`);
    } catch (error) {
      logger.error('Initialize failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Initialization failed. Check the console for details.');
    }
  },
};