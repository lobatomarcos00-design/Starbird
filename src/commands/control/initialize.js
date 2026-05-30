// src/commands/control/initialize.js
const { PermissionsBitField, ChannelType } = require('discord.js');
const config = require('../../utils/config');
const { performServerSetup } = require('../../utils/serverSetup');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:initialize');

module.exports = {
  name: 'initialize',
  description: 'Run the full server setup (Meteion role, stats, default role, lockdown).',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guild = message.guild;
    const botMember = guild.members.me;

    // --- Bot permission check ---
    const requiredBotPerms = ['ManageRoles', 'ManageChannels'];
    const missing = requiredBotPerms.filter(perm => !botMember.permissions.has(perm));
    if (missing.length > 0) {
      return message.channel.send(
        `❌ I'm missing these permissions: **${missing.join(', ')}**.\n` +
        `Make sure my role has them and is placed above the roles I need to manage.`
      );
    }

    let status = [];
    try {
      // --- Meteion role ---
      try {
        let role = guild.roles.cache.find(r => r.name === 'Meteion');
        if (!role) {
          role = await guild.roles.create({
            name: 'Meteion',
            color: '215db1',
            hoist: false,
            permissions: [],
            reason: 'Bot admin role (initialization)',
          });
          try {
            const botHighest = botMember.roles.highest;
            if (botHighest) await role.setPosition(Math.max(1, botHighest.position - 1));
          } catch (err) {
            logger.warn(`Could not set Meteion position: ${err.message}`);
          }
          status.push('<:Positive:1508838207838486579> Meteion role created.');
        } else {
          status.push('ℹ️ Meteion role already exists.');
        }
        if (!botMember.roles.cache.has(role.id)) {
          await botMember.roles.add(role);
        }
      } catch (err) {
        logger.error(`Meteion role error: ${err}`);
        return message.channel.send('❌ Failed to create/manage the **Meteion** role. Check my permissions and role position.');
      }

      // --- Statistics channel ---
      try {
        const statsName = '📊-statistics';
        let statsChannel = guild.channels.cache.find(c => c.name === statsName && c.type === ChannelType.GuildText);
        if (statsChannel) {
          // Clear existing
          const messages = await statsChannel.messages.fetch({ limit: 100 });
          if (messages.size > 0) await statsChannel.bulkDelete(messages, true).catch(() => {});
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
      } catch (err) {
        logger.error(`Stats channel error: ${err}`);
        return message.channel.send('❌ Failed to set up the **statistics channel**. Check my permissions and channel position.');
      }

      // --- Default role and channel lockdown (using shared setup) ---
      try {
        await performServerSetup(guild);   // this will handle default role & lockdown
        status.push('<:Positive:1508838207838486579> Default role & channels locked.');
      } catch (err) {
        logger.error(`Lockdown error: ${err}`);
        return message.channel.send('❌ Failed during **channel lockdown**. Make sure my role can manage channel permissions.');
      }

      config.set(`setupDone_${guild.id}`, true);
      await message.channel.send('<:star:1508838174305030306> **Server initialization complete:**\n' + status.join('\n'));
      logger.info(`Initialize completed in ${guild.name}`);
    } catch (err) {
      logger.error('Initialize crashed:', err);
      await message.channel.send('❌ An unexpected error occurred. Check the console.');
    }
  },
};