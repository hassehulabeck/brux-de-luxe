# Rules questions

Open ambiguities in the rulebook and the decisions taken. Where the rulebook is unclear, the engine implements the **most literal reading** behind a named option, so the answer can change without rewriting code.

Status: **open** (waiting for Hans), **decided** (answer recorded), **literal** (literal reading implemented, Hans may still overrule).

## Component and board geometry

### Q1. Are the Action strips rows or columns of the Art Nouveau board? (decided by the rulebook)

**Rows.** The contents (p. 1) and the setup illustration (p. 3) show 5 horizontal strips stacked above the Bonus strip, each holding one row of 5 action spaces. `action-strips.json` has `"orientation": "row"`.

Shield numbering is also shown on p. 3: the row labels **4, 3, 2, 1 run from top to bottom**, so shield row 1 is the bottom row next to the Bonus strip. The column labels 1–4 run left to right. `state/coords.ts` follows this.

### Q2. Workshop cursor bounds (decided by Hans)

Can the Workshop cursor be moved so that one of its colored dots lies outside the printed grid? If not, which cursor center positions are legal?

The rulebook illustrations don't settle it. In both Sale examples (p. 5 and p. 11) the cursor ends with its dots on the left edge of the grid, but never beyond it. If dots may not leave the 7×7 grid, the cursor center can only be on the inner 5×5 cells.
**Decided (Hans):** the entire Workshop cursor must stay inside the grid. With the dots on the diagonals, the cursor center can only be on the inner 5×5 cells of the 7×7 grid.

## Phase B: actions

### Q3. Does the Fiftieth Anniversary Park action trigger secondary actions for a building owner? (decided by Hans)

The secondary action triggers "when a player chooses an action on the Art Nouveau board, on which an opponent has built a Building tile" (p. 11). The Park action does not place anything on the Art Nouveau board (p. 7), so it is not tied to any space or building.
**Decided (Hans):** no secondary action.

### Q4. Sale: must the cursor move exactly N spaces, or up to N? (decided by Hans)

"The player can move the Workshop cursor ... a number of spaces equal to the total number of works he has" (p. 5). "Can" suggests the move is optional, but the rulebook does not say whether a shorter move is allowed.
**Decided (Hans):** up to N spaces, so 0 to N steps in total, in any mix of horizontal and vertical steps.

### Q5. Compass: what if turning a needle would make it point at the other needle's space? (decided by Hans)

"Turn one of the two compass needles one space clockwise. The needles are never allowed to point at the same box" (p. 6). Is that needle simply not allowed to turn (so you must turn the other one), or does it skip over the other needle?
**Decided (Hans):** that needle can't be turned, so you turn the other needle. With 6 spaces at most one of the two needles is ever blocked, so there is always a legal turn.

### Q6. Construction: does a Joker-only payment still have to "use both compass types"? (decided by Hans)

Each construction unit may be replaced by a Joker (p. 6), and you must pay with both unit types shown by the needles.
**Decided (Hans):** a Joker replaces one unit of whichever type it stands in for, so any number of the units, including all of them, may be Jokers. The 5 VP bonus is lost as soon as one Joker is used.

### Q7. Is money in the supply limited? (decided by Hans)

The game has 76 × 1 BF and 12 × 5 BF coins (136 BF). The rulebook only says Noble Materials can run out (p. 6).
**Decided (Hans):** money is unlimited. Noble Materials (10 of each) and Jokers (15) are limited. The engine tracks each player's BF but not a money supply, so money is left out of the component-conservation invariant.

### Q8. Rebuilding the Work of Art stacks from the shop (decided by Hans)

"Make two new stacks from the face-up tiles in the shop, making sure to leave the top 2 tiles in place" (p. 5). The shop slots are stacks, so the covered tiles go back: color tiles to the color stack and black tiles to the black stack, shuffled.
**Decided (Hans):** both top tiles stay on their slots; all covered tiles are shuffled back into their stacks.

## Phase C: resolution

### Q9. 2-player neutral Assistants (decided by the rulebook and Hans)

