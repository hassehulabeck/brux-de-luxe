# Rules summary

A condensed version of the **Bruxelles 1893** rulebook (Pearl Games / Z-Man, 2013, English translation). Page numbers (p. N) refer to that rulebook. This is a working reference for the engine, not a replacement for the rulebook.

Some information in the rulebook is only shown in pictures (track values, card faces, the Workshop grid). That information is not repeated here. It lives in `packages/engine/src/data/` and is transcribed from the physical components (see `data-entry-guide.md`). Open questions are tracked in `rules-questions.md`.

## Components (p. 1)

| Component                     | Count                                        |
| ----------------------------- | -------------------------------------------- |
| Architect boards              | 5 (one per player color)                     |
| Building tiles                | 30 (6 per color)                             |
| Discs                         | 20 (4 per color)                             |
| Assistant pawns               | 35 (7 per color)                             |
| Public Figure cards           | 26                                           |
| Bonus cards                   | 25                                           |
| Stock Exchange cards          | 12                                           |
| Exhibition tiles              | 5 (one per round, years 1893–1910)           |
| Works of Art tiles            | 30 (blue, pink, yellow, green, black)        |
| Noble Materials cubes         | 30 (10 wood, 10 iron, 10 stone)              |
| Joker Materials cubes (white) | 15                                           |
| Coins                         | 76 × 1 BF, 12 × 5 BF                         |
| Compass tiles                 | 6, plus 2 needles                            |
| Bracket tile, Workshop cursor | 1 each                                       |
| Manneken Pis pawn             | 1 (marks the first player)                   |
| Boards                        | Brussels board, 5 Action strips, Bonus strip |

## Setup (p. 2–3)

1. Randomly assemble the 5 Action strips above the Bonus strip to form the **Art Nouveau board** (5×5 action spaces). For the first games, use the side **without** the special symbol. The other side is for experienced players and is out of scope for this project.
2. Each player takes an Architect board and places their 6 Building tiles on it.
3. Each player takes 4 discs and 7 Assistants: 5 Assistants in their supply, 2 in the **Courthouse**.
4. Discs go on: the first shield of the **City Hall track**, the first Coat of Arms space of the **Royal Palace track**, the first space of the **Architect track** (on the personal board), and 0 on the scoring track.
5. Each player gets a **Georges Brugmann** Public Figure card (gain 5 BF). Unused Brugmann cards go back to the box.
6. Sort the 5 Exhibition tiles by year, face down; reveal the first.
7. Put the Workshop cursor in the center of the Workshop.
8. Shuffle the Public Figures. Deal 4 face up into the **Royal Theater** display; the rest form the deck.
9. Shuffle the Stock Exchange cards into a deck.
10. Make two face-down stacks: color Works of Art and black Works of Art. Each player draws one random color Work of Art, face up.
11. Set the compass needles as illustrated. Place the 6 compass tiles randomly around the compass.
12. Shuffle the 25 Bonus cards. Place one face up under each column of the Art Nouveau board.
13. The first player takes the Manneken Pis pawn and 5 BF. Players to their left get 6, 7, 8 and 9 BF.
14. The rest of the money and cubes form the general supply.

## Round structure (p. 4)

5 rounds. Each round has four phases: **A** Stock Exchange, **B** Action, **C** Resolution of the Turn, **D** End of Turn.

### A. Stock Exchange phase (p. 4)

- The first player reveals the top Stock Exchange card. Only the line for the current player count is used.
- That line shows two shields (row, column, numbered 1–4). The first player chooses one.
- The horizontal and vertical lines through the chosen shield split the 5×5 board into 4 areas. The Bracket is placed on the shield and points at the **largest** area (most action spaces). That area is the available area this round.

### B. Action phase (p. 5–7)

Starting with the first player and going clockwise, each player takes one action or passes, until all players have passed.

**Art Nouveau board actions.** Place an Assistant on an empty action space in the available area with a bid of at least 1 BF. The bid takes part in the auction for that column's Bonus card. Then perform the action immediately (performing it is optional, p. 5). Only one Assistant per action space per round.

