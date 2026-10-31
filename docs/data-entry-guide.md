# Data entry guide

The engine needs values that are only printed on the physical components. This guide explains exactly what to copy from each component and where to put it.

## How it works

- All files are in `packages/engine/src/data/json/`. Each component has its own file.
- Every value that still needs transcribing says `"TODO_DATA"`. Replace it with the real value **without quotes** for numbers and lists, e.g. `"bf": "TODO_DATA"` becomes `"bf": 4`.
- Values that are stated in the rulebook text are **not** in these files. They are already in `packages/engine/src/data/rulebook.ts` (starting money, building costs, compass tile types, Public Figure effects, …).
- You can fill in files a bit at a time. After each session, run:

  ```bash
  pnpm test         # fails if anything you entered is invalid (TODO_DATA is fine)
  pnpm check:data   # lists everything that is still TODO_DATA
  ```

  Errors show the exact path, e.g. `stockExchangeCards[3].shields.4[1].row: expected a whole number from 1 to 4, got 5`. List positions count from 0, so `stockExchangeCards[3]` is the **4th** card in the file.

- Counting conventions used everywhere below: **rows count from the top, columns from the left, starting at 0**, except shields, which use the rulebook's 1–4 numbering.
- If something on a component doesn't fit the format (an extra icon on a track space, a grid that isn't a full rectangle, …), don't force it. Write it down and tell Claude, and the format will be extended.

JSON reminders: text in double quotes, no comma after the last item in a list or object, no comments.

The examples below use **made-up values** to show the format. They are not the real values.

---

## Already filled in from the rulebook illustrations

Some values are visible in the rulebook's pictures, so they have been entered already. Please **check them against the physical components** and correct the JSON if anything differs:

| File                 | Value                                                                                                                                                                             | Source                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `action-strips.json` | `"orientation": "row"` (each strip is a horizontal row)                                                                                                                           | Contents (p. 1) and setup (p. 3)                                                              |
| `workshop.json`      | 7×7 grid, rows 6/4/2/0/2/4/6 BF, columns 6/4/2/0/2/4/6 VP; cursor starts in the center; blue top-left, pink top-right, green bottom-left, yellow bottom-right of the black center | Setup (p. 2), checked against the Sale examples on p. 5 (2 BF + 6 VP) and p. 11 (2 BF + 4 VP) |
| `tracks.json`        | City Hall 1, 2, 2, 3, 3, 4; Royal Palace 1, 2, 3, 4, 5, 7; Architect 3, 4, 5, 6, 8, 10                                                                                            | Setup (p. 2 and p. 3)                                                                         |
| `compass.json`       | needles start on the two top spaces: `[0, 5]`                                                                                                                                     | Setup step 11 (p. 2)                                                                          |

The Workshop column labels are the blurriest of these, so they are the most important to check.

## 1. Action strips: `action-strips.json`

There are 5 Action strips. Each strip is one **row** of the Art Nouveau board. Only the **basic side** (without the special symbol) is needed.

For each strip, enter:

- `"id"`: whatever identifies the strip (a printed letter or number). If nothing is printed, label the strips yourself, e.g. with a small sticker `"1"` to `"5"`, so the app can ask "which strip is in row 3?" at setup.
- `"basicSide"`: the 5 actions **left to right**, holding the strip the way it lies on the board. Use these names: `"workshop"`, `"sale"`, `"royalTheater"`, `"materials"`, `"construction"`.

```json
[
  {
    "id": "1",
    "basicSide": ["sale", "royalTheater", "materials", "construction", "workshop"]
  }
]
```

## 2. Workshop: `workshop.json` (pre-filled, please check)

The Workshop is the grid on the Brussels board that the Workshop cursor moves over. A dot's **row** gives BF and its **column** gives VP (rulebook p. 5).

- `"bfByRow"`: the BF value of every grid row, **top to bottom**.
- `"vpByColumn"`: the VP value of every grid column, **left to right**.
- `"cursorStart"`: the grid cell under the cursor's **center** at setup ("center of the workshop"), as `{ "row": r, "col": c }` counted from the top-left cell = `{ "row": 0, "col": 0 }`.
- `"dots"`: where each colored dot of the cursor sits **relative to its center**, in grid cells. Up and left are negative, down and right are positive. The black dot is the center itself, so it isn't entered.

## 3. Tracks: `tracks.json` (pre-filled, please check)

Three lists, each starting with the space where the disc **starts** (setup step 4) and continuing to the last space.

- `"cityHall"`: for each City Hall shield space, the VP a player scores per shield majority (rulebook p. 9).
- `"royalPalace"`: for each Royal Palace Coat of Arms space, the number of Public Figures a player can activate with one Grand Plaza action (rulebook p. 7).
- `"architect"`: for each Architect track space on the personal board, the end-game VP per building (rulebook p. 10). Check that all 5 personal boards show the same track.

If a track space shows anything besides its value, tell Claude.

