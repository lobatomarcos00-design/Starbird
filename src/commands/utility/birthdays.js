// src/commands/utility/birthdays.js
const { getEntriesByKey } = require('../../utils/database');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:birthdays');

// Column widths for the table
const NICK_COL_WIDTH = 30;
const DATE_COL_WIDTH = 15;

// Helper: right‑pad a string to a fixed width
function padRight(str, len) {
  return String(str).slice(0, len).padEnd(len, ' ');
}

module.exports = {
  name: 'birthdays',
  description: 'Show all stored birthdays in this server.',
  async execute(message, args) {
    const guild = message.guild;
    try {
      // Retrieve all birthday entries for this guild
      const entries = getEntriesByKey('birthday', guild.id);
      if (entries.length === 0) {
        return message.channel.send('📭 No birthdays stored.');
      }

      // Sort by month, then day (value format: DD/MM or DD/MM/YYYY)
      entries.sort((a, b) => {
        const [dA, mA] = a.value.split('/').map(Number);
        const [dB, mB] = b.value.split('/').map(Number);
        if (mA !== mB) return mA - mB;
        return dA - dB;
      });

      // Build a map of userID -> displayName for quick lookup
      const members = await guild.members.fetch().catch(() => null);
      const displayNames = new Map();
      if (members) {
        for (const [id, member] of members) {
          displayNames.set(id, member.displayName);
        }
      }

      // Limit entries to prevent embed overflow (100 rows is safe)
      const displayEntries = entries.slice(0, 100);

      // Build the table
      const lines = [];
      lines.push('```');
      // Header
      lines.push(
        padRight('Nickname', NICK_COL_WIDTH) +
        ' ' +
        padRight('Birthday', DATE_COL_WIDTH)
      );
      // Separator
      lines.push(
        '-'.repeat(NICK_COL_WIDTH) +
        ' ' +
        '-'.repeat(DATE_COL_WIDTH)
      );

      for (const entry of displayEntries) {
        const nick = displayNames.get(entry.userid) || entry.userid; // fallback to ID if not fetched
        const birthday = entry.value;
        lines.push(
          padRight(nick, NICK_COL_WIDTH) +
          ' ' +
          padRight(birthday, DATE_COL_WIDTH)
        );
      }

      // Footer with total count
      lines.push(
        '-'.repeat(NICK_COL_WIDTH) +
        ' ' +
        '-'.repeat(DATE_COL_WIDTH)
      );
      lines.push(`Total: ${entries.length} birthdays${displayEntries.length < entries.length ? ` (showing ${displayEntries.length})` : ''}`);
      lines.push('```');

      const embed = {
        color: 0x215db1,   // main bot color
        title: '<:cake:1508838162401857718> Stored Birthdays',
        description: lines.join('\n'),
        footer: { text: `Use !setbirthday @user DD/MM[/YY] to add one.` },
      };

      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Birthdays command failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Something went wrong.');
    }
  },
};