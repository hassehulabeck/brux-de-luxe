<script setup lang="ts">
import type { BotTurn } from '../stores/game';
import type { SeatConfig } from '../game/session';

defineProps<{ turn: BotTurn; seats: SeatConfig[]; canFinish: boolean }>();
const emit = defineEmits<{ done: [] }>();
</script>

<template>
  <section class="bot-turn">
    <header>
      <span class="swatch" :style="{ background: seats[turn.player]?.color }" />
      <h2>{{ seats[turn.player]?.name }} (bot)</h2>
      <span v-if="turn.plan" class="badge plan">{{ turn.plan }}</span>
    </header>
    <p class="hint">Carry out these moves for the bot on the board:</p>
    <ol>
      <li v-for="(step, i) in turn.steps" :key="i">
        <strong>{{ step.instruction }}</strong>
        <small v-if="step.reason">{{ step.reason }}</small>
      </li>
    </ol>
    <slot />
    <button v-if="canFinish" class="big primary" @click="emit('done')">Done</button>
  </section>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
h2 {
  margin: 0;
}
.swatch {
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  border: 1px solid #000;
}
li {
  margin: 0.4rem 0;
  font-size: 1.1rem;
}
li small {
  display: block;
  color: var(--color-muted);
  font-size: 0.8rem;
}
.plan {
  background: var(--color-accent);
  color: white;
}
</style>
