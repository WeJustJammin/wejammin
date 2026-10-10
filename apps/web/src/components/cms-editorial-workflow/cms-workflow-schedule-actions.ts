import { PublicationActionSchema } from '@wejammin/contracts';
import type { PublicationAction } from '@wejammin/contracts';

/**
 * The actions the schedule form offers, from the publish permission the server
 * proved. BE03b:268-270 refuses the revision author only the action `publish`
 * (403 `separation_of_duties`); `unpublish`, `expire` and `archive` stay
 * schedulable, so an author keeps the form with those three and never loses it.
 * The permission is the workflow read's `permittedNextActions` hint (it holds
 * `publish` for a publisher who is not the author) and grants nothing: the
 * command re-proves it.
 */
export interface ScheduleActionChoices {
  readonly options: readonly PublicationAction[];
  /** What the form shows, and sends, until the person chooses another. */
  readonly defaultAction: PublicationAction;
}

/** The one action withheld from a revision's author. */
const AUTHOR_REFUSED_ACTION: PublicationAction = 'publish';

/** Where an author's form starts: the first of the three actions they may schedule. */
const AUTHOR_DEFAULT_ACTION: PublicationAction = 'unpublish';

export const scheduleActionChoices = (
  publishPermitted: boolean,
): ScheduleActionChoices => ({
  options: PublicationActionSchema.options.filter(
    (action) => publishPermitted || action !== AUTHOR_REFUSED_ACTION,
  ),
  defaultAction: publishPermitted
    ? AUTHOR_REFUSED_ACTION
    : AUTHOR_DEFAULT_ACTION,
});

/**
 * The action to show and send: the person's choice (or a restored draft's) while
 * it is still offered, else the default. A stored or earlier choice of `publish`
 * therefore never outlives the permission that allowed it.
 */
export const effectiveScheduleAction = (
  chosen: string,
  choices: ScheduleActionChoices,
): PublicationAction =>
  choices.options.find((action) => action === chosen) ?? choices.defaultAction;
