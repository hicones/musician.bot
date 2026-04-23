import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../data/database.sqlite'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS playlist_songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    duration TEXT,
    thumbnail TEXT,
    FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE
  );
`);

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

export const savePlaylist = (name: string, userId: string, guildId: string, songs: SongData[]) => {
  const insertPlaylist = db.prepare('INSERT INTO playlists (name, user_id, guild_id) VALUES (?, ?, ?)');
  const insertSong = db.prepare('INSERT INTO playlist_songs (playlist_id, title, url, duration, thumbnail) VALUES (?, ?, ?, ?, ?)');

  const transaction = db.transaction((playlistSongs: SongData[]) => {
    const info = insertPlaylist.run(name, userId, guildId);
    const playlistId = info.lastInsertRowid;

    for (const song of playlistSongs) {
      insertSong.run(playlistId, song.title, song.url, song.duration, song.thumbnail);
    }
    return playlistId;
  });

  return transaction(songs);
};

export const getPlaylists = (guildId: string): Playlist[] => {
  return db.prepare('SELECT * FROM playlists WHERE guild_id = ?').all(guildId) as Playlist[];
};

export const getPlaylistSongs = (playlistId: number): SongData[] => {
  return db.prepare('SELECT title, url, duration, thumbnail FROM playlist_songs WHERE playlist_id = ?').all(playlistId) as SongData[];
};

export default db;
