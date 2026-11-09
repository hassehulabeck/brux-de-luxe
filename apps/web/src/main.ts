import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { recordError } from './game/feedback';
import { useGameStore } from './stores/game';
import './style.css';

const app = createApp(App).use(createPinia());
// Kept for bug reports from the suggestion box.
app.config.errorHandler = (error) => {
  recordError(error);
  console.error(error);
};
window.addEventListener('error', (event) => recordError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => recordError(event.reason));
app.mount('#app');

// The game log queues events while offline (game/game-log.ts): send them now and when back online.
const game = useGameStore();
game.flushGameLog();
window.addEventListener('online', () => game.flushGameLog());

// Offline after the first visit (public/sw.js). Only in the built app: the
// dev server should always serve fresh files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // No offline mode then; the app works the same online.
  });
}
