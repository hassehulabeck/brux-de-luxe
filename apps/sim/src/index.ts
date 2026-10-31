import { parseSimArgs, UsageError } from './args';
import { openLog } from './log';
import { runMatch, type MatchHooks } from './match';
import { formatReport } from './report';
import { formatTournament, MATCHUPS, runTournament } from './tournament';

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

  if (options.tournament) {
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
