import { ENGINE_NAME } from '@brux/engine';

// Placeholder until Phase 3. It shows that the sim can import the engine
// and receive CLI arguments. Both `pnpm sim --games 10` and
// `pnpm sim -- --games 10` work, so a leading `--` is dropped.
const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

console.log(`${ENGINE_NAME}: simulator not implemented yet (Phase 3).`);
if (args.length > 0) {
  console.log(`Arguments received: ${args.join(' ')}`);
}
