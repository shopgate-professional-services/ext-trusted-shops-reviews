import { WIDGET_SCRIPT_ID, WIDGET_SCRIPT_URL } from '../constants';

/**
 * Injects the Trusted Shops widget script once. The script only registers the <etrusted-widget>
 * custom element; every widget on the page is loaded by the element itself, so the order of script
 * and elements does not matter.
 * @returns {void}
 */
const loadWidgetScript = () => {
  if (document.getElementById(WIDGET_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement('script');
  script.id = WIDGET_SCRIPT_ID;
  script.src = WIDGET_SCRIPT_URL;
  script.async = true;
  script.defer = true;

  document.head.appendChild(script);
};

export default loadWidgetScript;
