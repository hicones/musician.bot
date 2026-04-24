import Database from "better-sqlite3";
import path from "path";
import type {
  GuildConfig,
  Playlist,
  SongData,
  FavoriteSongData,
  FavoriteSong,
} from "../types/database.js";

export type {
  GuildConfig,
  Playlist,
  SongData,
  FavoriteSongData,
  FavoriteSong,
};

const db = new Database(path.join(__dirname, "../../data/database.sqlite"));

export const savePlaylist = (
  name: string,
  userId: string,
  guildId: string,
  songs: SongData[],
) => {
  const insertPlaylist = db.prepare(
    "INSERT INTO playlists (name, user_id, guild_id) VALUES (?, ?, ?)",
  );
  const insertSong = db.prepare(
    "INSERT INTO playlist_songs (playlist_id, title, url, duration, thumbnail) VALUES (?, ?, ?, ?, ?)",
  );

  const transaction = db.transaction((playlistSongs: SongData[]) => {
    const info = insertPlaylist.run(name, userId, guildId);
    const playlistId = info.lastInsertRowid;

    for (const song of playlistSongs) {
      insertSong.run(
        playlistId,
        song.title,
        song.url,
        song.duration,
        song.thumbnail,
      );
    }
    return playlistId;
  });

  return transaction(songs);
};

export const getPlaylists = (guildId: string): Playlist[] => {
  return db
    .prepare("SELECT * FROM playlists WHERE guild_id = ?")
    .all(guildId) as Playlist[];
};

export const getPlaylistSongs = (playlistId: number): SongData[] => {
  return db
    .prepare(
      "SELECT title, url, duration, thumbnail FROM playlist_songs WHERE playlist_id = ?",
    )
    .all(playlistId) as SongData[];
};

export const saveFavoriteSong = (song: FavoriteSongData) => {
  const info = db.prepare(
    "INSERT OR IGNORE INTO favorite_songs (guild_id, user_id, title, url, duration, thumbnail) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    song.guildId,
    song.userId,
    song.title,
    song.url,
    song.duration,
    song.thumbnail,
  );

  return info.changes > 0;
};

export const getFavoriteSongs = (guildId: string): FavoriteSong[] => {
  return db.prepare(
    "SELECT id, guild_id, user_id, title, url, duration, thumbnail, favorited_at FROM favorite_songs WHERE guild_id = ? ORDER BY favorited_at ASC",
  ).all(guildId) as FavoriteSong[];
};

// Guild config management
export const saveGuildConfig = (
  guildId: string,
  config: Omit<GuildConfig, "setup_at" | "last_updated">,
) => {
  const existing = db
    .prepare("SELECT * FROM guild_config WHERE guild_id = ?")
    .get(guildId);

  if (existing) {
    db.prepare(
      "UPDATE guild_config SET music_room_id = ?, player_message_id = ?, setup_by = ?, last_updated = CURRENT_TIMESTAMP, status = ? WHERE guild_id = ?",
    ).run(
      config.music_room_id,
      config.player_message_id || null,
      config.setup_by,
      config.status,
      guildId,
    );
  } else {
    db.prepare(
      "INSERT INTO guild_config (guild_id, music_room_id, player_message_id, setup_by, status) VALUES (?, ?, ?, ?, ?)",
    ).run(
      guildId,
      config.music_room_id,
      config.player_message_id || null,
      config.setup_by,
      config.status,
    );
  }
};

export const getGuildConfig = (guildId: string): GuildConfig | null => {
  return db
    .prepare("SELECT * FROM guild_config WHERE guild_id = ?")
    .get(guildId) as GuildConfig | null;
};

export const updatePlayerMessageId = (guildId: string, messageId: string) => {
  db.prepare(
    "UPDATE guild_config SET player_message_id = ?, last_updated = CURRENT_TIMESTAMP WHERE guild_id = ?",
  ).run(messageId, guildId);
};

export default db;
