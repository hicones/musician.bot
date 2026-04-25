export interface GuildConfig {
  guild_id: string;
  music_room_id: string;
  player_message_id?: string;
  setup_by: string;
  setup_at: string;
  last_updated: string;
  status: "active" | "needs_repair" | "deprecated";
}

export interface Playlist {
  id: number;
  name: string;
  user_id: string;
  guild_id: string;
}

export interface SongData {
  title: string;
  url: string;
  duration?: string;
  thumbnail?: string;
}

export interface PlaylistSong extends SongData {
  id: number;
  playlist_id: number;
}

export interface FavoriteSongData extends SongData {
  guildId: string;
  userId: string;
}

export interface FavoriteSong extends SongData {
  id: number;
  guild_id: string;
  user_id: string;
  favorited_at: string;
}
