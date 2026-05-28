const { upsertEntry } = require('../../utils/database');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('COMMAND:setbirthday');

/**
 * Parse date input. Supports DD/MM or DD/MM/YY or DD/MM/YYYY.
 * Returns an object { formatted: "DD/MM" or "DD/MM/YYYY", hasYear: boolean }
 */
function parseDate(input) {
  // Optional year: match DD/MM or DD/MM/YY or DD/MM/YYYY
  const match = input.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) throw new Error('Invalid format. Use DD/MM or DD/MM/YY(YY).');

  let [, day, month, year] = match;
  day = parseInt(day, 10);
  month = parseInt(month, 10);

  if (month < 1 || month > 12) throw new Error('Month must be between 1 and 12.');
  if (day < 1 || day > 31) throw new Error('Day must be between 1 and 31.');

  // Rough day-per-month validation (assume non-leap year if no year given)
  const checkYear = year ? parseInt(year, 10) : 2001; // default non-leap
  const realYear = year ? (parseInt(year, 10) < 100 ? parseInt(year, 10) + 2000 : parseInt(year, 10)) : null;
  const daysInMonth = [31, (realYear && realYear % 4 === 0 && (realYear % 100 !== 0 || realYear % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) throw new Error(`Invalid day for given month.`);

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');

  if (year) {
    let yyyy = parseInt(year, 10);
    if (yyyy < 100) yyyy += 2000;
    return { formatted: `${dd}/${mm}/${yyyy}`, hasYear: true };
  } else {
    return { formatted: `${dd}/${mm}`, hasYear: false };
  }
}

module.exports = {
  name: 'setbirthday',
  description: 'Store or update a birthday. Usage: !setbirthday @user DD/MM[/YY]',
  async execute(message, args) {
    logger.info(`Executed by ${message.author.tag} in ${message.guild.name}`);
    if (args.length < 2) return message.channel.send('Usage: `!setbirthday @user DD/MM` or `DD/MM/YY`');

    const targetArg = args[0];
    let targetUser;
    if (targetArg.startsWith('<@') && targetArg.endsWith('>')) {
      const id = targetArg.replace(/[<@!>]/g, '');
      targetUser = message.guild.members.cache.get(id)?.user;
    } else if (/^\d+$/.test(targetArg)) {
      targetUser = message.guild.members.cache.get(targetArg)?.user;
    }
    if (!targetUser) return message.channel.send('<:Negative:1508838218043363419> User not found.');

    let parsed;
    try {
      parsed = parseDate(args[1]);
    } catch (err) {
      return message.channel.send(`<:Negative:1508838218043363419> ${err.message}`);
    }

    try {
      const result = upsertEntry('birthday', message.guild.id, targetUser.id, parsed.formatted);
      const msg = result.created
        ? `<:Positive:1508838207838486579> Birthday for ${targetUser.tag} set to **${parsed.formatted}**.`
        : `<:Positive:1508838207838486579> Birthday for ${targetUser.tag} updated to **${parsed.formatted}**.`;
      await message.channel.send(msg);
    } catch (error) {
      logger.error('Setbirthday failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Something went wrong.');
    }
  },
};