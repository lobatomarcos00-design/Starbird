const { loadBadWords } = require('../../utils/moderation');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:badwords');

module.exports = {
  name: 'badwords',
  description: 'Show the server\'s bad words list.',
  async execute(message, args) {
    const words = loadBadWords(message.guild.id);
    if (words.length === 0) {
      return message.channel.send('📭 No bad words configured.');
    }
    const embed = {
      color: 0x215db1,
      title: '🚫 Bad Words',
      description: words.join(', '),
    };
    await message.channel.send({ embeds: [embed] });
  },
};