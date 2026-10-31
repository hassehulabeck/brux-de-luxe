<script setup lang="ts">
import GameScreen from './components/GameScreen.vue';
import SetupWizard from './components/SetupWizard.vue';
import { useGameStore } from './stores/game';

const game = useGameStore();
</script>

<template>
  <GameScreen v-if="game.session" />
  <SetupWizard v-else />
</template>
