// src/events/voiceStateUpdate.js
const { createLogger } = require('../utils/logger');
const config = require('../utils/config');
const { incrementEntry } = require('../utils/database');
const logger = createLogger('EVENT:voiceStateUpdate');

const voiceSessions = new Map();

// Ensure the Falante role exists (unchanged)
async function ensureFalanteRole(guild) {
  const botMember = guild.members.me;
  if (!botMember || !botMember.permissions.has('ManageRoles')) return null;

  let role = guild.roles.cache.find(r => r.name === 'Falante');
  if (!role) {
    try {
      role = await guild.roles.create({
        name: 'Falante',
        color: 'e6f0f5',   // off‑color / highlight
        hoist: true,
        permissions: [],
        reason: 'Voice activity role',
      });
      logger.info(`[${guild.name}] Created Falante role.`);
      try {
        const botHighest = botMember.roles.highest;
        if (botHighest) await role.setPosition(Math.max(1, botHighest.position - 1));
      } catch (posErr) {
        logger.warn(`[${guild.name}] Could not set Falante position: ${posErr.message}`);
      }
    } catch (error) {
      logger.error(`[${guild.name}] Failed to create Falante role:`, error);
      return null;
    }
  }
  return role;
}

// Session helpers (unchanged)
function getSessionKey(guildId, userId) {
  return `${guildId}-${userId}`;
}

function startSession(guildId, userId, channelId) {
  voiceSessions.set(getSessionKey(guildId, userId), { startTime: Date.now(), channelId });
}

function endSession(guildId, userId) {
  const key = getSessionKey(guildId, userId);
  const session = voiceSessions.get(key);
  if (!session) return null;
  voiceSessions.delete(key);
  return session;
}

/**
 * Send a message to the configured voice‑log channel.
 * Now receives the GuildMember to use the server nickname.
 */
async function sendDurationMessage(guild, member, startTime) {
  const channelId = config.get(`voiceLogChannel_${guild.id}`);
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const durationMs = Date.now() - startTime;
  const minutes = Math.floor(durationMs / 60000);
  const minMinutes = config.get(`voiceMinDuration_${guild.id}`) || 30;

  if (minutes < minMinutes) {
    logger.info(`[${guild.name}] Voice session for ${member.displayName} was only ${minutes} min – ignored.`);
    return;
  }

  // Build the new message using the custom telephone emoji
  const message = `<:telephone:1508838089416511558> **${member.displayName}** was in vc for ${minutes} minute(s)`;

  try {
    await channel.send(message);
  } catch (error) {
    logger.error(`[${guild.name}] Failed to send duration message:`, error);
  }
}

module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guild = member.guild;
    if (!guild.available || !guild.members.me) return;

    const userId = member.id;
    const guildId = guild.id;

    // Falante role handling (unchanged)
    const role = await ensureFalanteRole(guild);
    if (role) {
      try {
        if (!oldState.channelId && newState.channelId) {
          if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'Entered voice');
        } else if (oldState.channelId && !newState.channelId) {
          if (member.roles.cache.has(role.id)) await member.roles.remove(role, 'Left voice');
        }
      } catch (error) {
        logger.error(`[${guild.name}] Falante role update failed for ${member.displayName}:`, error);
      }
    }

    // Session tracking & stats (updated to pass member)
    if (!oldState.channelId && newState.channelId) {
      startSession(guildId, userId, newState.channelId);
    } else if (oldState.channelId && !newState.channelId) {
      const session = endSession(guildId, userId);
      if (session) {
        await sendDurationMessage(guild, member, session.startTime);  // now passes member

        // Increment cumulative voice time (unchanged)
        const durationMs = Date.now() - session.startTime;
        try {
          incrementEntry(`voice_${guild.id}`, guildId, userId, durationMs);
        } catch (err) {
          logger.error('Failed to increment voice time:', err);
        }
      }
    }
  },
};