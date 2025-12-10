# BotLoL - Riot Games API Discord Bot

This is a Node.js Discord bot that consumes the Riot Games API to provide ranked statistics for players. It supports slash commands and sending recaps via Discord Webhooks.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.9.0 or higher)
- A Discord Bot Token and Client ID from the [Discord Developer Portal](https://discord.com/developers/applications)
- A Riot Games API Key from the [Riot Developer Portal](https://developer.riotgames.com/)

## Setup

1.  **Install Dependencies:**
    Open a terminal in the project folder and run:
    ```bash
    npm install
    ```

2.  **Configure Environment Variables:**
    Open the `.env` file and fill in your credentials:
    - `DISCORD_TOKEN`: Your Discord Bot Token.
    - `RIOT_API_KEY`: Your Riot API Key.
    - `DISCORD_WEBHOOK_URL`: The URL of the Discord Webhook where you want to send recaps.
    - `CLIENT_ID`: Your Discord Application Client ID.
    - `GUILD_ID`: (Optional) The ID of the server where you are testing (useful for instant command registration).

3.  **Run the Bot:**
    ```bash
    npm start
    ```

## Commands

- `/stats <name> <tag>`: Get ranked stats for a specific player (e.g., `/stats Faker T1`).
- `/recap <name> <tag>`: Fetch stats and send them to the configured Webhook.

## Notes

- The Riot API Key expires every 24 hours if you are using a development key. You will need to regenerate it and update the `.env` file.
- Ensure your bot has the `applications.commands` scope authorized when inviting it to your server.
