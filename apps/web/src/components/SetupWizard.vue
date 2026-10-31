<script setup lang="ts">
import { computed, ref } from 'vue';
import { DIFFICULTY_NAMES, type DifficultyName } from '@brux/engine';
import { useGameStore } from '../stores/game';
import type { SeatConfig } from '../game/session';

const game = useGameStore();

/** Only labels for the players: the app never needs the real piece colors. */
const COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'black', 'white'];

const count = ref(3);
const seats = ref<SeatConfig[]>(
  Array.from({ length: 5 }, (_, i) => ({
    name: i === 1 ? 'Bot' : `Player ${i + 1}`,
    color: COLORS[i]!,
    bot: i === 1 ? { difficulty: 'normal' as DifficultyName } : null,
  })),
);
const active = computed(() => seats.value.slice(0, count.value));
const colorsClash = computed(
  () => new Set(active.value.map((s) => s.color)).size !== active.value.length,
);
const hasSaved = game.hasSavedGame();

function toggleBot(seat: SeatConfig) {
  seat.bot = seat.bot ? null : { difficulty: 'normal' };
}

function start() {
  game.newGame({
    seats: active.value.map((s) => ({ ...s, bot: s.bot ? { ...s.bot } : null })),
    seed: Date.now() % 1_000_000,
  });
}

async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) game.importJson(await file.text());
}
</script>

<template>
  <main class="setup">
    <h1>Bruxelles 1893 Automa</h1>

    <section v-if="hasSaved" class="card">
      <p>A game is saved on this device.</p>
      <button class="big primary" @click="game.loadSaved()">Continue the saved game</button>
    </section>

    <section class="card">
      <h2>New game</h2>
      <p class="hint">Seats in turn order: the first seat is the first player of round 1.</p>
      <div class="row">
        <span>Players</span>
        <button
          v-for="n in [2, 3, 4, 5]"
          :key="n"
          class="big"
          :class="{ selected: n === count }"
          @click="count = n"
        >
          {{ n }}
        </button>
      </div>

      <div v-for="(seat, i) in active" :key="i" class="seat">
        <span class="seat-number">{{ i + 1 }}</span>
        <input v-model="seat.name" :aria-label="`Seat ${i + 1} name`" />
        <select v-model="seat.color" :aria-label="`Seat ${i + 1} color`">
          <option v-for="c in COLORS" :key="c" :value="c">{{ c }}</option>
        </select>
        <button class="big" :class="{ selected: seat.bot }" @click="toggleBot(seat)">
          {{ seat.bot ? 'Bot' : 'Human' }}
        </button>
        <select v-if="seat.bot" v-model="seat.bot.difficulty" aria-label="Difficulty">
          <option v-for="d in DIFFICULTY_NAMES" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>

      <p v-if="colorsClash" class="error">Two seats have the same color.</p>
      <button class="big primary" :disabled="colorsClash" @click="start">Start the game</button>
      <p class="hint">
        The app then asks how the board was set up: the Action strips, the compass tiles, the Public
        Figures, the starting Works of Art and the Bonus cards.
      </p>
    </section>

    <section class="card">
      <h2>Import a game</h2>
      <input type="file" accept="application/json,.json" @change="importFile" />
    </section>

    <p v-if="game.error" class="error">{{ game.error }}</p>
  </main>
</template>

<style scoped>
.setup {
  max-width: 48rem;
  margin: 0 auto;
  padding: 1rem;
}
.row,
.seat {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0.75rem 0;
}
.seat-number {
  width: 1.5rem;
  font-weight: bold;
}
.seat input {
  flex: 1 1 8rem;
}
</style>
