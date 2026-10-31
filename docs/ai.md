# How the utility bot thinks

A short tour of `packages/engine/src/ai`, for reading or changing how the bot plays. PLAN.md section 5 is the design; this is what was built.

## One decision, start to finish

```ts
const bot = utilityBot({ rng: seededRng(1), difficulty: 'normal' });
const { move, score, reason, alternatives, plan } = bot.decide(visibleState(state, me), me);
```

1. **Plans** (`plans.ts`). The bot works out how well each of its four plans fits its position (Builder, Art Dealer, Politician, Opportunist), blends them, and gets a multiplier for each value source (money, works, buildings, City Hall, figures, Assistants).
2. **Candidate moves** (`search.ts`). Every legal move, except that bids are capped at 2 BF more than it takes to catch the column's leader.
3. **Look-ahead** (`search.ts`). Each move is played out through the bot's own follow-up decisions, the best way. A Sale is valued as the best cursor position, work and shop space. The look-ahead stops at chance events, other players' decisions, the next turn and each Bonus card decision. The bot's own Workshop draw is valued with the most likely colors in the stack.
4. **Considerations** (`considerations/`). Each one turns (state before, move, state after) into VP. The bot adds them up, each times its weight.
5. **Pick**. On its turns the bot samples among its best few moves (the difficulty sets how many and how freely). Every other decision takes the best move.
6. **Explain** (`reason.ts`). "Sale on row 5, column 5, bid 1 BF: +6 VP, +5 BF, -1 work, bids for the Bonus card (Builder)."

## The projection

`project(state, player)` estimates the final score the player is heading for (`projection.ts`):

- **Terminal**: the real final score if the game ended now, with the Public Figures paid for (cheapest first, while the money lasts).
- **Future**: what the resources are still worth in the rounds left. Money to spend, works to sell, materials that can pay for Buildings (worth the Architect value + construction VP each), City Hall and Royal Palace positions that pay every round, Assistants outside the Courthouse, and the Assistants still available this round.

The future part shrinks as the rounds pass, so in round 5 the bot decides on the real final score. A move that ends the round (the last pass, the last Bonus card) leads to a state in the next round. That state is valued as of the end of the round the move was made in (`timingAfter`), so the round that just ended doesn't count as income lost.

## The considerations

| File                    | What it adds                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `projection-gain.ts`    | The change in the projection, weighted by the plan. Most of the score comes from here. |
| `auction.ts`            | The column's Bonus card × the chance of winning it with this bid.                      |
| `shield-majority.ts`    | Shield VP gained around the space, plus VP denied to opponents.                        |
| `gift.ts`               | The secondary action handed to an opponent's Building (a cost).                        |
| `courthouse-risk.ts`    | The extra chance of losing an Assistant to the Courthouse (a cost).                    |
| `manneken-pis.ts`       | The change in the chance of becoming first player (5 VP in round 5).                   |
| `denial.ts`             | Damage to opponents' best Sale (cursor, shop) and their means to build (needles).      |
| `building-placement.ts` | A new Building's expected income: how often its space will be in the area.             |
| `area-choice.ts`        | The Stock Exchange shield: own Buildings in the area are good, opponents' bad.         |

Each one has its own test with a hand-built state in `packages/engine/test/ai/considerations/`.

## Weights

All numbers live in JSON, not in the code:

- `ai/weights/default.json`: the hand-made set from Phase 4: what resources are worth, the plans' multipliers and fitness, the considerations' weights, and the auction, shield and Courthouse parameters.
- `ai/weights/tuned.json`: the same set after tuning (below).
- `ai/weights/difficulty.json`: sampling temperature and top-k for Easy, Normal, Hard and Brutal.

`WEIGHT_SETS` in `ai/weights/index.ts` lists the sets by name. In the simulator, `utility:tuned` is the utility bot with the tuned set, and plain `utility` uses `default`.

These are the bot's opinions (for example, "a Maeterlinck activation is worth about 5 VP"). They are not component data.

## Tuning

```bash
pnpm sim -- --tune --iterations 40 --games 80 --seed 42 --no-invariants
```

Hill-climbing (`apps/sim/src/tune.ts`):

1. Take the current best set (the champion) and multiply 3 random weights by a random factor around 1. Chances and shares stay at most 1, weights that are 0 stay 0, and the projection's own weight stays 1 (it sets the scale of everything).
2. Play the candidate against the champion: 3-player games of candidate, champion and greedy, seats rotating. Count the games where the candidate scored more than the champion.
3. Games are noisy, so the candidate must win twice: more than 55% of the first games, then more than 50% of as many fresh games. Only then does it become the champion, and the file is written.

`--from tuned` starts from the tuned set to continue. After tuning, check the result with the tournament: it plays the tuned set against the default one and flags degenerate strategies.

## Degenerate strategies

Every report (match and tournament) checks each bot for strategies a player would never fall into (`apps/sim/src/degeneracy.ts`): never using the Brussels board (under 0.5 actions per game), always tucking Bonus cards (over 90%), never building (under 0.5 Buildings per game) and hoarding money (over 20 BF left at the end).

## Speed

A game with one utility bot takes about 0.4 s. The tricks are in the comment at the top of `search.ts`: higher bids reuse the minimum bid's look-ahead, each action's best follow-ups are found once per decision and replayed for other spaces, and only the most promising Workshop cursor positions and Building spaces are searched.

## Reading a game

```bash
pnpm sim -- --games 1 --bots utility,greedy,greedy --seed 7 --log decisions.jsonl
```

Each line is one bot decision: round, seat, plan, the move, its score, the reason, and the top 3 alternatives with their scores.

## Not in v1

- Tempo/scarcity (PLAN.md 5.2, item 7) and opponent modelling are not built yet.
- The shield choice looks at Buildings in the area only, rather than simulating both areas in full.
- Difficulty only changes sampling (temperature, top-k), not projection quality.
