// src/commands/utility/members.js
const { getEntriesByKey } = require('../../utils/database');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:members');

const USER_COL_WIDTH = 30;
const NAME_COL_WIDTH = 25;

function padRight(str, len) {
  return String(str).slice(0, len).padEnd(len, ' ');
}

module.exports = {
  name: 'members',
  description: 'Show all server members with their stored real names.',
  async execute(message, args) {
    const guild = message.guild;
    try {
      const members = await guild.members.fetch();
      const nameEntries = getEntriesByKey('name', guild.id);

      const nameMap = new Map();
      for (const entry of nameEntries) {
        nameMap.set(entry.userid, entry.value);
      }

      const sorted = [...members.values()]
        .filter(m => !m.user.bot)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      const displayMembers = sorted.slice(0, 100);

      const lines = [];
      lines.push('```');
      lines.push(
        padRight('Nickname', USER_COL_WIDTH) +
        ' ' +
        padRight('Real Name', NAME_COL_WIDTH)
      );
      lines.push(
        '-'.repeat(USER_COL_WIDTH) +
        ' ' +
        '-'.repeat(NAME_COL_WIDTH)
      );

      for (const member of displayMembers) {
        const nick = member.displayName;
        const realName = nameMap.get(member.id) || '—';
        const userCol = padRight(nick, USER_COL_WIDTH);
        const nameCol = padRight(realName, NAME_COL_WIDTH);
        lines.push(userCol + ' ' + nameCol);
      }

      lines.push(
        '-'.repeat(USER_COL_WIDTH) +
        ' ' +
        '-'.repeat(NAME_COL_WIDTH)
      );
      lines.push(`Total members: ${sorted.length} (showing ${displayMembers.length})`);
      lines.push('```');

      const embed = {
        color: 0x215db1,  // main color
        title: `<:star:1508838174305030306> Server Members – ${guild.name}`,
        description: lines.join('\n'),
        footer: { text: 'Use !name @user Real Name to add/update a name.' },
      };

      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Members command failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Failed to list members. Do I have the **Server Members Intent** and **Manage Server** permission?');
    }
  },
};