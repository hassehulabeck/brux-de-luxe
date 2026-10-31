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

## 1. Action strips: `action-strips.json`

There are 5 Action strips. Only the **basic side** (without the special symbol) is needed.

1. Check how the strips sit on the board. Set `"orientation"` to `"row"` if each strip is a horizontal row of the 5×5 board, or `"column"` if each strip is a vertical column. (This is open question Q1 in `rules-questions.md`.)
2. For each strip, enter:
   - `"id"`: whatever identifies the strip (a printed letter or number). If nothing is printed, label the strips yourself, e.g. with a small sticker `"1"` to `"5"`, so the app can ask "which strip is in column 3?" at setup.
   - `"basicSide"`: the 5 actions in order, **left to right** for row strips, **top to bottom** for column strips. Use these names: `"workshop"`, `"sale"`, `"royalTheater"`, `"materials"`, `"construction"`.

```json
{ "id": "1", "basicSide": ["sale", "workshop", "construction", "materials", "royalTheater"] }
```

## 2. Workshop: `workshop.json`

The Workshop is the grid on the Brussels board that the Workshop cursor moves over. A dot's **row** gives BF and its **column** gives VP (rulebook p. 5).

- `"bfByRow"`: the BF value of every grid row, **top to bottom**.
- `"vpByColumn"`: the VP value of every grid column, **left to right**.
- `"cursorStart"`: the grid cell under the cursor's **center** at setup ("center of the workshop"), as `{ "row": r, "col": c }` counted from the top-left cell = `{ "row": 0, "col": 0 }`.
- `"dots"`: where each colored dot of the cursor sits **relative to its center**, in grid cells. Up and left are negative, down and right are positive. The black dot is the center itself, so it isn't entered.

```json
{
  "bfByRow": [5, 4, 3, 2, 1],
  "vpByColumn": [1, 2, 3, 4, 5],
  "cursorStart": { "row": 2, "col": 2 },
  "dots": {
    "blue": { "row": -1, "col": 0 },
    "pink": { "row": 0, "col": 1 },
    "yellow": { "row": 1, "col": 0 },
    "green": { "row": 0, "col": -1 }
  }
}
```

Please also answer open question **Q2**: can the cursor move so that a colored dot leaves the grid?

## 3. Tracks: `tracks.json`

Three lists, each starting with the space where the disc **starts** (setup step 4) and continuing to the last space.

- `"cityHall"`: for each City Hall shield space, the VP a player scores per shield majority (rulebook p. 9).
- `"royalPalace"`: for each Royal Palace Coat of Arms space, the number of Public Figures a player can activate with one Grand Plaza action (rulebook p. 7).
- `"architect"`: for each Architect track space on the personal board, the end-game VP per building (rulebook p. 10). Check that all 5 personal boards show the same track.

```json
{ "cityHall": [1, 2, 3, 4], "royalPalace": [1, 2, 3], "architect": [1, 2, 3, 4, 5] }
```

If a track space shows anything besides its value, tell Claude.

## 4. Compass: `compass.json`

The 6 compass tiles are placed randomly each game, so only the needles' **starting position** (setup step 11, as illustrated in the rulebook) is entered here.

Number the 6 compass spaces **0 to 5 clockwise, starting with the topmost space** (the one at or just clockwise of 12 o'clock). Enter the two spaces the needles start on:

```json
{ "needleStart": [0, 3] }
```

## 5. Stock Exchange cards: `stock-exchange-cards.json`

12 cards. The order doesn't matter. The `"id"` (1–12) is just our own numbering, so you can write the id on a sticky note while transcribing if you like.

For each card:

- `"bf"`: the money value at the top of the card (gained with the Stock Exchange action).
- `"shields"`: one line per player count (`"2"` to `"5"`), each with the **two shields** exactly as printed, the first number being the row, the second the column. If a single line on the card covers several player counts, copy it to each of them.

```json
{
  "id": 1,
  "bf": 4,
  "shields": {
    "2": [
      { "row": 1, "col": 1 },
      { "row": 4, "col": 4 }
    ],
    "3": [
      { "row": 2, "col": 3 },
      { "row": 3, "col": 2 }
    ],
    "4": [
      { "row": 1, "col": 4 },
      { "row": 4, "col": 1 }
    ],
    "5": [
      { "row": 2, "col": 2 },
      { "row": 3, "col": 3 }
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
[
  {
    "copies": 3,
    "mannekenPis": 1,
    "vpSymbols": 1,
    "power": { "kind": "single", "effect": "cityHall" }
  },
  {
    "copies": 2,
    "mannekenPis": 0,
    "vpSymbols": 2,
    "power": { "kind": "choice", "options": ["architect", "courthouse"] }
  }
]
```

If a card shows something that doesn't fit these shapes, tell Claude.

## 7. Public Figures: `public-figures.json`

26 cards in total, including the **5 starting Georges Brugmann cards** (setup step 5).

- `"startingBrugmannCost"`: the end-game cost printed on a starting Brugmann card. If the 5 starting cards differ, tell Claude.
- `"deck"`: for each of the 8 figures, the cost of **every copy** in the shuffled deck, e.g. `"costs": [2, 3, 3]` means three cards of that figure, one costing 2 BF and two costing 3 BF. Use `[]` for a figure with no cards in the deck (e.g. if Brugmann only exists as starting cards).

The total (all deck cards + 5) must be 26. Please also answer open question **Q12**: are there Brugmann cards in the deck besides the 5 starting cards, and do the starting cards look different?

## 8. Works of Art: `works-of-art.json`

Count the 30 tiles by color: four colors in the color stack, plus the black tiles. The total must be 30.

```json
{ "colorTiles": { "blue": 6, "pink": 6, "yellow": 6, "green": 6 }, "blackTiles": 6 }
```

## 9. Exhibition tiles: `exhibitions.json`

The year on each of the 5 tiles, in round order. The rulebook says they run from 1893 to 1910. These are only used for display.

```json
{ "years": [1893, 1895, 1900, 1905, 1910] }
```

---

## Already covered by the rulebook

These are **not** transcribed, because the rulebook text states them (see `rulebook.ts`): component counts, starting money (5/6/7/8/9 BF), building rows and costs (2/3/4 units, top row +5 VP), the six compass tile types, Royal Theater costs (0/1/2/3 BF), Market (3 Jokers), Materials (2 cubes), pass income, tuck rows, end-game scoring, Public Figure effects, and the 2-player rules.

## Out of scope for now

- The advanced side of the Action strips (with the special symbol). Its rules aren't in the base rulebook.
