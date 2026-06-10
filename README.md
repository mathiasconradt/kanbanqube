# KanbanQube

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mathiasconradt_kanbanqube&metric=alert_status&token=7c0afec22581861a3d7d49e67df8ad32aa9b5972)](https://sonarcloud.io/summary/new_code?id=mathiasconradt_kanbanqube)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me-a%20coffee-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/mathiasconradt)
![GitHub stars](https://img.shields.io/github/stars/mathiasconradt/kanbanqube)

![KanbanQube preview](promo.jpg)

KanbanQube is a local-first Kanban board app backed by normal files in a vault folder. It is designed for personal or team workflows where the board should live in a regular directory, optionally inside a Git repository, so changes can be versioned and synced with the tools you already use.

The app provides lanes, cards, labels, checklists, comments, card covers, file attachments, archived cards, search, and a card-detail view. Uploaded files are stored in an `uploads/` folder, while board data is split into per-object JSON files under `board/` so Git can merge independent card and checklist edits more cleanly.

![KanbanQube board screenshot](screenshot.png)

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
  board/
    meta.json
    cards/
    lists/
    checklists/
    actions/
    labels/
    members/
  uploads/
```

If `board/` does not exist, KanbanQube creates it automatically. If an older `board.json` exists, KanbanQube imports it into the split `board/` layout the first time it starts. The original `board.json` is left in place but is no longer the active storage file. If `uploads/` does not exist, it is created when the first file is uploaded.

Uploaded filenames are made unique while preserving the original name in the UI. For example:

```text
MyExample.png
MyExample.kbq_20260609T092141981Zb7a252.png
```

The stored filename prevents conflicts. The app still displays `MyExample.png`.

## Board Workflow

Use the board view for quick work:

- Click `+ Add a card` to create a card directly in the lane and type its title inline.
- Click the board title or lane title to rename it inline.
- Click a card to open its details.
- Settings can enable inline editing for existing card titles in board lanes.

## Git Sync

Git sync is optional. If the vault is a Git repository with a configured `origin` remote, the Sync button is enabled.

When Sync runs, KanbanQube:

1. Saves pending board changes.
2. Checks whether anything in the vault repository changed.
3. Stages and commits all repository changes when needed, including `board/`, `uploads/`, and newly added files.
4. Runs `git pull --rebase` to bring in remote changes after local work is committed.
5. Pushes to the configured remote.
6. Reloads the board from disk so changes pulled from another machine are visible without refreshing the browser.

If the vault is not a Git repository, or no remote is configured, Sync stays disabled. You can still use the board locally.

Settings includes `Run Git sync in the background (no dialog)`. When enabled, the Sync button runs without opening the sync log automatically. The status text under the app title can still be clicked to open the sync log during or after sync.

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
git add board
git commit -m "Initialize KanbanQube board"
git push -u origin main
```

## Import

KanbanQube can import a board export JSON from Settings. Import is only enabled when the current board has no cards. This keeps accidental replacement of an active board from happening inside the app.

Imported data is normalized and written into the split `board/` vault layout.

## Demo Board

The repository includes `demo_board.json`, a sample e-commerce product board with design, UX, frontend, backend, QA, content, and analytics work spread across the default lanes.

When a vault has no cards, KanbanQube asks whether to load the demo board. If accepted, the app loads `demo_board.json` and saves it into the current vault using the same path as a normal import.

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

Deleting an uploaded attachment from a card also deletes the physical file from `uploads/` when no other card still references that file.

## Keyboard Shortcuts

Board view shortcuts are ignored while typing in inputs or while a dialog is open.

| Key | Action |
| --- | --- |
| Arrow keys | Select cards across lanes and rows |
| Enter | Open selected card details |
| Space | Toggle selected card done status |
| c | Archive selected card |
| 1-9 | Toggle the matching label by label-list order |

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

## Star History

<a href="https://www.star-history.com/?repos=mathiasconradt%2Fkanbanqube&type=timeline&logscale=&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=mathiasconradt/kanbanqube&type=timeline&theme=dark&logscale&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=mathiasconradt/kanbanqube&type=timeline&logscale&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=mathiasconradt/kanbanqube&type=timeline&logscale&legend=top-left" />
 </picture>
</a>
