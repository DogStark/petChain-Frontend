import { useHaptic } from './useHaptic';

describe('useHaptic', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('calls navigator.vibrate with correct pattern for medium style', () => {
    const vibrateMock = jest.fn();
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: vibrateMock },
      configurable: true,
    });

    const { trigger } = useHaptic();
    trigger('medium');

    expect(vibrateMock).toHaveBeenCalledWith(20);
    expect(vibrateMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when navigator.vibrate is undefined', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
    });

    const { trigger } = useHaptic();
    expect(() => trigger('heavy')).not.toThrow();
  });

  it('maps each HapticStyle to a distinct vibration pattern', () => {
    const vibrateMock = jest.fn();
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: vibrateMock },
      configurable: true,
    });

    const { trigger } = useHaptic();

    trigger('light');
    expect(vibrateMock).toHaveBeenNthCalledWith(1, 10);

    trigger('medium');
    expect(vibrateMock).toHaveBeenNthCalledWith(2, 20);

    trigger('heavy');
    expect(vibrateMock).toHaveBeenNthCalledWith(3, 40);

    trigger('success');
    expect(vibrateMock).toHaveBeenNthCalledWith(4, [10, 50, 10]);

    trigger('warning');
    expect(vibrateMock).toHaveBeenNthCalledWith(5, [20, 40, 20]);

    trigger('error');
    expect(vibrateMock).toHaveBeenNthCalledWith(6, [40, 30, 40, 30, 40]);
  });

  it('returns without calling vibrate when window is undefined', () => {
    const vibrateMock = jest.fn();
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: vibrateMock },
      configurable: true,
    });

    // Simulate SSR context
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    const { trigger } = useHaptic();
    trigger('light');

    expect(vibrateMock).not.toHaveBeenCalled();

    global.window = originalWindow;
  });

  it('gracefully handles vibrate errors', () => {
    const vibrateMock = jest.fn(() => {
      throw new Error('Vibration blocked');
    });
    Object.defineProperty(global, 'navigator', {
      value: { vibrate: vibrateMock },
      configurable: true,
    });

    const { trigger } = useHaptic();
    expect(() => trigger('light')).not.toThrow();
    expect(vibrateMock).toHaveBeenCalled();
  });
});
