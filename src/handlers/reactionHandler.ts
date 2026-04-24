import { MessageReaction, User, TextChannel, ChannelType } from "discord.js";
import { MusicManager } from "../music/MusicManager";
import { saveFavoriteSong } from "../database/db";

const PREVIOUS_EMOJI = "\u23EE\uFE0F";
const PLAY_PAUSE_EMOJI = "\u25B6\uFE0F";
const SKIP_EMOJI = "\u23ED\uFE0F";
const STOP_EMOJI = "\u23F9\uFE0F";
const SHUFFLE_EMOJI = "\u{1F500}";
const REPEAT_EMOJI = "\u{1F501}";
const FAVORITE_EMOJI = "\u{1F31F}";
const LEAVE_EMOJI = "\u{1F6AA}";

export const handleReaction = async (
  reaction: MessageReaction,
  user: User,
  musicManager: MusicManager,
) => {
  if (user.bot) return;
  if (reaction.message.channel.type !== ChannelType.GuildText) return;

  const channel = reaction.message.channel as TextChannel;
  if (channel.name !== "music-room") return;

  const guildId = reaction.message.guildId!;
  const queue = musicManager.distube.getQueue(guildId);

  try {
    await reaction.users.remove(user.id);
  } catch (e) {}

  const emojiName = reaction.emoji.name;
  if (!emojiName) return;
  if (!queue && emojiName === FAVORITE_EMOJI) {
    await sendTemporaryFeedback(channel, user.id, "nao ha musica tocando agora para favoritar.");
    return;
  }
  if (!queue && emojiName !== LEAVE_EMOJI) return;

  switch (emojiName) {
    case PREVIOUS_EMOJI:
      try {
        await queue?.previous();
      } catch (e) {}
      break;
    case PLAY_PAUSE_EMOJI:
      if (queue?.paused) queue.resume();
      else queue?.pause();
      break;
    case SKIP_EMOJI:
      try {
        await queue?.skip();
      } catch (e) {
        queue?.stop();
      }
      break;
    case STOP_EMOJI:
      if (queue) {
        queue.stop();
        musicManager.activityManager.onFinish(queue);
        musicManager.clearHistory(guildId);
      }
      break;
    case SHUFFLE_EMOJI:
      queue?.shuffle();
      break;
    case REPEAT_EMOJI:
      const mode = queue?.repeatMode === 2 ? 0 : (queue?.repeatMode || 0) + 1;
      queue?.setRepeatMode(mode);
      break;
    case FAVORITE_EMOJI:
      if (!isAdminUser(user.id)) {
        await sendTemporaryFeedback(channel, user.id, "voce nao tem permissao para favoritar musicas.");
        break;
      }

      if (!queue?.songs.length) break;

      const currentSong = queue.songs[0];
      if (!currentSong.url) {
        await sendTemporaryFeedback(channel, user.id, "nao consegui favoritar essa musica porque ela nao tem URL.");
        break;
      }

      const saved = saveFavoriteSong({
        guildId,
        userId: user.id,
        title: currentSong.name || "Sem titulo",
        url: currentSong.url,
        duration: currentSong.formattedDuration,
        thumbnail: currentSong.thumbnail,
      });

      await sendTemporaryFeedback(
        channel,
        user.id,
        saved
          ? `musica favoritada: **${currentSong.name || "Sem titulo"}**.`
          : `essa musica ja estava nos favoritos: **${currentSong.name || "Sem titulo"}**.`,
      );

      if (saved) {
        console.log(`[Favorites] Musica favoritada: "${currentSong.name || "Sem titulo"}" por ${user.tag}`);
      }
      break;
    case LEAVE_EMOJI:
      musicManager.distube.voices.get(guildId)?.leave();
      musicManager.clearHistory(guildId);
      break;
  }

  musicManager.updatePlayerMessage(channel);
};

const isAdminUser = (userId: string): boolean => {
  const adminIds = process.env.ADMIN_USER_IDS
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) || [];

  return adminIds.includes(userId);
};

const sendTemporaryFeedback = async (
  channel: TextChannel,
  userId: string,
  message: string,
) => {
  const response = await channel.send({
    content: `<@${userId}>, ${message}`,
    allowedMentions: { users: [userId] },
  });

  setTimeout(() => {
    response.delete().catch(() => {});
  }, 8000);
};
