# The table app

`apps/web`: a Vue 3 + Pinia app that runs in the browser on a tablet next to the board. The humans enter what happens at the table, and the app plays the bots.

```bash
pnpm --filter web dev     # http://localhost:5173
pnpm --filter web build   # static files in apps/web/dist
```

## A game at the table

1. **New game**: number of players, then each seat in turn order (seat 1 is the first player of round 1): name, piece color, human or bot, and the bot's difficulty. The colors are only labels for the instructions ("Place a red Assistant ...").
2. **Setup**: the app asks what the table laid out: the Action strips row by row, the compass tiles space by space, the Public Figures for the Royal Theater (from the free space on the far right towards the 3 BF space), each player's starting Work of Art, the Bonus cards column by column and the Stock Exchange card. Each new question fades in. When several Works of Art are drawn, count them with a − / + per color.
3. **Human turns**: the panel at the top asks the question for the pending decision. Board spaces and Workshop cursor positions are tapped directly; everything else is a big button. Only legal moves are offered.
4. **Bot turns**: the panel lists the bot's moves as instructions, with its reason and its current plan. If the bot draws something (Works of Art in the Workshop), the app asks what was drawn. A human carries the moves out on the board and taps **Done**.
5. **Also on the board**: when the engine does something on its own, the app says what to move. That covers a secondary action on someone's Building, each shield that scores (who scores how many VP), and the Brussels majority. During a bot turn these are part of its list; after a human move they show in a box at the top, closed with **Done**.
6. **Can't carry out an action?** If only **Skip** is offered, the app says why (for a Construction: the needle tiles, what the next Building costs, and what you have).
7. **Bonus cards**: each won card is shown with its column, so a player with two cards knows which one is which.
8. **Game over**: the final scores, category by category.

**Suggestions** (in the toolbar, and on the start screen) opens the suggestion box: a bug or an idea, a title, a description and an optional name. It becomes an issue on GitHub. A bug report sent during a game can attach the game (the setup and every move), so it can be replayed.

**On a phone** (narrower than 600px) the toolbar keeps the round, **Undo**, **Redo** and a **Menu** button; Export, New game and Suggestions are in the menu. The board shrinks to fit the screen width. Tap outside the menu (or press Escape) to close it.

