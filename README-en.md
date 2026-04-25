# 🎵 Musician Bot

A modern, intuitive and modular music bot for Discord, built with TypeScript.

## ✨ Features

### Music Playback
- **Auto Play:** Paste a link (YouTube, Spotify, SoundCloud) in the channel and the bot plays automatically
- **Search by Name:** Type the song name to search on YouTube
- **Playlist Support:** YouTube, Spotify and SoundCloud
- **Dynamic Queue:** Add multiple songs and watch the queue grow
- **Radio Mode:** Play favorites randomly on loop

### Interface
- **Dedicated Channel:** Centralized interface in `#music-room`
- **Player Embed:** Shows cover, duration, progress and history
- **Reaction Controls:** Previous, Play/Pause, Skip, Stop, Shuffle, Repeat, Favorite, Leave
- **Button Controls:** View queue, save playlist, play playlist, start radio

### Management
- **/setup Command:** Automatically configures the `#music-room` channel
- **Persisted Playlists:** Save and load playlists from SQLite database
- **Favorites:** Favorite songs with ⭐ reaction for radio mode
- **History:** View what already played directly in the player
- **Inactivity Monitoring:** After 3 minutes empty, automatically starts the radio

## 🛠️ Stack

| Category | Technology |
|---------|-----------|
| Runtime | Node.js 22.x |
| Language | TypeScript 6.x (strict mode) |
| Discord API | Discord.js v14 |
| Audio Engine | DisTube v5 + yt-dlp |
| Database | SQLite (better-sqlite3) |
| Containerization | Docker + Docker Compose |

## 📁 Architecture

```
src/
├── index.ts                    # Entry point, client setup, events
├── commands/
│   ├── setup.ts              # /setup command handler
│   ├── setup-types.ts        # SetupStep, SetupResult interfaces
│   └── setup-steps.ts       # Logic for the 5 setup steps
├── database/
│   └── db.ts               # SQLite queries
├── handlers/
│   ├── interaction-handler.ts   # Interaction dispatch
│   ├── button-handlers.ts        # Button handlers
│   ├── modal-handlers.ts        # Modal handlers
│   └── select-handlers.ts       # Select menu handlers
├── music/
│   ├── music-manager.ts      # DisTube wrapper, events
│   ├── safe-spotify-plugin.ts   # Custom Spotify resolver
│   └── safe-yt-dlp-plugin.ts  # Custom YouTube resolver
├── activity/
│   └── activity-manager.ts  # Inactivity monitoring
├── utils/
│   ├── auth.ts             # isAdminUser()
│   ├── queue.ts           # shuffleSongs, getHumanMembers
│   ├── interactions.ts    # sendTemporaryFeedback
│   ├── player-embed.ts    # createPlayerEmbed, getPlayerButtons
│   ├── setup-embed.ts    # createStepEmbed
│   └── format-error.ts    # formatError()
├── types/
│   └── database.ts        # Database types (exported)
└── models/
    └── database.model.ts  # Original database types
```

### Patterns Used
- **ES Modules with explicit extensions:** `import from "./file.js"`
- **Naming:** kebab-case for files, PascalCase for interfaces
- **Strict Typing:** No `any` (replaced with Discord.js/DisTube types)
- **Separation of Concerns:** Each handler in separate file

## 🚀 How to Run

### Prerequisites

- Node.js 22.x **or** Docker
- FFmpeg (only for local development)
- Bot Token from [Discord Developer Portal](https://discord.com/developers/applications)

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
DISCORD_TOKEN=your_bot_token

# Required - Admin (only bot administrators can use certain commands)
ADMIN_USER_IDS=id1,id2,id3 (multiple IDs separated by comma)

# Optional - Spotify (for large playlists/albums)
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# Optional - User (personal refresh token)
SPOTIFY_REFRESH_TOKEN=your_refresh_token

```

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Production build
npm run build
```

### Docker (Recommended)

```bash
# Build + run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Docker handles:
- Node.js 22
- FFmpeg
- Database persistence in `./data/database.sqlite`

## 🎮 How to Use

### 1. Invite the Bot

Use the invite link from Discord Developer Portal with permissions:
- `Manage Channels`
- `Send Messages`
- `Embed Links`
- `Connect` (Voice)
- `Speak`

### 2. Setup

In any channel, run:
```
/setup
```

The bot will automatically create the `#music-room` channel with the player.

### 3. Play Music

In the `#music-room` channel:
- **Paste a link:** YouTube, Spotify, SoundCloud
- **Or type the name:** The bot searches on YouTube

### 4. Controls

Use reactions on the player embed:
| Emoji | Action |
|------|------|
| ⏮️ | Previous track |
| ▶️ | Play/Pause |
| ⏭️ | Skip |
| ⏹️ | Stop and leave |
| 🔀 | Shuffle queue |
| 🔁 | Change repeat mode |
| ⭐ | Favorite song |
| 🏠 | Leave channel |

---

Developed by Hicones