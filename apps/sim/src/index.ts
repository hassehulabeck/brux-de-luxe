import { resolve } from 'node:path';
import { WEIGHT_SETS } from '@brux/engine';
import { parseSimArgs, UsageError } from './args';
import { openLog } from './log';
import { runMatch, type MatchHooks } from './match';
import { formatReport } from './report';
import { formatTournament, MATCHUPS, runTournament } from './tournament';
import { formatStep, tune, writeWeights } from './tune';

try {
  const options = parseSimArgs(process.argv.slice(2));
  const log = options.log ? openLog(options.log) : null;
  const total = options.tournament ? options.games * MATCHUPS.length : options.games;
  const step = Math.max(1, Math.floor(total / 20));
  let done = 0;
  const hooks: MatchHooks = {
    onGameDone: () => {
      done++;
      if (done % step === 0) process.stderr.write(`\r${done}/${total} games`);
    },
    ...(log ? { onDecision: log.write } : {}),
  };

  if (options.tune) {
    const start = WEIGHT_SETS[options.from];
    if (!start) throw new UsageError(`--from: unknown weight set "${options.from}"`);
    // pnpm runs the script in apps/sim: a relative --out is relative to where it was typed.
    const out = resolve(process.env.INIT_CWD ?? process.cwd(), options.out);
    console.log(
      `Tuning from "${options.from}": ${options.iterations} steps, ${options.games} games per evaluation, seed ${options.seed}`,
    );
    const { steps } = tune(start, options, (step, champion) => {
      console.log(formatStep(step));
      if (step.accepted) writeWeights(out, champion);
    });
    const accepted = steps.filter((s) => s.accepted).length;
    console.log(
      accepted > 0
        ? `${accepted} steps accepted; weights written to ${out}`
        : 'No step was accepted.',
    );
  } else if (options.tournament) {
    const results = runTournament(options, hooks);
    process.stderr.write('\r\x1b[K');
    console.log(formatTournament(results));
    if (results.some((r) => r.errors.length > 0)) process.exitCode = 1;
  } else {
    const result = runMatch(options, hooks);
    process.stderr.write('\r\x1b[K');
    console.log(formatReport(result));
    if (result.errors.length > 0) process.exitCode = 1;
  }
  log?.close();
} catch (error) {
  if (
    error instanceof UsageError ||
    (error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')
  ) {
    console.error((error as Error).message);
    process.exitCode = 2;
  } else {
    throw error;
  }
}
