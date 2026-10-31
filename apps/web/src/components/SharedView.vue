<script setup lang="ts">
import { computed } from 'vue';
import { PUBLIC_FIGURE_NAMES, ROYAL_THEATER_COSTS, type GameState } from '@brux/engine';
import { COMPASS_TILE_LABELS, stockExchangeCardLabel } from '../game/labels';

const props = defineProps<{ state: GameState }>();

const shop = computed(() =>
  props.state.shop.map((stack) => (stack.length ? stack[stack.length - 1] : 'empty')),
);
</script>

<template>
  <section class="shared">
    <div>
      <h3>Stock Exchange</h3>
      <p>
        {{
          state.round.stockExchangeCard === null
            ? 'not revealed'
            : stockExchangeCardLabel(state, state.round.stockExchangeCard)
        }}
        <span v-if="state.round.shield">
          · Bracket on {{ state.round.shield.row }}-{{ state.round.shield.col }}
        </span>
      </p>
    </div>
    <div>
      <h3>Shop</h3>
      <p>Space 1: {{ shop[0] }} · Space 2: {{ shop[1] }}</p>
    </div>
    <div>
      <h3>Compass</h3>
      <p v-if="state.compass.tiles.length">
        <span v-for="(tile, i) in state.compass.tiles" :key="i" class="tile">
          <strong v-if="state.compass.needles.includes(i)">
            ▶ {{ COMPASS_TILE_LABELS[tile] }}
          </strong>
          <template v-else>{{ COMPASS_TILE_LABELS[tile] }}</template>
        </span>
      </p>
    </div>
    <div>
      <h3>Royal Theater</h3>
      <p>
        <span v-for="(card, i) in state.royalTheater.display" :key="i" class="tile">
          {{ card ? PUBLIC_FIGURE_NAMES[card.figure] : '—' }} ({{ ROYAL_THEATER_COSTS[i] }} BF)
        </span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.shared {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
}
h3 {
  margin: 0;
  font-size: 0.9rem;
}
p {
  margin: 0.2rem 0;
}
.tile + .tile::before {
  content: ' · ';
}
</style>
