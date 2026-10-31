<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  chanceOutcomes,
  COMPASS_TILE_SET,
  loadComponents,
  type ChanceEvent,
  type CompassTile,
  type GameState,
  type Move,
} from '@brux/engine';
import { chanceLabel, COMPASS_TILE_LABELS, stripLabel } from '../game/labels';
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
      return 'Which Public Figure was revealed for the Royal Theater?';
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
  <section class="prompt">
    <h2>{{ question }}</h2>

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

    <div v-else class="options">
      <button v-for="(move, i) in outcomes" :key="i" class="big" @click="emit('enter', move)">
        {{ chanceLabel(state, move) }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.5rem;
}
.picked {
  margin: 0.25rem 0;
}
</style>