- **Workshop:** draw 1 color Work of Art + 1 per Exhibition tile you own, keep one face up, return the rest to the stack.
- **Sale:**
  1. Move the Workshop cursor horizontally and/or vertically by a number of spaces equal to the number of works you have.
  2. Choose a work whose color is not visible in the shop (the two top tiles).
  3. Gain the BF and VP of the cursor dot of that color. The dot's row gives BF, its column gives VP. Black works use the center of the cursor.
  4. Put the sold work on one of the two shop spaces. The first two sales of the game must go on an empty space. Later sales may cover either work, and the covered color becomes sellable again.
  - If a Work of Art stack runs out, make new stacks from the shop tiles, leaving the top 2 tiles in place.
  - Rulebook example (p. 5): green work sold with 2 works in hand, cursor moved left 1 and down 1, earns **2 BF and 6 VP**.
- **Royal Theater:** take one of the 4 Public Figures in the display. Rightmost is free, then 1, 2, 3 BF (paid to the supply). Use its effect immediately, then either discard it or keep it rotated 90° (used this round). You keep kept cards until the end of the game and must pay their cost then. You cannot keep two identical cards. Shift the display right and refill the 3 BF space from the deck.
- **Materials:** take 2 Noble Materials of your choice (not Jokers), as long as the supply has them.
- **Construction:**
  1. Pay the construction cost via the **compass**: 2 units for the lower row of the Architect board, 3 for the middle, 4 for the top. Rows must be built bottom to top. Any unit may be replaced by a white Joker cube.
  2. If no Joker was used, gain **5 VP**.
  3. Turn one compass needle one space clockwise. The needles may never point at the same space.
  4. Place the Building tile on any empty Art Nouveau space without an Assistant. It does not have to be in the available area. Each top-row building gives **5 VP** immediately.

**Compass rules (p. 6–7).** The six tiles are wood, stone, iron, one Noble Material of your choice, 3 BF, and an empty space. The two needles point at two different tiles. You must pay with both indicated unit types: a cost of 2 is one unit of each type, and a higher cost can be split however you like as long as both types are used. If one needle points at the empty space, the whole cost is paid in the other type. Examples: cost 3 with wood + 3 BF is either 2 wood + 3 BF or 1 wood + 6 BF. Cost 4 with wood + empty is 4 wood.

**Secondary actions (Appendix 2, p. 11).** When a player takes an Art Nouveau action on a space where an opponent has a Building, the building owner performs a secondary action right after the main action:

| Action        | Secondary action for the building owner                            |
| ------------- | ------------------------------------------------------------------ |
| Workshop      | Take a black Work of Art.                                          |
| Sale          | 1 VP per work you have (black included).                           |
| Royal Theater | Activate one of your upright Public Figures and rotate it.         |
| Materials     | Take 1 Noble Material of your choice.                              |
| Construction  | 1 VP per building you have already built on the Art Nouveau board. |

**Brussels board actions (p. 7).** These cost no money, and several players can take the same one in a round. The first use of an action in a round costs 1 Assistant, the second costs 2, the third 3, and so on. With **4–5 players**, each action is available twice: the first two uses cost 1 Assistant each, the next two cost 2 each, and so on.

- **Market:** gain 3 Joker cubes.
- **Stock Exchange:** gain the BF value shown at the top of this round's Stock Exchange card.
- **Fiftieth Anniversary Park:** take any one of the 5 Art Nouveau actions. You don't place an Assistant on the Art Nouveau board, you don't join an auction, and the action does not need to be in the available area.
- **Grand Plaza:** activate upright Public Figures you own, up to your Royal Palace track value, and rotate each one.

**Pass (p. 7).** The first player to pass takes this round's Exhibition tile and gains 1 BF + 1 BF per Work of Art color they own (max 6). Each later passer gains 1 BF per color owned (max 5). The Exhibition tile gives +1 draw on all future Workshop actions.

### C. Resolution of the Turn phase (p. 8–9)

Resolve these steps in order:

