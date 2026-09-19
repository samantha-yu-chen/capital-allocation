/**
 * The starter profile: the one set of values the app calls a default.
 *
 * Everything the reader sees before they have typed anything comes from here, and "is this mine or
 * is it the app's?" is answered by comparing against it (`provenance.ts`). There is deliberately
 * exactly one such profile *at a time*: a "reset this field", a "reset this group" and the
 * whole-profile reset must never disagree about what the default is.
 *
 * UX-9 made *which* profile that is a choice. `src/domain/starter-situations.ts` holds a small set
 * of labelled starting points, and choosing one replaces the baseline the form is measured against
 * (`profile-state.ts`). This module still names the one the app opens with, which is the
 * specification's worked example (`createExampleProfile`, spec section 79) — an illustration chosen
 * to exercise the model, not a benchmark, not a recommendation and not a forecast of anyone's
 * situation.
 */
import type { Profile } from '../../domain/contracts.js';
import { DEFAULT_STARTER_ID, starterProfile } from '../../domain/starter-situations.js';

/** How the starter is named on screen when no particular situation needs naming. */
export const STARTER_PROFILE_LABEL = 'the starter profile';

/**
 * A fresh copy of the situation the app opens with. Identical to `createExampleProfile()` by
 * construction — the engines' fixture and the UI's opening default must be the same profile, or a
 * "reset" would quietly change a run — and a test asserts it.
 */
export function createStarterProfile(): Profile {
  return starterProfile(DEFAULT_STARTER_ID);
}
