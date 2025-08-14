import { describe, test, expect, beforeEach } from 'vitest';
import { GeneratorCache } from './cache';

describe('GeneratorCache', () => {
    describe('Konstruktor und Initialisierung', () => {
        test('sollte einen Cache mit Generator erstellen', () => {
            function* generator() {
                yield 1;
                yield 2;
                yield 3;
            }

            const cache = new GeneratorCache(generator(), 2);
            expect(cache.usableCacheSize).toBe(2);
            expect(cache.currentValue()).toBeUndefined();
        });

        test('sollte einen Cache mit Iterable erstellen', () => {
            const iterable = [1, 2, 3, 4, 5];
            const cache = new GeneratorCache(iterable, 3);
            expect(cache.usableCacheSize).toBe(3);
            expect(cache.currentValue()).toBeUndefined();
        });

        test('sollte die Cache-Größe auf mindestens 1 setzen', () => {
            const iterable = [1, 2, 3];
            const cache = new GeneratorCache(iterable, -1);
            expect(cache.usableCacheSize).toBe(1);
        });

        test('sollte mit einem leeren Generator umgehen können', () => {
            function* emptyGenerator() {
                // Keine Werte
            }

            const cache = new GeneratorCache(emptyGenerator(), 2);
            expect(cache.usableCacheSize).toBe(0);
            expect(cache.hasNext()).toBe(false);
            expect(cache.hasPrevious()).toBe(false);
        });

        test('sollte mit einem Generator mit weniger Werten als die Cache-Größe umgehen können', () => {
            function* smallGenerator() {
                yield 1;
                yield 2;
            }

            const cache = new GeneratorCache(smallGenerator(), 5);
            expect(cache.usableCacheSize).toBe(2);
        });
    });

    describe('Navigation', () => {
        let cache: GeneratorCache<number>;

        beforeEach(() => {
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            cache = new GeneratorCache(data, 3);
        });

        test('sollte currentValue undefined zurückgeben, wenn kein Wert geladen wurde', () => {
            expect(cache.currentValue()).toBeUndefined();
        });

        test('sollte mit next() vorwärts navigieren', () => {
            cache.next();
            expect(cache.currentValue()).toBe(1);
            cache.next();
            expect(cache.currentValue()).toBe(2);
            cache.next();
            expect(cache.currentValue()).toBe(3);
        });

        test('sollte mit previous() rückwärts navigieren', () => {
            cache.next(); // 1
            cache.next(); // 2
            cache.next(); // 3

            cache.previous();
            expect(cache.currentValue()).toBe(2);
            cache.previous();
            expect(cache.currentValue()).toBe(1);
        });

        test('sollte nicht hinter den Anfang zurückgehen können', () => {
            cache.next(); // 1
            cache.previous(); // Sollte nichts ändern
            expect(cache.currentValue()).toBe(1);
            expect(cache.hasPrevious()).toBe(false);
        });

        test('sollte korrekt erkennen, ob ein nächster Wert verfügbar ist', () => {
            expect(cache.hasNext()).toBe(true);

            // Navigiere durch alle Werte
            for (let i = 0; i < 10; i++) {
                cache.next();
            }

            expect(cache.currentValue()).toBe(10);
            expect(cache.hasNext()).toBe(false);
        });

        test('sollte korrekt erkennen, ob ein vorheriger Wert verfügbar ist', () => {
            expect(cache.hasPrevious()).toBe(false);

            cache.next(); // 1
            expect(cache.hasPrevious()).toBe(false);

            cache.next(); // 2
            expect(cache.hasPrevious()).toBe(true);
        });
    });

    describe('Cache-Fenster', () => {
        test('sollte das Cache-Fenster korrekt verschieben', () => {
            const data = [1, 2, 3, 4, 5, 6, 7, 8];
            const cache = new GeneratorCache(data, 3);

            // Navigiere bis zum Ende des sichtbaren Cache-Fensters
            cache.next(); // 1
            cache.next(); // 2
            cache.next(); // 3

            // Das nächste next() sollte das Fenster verschieben
            cache.next();
            expect(cache.currentValue()).toBe(4);

            // Der erste Wert (1) sollte nicht mehr im Cache sein
            cache.previous();
            cache.previous();
            cache.previous();
            expect(cache.currentValue()).toBe(2);
        });

        test('sollte bei Erreichen des Generator-Endes undefined ausgeben', () => {
            const data = [1, 2, 3, 4, 5];
            const cache = new GeneratorCache(data, 3);

            // Navigiere durch alle Werte
            for (let i = 0; i < 6; i++) {
                cache.next();
            }

            expect(cache.currentValue()).toBeUndefined();
            expect(cache.hasNext()).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('sollte mit großen Datenmengen umgehen können', () => {
            function* largeGenerator() {
                for (let i = 0; i < 1000; i++) {
                    yield i;
                }
            }

            const cache = new GeneratorCache(largeGenerator(), 5);

            // Navigiere durch viele Werte
            for (let i = 0; i < 100; i++) {
                cache.next();
            }

            expect(cache.currentValue()).toBe(99);
            expect(cache.hasNext()).toBe(true);

            // Prüfe, ob Zurücknavigation funktioniert
            for (let i = 0; i < 3; i++) {
                cache.previous();
            }

            expect(cache.currentValue()).toBe(96);
        });

        test('sollte mit einem 1-Element-Cache umgehen können', () => {
            const data = [1, 2, 3, 4, 5];
            const cache = new GeneratorCache(data, 1);

            cache.next();
            expect(cache.currentValue()).toBe(1);

            cache.next();
            expect(cache.currentValue()).toBe(2);
            expect(cache.hasPrevious()).toBe(false);
        });

        test('sollte mit nicht-numerischen Werten umgehen können', () => {
            const data = ['a', 'b', 'c', 'd'];
            const cache = new GeneratorCache(data, 2);

            cache.next();
            expect(cache.currentValue()).toBe('a');

            cache.next();
            expect(cache.currentValue()).toBe('b');

            cache.next();
            expect(cache.currentValue()).toBe('c');
        });

        test('sollte mit Objekten als Generator-Werte umgehen können', () => {
            const data = [
                { id: 1, name: 'Eins' },
                { id: 2, name: 'Zwei' },
                { id: 3, name: 'Drei' }
            ];

            const cache = new GeneratorCache(data, 2);

            cache.next();
            expect(cache.currentValue()).toEqual({ id: 1, name: 'Eins' });

            cache.next();
            expect(cache.currentValue()).toEqual({ id: 2, name: 'Zwei' });
        });
    });
});