# 🎵 Musician Bot

Um bot de música para Discord moderno, intuitivo e modular, desenvolvido em TypeScript.

## ✨ Funcionalidades

### Reprodução de Música

- **Play Automático:** Cole um link (YouTube, Spotify, SoundCloud) no canal e o bot toca automaticamente
- **Busca por Nome:** Digite o nome da música para buscar no YouTube
- **Suporte a Playlists:** YouTube, Spotify e SoundCloud
- **Fila Dinâmica:** Adicione várias músicas e veja a fila crescer
- **Modo Rádio:** Reproduz favoritos aleatoriamente em loop

### Interface

- **Canal Dedicado:** Interface centralizada em `#music-room`
- **Player Embed:** Mostra capa, duração, progresso e histórico
- **Controle por Reações:** Anterior, Play/Pausa, Pular, Parar, Shuffle, Repetir, Favoritar, Sair
- **Controle por Botões:** Visualizar fila, salvar playlist, tocar playlist, iniciar rádio

### Gerenciamento

- **Comando `/setup:** Configura o canal `#music-room` automaticamente
- **Playlists Persistidas:** Salve e carregue playlists do banco SQLite
- **Favoritos:**Favorite músicas com reação ⭐ para uso no modo rádio
- **Histórico:** Veja o que já tocou diretamente no player
- **Monitoramento de Inatividade:** Após 3 minutos vazio, inicia o rádio automaticamente

## 🛠️ Stack

| Categoria       | Tecnologia                   |
| --------------- | ---------------------------- |
| Runtime         | Node.js 22.x                 |
| Linguagem       | TypeScript 6.x (strict mode) |
| Discord API     | Discord.js v14               |
| Audio Engine    | DisTube v5 + yt-dlp          |
| Database        | SQLite (better-sqlite3)      |
| Containerização | Docker + Docker Compose      |

## 📁 Arquitetura

```
src/
├── index.ts                    # Entry point, client setup, eventos
├── commands/
│   ├── setup.ts              # Comando /setup (handler)
│   ├── setup-types.ts        # Interfaces SetupStep, SetupResult
│   └── setup-steps.ts       # Lógica dos 5 steps do setup
├── database/
│   └── db.ts               # Queries SQLite
├── handlers/
│   ├── interaction-handler.ts   # Dispatch de interações
│   ├── button-handlers.ts        # Handlers de botão
│   ├── modal-handlers.ts        # Handlers de modal
│   └── select-handlers.ts       # Handlers de select menu
├── music/
│   ├── music-manager.ts      # DisTube wrapper, eventos
│   ├── safe-spotify-plugin.ts   # Spotify resolver customizado
│   └── safe-yt-dlp-plugin.ts  # YouTube resolver customizado
├── activity/
│   └── activity-manager.ts  # Monitoramento de inatividade
├── utils/
│   ├── auth.ts             # isAdminUser()
│   ├── queue.ts           # shuffleSongs, getHumanMembers
│   ├── interactions.ts    # sendTemporaryFeedback
│   ├── player-embed.ts    # createPlayerEmbed, getPlayerButtons
│   ├── setup-embed.ts    # createStepEmbed
│   └── format-error.ts    # formatError()
├── types/
│   └── database.ts        # Tipos do banco (exportados)
└── models/
    └── database.model.ts  # Tipos originais do banco
```

### Padrões Utilizados

- **Módulos ES com extensões explícitas:** `import from "./file.js"`
- **Nomenclatura:** kebab-case para arquivos, PascalCase para interfaces
- **Tipagem Estrita:** Sem `any` (substituído por tipos do Discord.js/DisTube)
- **Separação de Responsabilidades:** Cada handler em arquivo separado

## 🚀 Como Rodar

### Pré-requisitos

- Node.js 22.x **ou** Docker
- FFmpeg
- Token de Bot do [Discord Developer Portal](https://discord.com/developers/applications)

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Obrigatório
DISCORD_TOKEN=seu_token_do_bot

# Obrigatório - Admin (somente administradores do bot podem usar certos comandos)
ADMIN_USER_IDS=id1,id2,id3 (múltiplos IDs separados por vírgula)

# Opcional - Spotify (para playlists/albums grandes)
SPOTIFY_CLIENT_ID=seu_client_id
SPOTIFY_CLIENT_SECRET=seu_client_secret

# Opcional - Usuário (refresh token pessoal)
SPOTIFY_REFRESH_TOKEN=seu_refresh_token
```

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Build de produção
npm run build
```

### Docker (Recomendado)

```bash
# Build + run em modo separado
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

O Docker cuida de:

- Node.js 22
- FFmpeg
- Persistência do banco em `./data/database.sqlite`

## 🎮 Como Usar

### 1. Convidar o Bot

Use o link de convite gerado no Discord Developer Portal com permissões:

- `Manage Channels`
- `Send Messages`
- `Embed Links`
- `Connect` (Voice)
- `Speak`

### 2. Configurar

Em qualquer canal, execute:

```
/setup
```

O bot criará automaticamente o canal `#music-room` com o player.

### 3. Tocar Música

No canal `#music-room`:

- **Cole um link:** YouTube, Spotify, SoundCloud
- **Ou digite o nome:** O bot busca no YouTube

### 4. Controles

Use as reações no embed do player:
| Emoji | Ação |
|------|------|
| ⏮️ | Música anterior |
| ▶️ | Play/Pausa |
| ⏭️ | Pular |
| ⏹️ | Parar e sair |
| 🔀 | Embaralhar fila |
| 🔁 | Mudar modo repeat |
| ⭐ | Favoritar música |
| 🏠 | Sair do canal |

---

Desenvolvido por Hicones
