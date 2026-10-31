/**
 * Rule options for the places where the rulebook can be read more than one
 * way. The defaults are the most literal reading. Each option points at its
 * question in docs/rules-questions.md.
 */
export interface RuleOptions {
  /**
   * Q14. End-game tuck row 4 counts "each Assistant pawn in his possession",
   * except those in the Courthouse. The game ends before the End of Turn
   * phase, so Assistants are still on the boards. Literal: they count.
   */
  tuckRow4CountsAssistantsOnBoards: boolean;
  /**
   * Q15. On a Manneken Pis tie, "the tied player who is the first one
   * clockwise from the current first player" becomes first player.
   * Literal: the search starts with the current first player, so they keep it.
   */
  firstPlayerTieIncludesCurrent: boolean;
  /**
   * Q16. Manneken Pis are counted on "each Bonus card earned". A tied card is
   * discarded, not earned. Literal: tied cards give no Manneken Pis.
   */
  tiedBonusCardsCountMannekenPis: boolean;
  /**
   * Q17. The secondary action triggers when a player "chooses an action" on a
   * space with an opponent's Building. Literal: it triggers even if the
   * active player then skips performing the action.
   */
  secondaryActionWhenPrimarySkipped: boolean;
  /**
   * Q19. "Each player must pay the amounts indicated on the Public Figure
   * cards that he kept." Hans: paying is optional (an unpaid card costs 5 VP),
   * so this is off. On: a card may only stay unpaid if the money left after
   * paying the others can't cover it.
   */
  mustPayPublicFiguresWhenAble: boolean;
}

export const DEFAULT_RULES: RuleOptions = {
  tuckRow4CountsAssistantsOnBoards: true,
  firstPlayerTieIncludesCurrent: true,
  tiedBonusCardsCountMannekenPis: false,
  secondaryActionWhenPrimarySkipped: true,
  mustPayPublicFiguresWhenAble: false,
};
