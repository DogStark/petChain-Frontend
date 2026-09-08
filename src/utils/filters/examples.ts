/**
 * Filter Builder Pattern Examples
 *
 * This file demonstrates how to use the filter builder classes
 * for querying and filtering events in the petChain application.
 */

import { EventFilterBuilder, Event } from './EventFilterBuilder';

// Example 1: Basic event filtering
export function exampleBasicFiltering(events: Event[]): Event[] {
  return EventFilterBuilder.create()
    .eventTypes()
    .isPetStatusChanged()
    .build()
    ? events.filter((e) =>
        ['PetCreated', 'PetUpdated', 'PetStatusChanged'].includes(e.type),
      )
    : events;
}

// Example 2: Date range filtering
export function exampleDateRangeFiltering(events: Event[]): Event[] {
  return EventFilterBuilder.create()
    .dateRange()
    .lastDays(7)
    .build()
    ? events.filter((e) => {
        const eventDate = new Date(
          typeof e.timestamp === 'number' ? e.timestamp * 1000 : e.timestamp,
        );
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return eventDate >= weekAgo;
      })
    : events;
}

// Example 3: Contract ID filtering
export function exampleContractIdFiltering(
  events: Event[],
  contractId: string,
): Event[] {
  return EventFilterBuilder.create()
    .contractIds()
    .include(contractId)
    .build()
    ? events.filter((e) => e.contractId === contractId)
    : events;
}

// Example 4: Combined filters
export function exampleCombinedFilters(events: Event[]): Event[] {
  const builder = EventFilterBuilder.create();

  builder.dateRange().lastWeek();

  builder
    .contractIds()
    .include('CONTRACT_ID_1')
    .include('CONTRACT_ID_2');

  builder.eventTypes().isPetCreated().isPetUpdated();

  builder.paginate(1, 10);

  return builder.apply(events);
}

// Example 5: Custom predicate
export function exampleCustomPredicate(events: Event[]): Event[] {
  return EventFilterBuilder.create()
    .where((event) => {
      const timestamp =
        typeof event.timestamp === 'number'
          ? event.timestamp
          : new Date(event.timestamp).getTime() / 1000;
      return timestamp > 1000000000;
    })
    .where((event) => event.data['amount'] !== undefined)
    .apply(events);
}

// Example 6: Wallet events only
export function exampleWalletEvents(events: Event[]): Event[] {
  return EventFilterBuilder.create()
    .eventTypes()
    .isWalletCreated()
    .apply(events);
}

// Example 7: Transaction events
export function exampleTransactionEvents(events: Event[]): Event[] {
  return EventFilterBuilder.create()
    .eventTypes()
    .isTransactionEvent()
    .apply(events);
}

// Example 8: Today's events
export function exampleTodayEvents(events: Event[]): Event[] {
  return EventFilterBuilder.create()
    .dateRange()
    .today()
    .apply(events);
}

// Example 9: Events from last month, excluding failed transactions
export function exampleLastMonthExcludingFailed(
  events: Event[],
): Event[] {
  return EventFilterBuilder.create()
    .dateRange()
    .lastMonth()
    .eventTypes()
    .notEquals('TransactionFailed')
    .apply(events);
}

// Example 10: Complex query with multiple conditions
export function exampleComplexQuery(events: Event[]): Event[] {
  return EventFilterBuilder.create()
    .dateRange()
    .lastDays(30)
    .contractIds()
    .include('PET_REGISTRY_ID')
    .include('WALLET_ID')
    .eventTypes()
    .isPetStatusChanged()
    .where((event) => {
      const timestamp =
        typeof event.timestamp === 'number'
          ? event.timestamp
          : new Date(event.timestamp).getTime() / 1000;
      return timestamp > 2000000000;
    })
    .paginate(1, 20)
    .apply(events);
}
