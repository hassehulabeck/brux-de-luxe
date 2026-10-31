/**
 * Loads the transcribed component data from `json/` and validates it.
 * The rest of the engine gets component data through `loadComponents()` only.
 */

import actionStrips from './json/action-strips.json';
import bonusCards from './json/bonus-cards.json';
import compass from './json/compass.json';
import exhibitions from './json/exhibitions.json';
import publicFigures from './json/public-figures.json';
import stockExchangeCards from './json/stock-exchange-cards.json';
import tracks from './json/tracks.json';
import worksOfArt from './json/works-of-art.json';
import workshop from './json/workshop.json';
import type { Components } from './types';
import { validateComponents, type DataReport, type RawComponents } from './validate';

export const RAW_COMPONENTS: RawComponents = {
  actionStrips,
  workshop,
  tracks,
  compass,
  stockExchangeCards,
  bonusCards,
  publicFigures,
  worksOfArt,
  exhibitions,
};

/** What is still missing or wrong in the transcribed data. */
export function componentDataReport(raw: RawComponents = RAW_COMPONENTS): DataReport {
  return validateComponents(raw).report;
}

/** The complete component data. Throws a readable list of problems if the data isn't complete yet. */
export function loadComponents(raw: RawComponents = RAW_COMPONENTS): Components {
  const { components, report } = validateComponents(raw);
  if (components) return components;

  const lines = [
    ...report.errors.map((error) => `  error:   ${error}`),
    ...report.missing.map((path) => `  missing: ${path}`),
  ];
  throw new Error(
    `Component data is not complete (see docs/data-entry-guide.md):\n${lines.join('\n')}`,
  );
}
