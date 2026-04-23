import { MessageReaction, User, TextChannel, ChannelType } from 'discord.js';
import { MusicManager } from '../music/MusicManager';

export const handleReaction = async (reaction: MessageReaction, user: User, musicManager: MusicManager) => {
  if (user.bot) return;
  if (reaction.message.channel.type !== ChannelType.GuildText) return; // GuildText
  
  const channel = reaction.message.channel as TextChannel;
  if (channel.name !== 'music-room') return;

  const guildId = reaction.message.guildId!;
  const queue = musicManager.distube.getQueue(guildId);

  // Remove user reaction
  try {
    await reaction.users.remove(user.id);
  } catch (e) {}

  if (!queue && reaction.emoji.name !== '🚪') return;

  const emojiName = reaction.emoji.name;
  if (!emojiName) return;

  switch (emojiName) {
    case '⏯️':
      if (queue?.paused) queue.resume();
      else queue?.pause();
      break;
    case '⏮️':
      try {
        await queue?.previous();
      } catch (e) {}
      break;
    case '⏭️':
      try {
        await queue?.skip();
      } catch (e) {
        queue?.stop();
      }
      break;
    case '🔀':
      queue?.shuffle();
      break;
    case '🔁':
      const mode = (queue?.repeatMode === 2) ? 0 : (queue?.repeatMode || 0) + 1;
      queue?.setRepeatMode(mode);
      break;
    case '🚪':
      musicManager.distube.voices.get(guildId)?.leave();
      musicManager.clearHistory(guildId);
      break;
  }

  musicManager.updatePlayerMessage(channel);
};
