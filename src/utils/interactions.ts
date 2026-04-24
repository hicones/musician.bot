import { TextChannel } from "discord.js";

export const sendTemporaryFeedback = async (
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