import { parseSimArgs, UsageError } from './args';
import { runMatch } from './match';
import { formatReport } from './report';

try {
  const options = parseSimArgs(process.argv.slice(2));
  const step = Math.max(1, Math.floor(options.games / 20));
  const result = runMatch(options, (game) => {
    if ((game + 1) % step === 0) process.stderr.write(`\r${game + 1}/${options.games} games`);
  });
  process.stderr.write('\r\x1b[K');
  console.log(formatReport(result));
  if (result.errors.length > 0) process.exitCode = 1;
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
