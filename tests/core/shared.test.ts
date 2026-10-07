import { addHours, ControllableClock, ManualClock, SystemClock } from '@/core/shared/Clock';
import { InMemoryErrorLog } from '@/core/shared/ErrorLog';
import { DomainError, NotFoundError, OperationFailedError, ValidationError } from '@/core/shared/errors';
import { InMemoryEventBus } from '@/core/shared/EventBus';
import { SequentialIdGenerator } from '@/core/shared/IdGenerator';
import { InMemoryRepository } from '@/core/shared/Repository';
import { FieldErrors, isBlank } from '@/core/shared/Validator';
import { T0 } from '../helpers/fixtures';

describe('InMemoryRepository', () => {
  it('saves, finds, filters, counts and deletes items', () => {
    const repo = new InMemoryRepository([{ id: 'a', n: 1 }]);
    repo.save({ id: 'b', n: 2 });

    expect(repo.findById('b')).toEqual({ id: 'b', n: 2 });
    expect(repo.findWhere((item) => item.n > 1)).toHaveLength(1);
    expect(repo.count()).toBe(2);
    expect(repo.delete('a')).toBe(true);
    expect(repo.delete('a')).toBe(false);
    expect(repo.findAll()).toEqual([{ id: 'b', n: 2 }]);
  });

  it('returns undefined for unknown ids and replaces items with the same id', () => {
    const repo = new InMemoryRepository<{ id: string; n: number }>();
    expect(repo.findById('missing')).toBeUndefined();
    repo.save({ id: 'x', n: 1 });
    repo.save({ id: 'x', n: 5 });
    expect(repo.count()).toBe(1);
    expect(repo.findById('x')?.n).toBe(5);
  });
});

describe('SequentialIdGenerator', () => {
  it('numbers each prefix independently with zero padding', () => {
    const ids = new SequentialIdGenerator();
    expect(ids.next('ALT')).toBe('ALT-0001');
    expect(ids.next('ALT')).toBe('ALT-0002');
    expect(ids.next('RPT')).toBe('RPT-0001');
  });
});

describe('clocks', () => {
  it('ManualClock only moves when told to and returns defensive copies', () => {
    const clock = new ManualClock(T0);
    const first = clock.now();
    first.setFullYear(2000);
    expect(clock.now()).toEqual(T0);
    clock.advanceMinutes(90);
    expect(clock.now()).toEqual(addHours(T0, 1.5));
    clock.set(new Date('2027-01-01T00:00:00Z'));
    expect(clock.now().getUTCFullYear()).toBe(2027);
  });

  it('ControllableClock freezes, advances and releases back to real time', () => {
    const clock = new ControllableClock();
    clock.freezeAt(T0);
    expect(clock.now()).toEqual(T0);
    clock.advanceMinutes(30);
    expect(clock.now()).toEqual(new Date(T0.getTime() + 30 * 60_000));
    clock.release();
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
    clock.advanceMinutes(1);
    expect(clock.now().getTime()).toBeGreaterThan(Date.now());
  });

  it('SystemClock reports the current time', () => {
    expect(Math.abs(new SystemClock().now().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe('InMemoryEventBus', () => {
  it('delivers events to type subscribers and wildcard subscribers until they unsubscribe', () => {
    const bus = new InMemoryEventBus();
    const typed = vi.fn();
    const all = vi.fn();
    const stopTyped = bus.subscribe('a', typed);
    const stopAll = bus.subscribeAll(all);
    const event = { type: 'a', occurredAt: T0, payload: {} };

    bus.publish(event);
    bus.publish({ ...event, type: 'b' });
    expect(typed).toHaveBeenCalledTimes(1);
    expect(all).toHaveBeenCalledTimes(2);

    stopTyped();
    stopAll();
    bus.publish(event);
    expect(typed).toHaveBeenCalledTimes(1);
    expect(all).toHaveBeenCalledTimes(2);
  });
});

describe('FieldErrors', () => {
  it('keeps the first message per field and throws a ValidationError', () => {
    const errors = new FieldErrors().require(false, 'title', 'first').require(false, 'title', 'second').require(true, 'other', 'never');
    expect(errors.isEmpty).toBe(false);
    expect(errors.toRecord()).toEqual({ title: 'first' });
    expect(() => errors.throwIfAny()).toThrow(ValidationError);
  });

  it('does nothing when every rule passes', () => {
    expect(() => new FieldErrors().require(true, 'a', 'x').throwIfAny()).not.toThrow();
  });

  it.each([
    [undefined, true],
    [null, true],
    ['   ', true],
    [' a ', false],
  ])('isBlank(%j) is %s', (value, expected) => {
    expect(isBlank(value)).toBe(expected);
  });
});

describe('errors and error log', () => {
  it('exposes codes and names for each error category', () => {
    expect(new NotFoundError('Shelter', 'S1')).toMatchObject({ code: 'NOT_FOUND', name: 'NotFoundError', message: "Shelter 'S1' was not found" });
    expect(new ValidationError({ a: 'x' }).fieldErrors).toEqual({ a: 'x' });
    const cause = new Error('db down');
    expect(new OperationFailedError('failed', cause).cause).toBe(cause);
    expect(new DomainError('rule')).toMatchObject({ code: 'DOMAIN_RULE_VIOLATION' });
  });

  it('records Error and non-Error failures', () => {
    const log = new InMemoryErrorLog();
    log.record('op1', new Error('boom'), T0);
    log.record('op2', 'plain', T0);
    expect(log.entries()).toEqual([
      { operation: 'op1', message: 'boom', at: T0 },
      { operation: 'op2', message: 'plain', at: T0 },
    ]);
  });
});
