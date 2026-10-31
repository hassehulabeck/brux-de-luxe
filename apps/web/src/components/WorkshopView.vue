<script setup lang="ts">
import { loadComponents, WORK_COLORS, type GameState, type GridPosition } from '@brux/engine';

const props = withDefaults(defineProps<{ state: GameState; selectable?: GridPosition[] }>(), {
  selectable: () => [],
});
const emit = defineEmits<{ pick: [to: GridPosition] }>();
const { bfByRow, vpByColumn, dots } = loadComponents().workshop;

/** What sits on a grid cell: the cursor's center or one of its colored dots. */
function marker(row: number, col: number): string | null {
  const c = props.state.workshopCursor;
  if (c.row === row && c.col === col) return 'black';
  return (
    WORK_COLORS.find(
      (color) => c.row + dots[color].row === row && c.col + dots[color].col === col,
    ) ?? null
  );
}
function isSelectable(row: number, col: number) {
  return props.selectable.some((p) => p.row === row && p.col === col);
}
</script>

<template>
  <div class="workshop" :style="{ gridTemplateColumns: `auto repeat(${vpByColumn.length}, 1fr)` }">
    <span class="corner">BF \ VP</span>
    <span v-for="(vp, col) in vpByColumn" :key="`vp-${col}`" class="head">{{ vp }}</span>
    <template v-for="(bf, row) in bfByRow" :key="row">
      <span class="head">{{ bf }}</span>
      <button
        v-for="(_, col) in vpByColumn"
        :key="`${row}-${col}`"
        class="cell"
        :class="{ selectable: isSelectable(row, col) }"
        :disabled="!isSelectable(row, col)"
        :aria-label="`Cursor to row ${row + 1}, column ${col + 1}`"
        @click="emit('pick', { row, col })"
      >
        <span v-if="marker(row, col)" class="dot" :style="{ background: marker(row, col)! }" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.workshop {
  display: grid;
  gap: 3px;
  max-width: 24rem;
}
.head,
.corner {
  font-size: 0.75rem;
  text-align: center;
  align-self: center;
}
.cell {
  aspect-ratio: 1;
  min-height: 2.6rem;
  border: 1px solid var(--color-line);
  border-radius: 4px;
  background: var(--color-space);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cell.selectable {
  border: 2px solid var(--color-accent);
  cursor: pointer;
}
.dot {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 1px solid #000;
}
</style>
