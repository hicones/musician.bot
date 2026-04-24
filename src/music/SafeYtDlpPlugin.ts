import { DisTubeError, ExtractorPlugin, Playlist, ResolveOptions, Song } from 'distube';
import { json } from '@distube/yt-dlp';

type YtDlpVideo = {
  id: string;
  title?: string;
  fulltitle?: string;
  extractor?: string;
  webpage_url?: string;
  original_url?: string;
  is_live?: boolean;
  thumbnail?: string;
  thumbnails?: { url: string }[];
  duration?: number;
  uploader?: string;
  uploader_url?: string;
  view_count?: number;
  like_count?: number;
  dislike_count?: number;
  repost_count?: number;
  age_limit?: number;
  url?: string;
};

type YtDlpPlaylist = {
  entries: YtDlpVideo[];
  extractor?: string;
  id: string | number;
  title?: string;
  webpage_url?: string;
  thumbnails?: { url: string }[];
};

const isPlaylist = (info: YtDlpVideo | YtDlpPlaylist): info is YtDlpPlaylist => {
  return Array.isArray((info as YtDlpPlaylist).entries);
};

export class SafeYtDlpPlugin extends ExtractorPlugin {
  validate(url: string) {
    return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(url);
  }

  async resolve<T>(url: string, options: ResolveOptions<T>) {
    const info = await this.getInfo(url);

    if (isPlaylist(info)) {
      if (info.entries.length === 0) {
        throw new DisTubeError('YTDLP_ERROR', 'The playlist is empty');
      }

      return new Playlist(
        {
          source: info.extractor || 'yt-dlp',
          songs: info.entries.map((entry) => new SafeYtDlpSong(this, entry, options)),
          id: info.id.toString(),
          name: info.title,
          url: info.webpage_url,
          thumbnail: info.thumbnails?.[0]?.url,
        },
        options,
      );
    }

    return new SafeYtDlpSong(this, info, options);
  }

  async getStreamURL(song: Song) {
    if (!song.url) {
      throw new DisTubeError('YTDLP_PLUGIN_INVALID_SONG', 'Cannot get stream url from invalid song.');
    }

    const info = await this.getInfo(song.url, { format: 'ba/ba*' });
    if (isPlaylist(info)) {
      throw new DisTubeError('YTDLP_ERROR', 'Cannot get stream URL of an entire playlist');
    }

    if (!info.url) {
      throw new DisTubeError('YTDLP_ERROR', 'yt-dlp did not return a playable stream URL');
    }

    return info.url;
  }

  getRelatedSongs() {
    return [];
  }

  async searchSong<T>(query: string, options: ResolveOptions<T>) {
    const info = await this.getInfo(`ytsearch1:${query}`);
    const firstResult = isPlaylist(info) ? info.entries[0] : info;

    if (!firstResult) {
      return null;
    }

    return new SafeYtDlpSong(this, firstResult, options);
  }

  private async getInfo(url: string, extraFlags: Record<string, unknown> = {}) {
    return json(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      skipDownload: true,
      simulate: true,
      ...extraFlags,
    }).catch((error) => {
      throw new DisTubeError('YTDLP_ERROR', error instanceof Error ? error.message : String(error));
    });
  }
}

class SafeYtDlpSong<T = unknown> extends Song<T> {
  constructor(plugin: SafeYtDlpPlugin, info: YtDlpVideo, options?: ResolveOptions<T>) {
    super(
      {
        plugin,
        source: info.extractor || 'yt-dlp',
        playFromSource: true,
        id: info.id,
        name: info.title || info.fulltitle,
        url: info.webpage_url || info.original_url,
        isLive: info.is_live,
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
        duration: info.is_live ? 0 : info.duration,
        uploader: {
          name: info.uploader,
          url: info.uploader_url,
        },
        views: info.view_count,
        likes: info.like_count,
        dislikes: info.dislike_count,
        reposts: info.repost_count,
        ageRestricted: (info.age_limit ?? 0) >= 18,
      },
      options,
    );
  }
}
