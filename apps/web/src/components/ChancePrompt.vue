<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  chanceOutcomes,
  COMPASS_TILE_SET,
  loadComponents,
  PUBLIC_FIGURE_NAMES,
  ROYAL_THEATER_COSTS,
  WORK_COLORS,
  type ChanceEvent,
  type CompassTile,
  type GameState,
  type Move,
} from '@brux/engine';
import { bonusCardLabel, chanceLabel, COMPASS_TILE_LABELS, stripLabel } from '../game/labels';
import type { SeatConfig } from '../game/session';

const props = defineProps<{ state: GameState; event: ChanceEvent; seats: SeatConfig[] }>();
const emit = defineEmits<{ enter: [move: Move] }>();

const stripIds = loadComponents().actionStrips.strips.map((s) => s.id);

const question = computed(() => {
  const e = props.event;
  switch (e.kind) {
    case 'arrangeStrips':
      return 'How were the Action strips laid out? Choose the strip in each row, top to bottom.';
    case 'placeCompassTiles':
      return 'Which compass tile is on each compass space? Go clockwise from space 1.';
    case 'drawPublicFigure':
      return `Royal Theater: which Public Figure goes on the ${theaterSpace(nextTheaterSlot.value)}?`;
    case 'drawWorks': {
      const who = props.seats[e.player]?.name ?? `Player ${e.player + 1}`;
      const what = e.count === 1 ? 'a Work of Art' : `${e.count} Works of Art`;
      return e.reason === 'setup'
        ? `${who} draws ${what} at setup. Which color?`
        : `${who} draws ${what} in the Workshop. Which color${e.count === 1 ? '' : 's'}?`;
    }
    case 'drawStockExchangeCard':
      return 'Which Stock Exchange card was revealed?';
    case 'drawBonusCard':
      return `Which Bonus card was dealt under column ${e.column + 1}?`;
    default:
      return 'What came out?';
  }
});

// --- Royal Theater: the display is filled from the free space (far right) leftwards ---
const nextTheaterSlot = computed(() => props.state.royalTheater.display.indexOf(null));
function theaterSpace(slot: number): string {
  const cost = ROYAL_THEATER_COSTS[slot] ?? 0;
  const where =
    slot === 0 ? ' (far right)' : slot === ROYAL_THEATER_COSTS.length - 1 ? ' (far left)' : '';
  return `${cost === 0 ? 'free' : `${cost} BF`} space${where}`;
}
/** The display as it lies on the table, left to right: 3 BF ... free. */
const theaterSoFar = computed(() =>
  props.state.royalTheater.display
    .map((card, slot) => ({ slot, card }))
    .reverse()
    .map(({ slot, card }) => ({
      label:
        slot === 0
          ? 'Free · far right'
          : `${ROYAL_THEATER_COSTS[slot]} BF${slot === ROYAL_THEATER_COSTS.length - 1 ? ' · far left' : ''}`,
      text: card ? PUBLIC_FIGURE_NAMES[card.figure] : slot === nextTheaterSlot.value ? '?' : '—',
      next: slot === nextTheaterSlot.value,
    })),
);

// --- Bonus cards: the strip so far, column by column ---------------------------------
const bonusSoFar = computed(() => {
  const e = props.event;
  return props.state.bonusStrip.map((card, col) => ({
    label: `Column ${col + 1}`,
    text:
      card !== null
        ? bonusCardLabel(card).split(' · ')[0]!
        : e.kind === 'drawBonusCard' && e.column === col
          ? '?'
          : '—',
    next: e.kind === 'drawBonusCard' && e.column === col,
  }));
});
const soFar = computed(() =>
  props.event.kind === 'drawPublicFigure'
    ? theaterSoFar.value
    : props.event.kind === 'drawBonusCard'
      ? bonusSoFar.value
      : [],
);

// --- Several Works of Art: count each color instead of one button per combination ---
const workCounts = ref<Record<string, number>>({});
const drawCount = computed(() => (props.event.kind === 'drawWorks' ? props.event.count : 0));
const countWorks = computed(() => drawCount.value > 1);
const workTotal = computed(() => Object.values(workCounts.value).reduce((a, b) => a + b, 0));
/** The most of each color any legal draw can contain (the stacks may run low). */
const workMax = computed(() =>
  Object.fromEntries(
    WORK_COLORS.map((color) => [
      color,
      Math.max(
        0,
        ...outcomes.value.map((m) =>
          m.kind === 'revealWorks' ? m.colors.filter((c) => c === color).length : 0,
        ),
      ),
    ]),
  ),
);
/** The legal draw matching the counts, or undefined. */
const workMove = computed(() => {
  const colors = WORK_COLORS.flatMap((color) =>
    Array.from({ length: workCounts.value[color] ?? 0 }, () => color),
  );
  return outcomes.value.find((m) => m.kind === 'revealWorks' && m.colors.join() === colors.join());
});
function changeWork(color: string, by: number) {
  workCounts.value = { ...workCounts.value, [color]: (workCounts.value[color] ?? 0) + by };
}

