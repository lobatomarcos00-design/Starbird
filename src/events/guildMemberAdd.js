// src/events/guildMemberAdd.js
const { PermissionsBitField } = require('discord.js');
const config = require('../utils/config');
const { createLogger } = require('../utils/logger');
const { findUsedInvite } = require('../utils/inviteCache');
const { incrementEntry } = require('../utils/database');
const logger = createLogger('EVENT:guildMemberAdd');

// Random welcome messages for the public channel
const welcomeMessages = [
  `👋 Welcome to the server, <@%MEMBERID%>! We're glad to have you here.`,
  `🎉 Hey <@%MEMBERID%>, welcome! Make yourself at home.`,
  `✨ A wild <@%MEMBERID%> appeared! Welcome!`,
  `🌟 <@%MEMBERID%> just joined the party! Welcome!`,
  `💫 Welcome aboard, <@%MEMBERID%>! Great to see you!`,
];

/**
 * Send a helpful DM embed to the new member.
 */
async function sendWelcomeDM(member) {
  try {
    const embed = {
      color: 0x215db1,                     // main bot color
      author: {
        name: `Welcome to ${member.guild.name}!`,
        icon_url: member.guild.iconURL({ dynamic: true }),
      },
      thumbnail: {
        url: member.guild.iconURL({ dynamic: true }),
      },
      fields: [
        {
          name: '<:Positive:1508838207838486579> Welcome and Getting Started',
          value: `Welcome and well met, here are some things to take note of:\n` +
            `Some channels are dedicated to bot commands and can be a bit spammy.\n` +
            `To keep your chat list clean, **right‑click any noisy channel → Mute Channel**.`,
        },
        {
          name: '<:pen:1508838047318544538> Know Your Members',
          value: `Use \`!name @user Real Name\` to store someone’s real name.\n` +
            `Then \`!members\` shows everyone’s real name in a neat table.`,
        },
        {
          name: '<:star:1508838174305030306> Handy Commands',
          value: `\`!birthdays\` – see all stored birthdays\n` +
            `\`!nextbirthday\` – who’s up next?\n` +
            `\`!members\` – list of members & real names\n` +
            `\`!help\` – full command list`,
        },
      ],
      footer: {
        text: 'Enjoy your stay!',
        icon_url: member.guild.client.user.displayAvatarURL(),
      },
    };

    await member.send({ embeds: [embed] });
    logger.info(`Welcome DM sent to ${member.user.tag}`);
  } catch (err) {
    // User may have DMs closed – not a critical error
    logger.warn(`Could not send welcome DM to ${member.user.tag}: ${err.message}`);
  }
}

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    if (member.user.bot) return;   // skip bots

    const guild = member.guild;
    if (!guild.available || !guild.members.me) return;

    // --- Send DM guide ---
    await sendWelcomeDM(member);

    // Random welcome message for the public channel
    const publicMessages = welcomeMessages.map(m => m.replace('%MEMBERID%', member.id));

    // --- Default role assignment ---
    const defaultRoleId = config.get(`defaultRole_${guild.id}`);
    if (defaultRoleId) {
      const role = guild.roles.cache.get(defaultRoleId);
      if (role) {
        try {
          await member.roles.add(role, 'Default role for new members');
          logger.info(`Assigned default role ${role.name} to ${member.user.tag}`);
        } catch (error) {
          logger.error(`Failed to assign default role to ${member.user.tag}:`, error);
        }
      }
    }

    // --- Invite tracking ---
    let inviteLog = null;
    try {
      const inviteData = await findUsedInvite(guild);
      if (inviteData) {
        try {
          incrementEntry(`invites_count_${guild.id}`, guild.id, inviteData.inviterId, 1);
        } catch (err) {
          logger.error('Failed to increment invite count:', err);
        }
        inviteLog = inviteData;
        logger.info(`[${guild.name}] ${member.user.tag} used invite ${inviteData.code} by ${inviteData.inviterId}`);
      }
    } catch (err) {
      logger.error(`[${guild.name}] Invite detection error:`, err);
    }

    // --- Invite log message ---
    const inviteLogChannelId = config.get(`inviteLogChannel_${guild.id}`);
    if (inviteLogChannelId && inviteLog) {
      const inviter = await guild.client.users.fetch(inviteLog.inviterId).catch(() => null);
      const channel = guild.channels.cache.get(inviteLogChannelId);
      if (channel && inviter) {
        try {
          await channel.send(`<:envelope:1508838099977769063> ${member.user.tag} joined using an invite from **${inviter.tag}** (code: \`${inviteLog.code}\`)`);
        } catch (err) {
          logger.error(`Failed to send invite log:`, err);
        }
      }
    }

    // --- Public welcome message ---
    const welcomeChannelId = config.get(`welcomeChannel_${guild.id}`);
    if (!welcomeChannelId) return;

    const welcomeChannel = guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) return;

    const botPermissions = welcomeChannel.permissionsFor(guild.members.me);
    if (!botPermissions.has(PermissionsBitField.Flags.SendMessages)) {
      logger.warn(`[${guild.name}] Cannot send welcome message – missing permissions.`);
      return;
    }

    try {
      const randomIndex = Math.floor(Math.random() * publicMessages.length);
      await welcomeChannel.send(publicMessages[randomIndex]);
    } catch (error) {
      logger.error(`[${guild.name}] Failed to send welcome message:`, error);
    }
  },
};