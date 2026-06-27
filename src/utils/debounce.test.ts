import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires once after rapid successive calls', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    debounced('b');
    debounced('c');

    expect(fn).not.toHaveBeenCalled();

    jest.runAllTimers();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses arguments from the last call', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('first');
    debounced('second');
    debounced('last');

    jest.runAllTimers();

    expect(fn).toHaveBeenCalledWith('last');
  });

  it('fires again after the delay resets between call groups', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 300);

    debounced('first-group');
    jest.runAllTimers();

    debounced('second-group');
    jest.runAllTimers();

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'first-group');
    expect(fn).toHaveBeenNthCalledWith(2, 'second-group');
  });

  it('does not fire before the delay elapses', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);

    debounced('x');
    jest.advanceTimersByTime(499);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
