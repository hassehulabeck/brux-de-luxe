import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).use(createPinia()).mount('#app');

// Offline after the first visit (public/sw.js). Only in the built app: the
// dev server should always serve fresh files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // No offline mode then; the app works the same online.
  });
}
