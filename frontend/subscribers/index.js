import { appDidStart$ } from '@shopgate/engage/core';
import loadWidgetScript from '../helpers/widgetScript';
import { isWidgetScriptNeeded } from '../settings';

/**
 * Loads the widget script as early as possible, so that the first widget does not have to wait for
 * it. Widgets that are rendered without a configured widget id - a badge placed through the page
 * builder with its own one - take care of the script themselves.
 * @param {Function} subscribe The subscribe function.
 * @returns {void}
 */
export default function trustedShopsSubscribers(subscribe) {
  subscribe(appDidStart$, () => {
    if (!isWidgetScriptNeeded) {
      return;
    }

    loadWidgetScript();
  });
}
