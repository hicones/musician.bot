import { GuildMember } from "discord.js";

export const shuffleSongs = <T>(songs: T[]) => {
  const shuffled = [...songs];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};

export const getHumanMembers = (voiceChannel: {
  members: Map<string, GuildMember>;
}): GuildMember[] => {
  return Array.from(voiceChannel.members.values()).filter(
    (member) => !member.user.bot,
  );
};
