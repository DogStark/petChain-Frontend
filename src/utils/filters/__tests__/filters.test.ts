import { DateRangeFilter } from '../DateRangeFilter';
import { ContractIdFilter } from '../ContractIdFilter';
import { EventTypePredicate } from '../EventTypePredicate';
import { EventFilterBuilder, Event } from '../EventFilterBuilder';

describe('Filter Builder Pattern', () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      type: 'PetCreated',
      contractId: 'CONTRACT_1',
      timestamp: Math.floor(Date.now() / 1000) - 3600,
      data: { petName: 'Buddy' },
    },
    {
      id: '2',
      type: 'PetUpdated',
      contractId: 'CONTRACT_2',
      timestamp: Math.floor(Date.now() / 1000) - 7200,
      data: { petName: 'Max' },
    },
    {
      id: '3',
      type: 'TransactionCompleted',
      contractId: 'CONTRACT_1',
      timestamp: Math.floor(Date.now() / 1000) - 86400,
      data: { amount: 100 },
    },
    {
      id: '4',
      type: 'WalletCreated',
      contractId: 'CONTRACT_3',
      timestamp: Math.floor(Date.now() / 1000) - 172800,
      data: { publicKey: 'ABC123' },
    },
  ];

  describe('DateRangeFilter', () => {
    it('should filter events by date range', () => {
      const filter = DateRangeFilter.create().lastHours(2);
      const filtered = filter.apply(mockEvents);
      expect(filtered.length).toBe(2);
      expect(
        filtered.every(
          (e) => e.timestamp > Math.floor(Date.now() / 1000) - 7200,
        ),
      ).toBe(true);
    });

    it('should filter events by today', () => {
      const filter = DateRangeFilter.create().today();
      const filtered = filter.apply(mockEvents);
      expect(filtered.length).toBe(3);
    });

    it('should return null when no date range is set', () => {
      const filter = DateRangeFilter.create();
      expect(filter.build()).toBeNull();
    });
  });

  describe('ContractIdFilter', () => {
    it('should filter events by contract ID', () => {
      const filter = ContractIdFilter.create().include('CONTRACT_1');
      const filtered = filter.apply(mockEvents);
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => e.contractId === 'CONTRACT_1')).toBe(true);
    });

    it('should exclude specific contract IDs', () => {
      const filter = ContractIdFilter.create().exclude('CONTRACT_1');
      const filtered = filter.apply(mockEvents);
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => e.contractId !== 'CONTRACT_1')).toBe(true);
    });

    it('should validate contract ID format', () => {
      const filter = ContractIdFilter.create();
      expect(() => filter.include('')).toThrow('Contract ID cannot be empty');
      expect(() => filter.include('A'.repeat(65))).toThrow(
        'Contract ID cannot exceed 64 characters',
      );
    });

    it('should skip validation when requested', () => {
      const filter = ContractIdFilter.create().skipValidation();
      expect(() => filter.include('')).not.toThrow();
    });
  });

  describe('EventTypePredicate', () => {
    it('should filter events by type', () => {
      const predicate = EventTypePredicate.create().isPetCreated();
      const filtered = predicate.apply(mockEvents);
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe('PetCreated');
    });

    it('should filter pet status changes', () => {
      const predicate = EventTypePredicate.create().isPetStatusChanged();
      const filtered = predicate.apply(mockEvents);
      expect(filtered.length).toBe(2);
      expect(
        filtered.every(
          (e) => e.type === 'PetCreated' || e.type === 'PetUpdated',
        ),
      ).toBe(true);
    });

    it('should filter wallet events', () => {
      const predicate = EventTypePredicate.create().isWalletCreated();
      const filtered = predicate.apply(mockEvents);
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe('WalletCreated');
    });

    it('should filter transaction events', () => {
      const predicate = EventTypePredicate.create().isTransactionEvent();
      const filtered = predicate.apply(mockEvents);
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe('TransactionCompleted');
    });

    it('should support custom predicates', () => {
      const predicate = EventTypePredicate.create()
        .startsWith('Pet')
        .notEquals('PetFlagged');
      const filtered = predicate.apply(mockEvents);
      expect(filtered.length).toBe(2);
      expect(
        filtered.every(
          (e) => e.type === 'PetCreated' || e.type === 'PetUpdated',
        ),
      ).toBe(true);
    });
  });

  describe('EventFilterBuilder', () => {
    it('should combine multiple filters', () => {
      const builder = EventFilterBuilder.create();
      builder.contractIds().include('CONTRACT_1');
      builder.eventTypes().isPetCreated();

      const filtered = builder.apply(mockEvents);
      expect(filtered.length).toBe(1);
      expect(filtered[0].contractId).toBe('CONTRACT_1');
      expect(filtered[0].type).toBe('PetCreated');
    });

    it('should apply pagination', () => {
      const builder = EventFilterBuilder.create();
      builder.paginate(1, 2);

      const filtered = builder.apply(mockEvents);
      expect(filtered.length).toBe(2);
    });

    it('should support custom where clauses', () => {
      const builder = EventFilterBuilder.create();
      builder.where((e) => e.data['amount'] !== undefined);

      const filtered = builder.apply(mockEvents);
      expect(filtered.length).toBe(1);
    });

    it('should build filter config', () => {
      const builder = EventFilterBuilder.create();
      builder.contractIds().include('CONTRACT_1');
      builder.eventTypes().isPetCreated();
      builder.paginate(1, 10);

      const config = builder.build();
      expect(config.contractIds).toBeDefined();
      expect(config.eventTypes).toBeDefined();
      expect(config.pagination).toEqual({ page: 1, limit: 10 });
    });

    it('should generate query params', () => {
      const builder = EventFilterBuilder.create();
      builder.paginate(2, 20);

      const params = builder.toQueryParams();
      expect(params.page).toBe('2');
      expect(params.limit).toBe('20');
    });
  });
});
