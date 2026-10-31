# The table app

`apps/web`: a Vue 3 + Pinia app that runs in the browser on a tablet next to the board. The humans enter what happens at the table, and the app plays the bots.

```bash
pnpm --filter web dev     # http://localhost:5173
pnpm --filter web build   # static files in apps/web/dist
```

## A game at the table

1. **New game**: number of players, then each seat in turn order (seat 1 is the first player of round 1): name, piece color, human or bot, and the bot's difficulty. The colors are only labels for the instructions ("Place a red Assistant ...").
2. **Setup**: the app asks what the table laid out: the Action strips row by row, the compass tiles space by space, the Public Figures for the Royal Theater, each player's starting Work of Art, the Bonus cards and the Stock Exchange card.
3. **Human turns**: the panel at the top asks the question for the pending decision. Board spaces and Workshop cursor positions are tapped directly; everything else is a big button. Only legal moves are offered.
4. **Bot turns**: the panel lists the bot's moves as instructions, with its reason and its current plan. If the bot draws something (Works of Art in the Workshop), the app asks what was drawn. A human carries the moves out on the board and taps **Done**.
5. **Game over**: the final scores, category by category.

**Undo** goes back to before the last thing a human entered (a decision or a draw), bot moves included. **Redo** plays it again. **Export** downloads the game as JSON; **Import** on the start screen loads one.

## How it is built

| File                  | What it does                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/game/session.ts` | The game: setup, moves, history, undo/redo, save/load, bots. Plain functions, tested without a browser. |
| `src/game/labels.ts`  | Wording: chance outcomes as players see them, bot moves as physical instructions.                       |
| `src/stores/game.ts`  | The Pinia store: the session, the bot turn on screen, autosave to `localStorage`.                       |
| `src/components/`     | The screens. `DecisionPanel` arranges `legalMoves()` as buttons; it never decides what is legal.        |
| `public/sw.js`        | Offline support: after the first visit the app works without a network.                                 |

A saved game is the setup plus the list of moves (`SavedGame` in `session.ts`). Loading replays the moves through `apply()`, so a broken file can't create an impossible state. The game is saved after every move.

The bots use the hand-made `default` weight set. They remember their plan from round to round only while the page is open; after a reload they start fresh, which only removes a small nudge.

## Deploying

`.github/workflows/deploy.yml` builds the app on every push to `main` and uploads `apps/web/dist` over SFTP (the web hotel's protocol) with `lftp`. It needs four repository secrets: `FTP_SERVER` (host name only), `FTP_USERNAME`, `FTP_PASSWORD` and `FTP_SERVER_DIR` (the folder on the server). `FTP_PORT` is optional (default 22). The upload adds and replaces files; it never deletes anything on the server. Until they are set, it builds and skips the upload. The build uses relative paths, so it works in any folder on the web hotel.