**One-column layout** (narrower than 900px: phones and portrait tablets): when a human has to tap a board space, the board moves into the question panel, between the question and the bid, so there is no scrolling between tapping and bidding. Long choice lists show two columns of smaller buttons on a phone, with details (Manneken Pis, VP symbols, a Public Figure's cost) on a smaller second line.

**Undo** goes back to before the last thing a human entered (a decision or a draw), bot moves included. **Redo** plays it again. **Export** downloads the game as JSON; **Import** on the start screen loads one.

## How it is built

| File                      | What it does                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/game/session.ts`     | The game: setup, moves, history, undo/redo, save/load, bots. Plain functions, tested without a browser. |
| `src/game/labels.ts`      | Wording: chance outcomes as players see them, bot moves as physical instructions.                       |
| `src/stores/game.ts`      | The Pinia store: the session, the bot turn on screen, autosave to `localStorage`.                       |
| `src/components/`         | The screens. `DecisionPanel` arranges `legalMoves()` as buttons; it never decides what is legal.        |
| `public/sw.js`            | Offline support: after the first visit the app works without a network.                                 |
| `src/game/feedback.ts`    | The suggestion box report: what it holds and how it is sent. `SuggestionBox.vue` is the form.           |
| `public/api/feedback.php` | The suggestion box server side on the web hotel: checks the report and files it as a GitHub issue.      |

A saved game is the setup plus the list of moves (`SavedGame` in `session.ts`). Loading replays the moves through `apply()`, so a broken file can't create an impossible state. The game is saved after every move.

The bots use the hand-made `default` weight set. They remember their plan from round to round only while the page is open; after a reload they start fresh, which only removes a small nudge.

## Deploying

`.github/workflows/deploy.yml` builds the app on every push to `main` and uploads `apps/web/dist` over SFTP (the web hotel's protocol) with `lftp`. It needs four repository secrets: `FTP_SERVER` (host name only), `FTP_USERNAME`, `FTP_PASSWORD` and `FTP_SERVER_DIR` (the folder on the server). `FTP_PORT` is optional (default 22). The upload adds and replaces files; it never deletes anything on the server. Until they are set, it builds and skips the upload. The build uses relative paths, so it works in any folder on the web hotel.

## The suggestion box

The web hotel serves the app as static files, plus one PHP script: `public/api/feedback.php` (Vite copies it to `dist/api/`). The app posts the report there as JSON. The script:

1. checks it (bug or idea, title 3–120 characters, a description, a hidden honeypot field that only bots fill in),
2. allows 5 reports per visitor (IP address) per 10 minutes,
3. for a bug with an attached game, commits `reports/<date>/<time>-<id>.json` to the `bug-reports` branch,
4. creates an issue titled `[Bug] …` or `[Idea] …` with the build's commit, labelled `bug` or `enhancement` plus `from-the-app`, and links the attached game.

An attached game opens with **Import** on the start screen, just like an export. `@` in the text is defanged, so a report can't ping anyone on GitHub. The repository is public, so reports are too: the form says so.

**Setup:** create a fine-grained GitHub token for `hassehulabeck/brux-de-luxe` only, with **Issues: Read and write** and **Contents: Read and write** (for the `bug-reports` branch). Add it as the repository secret `FEEDBACK_GITHUB_TOKEN`. `deploy.yml` then writes `dist/api/feedback-config.php`, which returns the token, and uploads it with the rest; `api/.htaccess` keeps it out of reach. Without the secret the box answers "The suggestion box is closed for now." The web hotel needs PHP 8.1 or later with curl.

`test/feedback-php.test.ts` runs the script with PHP's built-in server against a fake GitHub API (skipped when `php` is not installed).

## The game log

The app tells `public/api/games.php` (next to the suggestion box) when a game starts and when it ends. The server keeps **one row per game** in MySQL on the web hotel, table `games`:

| Column                                 | What                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `game_id`                              | A random UUID made at **Start the game**. It is saved with the game (`SessionConfig.gameId`), so a reload is not a new game.        |
| `ip_network`                           | Rough geography: the visitor's address with the end zeroed (IPv4 /24, `203.0.113.0`; IPv6 /48). The whole address is never stored.  |
| `app_commit`                           | The build.                                                                                                                          |
| `player_count`, `seats`                | Number of seats, and each seat's color and bot level (`null` for a human), as JSON. No names.                                       |
| `started_at`, `ended_at`               | The device's clock, in UTC. These are the real times even if the event was sent later.                                              |
| `start_received_at`, `end_received_at` | The server's clock, in UTC.                                                                                                         |
| `moves`, `winning_score`               | Number of moves, and the highest total.                                                                                             |
| `scores`                               | Every seat's whole final score as JSON: track, buildings, rows 1–4, noble materials, Manneken Pis, total, with color and bot level. |

A row with a start and no end is a game that was not finished (or not yet). Ending again after an undo replaces the result. The script creates the table on its first request.

**Offline:** events wait in a queue in `localStorage` (`game/game-log.ts`) and are sent at the next start-up, when the browser comes back online, or with the next event. An event leaves the queue when the server took it or refused it for good (4xx); offline, 429 and 5xx keep it. The queue holds at most 50 events. Logging never blocks or breaks play.

**Opt-out:** the start screen says what is logged, with a checkbox that is on by default. Switching it off on a device sends nothing more and forgets what was waiting.

**Setup:** in the web hotel's control panel, create a MySQL database and a user with access to it. Add the repository secrets `GAMES_DB_HOST`, `GAMES_DB_NAME`, `GAMES_DB_USER` and `GAMES_DB_PASSWORD`. `deploy.yml` then writes `dist/api/games-config.php`; `api/.htaccess` keeps it out of reach. Without the secrets the log answers 503 and the app keeps its queue until the log is switched on. Read the data in phpMyAdmin, for example:

```sql
SELECT started_at, ended_at, player_count, winning_score, ip_network
FROM games WHERE ended_at IS NOT NULL ORDER BY started_at DESC;
```

**Debugging the connection:** set the repository variable `GAMES_DEBUG` to `1` (Settings → Secrets and variables → Actions → Variables) and run the deploy. Then open `api/games.php` in a browser: `{"ok":true}` means it connected and the table exists; otherwise the error says why (wrong host, access denied...). Delete the variable and deploy again afterwards, because the messages name the database.

`test/games-php.test.ts` runs the script with PHP's built-in server against an SQLite file. The SQL is plain enough for both. It is skipped when `php` or `pdo_sqlite` is missing.
