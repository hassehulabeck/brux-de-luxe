<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ACTION_NAMES,
  describeMove,
  type ArtNouveauSpace,
  type GameState,
  type Move,
} from '@brux/engine';
import type { SeatConfig } from '../game/session';
import WorkshopView from './WorkshopView.vue';

/**
 * A human seat's decision. The options are exactly legalMoves(): this panel
 * only arranges them as buttons (and the board and Workshop as tap targets).
 */
const props = defineProps<{
  state: GameState;
  moves: Move[];
  seats: SeatConfig[];
  /** The board space tapped for a turn, or null. */
  selected: ArtNouveauSpace | null;
}>();
const emit = defineEmits<{ enter: [move: Move]; clear: [] }>();

const pending = computed(() => props.state.pending!);
const who = computed(() => {
  const p = pending.value;
  return 'player' in p ? (props.seats[p.player]?.name ?? '') : '';
});

const QUESTIONS: Record<string, string> = {
  chooseShield: 'Which shield gets the Bracket?',
  placeNeutral: 'Tap a space on the board for your neutral Assistant.',
  turn: 'Your turn: tap a space on the board, take a Brussels action, or pass.',
  performOrSkip: 'Carry out the action?',
  chooseParkAction: 'Fiftieth Anniversary Park: which action?',
  keepWork: 'Which work do you keep?',
  moveCursor: 'Sale: tap where the Workshop cursor goes.',
  sellWork: 'Which work do you sell?',
  placeInShop: 'Which shop space does it go on?',
  takePublicFigure: 'Which Public Figure do you take?',
  keepPublicFigure: 'Keep the Public Figure or discard it?',
  takeMaterials: 'Which Noble Materials do you take?',
  solvay: 'Ernest Solvay: which material?',
  payConstruction: 'How do you pay for the Building?',
  turnNeedle: 'Which compass needle do you turn?',
  placeBuilding: 'Tap an empty space on the board for your Building.',
  activatePublicFigure: 'Which Public Figure do you activate?',
  resolveBonus: 'Bonus card: use its power, or tuck it under a row?',
  payPublicFigures: 'Which Public Figures do you pay for?',
};
const question = computed(() => QUESTIONS[pending.value.kind] ?? 'Choose:');

// --- A turn: space + bid, a Brussels action, or pass ------------------------------
const bidsHere = computed(() =>
  props.moves.flatMap((m) =>
    m.kind === 'placeAssistant' &&
    props.selected &&
    m.space.row === props.selected.row &&
    m.space.col === props.selected.col
      ? [m.bid]
      : [],
  ),
);
const bid = ref(1);
watch(bidsHere, (bids) => (bid.value = bids[0] ?? 1));
const others = computed(() =>
  props.moves.filter((m) => m.kind === 'takeBrusselsAction' || m.kind === 'pass'),
);
function placeAssistant() {
  if (!props.selected) return;
  emit('enter', { kind: 'placeAssistant', space: props.selected, bid: bid.value });
}

// --- The Workshop cursor ---------------------------------------------------------
const cursorTargets = computed(() =>
  props.moves.flatMap((m) => (m.kind === 'moveCursor' ? [m.to] : [])),
);
function moveCursor(to: { row: number; col: number }) {
  emit('enter', { kind: 'moveCursor', to });
}

/** Decisions made on the board itself: GameScreen handles the taps. */
const onBoard = computed(() => ['placeBuilding', 'placeNeutral'].includes(pending.value.kind));
</script>

<template>
  <section class="decision">
    <h2>{{ who }}: {{ question }}</h2>

    <template v-if="pending.kind === 'turn'">
      <div v-if="selected && bidsHere.length" class="bid">
        <p>
          {{ ACTION_NAMES[state.board[selected.row]![selected.col]!.action] }} on row
          {{ selected.row + 1 }}, column {{ selected.col + 1 }}. Bid:
        </p>
        <div class="stepper">
          <button class="big" :disabled="bid <= bidsHere[0]!" @click="bid--">−</button>
          <span class="amount">{{ bid }} BF</span>
          <button class="big" :disabled="bid >= bidsHere[bidsHere.length - 1]!" @click="bid++">
            +
          </button>
        </div>
        <button class="big primary" @click="placeAssistant">Place the Assistant</button>
        <button class="big" @click="emit('clear')">Another space</button>
      </div>
      <div class="options">
        <button v-for="(move, i) in others" :key="i" class="big" @click="emit('enter', move)">
          {{ describeMove(state, move) }}
        </button>
      </div>
    </template>

    <WorkshopView
      v-else-if="pending.kind === 'moveCursor'"
      :state="state"
      :selectable="cursorTargets"
      @pick="moveCursor"
    />

    <p v-else-if="onBoard" class="hint">The spaces you can choose are outlined.</p>

    <div v-else class="options">
      <button v-for="(move, i) in moves" :key="i" class="big" @click="emit('enter', move)">
        {{ describeMove(state, move) }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.5rem 0;
}
.amount {
  font-size: 1.4rem;
  min-width: 4rem;
  text-align: center;
}
.bid {
  margin-bottom: 0.75rem;
}
</style>
