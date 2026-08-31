export type EventPredicate = (eventType: string) => boolean;

export class EventTypePredicate {
  private predicates: EventPredicate[] = [];

  static create(): EventTypePredicate {
    return new EventTypePredicate();
  }

  equals(eventType: string): this {
    this.predicates.push((type) => type === eventType);
    return this;
  }

  equalsAny(...eventTypes: string[]): this {
    const typeSet = new Set(eventTypes);
    this.predicates.push((type) => typeSet.has(type));
    return this;
  }

  notEquals(eventType: string): this {
    this.predicates.push((type) => type !== eventType);
    return this;
  }

  startsWith(prefix: string): this {
    this.predicates.push((type) => type.startsWith(prefix));
    return this;
  }

  endsWith(suffix: string): this {
    this.predicates.push((type) => type.endsWith(suffix));
    return this;
  }

  includes(substring: string): this {
    this.predicates.push((type) => type.includes(substring));
    return this;
  }

  matches(regex: RegExp): this {
    this.predicates.push((type) => regex.test(type));
    return this;
  }

  isPetCreated(): this {
    return this.equals('PetCreated');
  }

  isPetUpdated(): this {
    return this.equals('PetUpdated');
  }

  isPetStatusChanged(): this {
    return this.equalsAny('PetCreated', 'PetUpdated', 'PetStatusChanged');
  }

  isWalletCreated(): this {
    return this.equals('WalletCreated');
  }

  isTransactionCompleted(): this {
    return this.equals('TransactionCompleted');
  }

  isTransactionFailed(): this {
    return this.equals('TransactionFailed');
  }

  isTransactionEvent(): this {
    return this.startsWith('Transaction');
  }

  isSecurityEvent(): this {
    return this.startsWith('Security');
  }

  isBackupEvent(): this {
    return this.startsWith('Backup');
  }

  isVaccinationEvent(): this {
    return this.startsWith('Vaccination');
  }

  isAppointmentEvent(): this {
    return this.startsWith('Appointment');
  }

  isClinicEvent(): this {
    return this.startsWith('Clinic');
  }

  not(predicate: EventPredicate): this {
    this.predicates.push((type) => !predicate(type));
    return this;
  }

  combine(predicates: EventPredicate[], mode: 'and' | 'or' = 'and'): this {
    if (mode === 'and') {
      this.predicates.push((type) => predicates.every((p) => p(type)));
    } else {
      this.predicates.push((type) => predicates.some((p) => p(type)));
    }
    return this;
  }

  build(): EventPredicate {
    return (eventType: string) => {
      if (this.predicates.length === 0) return true;
      return this.predicates.every((predicate) => predicate(eventType));
    };
  }

  apply<T extends { type: string }>(items: T[]): T[] {
    const predicate = this.build();
    return items.filter((item) => predicate(item.type));
  }
}
