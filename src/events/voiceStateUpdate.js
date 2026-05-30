// src/events/voiceStateUpdate.js
const { createLogger } = require('../utils/logger');
const config = require('../utils/config');
const { incrementEntry, setVoiceSession, getVoiceSession, deleteVoiceSession } = require('../utils/database');
const { addVoiceTime, conditionalUpdate } = require('../utils/statsUpdater');
const logger = createLogger('EVENT:voiceStateUpdate');

const voiceSessions = new Map();

async function ensureFalanteRole(guild) {
  const botMember = guild.members.me;
  if (!botMember || !botMember.permissions.has('ManageRoles')) return null;
  let role = guild.roles.cache.find(r => r.name === 'Falante');
  if (!role) {
    try {
      role = await guild.roles.create({
        name: 'Falante',
        color: 'e6f0f5',
        hoist: true,
        permissions: [],
        reason: 'Voice activity role',
      });
      try {
        const botHighest = botMember.roles.highest;
        if (botHighest) await role.setPosition(Math.max(1, botHighest.position - 1));
      } catch {}
    } catch (error) {
      logger.error(`[${guild.name}] Failed to create Falante role:`, error);
      return null;
    }
  }
  return role;
}

async function startSession(guildId, userId) {
  const now = Date.now();
  voiceSessions.set(`${guildId}-${userId}`, now);
  try { setVoiceSession(guildId, userId, now); } catch {}
}

async function endSession(guildId, userId) {
  const memKey = `${guildId}-${userId}`;
  let startTime = voiceSessions.get(memKey);
  if (startTime) voiceSessions.delete(memKey);
  else startTime = getVoiceSession(guildId, userId);
  try { deleteVoiceSession(guildId, userId); } catch {}
  return startTime;
}

async function sendDurationMessage(guild, member, startTime) {
  const channelId = config.get(`voiceLogChannel_${guild.id}`);
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  const durationMs = Date.now() - startTime;
  const minutes = Math.floor(durationMs / 60000);
  const minMinutes = config.get(`voiceMinDuration_${guild.id}`) || 30;
  if (minutes < minMinutes) return;
  const message = `<:telephone:1508838089416511558> **${member.displayName}** was in vc for ${minutes} minutes`;
  try { await channel.send(message); } catch {}
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

    const role = await ensureFalanteRole(guild);
    if (role) {
      try {
        if (!oldState.channelId && newState.channelId) {
          if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'Entered voice');
        } else if (oldState.channelId && !newState.channelId) {
          if (member.roles.cache.has(role.id)) await member.roles.remove(role, 'Left voice');
        }
      } catch (err) { logger.error(`Falante error: ${err}`); }
    }

    if (!oldState.channelId && newState.channelId) {
      await startSession(guildId, userId);
    } else if (oldState.channelId && !newState.channelId) {
      const startTime = await endSession(guildId, userId);
      if (startTime) {
        await sendDurationMessage(guild, member, startTime);
        const durationMs = Date.now() - startTime;
        try { incrementEntry(`voice_${guildId}`, guildId, userId, durationMs); } catch {}
        // Event‑driven stats update
        if (addVoiceTime(guildId, durationMs)) {
          conditionalUpdate(guild).catch(() => {});
        }
      }
    }
  },
};