1. **Bids.** In each column, the player with the highest total bid wins the Bonus card. On a tie, every tied player gets the central power and the card is discarded.
2. **New first player.** Count the Manneken Pis symbols each player earned **this round**: 0–2 on each Bonus card won, and 2 on the Exhibition tile. Most symbols becomes first player. Ties go to the tied player first clockwise from the current first player.
3. **Bonus cards.** For each card won, either use its central power or tuck it under a row of your Architect board.
   - Central powers: +1 City Hall, retrieve 1 Assistant from the Courthouse, +1 Royal Palace, +1 Architect. Some cards offer a choice of two; some give a double power. The card is discarded after use.
   - Tucking: you can tuck at most one card per row per round. Cards with no VP symbols cannot be tucked. Each row starts with 1 printed VP symbol.
4. **Shield majorities.** Each shield with 4 Assistants around it is scored. The player with the most of those 4 Assistants gains VP equal to their City Hall track value. On a tie, every tied player scores in full. Bids don't matter.
   - Rulebook example (p. 9): shields 1 and 4 don't score (not 4 Assistants around them). Shield 2: blue scores 2. Shield 3: orange and blue tie, orange scores 3 and blue scores 2.
5. **Brussels majority.** The player who placed the most Assistants on the Brussels board moves one of them to the Courthouse. On a tie, each tied player moves one.

### D. End of Turn phase (p. 10)

- Each player takes back their placed Assistants, except those in the Courthouse.
- Bid money goes to the supply.
- Rotated Public Figures turn upright again.
- Reveal the next Exhibition tile.
- Discard the Royal Theater card on space 0, shift the others right, and refill space 3 from the deck. When the deck runs out, shuffle the discards into a new deck.
- Discard the Bonus cards left on the board and deal 5 new ones.
- Discard this round's Stock Exchange card.

## End of the game (p. 10)

After step C5 of round 5, skip phase D and score:

1. **Public Figures.** Pay the cost on each kept Public Figure. For each one you don't pay, discard it and lose 5 VP.
   - Rulebook example: green has 5 Public Figures worth 15 BF and only 12 BF. They pay 11 BF, give up a 4 BF figure, and lose 5 VP.
2. **Final score:**
   - a. VP on the scoring track.
   - b. Each built Building tile × Architect track value.
   - c. Tucked rows. Each row's multiplier is 1 + the VP symbols on the cards tucked under it.
     - Row 1: per 4 BF.
     - Row 2: per Work of Art.
     - Row 3: per Public Figure.
     - Row 4: per Assistant beyond the second (Courthouse Assistants don't count).
   - d. 1 VP per Noble Material. Jokers are worth nothing.
   - e. 5 VP for the player holding the Manneken Pis pawn.
   - Rulebook example (blue player): a. 80 VP on the track. b. 5 buildings × Architect 8 = 40. c1. 5 VP for 6 BF. c2. 3 VP for Works of Art. c3. 2 VP for Public Figures. c4. 6 VP for 5 Assistants. d. 3 VP for 3 Noble Materials.

## Public Figures (Appendix 1, p. 11)

| Figure              | Effect                                                                 |
| ------------------- | ---------------------------------------------------------------------- |
| Georges Brugmann    | Gain 5 BF.                                                             |
| Ernest Solvay       | Gain 1 Noble Material, or exchange 1 Joker for 2 Noble Materials.      |
| Charles Buls        | +1 City Hall track.                                                    |
| Henry Van de Velde  | +1 Architect track.                                                    |
| Edouard Empain      | Gain 2 Joker cubes.                                                    |
| Prince Albert       | +1 Royal Palace track.                                                 |
| Emile Vandervelde   | Retrieve 1 Assistant from the Courthouse. It is available immediately. |
| Maurice Maeterlinck | Gain 5 VP.                                                             |

The costs and the number of copies of each figure are printed on the cards only. They are component data.

## 2-player game (Appendix 3, p. 12)

Each player also gets one neutral Assistant (an unused color). At the start of each Action phase, starting with the first player, each player places their neutral Assistant on an empty space in the available area that has no Building on it. If no such space exists, it is not placed. Neutral Assistants never bid. They count for shield majorities: if the neutral color wins a majority, nobody scores. If the neutral color only ties, the tied players score as normal.
