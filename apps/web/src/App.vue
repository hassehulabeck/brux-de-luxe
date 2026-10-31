<script setup lang="ts">
import { ENGINE_NAME } from '@brux/engine';
</script>

<template>
  <main class="placeholder">
    <h1>Bruxelles 1893 Automa</h1>
    <p>The table app arrives in Phase 6. Engine loaded: {{ ENGINE_NAME }}.</p>
  </main>
</template>

<style scoped>
.placeholder {
  max-width: 40rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}
</style>
