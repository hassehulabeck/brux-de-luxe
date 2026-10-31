<script setup lang="ts">
import { computed } from 'vue';
import type { GameState } from '@brux/engine';
import type { SeatConfig } from '../game/session';

const props = defineProps<{ state: GameState; seats: SeatConfig[] }>();
const ranked = computed(() => [...(props.state.final ?? [])].sort((a, b) => b.total - a.total));
</script>

<template>
  <section>
    <h2>Final scores</h2>
    <table>
      <thead>
        <tr>
          <th>Player</th>
          <th>Track</th>
          <th>Buildings</th>
          <th>Rows 1–4</th>
          <th>Materials</th>
          <th>Manneken Pis</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="score in ranked" :key="score.player">
          <td>{{ seats[score.player]?.name }}</td>
          <td>{{ score.scoringTrack }}</td>
          <td>{{ score.buildings }}</td>
          <td>{{ score.rows.join(' + ') }}</td>
          <td>{{ score.nobleMaterials }}</td>
          <td>{{ score.mannekenPis }}</td>
          <td>
            <strong>{{ score.total }}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
table {
  border-collapse: collapse;
  width: 100%;
}
th,
td {
  padding: 0.4rem;
  border-bottom: 1px solid var(--color-line);
  text-align: right;
}
th:first-child,
td:first-child {
  text-align: left;
}
</style>
