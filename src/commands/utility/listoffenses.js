// src/commands/utility/listoffenses.js
const { loadBadWords } = require('../../utils/moderation');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:listoffenses');

module.exports = {
  name: 'listoffenses',
  description: 'Show all prohibited behaviors and bad words in this server.',
  async execute(message, args) {
    const offenses = [
      '**Fast Message Spam** – more than 7 messages in 5 seconds.',
      '**Duplicate Text** – 4+ identical consecutive messages or walls of repeated characters/words.',
      '**Link Spam** – 5+ external/invite links in 30 seconds.',
      '**Mass Mentions** – 10+ unique user mentions in a single message.',
      '**Excessive Newlines** – more than 10 blank line breaks.',
      '**Mention Spam** – sending messages with mentions too frequently.',
    ];

    const badWords = loadBadWords(message.guild.id);
    if (badWords.length > 0) {
      offenses.push('**Bad Words** – use of a prohibited word/phrase.');
    }

    const embed = {
      color: 0x215db1,
      title: '📜 Server Rules (Automated)',
      description: offenses.join('\n\n'),
      footer: { text: 'Violations will be warned; repeated offenses result in a 1‑hour mute.' },
    };

    if (badWords.length > 0) {
      embed.fields = [
        {
          name: '🚫 Bad Words List',
          value: badWords.join(', '),
          inline: false,
        },
      ];
    }

    await message.channel.send({ embeds: [embed] });
  },
};