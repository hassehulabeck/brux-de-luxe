<script setup lang="ts">
import { ACTION_NAMES, type ArtNouveauSpace, type GameState } from '@brux/engine';
import { bonusCardLabel } from '../game/labels';
import type { SeatConfig } from '../game/session';

const props = withDefaults(
  defineProps<{
    state: GameState;
    seats: SeatConfig[];
    /** Spaces the player may tap now. */
    selectable?: ArtNouveauSpace[];
    selected?: ArtNouveauSpace | null;
  }>(),
  { selectable: () => [], selected: null },
);
const emit = defineEmits<{ pick: [space: ArtNouveauSpace] }>();

function isSelectable(row: number, col: number) {
  return props.selectable.some((s) => s.row === row && s.col === col);
}
function inArea(row: number, col: number) {
  const area = props.state.round.area;
  return (
    area !== null &&
    row >= area.rows[0] &&
    row <= area.rows[1] &&
    col >= area.cols[0] &&
    col <= area.cols[1]
  );
}
function colorOf(player: number) {
  return props.seats[player]?.color ?? 'gray';
}
</script>

<template>
  <div class="board" role="grid" aria-label="Art Nouveau board">
    <template v-for="(cells, row) in state.board" :key="row">
      <button
        v-for="(space, col) in cells"
        :key="`${row}-${col}`"
        class="space"
        :class="{
          area: inArea(row, col),
          selectable: isSelectable(row, col),
          selected: selected?.row === row && selected?.col === col,
        }"
        :disabled="!isSelectable(row, col)"
        :aria-label="`Row ${row + 1}, column ${col + 1}: ${ACTION_NAMES[space.action]}`"
        @click="emit('pick', { row, col })"
      >
        <span class="action">{{ ACTION_NAMES[space.action] }}</span>
        <span
          v-if="space.building !== null"
          class="building"
          :style="{ background: colorOf(space.building) }"
          :title="`${seats[space.building]?.name}'s Building`"
        />
        <span v-if="space.assistant" class="assistant">
          <span
            class="pawn"
            :style="{
              background:
                space.assistant.kind === 'player' ? colorOf(space.assistant.player) : 'gray',
            }"
          />
          {{ space.assistant.kind === 'player' ? `${space.assistant.bid} BF` : 'neutral' }}
        </span>
      </button>
    </template>
    <div v-for="(card, col) in state.bonusStrip" :key="`bonus-${col}`" class="bonus">
      {{ card === null ? '—' : bonusCardLabel(card).split(' · ')[0] }}
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}
.space {
  min-height: 4.5rem;
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  border: 2px solid var(--color-line);
  border-radius: 6px;
  background: var(--color-space);
  color: inherit;
  font-size: 0.8rem;
  opacity: 0.6;
}
.space.area {
  opacity: 1;
  background: var(--color-area);
}
.space.selectable {
  cursor: pointer;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
  opacity: 1;
}
.space.selected {
  background: var(--color-accent);
  color: white;
}
.space:disabled {
  cursor: default;
}
.building {
  width: 1.2rem;
  height: 0.8rem;
  border: 1px solid #000;
}
.assistant {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: bold;
}
.pawn {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  border: 1px solid #000;
}
.bonus {
  font-size: 0.7rem;
  text-align: center;
  padding: 0.25rem;
  border: 1px dashed var(--color-line);
  border-radius: 4px;
}
</style>
