/**
 * A destination whose engine does not exist yet.
 *
 * The tab stays reachable so the eight-tab structure is preserved, and it says plainly what is
 * missing and which package owns it. It never renders an illustrative number.
 */
import type { ReactNode } from 'react';
import type { TabDefinition } from '../view/tabs.js';
import { Card } from './components.js';

export function PlannedScreen(props: { tab: TabDefinition }): ReactNode {
  return (
    <Card kicker={`Work package ${props.tab.package}`} title="Not implemented yet" elevation="sm">
      <p className="card-body">{props.tab.summary}</p>
      <p className="card-body">{props.tab.groundwork}</p>
      <p className="footnote" style={{ margin: 0 }}>
        This screen is deliberately empty. Showing a placeholder chart or an approximate figure here would be
        indistinguishable from a real result, so nothing is shown until the engine behind it exists.
      </p>
    </Card>
  );
}
