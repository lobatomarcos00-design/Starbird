const config = require('../utils/config');
const { PermissionsBitField, ChannelType } = require('discord.js');
const { createLogger } = require('../utils/logger');
const logger = createLogger('COMMAND:initialize');

/**
 * Delete all messages in a text channel.
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
 * Ensure the default role exists (create 'member' if missing).
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
 * Ensure the welcome channel exists.
 * If not set, create a '🌱-welcome' text channel at the bottom.
 */
async function ensureWelcomeChannel(guild) {
  const guildId = guild.id;
  const existingId = config.get(`welcomeChannel_${guildId}`);
  if (existingId) {
    const channel = guild.channels.cache.get(existingId);
    if (channel && channel.type === ChannelType.GuildText) return channel;
  }

  const channel = await guild.channels.create({
    name: '🌱-welcome',
    type: ChannelType.GuildText,
    position: 9999,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
      },
    ],
    reason: 'Default welcome channel',
  });

  config.set(`welcomeChannel_${guildId}`, channel.id);
  return channel;
}

/**
 * Lock all text/voice channels to the default role,
 * leaving the welcome channel open to everyone.
 */
async function lockChannels(guild, defaultRole, welcomeChannel) {
  const everyoneId = guild.roles.everyone.id;
  const defaultRoleId = defaultRole.id;

  const channels = guild.channels.cache.filter(
    c => (c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice) &&
         c.id !== welcomeChannel.id
  );

  for (const [, channel] of channels) {
    try {
      const overwrites = channel.permissionOverwrites.cache.map(o => o.toJSON());
      let filtered = overwrites.filter(o => o.id !== everyoneId && o.id !== defaultRoleId);

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

  // Keep welcome channel public
  try {
    const welcomeOverwrites = welcomeChannel.permissionOverwrites.cache.map(o => o.toJSON());
    let welcomeFiltered = welcomeOverwrites.filter(o => o.id !== everyoneId);

    welcomeFiltered.push({
      id: everyoneId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
      deny: [],
    });

    await welcomeChannel.edit({ permissionOverwrites: welcomeFiltered });
    logger.info(`Welcome channel set to public.`);
  } catch (err) {
    logger.error(`Failed to update welcome channel permissions: ${err.message}`);
  }
}

module.exports = {
  name: 'initialize',
  description: 'Run full server setup: Meteion role, stats channel, default role, welcome channel, and channel lockdown.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guild = message.guild;
    const botMember = guild.members.me;
    logger.info(`Initialize triggered by ${message.author.tag} in ${guild.name}`);

    if (!botMember.permissions.has('ManageRoles') || !botMember.permissions.has('ManageChannels')) {
      return message.channel.send('<:Negative:1508838218043363419> I need **Manage Roles** and **Manage Channels** permissions.');
    }

    const status = [];
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
        status.push('<:Positive:1508838207838486579> Meteion role created.');
      } else {
        status.push('ℹ️ Meteion role already exists.');
      }
      if (!botMember.roles.cache.has(meteionRole.id)) {
        await botMember.roles.add(meteionRole);
      }

      // -- Statistics channel --
      const statsName = '📊-statistics';
      let statsChannel = guild.channels.cache.find(c => c.name === statsName && c.type === ChannelType.GuildText);
      if (statsChannel) {
        await clearChannel(statsChannel).catch(() => {});
        status.push('ℹ️ Statistics channel cleared.');
      } else {
        statsChannel = await guild.channels.create({
          name: statsName,
          type: ChannelType.GuildText,
          permissionOverwrites: [{ id: guild.id, deny: [PermissionsBitField.Flags.SendMessages] }],
          reason: 'Server statistics',
        });
        status.push('<:Positive:1508838207838486579> Statistics channel created.');
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

      // -- Default role, welcome channel, and lockdown --
      const defaultRole = await ensureDefaultRole(guild);
      status.push(`<:Positive:1508838207838486579> Default role: ${defaultRole.name}`);

      const welcomeChannel = await ensureWelcomeChannel(guild);
      status.push(`<:Positive:1508838207838486579> Welcome channel: ${welcomeChannel.toString()}`);

      await lockChannels(guild, defaultRole, welcomeChannel);
      status.push('<:Positive:1508838207838486579> Channels locked to default role (except welcome).');

      await message.channel.send('<:moon:1508838061885362186> **Initialization complete:**\n' + status.join('\n'));
      logger.info(`Initialize finished in ${guild.name}`);
    } catch (error) {
      logger.error('Initialize failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Initialization failed. Check console.');
    }
  },
};