// A new question gets a fresh look, so the table notices that it changed
// (the five Bonus card questions look almost the same).
const questionNumber = ref(0);
watch(
  () => props.state,
  () => {
    questionNumber.value++;
    workCounts.value = {};
  },
);

/** Simple events: one button per outcome. The layouts are built step by step instead. */
const outcomes = computed(() =>
  props.event.kind === 'arrangeStrips' || props.event.kind === 'placeCompassTiles'
    ? []
    : chanceOutcomes(props.state, props.event),
);

// Step-by-step choice for the strips (5 rows) and the compass (6 spaces).
const picked = ref<string[]>([]);
watch(
  () => props.event,
  () => (picked.value = []),
);
const choices = computed<string[]>(() => {
  if (props.event.kind === 'arrangeStrips')
    return stripIds.filter((id) => !picked.value.includes(id));
  if (props.event.kind === 'placeCompassTiles') {
    return COMPASS_TILE_SET.filter((t) => !picked.value.includes(t));
  }
  return [];
});
const slots = computed(() => (props.event.kind === 'arrangeStrips' ? 5 : 6));

function pick(choice: string) {
  picked.value = [...picked.value, choice];
  if (picked.value.length < slots.value) return;
  emit(
    'enter',
    props.event.kind === 'arrangeStrips'
      ? { kind: 'revealStrips', order: picked.value }
      : { kind: 'revealCompassTiles', tiles: picked.value as CompassTile[] },
  );
  picked.value = [];
}

function choiceLabel(choice: string) {
  return props.event.kind === 'arrangeStrips'
    ? `Strip ${choice}: ${stripLabel(choice)}`
    : COMPASS_TILE_LABELS[choice];
}
</script>

<template>
  <section :key="questionNumber" class="prompt">
    <h2>{{ question }}</h2>

    <ol v-if="soFar.length" class="so-far">
      <li v-for="(item, i) in soFar" :key="i" :class="{ next: item.next }">
        <small>{{ item.label }}</small>
        <span>{{ item.text }}</span>
      </li>
    </ol>

    <template v-if="choices.length">
      <ol class="picked">
        <li v-for="(choice, i) in picked" :key="i">{{ choiceLabel(choice) }}</li>
      </ol>
      <p>{{ event.kind === 'arrangeStrips' ? 'Row' : 'Compass space' }} {{ picked.length + 1 }}:</p>
      <div class="options">
        <button v-for="choice in choices" :key="choice" class="big" @click="pick(choice)">
          {{ choiceLabel(choice) }}
        </button>
      </div>
      <button v-if="picked.length" class="big" @click="picked = picked.slice(0, -1)">Back</button>
    </template>

    <template v-else-if="countWorks">
      <p>Tap + for each work drawn ({{ workTotal }} of {{ drawCount }}).</p>
      <div class="counts">
        <div v-for="color in WORK_COLORS" :key="color" class="count">
          <span class="color">{{ color }}</span>
          <button
            class="big"
            :disabled="!workCounts[color]"
            :aria-label="`One ${color} less`"
            @click="changeWork(color, -1)"
          >
            −
          </button>
          <span class="amount">{{ workCounts[color] ?? 0 }}</span>
          <button
            class="big"
            :disabled="workTotal >= drawCount || (workCounts[color] ?? 0) >= workMax[color]!"
            :aria-label="`One ${color} more`"
            @click="changeWork(color, 1)"
          >
            +
          </button>
        </div>
      </div>
      <button
        class="big primary"
        :disabled="!workMove"
        @click="workMove && emit('enter', workMove)"
      >
        These {{ drawCount }} works
      </button>
    </template>

    <div v-else class="options">
      <button v-for="(move, i) in outcomes" :key="i" class="big" @click="emit('enter', move)">
        {{ chanceLabel(state, move) }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.prompt {
  animation: new-question 0.6s ease-out;
}
@keyframes new-question {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
    background: color-mix(in srgb, var(--color-accent) 25%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .prompt {
    animation: none;
  }
}
.so-far {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0.75rem;
}
.so-far li {
  display: grid;
  min-width: 8rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-line);
  border-radius: 0.4rem;
}
.so-far li.next {
  border: 2px solid var(--color-accent);
  font-weight: 600;
}
.so-far small {
  color: var(--color-muted);
}
.counts {
  display: grid;
  gap: 0.5rem;
  margin: 0.5rem 0 0.75rem;
}
.count {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.count .color {
  min-width: 5rem;
  font-size: 1.2rem;
  text-transform: capitalize;
}
.count .amount {
  min-width: 2rem;
  text-align: center;
  font-size: 1.4rem;
}
.options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.5rem;
}
.picked {
  margin: 0.25rem 0;
}
</style>
