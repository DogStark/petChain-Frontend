import {
  FIRST_NAMES,
  LAST_NAMES,
  PET_NAMES,
  CITIES,
  STREETS,
} from '../data/mock-data';

export class EntityFactory {
  static getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  static getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static generateEmail(firstName: string, lastName: string): string {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com'];
    const domain = this.getRandomElement(domains);
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${this.getRandomInt(1, 999)}@${domain}`;
  }

  static generatePhone(): string {
    return `+1-${this.getRandomInt(200, 999)}-${this.getRandomInt(200, 999)}-${this.getRandomInt(1000, 9999)}`;
  }

  static generateAddress(): string {
    return `${this.getRandomInt(100, 9999)} ${this.getRandomElement(STREETS)}, ${this.getRandomElement(CITIES)}`;
  }

  static generateDate(yearsBack: number = 0): Date {
    const date = new Date();
    date.setFullYear(date.getFullYear() - yearsBack);
    date.setMonth(this.getRandomInt(0, 11));
    date.setDate(this.getRandomInt(1, 28));
    return date;
  }
}
