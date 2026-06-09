# KanbanQube

![KanbanQube preview](promo.png)

KanbanQube is a local-first Kanban board app backed by a single `board.json` file. It is designed for personal or team workflows where the board should live in a normal folder, optionally inside a Git repository, so changes can be versioned and synced with the tools you already use.

The app provides lanes, cards, labels, checklists, comments, card covers, file attachments, archived cards, search, and a card-detail view. Uploaded files are stored in an `uploads/` folder next to `board.json`, while the board keeps only the attachment metadata and relative links.

## Requirements

- Node.js 18 or newer
- Git, if you want repository sync
- A folder to use as your board vault

## Run With npx

Run KanbanQube against a vault folder:

```sh
npx kanbanqube /path/to/your/vault
```

Then open:

```text
http://localhost:3000
```

If no path is provided, KanbanQube uses the current working directory as the vault:

```sh
npx kanbanqube
```

You can choose a different port:

```sh
PORT=4000 npx kanbanqube /path/to/your/vault
```

## Install

Global install:

```sh
npm install -g kanbanqube
kanbanqube /path/to/your/vault
```

Local development install from this repository:

```sh
npm install
npm start -- /path/to/your/vault
```

## Build

KanbanQube has no frontend build step. The app is plain Node.js plus static browser assets.

Validate the server and browser JavaScript:

```sh
npm test
```

Package managers can install it directly because `package.json` exposes the `kanbanqube` executable through the `bin` field.

## Vaults

A vault is just a directory. KanbanQube stores:

```text
vault/
  board.json
  uploads/
```

If `board.json` does not exist, KanbanQube creates it automatically. If `uploads/` does not exist, it is created when the first file is uploaded.

Uploaded filenames are made unique while preserving the original name in the UI. For example:

```text
MyExample.png
MyExample.kbq_20260609T092141981Zb7a252.png
```

The stored filename prevents conflicts. The app still displays `MyExample.png`.

## Git Sync

Git sync is optional. If the vault is a Git repository with a configured `origin` remote, the Sync button is enabled.

When Sync runs, KanbanQube:

1. Saves pending board changes.
2. Runs `git pull --ff-only`.
3. Checks whether `board.json` changed.
4. Stages and commits `board.json` when needed.
5. Pushes to the configured remote.

If the vault is not a Git repository, or no remote is configured, Sync stays disabled. You can still use the board locally.

Recommended setup:

```sh
mkdir my-kanban-vault
cd my-kanban-vault
git init
git remote add origin git@github.com:you/my-kanban-vault.git
npx kanbanqube .
```

Commit and push once if your remote requires an initial branch:

```sh
git add board.json
git commit -m "Initialize KanbanQube board"
git push -u origin main
```

## Identity

KanbanQube reads your Git identity from the vault repository first:

```sh
git config --local user.name
git config --local user.email
```

If local values are missing, it falls back to global Git config:

```sh
git config --global user.name
git config --global user.email
```

That name is used for comments and activity entries. The settings dialog shows the detected name and email as read-only values.

## Attachments And Covers

Drop files onto a card or into the card details view to attach them. Files are uploaded into the vault `uploads/` folder.

Images can be used as card covers. The cover is stored as a pointer to the attachment in `card.cover.idAttachment`, so removing a cover does not delete the attachment. You can also select another image attachment as the cover.

## Development

Start the app from the repository:

```sh
npm start -- /path/to/your/vault
```

Run checks:

```sh
npm test
```

Main files:

- `server.js` - HTTP server, vault storage, upload handling, Git sync
- `public/app.js` - board UI behavior
- `public/styles.css` - app styling
- `public/index.html` - static app shell
