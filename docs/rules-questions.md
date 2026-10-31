# Rules questions

Open ambiguities in the rulebook and the decisions taken. Where the rulebook is unclear, the engine implements the **most literal reading** behind a named option, so the answer can change without rewriting code.

Status: **open** (waiting for Hans), **decided** (answer recorded), **literal** (literal reading implemented, Hans may still overrule).

## Component and board geometry

### Q1. Are the Action strips rows or columns of the Art Nouveau board? (open)

The rulebook says "assemble the 5 Action strips and place them above the Bonus strip" (p. 2). That fits both 5 horizontal strips stacked on top of each other and 5 vertical strips side by side. PLAN.md says "which strip in which column", but that needs checking against the physical game. It decides how a strip's data maps onto the 5×5 board.

### Q2. Workshop cursor bounds (open)

Can the Workshop cursor be moved so that one of its colored dots lies outside the printed grid? If not, which cursor center positions are legal? This is needed together with the Workshop data (see `data-entry-guide.md`).

## Phase B: actions

### Q3. Does the Fiftieth Anniversary Park action trigger secondary actions for a building owner? (literal)

The secondary action triggers "when a player chooses an action on the Art Nouveau board, on which an opponent has built a Building tile" (p. 11). The Park action does not place anything on the Art Nouveau board (p. 7), so it is not tied to any space or building.
**Literal reading:** no secondary action. Option: `rules.parkTriggersSecondary = false`.

### Q4. Sale: must the cursor move exactly N spaces, or up to N? (literal)

"The player can move the Workshop cursor ... a number of spaces equal to the total number of works he has" (p. 5). "Can" suggests the move is optional, but the rulebook does not say whether a shorter move is allowed.
**Literal reading:** move 0 to N spaces in total, in any mix of horizontal and vertical steps. Option: `rules.saleCursorExactDistance = false`.

### Q5. Compass: what if turning a needle would make it point at the other needle's space? (open)

"Turn one of the two compass needles one space clockwise. The needles are never allowed to point at the same box" (p. 6). Is that needle simply not allowed to turn (so you must turn the other one), or does it skip over the other needle?
**Literal reading (proposed):** that needle cannot be turned, so you turn the other needle. Option: `rules.needleSkipsOccupied = false`.

### Q6. Construction: does a Joker-only payment still have to "use both compass types"? (literal)

Each construction unit may be replaced by a Joker (p. 6), and you must pay with both unit types shown by the needles.
**Literal reading:** a Joker replaces one unit of whichever type it stands in for, so any number of the units, including all of them, may be Jokers. The 5 VP bonus is lost as soon as one Joker is used.

### Q7. Is money in the supply limited? (literal)

The game has 76 × 1 BF and 12 × 5 BF coins (136 BF). The rulebook only says Noble Materials can run out (p. 6).
**Literal reading:** money is unlimited, Noble Materials (10 of each) and Jokers (15) are limited. The engine still tracks money so the totals can be checked.

### Q8. Rebuilding the Work of Art stacks from the shop (literal)

"Make two new stacks from the face-up tiles in the shop, making sure to leave the top 2 tiles in place" (p. 5). The shop slots are stacks, so the covered tiles go back: color tiles to the color stack and black tiles to the black stack, shuffled.
**Literal reading:** both top tiles stay on their slots; all covered tiles are shuffled back into their stacks.

## Phase C: resolution

### Q9. 2-player neutral Assistants (partly answered by the rulebook)

Appendix 3 (p. 12) answers most of this. Neutral Assistants have no bid, so they never affect an auction. They count for shield majorities: if the neutral color wins, nobody scores, but on a tie the tied players score as normal.
**Still open:** removal at the end of the round. **Literal reading:** they return to their owners like any other Assistant (End of Turn phase, p. 10).

### Q10. Can a Bonus card won in a tie be tucked? (decided by the rulebook)

"In case of a tie, each player involved in the tie benefits from the central power, but the card is discarded" (p. 8). So it cannot be tucked. For a choice card, each tied player chooses their own power.

### Q11. Brussels majority when nobody used the Brussels board (literal)

"The player who placed the most total Assistant pawns ... must move one of those Assistant pawns onto the Courthouse" (p. 9). If nobody placed any, there are no pawns to move.
**Literal reading:** nobody goes to the Courthouse.

### Q12. Starting Brugmann cards and the 26 Public Figure cards (open)

Are the 5 starting Georges Brugmann cards part of the 26 Public Figure cards, and are there more Brugmann cards in the shuffled deck? This affects the deck composition (see the data entry guide).

## House rules

### Q13. Any house rules the group uses? (open)
