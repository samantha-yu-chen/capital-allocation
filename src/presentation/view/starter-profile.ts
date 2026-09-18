/**
 * The starter profile: the one set of values the app calls a default.
 *
 * Everything the reader sees before they have typed anything comes from here, and "is this mine or
 * is it the app's?" is answered by comparing against it (`provenance.ts`). There is deliberately
 * exactly one such profile: a "reset this field", a "reset this group" and the whole-profile reset
 * must never disagree about what the default is.
 *
 * It is the specification's worked example (`createExampleProfile`, spec section 79) under a name
 * that says what it is for. The values are an illustration chosen to exercise the model — not a
 * benchmark, not a recommendation, and not a forecast of anyone's situation.
 */
import type { Profile } from '../../domain/contracts.js';
import { createExampleProfile } from '../../domain/fixtures.js';

/** How the starter is named on screen, so every surface says the same thing. */
export const STARTER_PROFILE_LABEL = 'the starter profile';

/**
 * A fresh copy of the starter. Identical to `createExampleProfile()` by construction: the engines'
 * fixture and the UI's default must be the same profile, or a "reset" would quietly change a run.
 */
export function createStarterProfile(): Profile {
  return createExampleProfile();
}
