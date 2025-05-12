# Newsletter-to-Discord Bot

A Discord bot that automatically posts new newsletters to Discord channels based on a Google Sheets configuration.

## Features

- Monitors a shared inbox for newsletter emails
- Automatically extracts web version links
- Posts rich embeds to configured Discord channels
- Tracks link clicks for analytics
- One-click OAuth2 installation flow

## Architecture

This bot is built using TypeScript and follows Clean Architecture principles with Domain-Driven Design. The application is structured to separate core business logic from external services like Discord, IMAP, and Google Sheets.

## Development

### Prerequisites

- Node.js 20+
- Discord Developer account
- Google Cloud account with Sheets API enabled
- IMAP-enabled email account

### Setup

1. Clone this repository
2. Run `yarn install` to install dependencies
3. Copy `.env.example` to `.env` and fill in required values
4. Run `yarn dev` to start the development server

## Configuration

The bot uses Google Sheets for configuration. The sheet should have the following columns:
- Newsletter Name
- Signup URL
- Sender Email
- Discord Channel IDs (comma-separated)

## License

[MIT](LICENSE)