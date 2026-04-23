# 🎵 Musician Bot

O **Musician Bot** é um bot de música para Discord moderno e intuitivo, desenvolvido em TypeScript. Ele oferece uma experiência de usuário simplificada através de um canal de controle dedicado e uma interface reativa baseada em embeds.

## ✨ Funcionalidades

- **Canal de Música Dedicado:** Interface centralizada em um canal específico (`#music-room`).
- **Play Automático:** Basta colar o link da música no canal e o bot cuida do resto (e limpa o chat para você!).
- **Interface Interativa:** Controle a reprodução através de botões e reações no player.
- **Sistema de Playlists:** Salve suas músicas favoritas em playlists personalizadas persistidas em banco de dados.
- **Histórico de Reprodução:** Acompanhe o que já tocou diretamente na interface do player.
- **Fila Dinâmica:** Visualize e gerencie a fila de reprodução em tempo real.

## 🚀 Tecnologias Utilizadas

- **Runtime:** [Node.js](https://nodejs.org/)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Biblioteca Discord:** [Discord.js v14](https://discord.js.org/)
- **Engine de Áudio:** [DisTube v5](https://distube.js.org/)
- **Banco de Dados:** [SQLite](https://www.sqlite.org/) (via `better-sqlite3`)
- **Containerização:** [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

## 🛠️ Instalação e Uso

### Pré-requisitos

- Node.js 18+ ou Docker instalado.
- Token de Bot do Discord (obtido no [Discord Developer Portal](https://discord.com/developers/applications)).
- FFmpeg instalado no sistema (se não estiver usando Docker).

### Configuração

1. Clone o repositório:

   ```bash
   git clone https://github.com/seu-usuario/musician.bot.git
   cd musician.bot
   ```

2. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz do projeto:
   ```env
   DISCORD_TOKEN=seu_token_aqui
   PREFIX=!
   ```

### Execução Local (Desenvolvimento)

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

### Execução via Docker (Recomendado)

Para rodar em produção de forma isolada:

```bash
docker-compose up -d
```

## 🎮 Como Usar

1. **Setup Inicial:** Após convidar o bot, use o comando `!setup` em qualquer canal. O bot criará um canal chamado `#music-room` com a interface do player.
2. **Tocar Música:** No canal `#music-room`, apenas cole o link (YouTube, Spotify, etc.) da música desejada.
3. **Controles:** Utilize as reações ou botões no embed do player para pausar, pular ou parar a música.

## 📁 Estrutura do Projeto

```text
src/
├── commands/   # Definições de comandos
├── database/   # Configuração e queries do SQLite
├── handlers/   # Tratamento de eventos (interações/reações)
├── music/      # Lógica central do MusicManager (DisTube)
├── utils/      # Helpers e gerador de embeds
└── index.ts    # Ponto de entrada da aplicação
```

---

Desenvolvido por Hicones
