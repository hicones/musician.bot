import { Playlist, ResolveOptions, Song } from 'distube';
import { SpotifyPlugin, SpotifyPluginOptions } from '@distube/spotify';
import { Details, Preview, SpotifyUrlInfoModule, Track } from 'spotify-url-info';

const spotifyUrlInfo = require('spotify-url-info') as SpotifyUrlInfoModule;
const spotifyInfo = spotifyUrlInfo(fetch);

const getSpotifyId = (uriOrUrl: string | undefined, fallback: string) => {
  if (!uriOrUrl) return fallback;
  return uriOrUrl.split(/[/:]/).filter(Boolean).pop() || fallback;
};

const getTrackUrl = (track: Track, fallbackId: string) => {
  return `https://open.spotify.com/track/${getSpotifyId(track.uri, fallbackId)}`;
};

export class SafeSpotifyPlugin extends SpotifyPlugin {
  constructor(options?: SpotifyPluginOptions) {
    super(options);
  }

  async resolve<T>(url: string, options: ResolveOptions<T>): Promise<Song<T> | Playlist<T>> {
    try {
      return await super.resolve(url, options);
    } catch (error) {
      if (!this.validate(url)) {
        throw error;
      }

      return this.resolveWithScraper(url, options);
    }
  }

  private async resolveWithScraper<T>(url: string, options: ResolveOptions<T>): Promise<Song<T> | Playlist<T>> {
    const details = await spotifyInfo.getDetails(url);

    if (details.tracks.length > 0) {
      return this.createPlaylistFromDetails(details, options);
    }

    return this.createSongFromPreview(details.preview, options);
  }

  private createPlaylistFromDetails<T>(details: Details, options: ResolveOptions<T>): Playlist<T> {
    return new Playlist(
      {
        source: 'spotify',
        name: details.preview.title,
        url: details.preview.link,
        thumbnail: details.preview.image,
        songs: details.tracks.map((track, index): Song<T> => this.createSongFromTrack(track, options, index)),
      },
      options,
    );
  }

  private createSongFromPreview<T>(preview: Preview, options: ResolveOptions<T>): Song<T> {
    return new Song(
      {
        plugin: this,
        source: 'spotify',
        playFromSource: false,
        id: getSpotifyId(preview.link, preview.track),
        name: preview.track || preview.title,
        url: preview.link,
        thumbnail: preview.image,
        uploader: {
          name: preview.artist,
        },
      },
      options,
    );
  }

  private createSongFromTrack<T>(track: Track, options: ResolveOptions<T>, index: number): Song<T> {
    const id = getSpotifyId(track.uri, `spotify-track-${index}`);

    return new Song(
      {
        plugin: this,
        source: 'spotify',
        playFromSource: false,
        id,
        name: track.name,
        url: getTrackUrl(track, id),
        duration: track.duration ? track.duration / 1000 : undefined,
        uploader: {
          name: track.artist,
        },
      },
      options,
    );
  }
}
