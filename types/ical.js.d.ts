declare module 'ical.js' {
  export class Component {
    constructor(jCal: unknown);
    static fromString(data: string): Component;
    getFirstPropertyValue(name: string): unknown;
    getAllSubcomponents(name?: string): Component[];
    getFirstSubcomponent(name: string): Component | null;
  }

  export class Event {
    constructor(component: Component, options?: { strictExceptions?: boolean });
    uid: string;
    summary: string;
    description: string;
    location: string;
    startDate: Time;
    endDate: Time;
    duration: Duration;
    isRecurring(): boolean;
    iterator(startTime?: Time): RecurExpansion;
    sequence: number;
  }

  export class Time {
    constructor(data?: {
      year: number;
      month: number;
      day: number;
      hour?: number;
      minute?: number;
      second?: number;
      isDate?: boolean;
    });
    toJSDate(): Date;
    isDate: boolean;
    zone: Timezone | null;
    static fromJSDate(date: Date, useUTC?: boolean): Time;
    static now(): Time;
  }

  export class Duration {
    toSeconds(): number;
  }

  export class Timezone {
    static localTimezone: Timezone;
    tzid: string;
    constructor(data: Component | unknown);
  }

  export class TimezoneService {
    static get(tzid: string): Timezone | null;
    static register(tzid: string, zone: Timezone): void;
    static has(tzid: string): boolean;
  }

  export class RecurExpansion {
    next(): Time | null;
  }

  export function parse(input: string): unknown;
}
