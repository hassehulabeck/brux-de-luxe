<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  APP_COMMIT,
  DESCRIPTION_MAX,
  NAME_MAX,
  TITLE_MAX,
  feedbackRequest,
  recentErrors,
  sendFeedback,
  type FeedbackForm,
} from '../game/feedback';
import { useGameStore } from '../stores/game';

const NAME_KEY = 'brux-de-luxe:reporter-name';

const game = useGameStore();
const dialog = ref<HTMLDialogElement | null>(null);

type Status =
  { s: 'idle' } | { s: 'sending' } | { s: 'sent'; issue: number } | { s: 'error'; msg: string };
const status = ref<Status>({ s: 'idle' });

const form = reactive<FeedbackForm>(blankForm());

function blankForm(): FeedbackForm {
  return {
    kind: 'idea',
    title: '',
    description: '',
    name: storedName(),
    website: '',
    attach: true,
  };
}

function storedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

const canSend = computed(
  () =>
    status.value.s !== 'sending' && form.title.trim().length >= 3 && form.description.trim() !== '',
);

function open() {
  if (status.value.s === 'sent') Object.assign(form, blankForm());
  status.value = { s: 'idle' };
  dialog.value?.showModal();
}

function close() {
  dialog.value?.close();
}

async function send() {
  if (!canSend.value) return;
  status.value = { s: 'sending' };
  try {
    localStorage.setItem(NAME_KEY, form.name.trim());
  } catch {
    // Private mode: the name just isn't remembered.
  }
  const request = feedbackRequest(
    form,
    game.session,
    {
      commit: APP_COMMIT,
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
    },
    recentErrors(),
  );
  try {
    status.value = { s: 'sent', issue: await sendFeedback(request) };
  } catch (error) {
    status.value = { s: 'error', msg: error instanceof Error ? error.message : String(error) };
  }
}
</script>

<template>
  <button class="big" @click="open">Suggestions</button>

  <!-- In <body>, so the dialog still shows when the button sits in a menu that closes. -->
  <Teleport to="body">
    <dialog ref="dialog" class="suggestion-box" aria-labelledby="suggestion-box-title">
      <template v-if="status.s === 'sent'">
        <h2 id="suggestion-box-title">Thanks!</h2>
        <p>It's now issue #{{ status.issue }}. We'll have a look.</p>
        <div class="actions">
          <button class="big primary" @click="close">Back to the game</button>
          <button class="big" @click="open">Send another</button>
        </div>
      </template>

      <form v-else method="dialog" @submit.prevent="send">
        <h2 id="suggestion-box-title">Suggestion box</h2>
        <p class="hint">Found a bug or have an idea? It goes straight to the to-do list.</p>

        <div class="mode" role="radiogroup" aria-label="What is it?">
          <label :class="{ on: form.kind === 'bug' }">
            <input v-model="form.kind" type="radio" name="kind" value="bug" />
            🐞 A bug
          </label>
          <label :class="{ on: form.kind === 'idea' }">
            <input v-model="form.kind" type="radio" name="kind" value="idea" />
            💡 An idea
          </label>
        </div>

        <label class="field">
          <span>Title</span>
          <input
            v-model="form.title"
            type="text"
            required
            minlength="3"
            :maxlength="TITLE_MAX"
            :placeholder="
              form.kind === 'bug' ? 'The bot placed an Assistant on…' : 'It would be nice if…'
            "
          />
        </label>

        <label class="field">
          <span>Tell us more</span>
          <textarea
            v-model="form.description"
            required
            :maxlength="DESCRIPTION_MAX"
            rows="6"
            :placeholder="
              form.kind === 'bug'
                ? 'What did you do, what happened, and what did you expect?'
                : 'Describe your idea.'
            "
          />
        </label>

        <label class="field">
          <span>Your name (optional)</span>
          <input v-model="form.name" type="text" :maxlength="NAME_MAX" autocomplete="name" />
        </label>

        <!-- Honeypot: hidden from people, filled in by bots. -->
        <input
          v-model="form.website"
          class="hp"
          name="website"
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
        />

        <label v-if="form.kind === 'bug' && game.session" class="attach">
          <input v-model="form.attach" type="checkbox" />
          Attach this game ({{ game.session.moves.length }} moves) so the bug can be replayed
        </label>

        <p v-if="status.s === 'error'" class="error">{{ status.msg }}</p>

        <div class="actions">
          <button class="big primary" type="submit" :disabled="!canSend">
            {{ status.s === 'sending' ? 'Sending…' : 'Send' }}
          </button>
          <button class="big" type="button" @click="close">Cancel</button>
        </div>
        <p class="hint note">
          Heads up: suggestions{{
            form.attach && form.kind === 'bug' && game.session
              ? ' and attached games (with player names)'
              : ''
          }}
          are public on GitHub.
        </p>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
.suggestion-box {
  width: min(36rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  box-sizing: border-box;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-card);
  color: var(--color-text);
}
.suggestion-box::backdrop {
  background: rgb(0 0 0 / 0.4);
}
.mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin: 0.75rem 0 1rem;
  padding: 4px;
  border-radius: 12px;
  background: var(--color-space);
}
.mode label {
  display: grid;
  place-items: center;
  min-height: 3rem;
  border-radius: 9px;
  color: var(--color-muted);
  font-weight: 600;
  cursor: pointer;
}
.mode label.on {
  background: var(--color-card);
  color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-accent);
}
.mode input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.mode label:has(input:focus-visible) {
  outline: 2px solid var(--color-accent);
}
.field {
  display: grid;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
}
.field input,
.field textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 0.6rem;
  border: 2px solid var(--color-line);
  border-radius: 8px;
  background: var(--color-card);
  color: inherit;
  font: inherit;
  font-weight: normal;
}
.field textarea {
  resize: vertical;
}
.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}
.hp {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
}
.attach {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}
.attach input {
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
}
.error {
  padding: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.note {
  margin: 0.75rem 0 0;
}
</style>
