<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { legalMoves, type ArtNouveauSpace } from '@brux/engine';
import { whoActs } from '../game/session';
import { useGameStore } from '../stores/game';
import BoardView from './BoardView.vue';
import BotTurnCard from './BotTurnCard.vue';
import ChancePrompt from './ChancePrompt.vue';
import DecisionPanel from './DecisionPanel.vue';
import GameOver from './GameOver.vue';
import PlayersView from './PlayersView.vue';
import SharedView from './SharedView.vue';
import WorkshopView from './WorkshopView.vue';

const game = useGameStore();
const state = computed(() => game.state!);
const actor = computed(() => whoActs(state.value));
const humanToAct = computed(() =>
  actor.value.kind === 'seat' && !game.seats[actor.value.player]?.bot ? actor.value.player : null,
);
const chanceEvent = computed(() =>
  state.value.pending?.kind === 'chance' ? state.value.pending.event : null,
);
const moves = computed(() =>
  humanToAct.value !== null && !game.botTurn ? legalMoves(state.value) : [],
);

// Board taps: choosing a space for a turn, a Building or a neutral Assistant.
const selected = ref<ArtNouveauSpace | null>(null);
watch(state, () => (selected.value = null));
const boardTargets = computed(() => {
  const spaces = moves.value.flatMap((m) =>
    m.kind === 'placeAssistant' || m.kind === 'placeBuilding' || m.kind === 'placeNeutral'
      ? [m.space]
      : [],
  );
  return spaces.filter((s, i) => spaces.findIndex((t) => t.row === s.row && t.col === s.col) === i);
});
function pickSpace(space: ArtNouveauSpace) {
  const kind = state.value.pending?.kind;
  if (kind === 'turn') selected.value = space;
  else if (kind === 'placeBuilding') game.enter({ kind: 'placeBuilding', space });
  else if (kind === 'placeNeutral') game.enter({ kind: 'placeNeutral', space });
}

const PHASES: Record<string, string> = {
  setup: 'Setup',
  stockExchange: 'Stock Exchange',
  action: 'Actions',
  resolution: 'Resolution',
  gameOver: 'Game over',
};

function exportGame() {
  const blob = new Blob([game.exportJson()], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `bruxelles-1893-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function quit() {
  if (confirm('Leave this game? It will be removed from this device.')) game.quit();
}
</script>

<template>
  <div class="game">
    <header class="toolbar">
      <strong>Round {{ Math.min(state.round.number, 5) }} · {{ PHASES[state.phase] }}</strong>
      <span class="spacer" />
      <button class="big" :disabled="!game.canUndo" @click="game.undo()">Undo</button>
      <button class="big" :disabled="!game.canRedo" @click="game.redo()">Redo</button>
      <button class="big" @click="exportGame">Export</button>
      <button class="big" @click="quit">New game</button>
    </header>

    <p v-if="game.error" class="error">{{ game.error }}</p>

    <div class="layout">
      <section v-if="game.notes.length" class="notes card">
        <h2>Also on the board</h2>
        <ul>
          <li v-for="(note, i) in game.notes" :key="i">{{ note }}</li>
        </ul>
        <button class="big" @click="game.dismissNotes()">Done</button>
      </section>

      <section class="panel card">
        <GameOver v-if="state.phase === 'gameOver'" :state="state" :seats="game.seats" />
        <BotTurnCard
          v-else-if="game.botTurn"
          :turn="game.botTurn"
          :seats="game.seats"
          :can-finish="game.botTurnDone"
          @done="game.doneWithBotTurn()"
        >
          <ChancePrompt
            v-if="chanceEvent"
            :state="state"
            :event="chanceEvent"
            :seats="game.seats"
            @enter="game.enter($event)"
          />
        </BotTurnCard>
        <ChancePrompt
          v-else-if="chanceEvent"
          :state="state"
          :event="chanceEvent"
          :seats="game.seats"
          @enter="game.enter($event)"
        />
        <DecisionPanel
          v-else-if="humanToAct !== null"
          :state="state"
          :moves="moves"
          :seats="game.seats"
          :selected="selected"
          @enter="game.enter($event)"
          @clear="selected = null"
        />
        <p v-else class="hint">The bot is thinking…</p>
      </section>

      <section v-if="state.board.length" class="board-area card">
        <BoardView
          :state="state"
          :seats="game.seats"
          :selectable="boardTargets"
          :selected="selected"
          @pick="pickSpace"
        />
        <SharedView :state="state" />
        <details>
          <summary>Workshop</summary>
          <WorkshopView :state="state" />
        </details>
      </section>

      <section class="players-area">
        <PlayersView
          :state="state"
          :seats="game.seats"
          :active="actor.kind === 'seat' ? actor.player : null"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-card);
  border-bottom: 1px solid var(--color-line);
}
.spacer {
  flex: 1;
}
.layout {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
  grid-template-columns: minmax(0, 3fr) minmax(16rem, 2fr);
  grid-template-areas:
    'notes notes'
    'panel panel'
    'board players';
}
.notes {
  grid-area: notes;
  border: 2px solid var(--color-accent);
}
.notes h2 {
  margin: 0;
}
.notes li {
  margin: 0.4rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}
.panel {
  grid-area: panel;
}
.board-area {
  grid-area: board;
  display: grid;
  gap: 0.75rem;
}
.players-area {
  grid-area: players;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'notes' 'panel' 'board' 'players';
  }
}
</style>