Appendix 3 (p. 12) answers most of this. Neutral Assistants have no bid, so they never affect an auction. They count for shield majorities: if the neutral color wins, nobody scores, but on a tie the tied players score as normal.
**Decided (Hans):** at the end of the round they return to their owners like any other Assistant (End of Turn phase, p. 10).

### Q10. Can a Bonus card won in a tie be tucked? (decided by the rulebook)

"In case of a tie, each player involved in the tie benefits from the central power, but the card is discarded" (p. 8). So it cannot be tucked. For a choice card, each tied player chooses their own power.

### Q11. Brussels majority when nobody used the Brussels board (decided by Hans)

"The player who placed the most total Assistant pawns ... must move one of those Assistant pawns onto the Courthouse" (p. 9). If nobody placed any, there are no pawns to move.
**Decided (Hans):** nobody goes to the Courthouse.

### Q12. Starting Brugmann cards and the 26 Public Figure cards (decided by Hans)

Are the 5 starting Georges Brugmann cards part of the 26 Public Figure cards, and are there more Brugmann cards in the shuffled deck? This affects the deck composition (see the data entry guide).
**Decided (Hans):** the Brugmann cards are only dealt at the start of the game, one to each player. Unused ones go back to the box and are never in the deck. So the deck has 26 − 5 = 21 cards and no Brugmann.

### Q14. Tuck row 4 at the end of the game: which Assistants count? (decided by Hans)

Row 4 scores "each Assistant pawn beyond the second in his possession ... Assistant pawns in the Courthouse do not count" (p. 9). The game ends right after the Brussels majority, skipping the End of Turn phase (p. 10), so Assistants placed in round 5 are still on the boards.
**Decided (Hans):** every Assistant not in the Courthouse counts, including those still on the boards. Option: `rules.tuckRow4CountsAssistantsOnBoards` (set to `false` to count only the Assistants in the player's supply).

### Q15. New first player on a Manneken Pis tie (decided by Hans)

"The tied player who is the first one clockwise from the current first player becomes the new first player" (p. 8). Does the search start with the current first player (who then keeps the pawn if tied) or with the player to their left?
**Decided (Hans):** it starts with the current first player, who keeps the pawn if tied. Option: `rules.firstPlayerTieIncludesCurrent` (set to `false` to start with the player to their left).

### Q16. Do tied Bonus cards count for Manneken Pis? (decided by Hans)

Manneken Pis are counted on "each Bonus card earned during this round" (p. 8). A tied card gives each tied player its central power but is discarded (p. 8).
**Decided (Hans):** no. A tied card is not earned, so its Manneken Pis don't count. Option: `rules.tiedBonusCardsCountMannekenPis`.

### Q17. Secondary action when the active player skips the main action (decided by Hans)

The secondary action triggers "when a player chooses an action on the Art Nouveau board, on which an opponent has built a Building tile" (p. 11). Placing an Assistant without performing the action is allowed (p. 5).
**Decided (Hans):** choosing the space is enough, so the Building owner gets the secondary action even if the action is skipped. Option: `rules.secondaryActionWhenPrimarySkipped`.

### Q18. Advancing past the end of a track (literal)

The rulebook doesn't say what happens when a Bonus card or Public Figure would move a disc past the last space of the City Hall, Royal Palace or Architect track.
**Literal reading implemented:** the disc stays on the last space and the advance is lost. No option, because the rulebook offers no other reading.

### Q19. Choosing which Public Figures to leave unpaid (decided by Hans)

"Each player must pay the amounts indicated on the Public Figure cards that he kept. For each Public Figure card he doesn't pay, the player loses the card and 5 VP" (p. 10). In the example, green chooses which card to give up.
**Decided (Hans):** paying is optional. Leaving a card unpaid costs 5 VP, so in practice players pay when they can, but the engine lets them choose. Option: `rules.mustPayPublicFiguresWhenAble` is `false` by default (set it to `true` to only allow leaving a card unpaid when the money left can't cover it).

## House rules

### Q13. Any house rules the group uses? (decided by Hans)

No house rules. The engine follows the rulebook plus the decisions recorded here.
