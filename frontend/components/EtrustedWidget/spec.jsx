import React from 'react';
import { shallow, mount } from 'enzyme';
import { WIDGET_SCRIPT_ID } from '../../constants';
import EtrustedWidget from './index';

describe('<EtrustedWidget />', () => {
  it('should render the widget id only', () => {
    const wrapper = shallow(<EtrustedWidget widgetId="wdg-1" />);

    expect(wrapper.props()).toEqual({ 'data-etrusted-widget-id': 'wdg-1' });
  });

  it('should name the identifier attribute after the identifier type', () => {
    const wrapper = shallow(
      <EtrustedWidget widgetId="wdg-1" identifier="4001234567890" identifierType="gtin" />
    );

    expect(wrapper.props()).toEqual({
      'data-etrusted-widget-id': 'wdg-1',
      'data-gtin': '4001234567890',
    });
  });

  it('should bring the widget script along, exactly once', () => {
    const existing = document.getElementById(WIDGET_SCRIPT_ID);

    if (existing) {
      existing.remove();
    }

    mount(<EtrustedWidget widgetId="wdg-1" />);
    mount(<EtrustedWidget widgetId="wdg-2" />);

    expect(document.querySelectorAll(`#${WIDGET_SCRIPT_ID}`)).toHaveLength(1);
  });

  it('should end up as a custom element carrying the data attributes', () => {
    const wrapper = mount(
      <EtrustedWidget widgetId="wdg-1" identifier="SKU-4711" identifierType="sku" />
    );

    expect(wrapper.html()).toBe(
      '<etrusted-widget data-etrusted-widget-id="wdg-1" data-sku="SKU-4711"></etrusted-widget>'
    );
  });
});