## 4. Compass: `compass.json` (pre-filled, please check)

The 6 compass tiles are placed randomly each game, so only the needles' **starting position** (setup step 11) is entered here.

The compass ring is divided at 12, 2, 4, 6, 8 and 10 o'clock. Number the 6 spaces **0 to 5 clockwise, starting with the space just clockwise of 12 o'clock** (centered on 1 o'clock). The rulebook shows the needles starting on the two top spaces, 0 (1 o'clock) and 5 (11 o'clock).

## 5. Stock Exchange cards: `stock-exchange-cards.json`

12 cards. The order doesn't matter. The `"id"` (1–12) is just our own numbering, so you can write the id on a sticky note while transcribing if you like.

For each card:

- `"bf"`: the money value at the top of the card (gained with the Stock Exchange action).
- `"shields"`: one line per player count (`"2"` to `"5"`), each with the **two shields** exactly as printed, the first number being the row, the second the column. If a single line on the card covers several player counts, copy it to each of them.

```json
{
  "id": 1,
  "bf": 5,
  "shields": {
    "2": [
      { "row": 2, "col": 2 },
      { "row": 3, "col": 3 }
    ],
    "3": [
      { "row": 3, "col": 4 },
      { "row": 4, "col": 3 }
    ],
    "4": [
      { "row": 1, "col": 3 },
      { "row": 3, "col": 1 }
    ],
    "5": [
      { "row": 1, "col": 4 },
      { "row": 4, "col": 1 }
    ]
  }
}
```

## 6. Bonus cards: `bonus-cards.json`

25 cards. Many are probably identical, so enter each **different** card once and say how many `"copies"` there are. Copy the template object for every new kind of card. The copies must add up to 25.

- `"copies"`: how many identical cards of this kind.
- `"mannekenPis"`: number of Manneken Pis symbols (0, 1 or 2).
- `"vpSymbols"`: number of VP symbols shown for tucking (0 if it can't be tucked).
- `"power"`: the central power. The four effects are `"cityHall"` (+1 City Hall), `"courthouse"` (retrieve an Assistant), `"royalPalace"` (+1 Royal Palace), `"architect"` (+1 Architect). Use one of:
  - one power: `{ "kind": "single", "effect": "cityHall" }`
  - choose one of two: `{ "kind": "choice", "options": ["cityHall", "architect"] }`
  - both (a "double power", e.g. +2 Royal Palace): `{ "kind": "double", "effects": ["royalPalace", "royalPalace"] }`

```json
{
  "copies": 4,
  "mannekenPis": 1,
  "vpSymbols": 1,
  "power": { "kind": "single", "effect": "royalPalace" }
}
```

If a card shows something that doesn't fit these shapes, tell Claude.

## 7. Public Figures: `public-figures.json`

26 cards in total, including the **5 starting Georges Brugmann cards** (setup step 5).

- `"startingBrugmannCost"`: the end-game cost printed on a starting Brugmann card. If the 5 starting cards differ, tell Claude.
- `"deck"`: for each of the 7 other figures, the cost of **every copy** in the shuffled deck, e.g. `"costs": [2, 2, 2]` means three cards of that figure, each costing 2 BF. Georges Brugmann is already set to `[]`, because Brugmann cards are never in the deck (Q12).

The cards in Appendix 1 (p. 11) each show a number in a circle on the left edge. It is most likely the end-game cost: Brugmann 1, Solvay 2, Empain 2, Buls 3, Prince Albert 3, Vandervelde 4, Van De Velde 4, Maeterlinck 5. The rulebook doesn't say what the circle means or how many copies there are, so this file is still `TODO_DATA`. Please confirm the meaning, check that all copies of a figure show the same number, and count the copies.

The total (all deck cards + 5 starting Brugmann cards) must be 26, so the deck has 21 cards.

## 8. Works of Art: `works-of-art.json`

Count the 30 tiles by color: four colors in the color stack, plus the black tiles. The total must be 30.

```json
{ "colorTiles": { "blue": 6, "pink": 6, "yellow": 6, "green": 6 }, "blackTiles": 6 }
```

## 9. Exhibition tiles: `exhibitions.json`

The year on each of the 5 tiles, in round order. The rulebook says they run from 1893 to 1910. These are only used for display.

```json
{ "years": [1893, 1894, 1897, 1905, 1910] }
```

---

## Already covered by the rulebook

These are **not** transcribed, because the rulebook text states them (see `rulebook.ts`): component counts, starting money (5/6/7/8/9 BF), building rows and costs (2/3/4 units, top row +5 VP), the six compass tile types, Royal Theater costs (0/1/2/3 BF), Market (3 Jokers), Materials (2 cubes), pass income, tuck rows, end-game scoring, Public Figure effects, and the 2-player rules.

## Out of scope for now

- The advanced side of the Action strips (with the special symbol). Its rules aren't in the base rulebook.
