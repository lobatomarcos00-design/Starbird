// src/utils/statsUpdater.js
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createLogger } = require('./logger');
const logger = createLogger('STATS_UPDATER');

const DATA_FILE = path.join(process.cwd(), 'database.json');

function loadAllEntries() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('Failed to load database:', err);
    return [];
  }
}

const USER_COL_WIDTH = 23;
const MSG_COL_WIDTH = 10;
const VOICE_COL_WIDTH = 12;

function padRight(str, len) {
  return String(str).slice(0, len).padEnd(len, ' ');
}

function padLeft(str, len) {
  return String(str).slice(0, len).padStart(len, ' ');
}

function formatMs(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function updateStatsEmbed(guild) {
  try {
    const channelId = config.get(`statsChannel_${guild.id}`);
    const messageId = config.get(`statsMessage_${guild.id}`);
    if (!channelId) {
      logger.warn(`[${guild.name}] No stats channel configured.`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      logger.warn(`[${guild.name}] Stats channel ${channelId} not found.`);
      return;
    }

    const allEntries = loadAllEntries();
    const guildEntries = allEntries.filter(e => e.guildId === guild.id);

    const msgEntries = guildEntries.filter(e => e.key === `msg_${guild.id}`);
    const voiceEntries = guildEntries.filter(e => e.key === `voice_${guild.id}`);

    logger.info(`[${guild.name}] Found ${msgEntries.length} msg entries, ${voiceEntries.length} voice entries.`);

    const statsMap = new Map();
    for (const entry of msgEntries) {
      statsMap.set(entry.userid, { messages: Number(entry.value) || 0, voiceMs: 0 });
    }
    for (const entry of voiceEntries) {
      const existing = statsMap.get(entry.userid) || { messages: 0, voiceMs: 0 };
      existing.voiceMs = Number(entry.value) || 0;
      statsMap.set(entry.userid, existing);
    }

    let embed;
    if (statsMap.size === 0) {
      embed = {
        color: 0x215db1,  // main color
        title: '📊 Server Statistics',
        description: 'No data yet.',
        footer: { text: `Last updated: ${new Date().toLocaleString()}` },
      };
    } else {
      const sorted = [...statsMap.entries()]
        .map(([userId, stats]) => ({ userId, ...stats }))
        .sort((a, b) => b.messages - a.messages);

      let totalMessages = 0;
      let totalVoiceMs = 0;

      const lines = [];
      lines.push('```');
      lines.push(
        padRight('User', USER_COL_WIDTH) +
        padLeft('Messages', MSG_COL_WIDTH) +
        padLeft('Voice Time', VOICE_COL_WIDTH)
      );
      lines.push(
        '-'.repeat(USER_COL_WIDTH) +
        ' ' +
        '-'.repeat(MSG_COL_WIDTH) +
        ' ' +
        '-'.repeat(VOICE_COL_WIDTH)
      );

      for (const row of sorted) {
        const member = await guild.members.fetch(row.userId).catch(() => null);
        const displayName = member ? member.displayName : row.userId;

        const nameCol = padRight(displayName, USER_COL_WIDTH);
        const msgCol = padLeft(row.messages.toString(), MSG_COL_WIDTH);
        const voiceCol = padLeft(formatMs(row.voiceMs), VOICE_COL_WIDTH);
        lines.push(nameCol + ' ' + msgCol + ' ' + voiceCol + '      ');

        totalMessages += row.messages;
        totalVoiceMs += row.voiceMs;
      }

      lines.push(
        '-'.repeat(USER_COL_WIDTH) +
        ' ' +
        '-'.repeat(MSG_COL_WIDTH) +
        ' ' +
        '-'.repeat(VOICE_COL_WIDTH)
      );
      lines.push(
        padRight('Total', USER_COL_WIDTH) +
        ' ' +
        padLeft(totalMessages.toString(), MSG_COL_WIDTH) +
        ' ' +
        padLeft(formatMs(totalVoiceMs), VOICE_COL_WIDTH)
      );
      lines.push('```');

      embed = {
        color: 0x215db1,  // main color
        title: '📊 Server Statistics',
        description: lines.join('\n'),
        footer: { text: `Last updated: ${new Date().toLocaleString()}` },
      };
    }

    let message;
    if (messageId) {
      message = await channel.messages.fetch(messageId).catch(() => null);
      if (message) {
        await message.edit({ embeds: [embed] });
        logger.info(`[${guild.name}] Stats embed updated.`);
        return;
      }
      logger.warn(`[${guild.name}] Stored message ${messageId} not found – sending new one.`);
    }

    const newMsg = await channel.send({ embeds: [embed] });
    config.set(`statsMessage_${guild.id}`, newMsg.id);
    logger.info(`[${guild.name}] Created new stats embed.`);
  } catch (error) {
    logger.error(`[${guild.name}] Failed to update stats:`, error);
  }
}

module.exports = { updateStatsEmbed };