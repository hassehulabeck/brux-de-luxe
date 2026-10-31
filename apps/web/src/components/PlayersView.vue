<script setup lang="ts">
import { loadComponents, PUBLIC_FIGURE_NAMES, type GameState } from '@brux/engine';
import type { SeatConfig } from '../game/session';

defineProps<{ state: GameState; seats: SeatConfig[]; active: number | null }>();

const tracks = loadComponents().tracks;
/** The value at a track position (tracks stop at their last space). */
const value = (track: keyof typeof tracks, index: number) =>
  tracks[track][Math.min(index, tracks[track].length - 1)];
const workTotal = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);
</script>

<template>
  <div class="players">
    <article
      v-for="(p, i) in state.players"
      :key="i"
      class="player"
      :class="{ active: active === i, passed: state.round.passed.includes(i) }"
    >
      <header>
        <span class="swatch" :style="{ background: seats[i]?.color }" />
        <strong>{{ seats[i]?.name }}</strong>
        <span v-if="seats[i]?.bot" class="badge">bot</span>
        <span v-if="state.firstPlayer === i" class="badge" title="Manneken Pis">first</span>
        <span v-if="state.round.passed.includes(i)" class="badge">passed</span>
      </header>
      <dl>
        <dt>VP</dt>
        <dd>{{ p.vp }}</dd>
        <dt>BF</dt>
        <dd>{{ p.bf }}</dd>
        <dt>Works</dt>
        <dd>
          {{ workTotal(p.works) }}
          <small>
            ({{
              Object.entries(p.works)
                .filter(([, n]) => n > 0)
                .map(([c, n]) => `${n} ${c}`)
                .join(', ') || 'none'
            }})
          </small>
        </dd>
        <dt>Materials</dt>
        <dd>
          {{ p.nobles.wood }} wood, {{ p.nobles.stone }} stone, {{ p.nobles.iron }} iron,
          {{ p.jokers }} Jokers
        </dd>
        <dt>Assistants</dt>
        <dd>{{ p.assistants.available }} free, {{ p.assistants.courthouse }} in the Courthouse</dd>
        <dt>Tracks</dt>
        <dd>
          City Hall {{ value('cityHall', p.tracks.cityHall) }} VP, Royal Palace
          {{ value('royalPalace', p.tracks.royalPalace) }} figures, Architect
          {{ value('architect', p.tracks.architect) }} VP
        </dd>
        <dt>Buildings</dt>
        <dd>{{ p.buildingsBuilt }} of 6</dd>
        <dt>Figures</dt>
        <dd>
          {{
            p.publicFigures
              .map((f) => `${PUBLIC_FIGURE_NAMES[f.figure]}${f.rotated ? ' (used)' : ''}`)
              .join(', ') || 'none'
          }}
        </dd>
      </dl>
    </article>
  </div>
</template>

<style scoped>
.players {
  display: grid;
  gap: 0.5rem;
}
.player {
  border: 2px solid var(--color-line);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  background: var(--color-card);
}
.player.active {
  border-color: var(--color-accent);
}
.player.passed {
  opacity: 0.7;
}
header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.swatch {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 1px solid #000;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.1rem 0.6rem;
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
}
dt {
  color: var(--color-muted);
}
dd {
  margin: 0;
}
</style>
