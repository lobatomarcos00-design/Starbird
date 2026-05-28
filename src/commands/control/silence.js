// src/commands/control/silence.js
const { PermissionsBitField } = require('discord.js');
const { muteUser } = require('../../utils/moderation');   // reuse the same mute function
const config = require('../../utils/config');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:silence');

module.exports = {
  name: 'silence',
  description: 'Immediately mute a user for 1 hour, even without prior warns.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guild = message.guild;

    // Check bot permissions
    if (!guild.members.me.permissions.has('ManageRoles')) {
      return message.channel.send('❌ I need **Manage Roles** permission to mute users.');
    }

    // Parse target user
    const targetArg = args[0];
    let targetMember;
    if (targetArg?.startsWith('<@') && targetArg.endsWith('>')) {
      const id = targetArg.replace(/[<@!>]/g, '');
      targetMember = guild.members.cache.get(id);
    } else if (targetArg && /^\d+$/.test(targetArg)) {
      targetMember = guild.members.cache.get(targetArg);
    } else {
      // Try to find by name/nickname
      targetMember = guild.members.cache.find(m => m.displayName.toLowerCase() === targetArg?.toLowerCase());
    }

    if (!targetMember) {
      return message.channel.send('❌ User not found. Please mention them or provide their ID.');
    }

    // Prevent muting admins
    if (targetMember.permissions.has('ManageGuild')) {
      return message.channel.send('❌ You cannot mute an admin.');
    }

    // Check if already muted
    const silencedRoleId = config.get(`silencedRole_${guild.id}`);
    if (silencedRoleId && targetMember.roles.cache.has(silencedRoleId)) {
      return message.channel.send(`❌ ${targetMember.user.tag} is already muted.`);
    }

    try {
      // Apply mute using the same function that moderation uses, passing the command channel as the source
      await muteUser(guild, targetMember, message.channel.id);
      logger.info(`[${guild.name}] ${message.author.tag} manually muted ${targetMember.user.tag}`);

      // Send a public confirmation (also acts as the "silenced" notification)
      const embed = {
        color: 0xd3324d,
        title: '🔇 User Silenced',
        description: `${targetMember} has been muted by ${message.author}.`,
        fields: [
          { name: 'Duration', value: '1 hour', inline: true },
          { name: 'Reason', value: 'Manual silence by admin', inline: true },
        ],
        timestamp: new Date().toISOString(),
      };
      await message.channel.send({ embeds: [embed] });

      // Notify other admins via DM
      const admins = guild.members.cache.filter(m => m.permissions.has('ManageGuild') && !m.user.bot && m.id !== message.author.id);
      for (const admin of admins.values()) {
        try {
          await admin.send({ embeds: [{
            color: 0xd3324d,
            title: '🔇 Manual Silence',
            description: `${targetMember.user.tag} was muted by ${message.author.tag} in ${guild.name}.`,
          }]});
        } catch (err) { /* DM closed */ }
      }
    } catch (error) {
      logger.error('Silence command failed:', error);
      await message.channel.send('❌ Failed to mute the user. Check the console for details.');
    }
  },
};