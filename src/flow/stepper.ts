/**
 * Eine Klasse, die als Cache für Generatoren dient und Windowing ermöglicht.
 * Der Cache speichert bis zu `cacheSize` aufeinanderfolgende Werte des Generators.
 * Intern wird immer ein Wert im Voraus geladen, was aber nach außen transparent ist.
 */
export class GeneratorStepper<T> {
    private generator: Iterator<T>;
    private readonly cache: T[] = [];
    private isGeneratorDone: boolean;
    // this is always one larger than the actual cache size to hold a proxy value
    private readonly cacheSize: number;
    private currentIndex : number;
    readonly usableCacheSize : number;

    /**
     * Erstellt einen neuen Generator-Cache.
     * @param generator Der Generator oder Iterable, dessen Werte gecacht werden sollen
     * @param wantedCacheSize Maximale Größe des Caches (sichtbar für den Benutzer)
     */
    constructor(generator: Iterator<T> | Iterable<T>, wantedCacheSize: number) {
        if (Symbol.iterator in Object(generator)) {
            this.generator = (generator as Iterable<T>)[Symbol.iterator]();
        } else {
            this.generator = generator as Iterator<T>;
        }

        const realCacheSize = Math.max(1, wantedCacheSize) + 1;
        this.cache = [];
        this.isGeneratorDone = false;
        let i = 0;
        for (; i < realCacheSize; i++) {
            const next = this.generator.next();
            if (!next.done) {
                this.cache.push(next.value);
            } else {
                this.isGeneratorDone = true;
                break;
            }
        }
        // update wantedCacheSize to the number of loop values
        this.cacheSize = i;
        this.usableCacheSize = Math.min(i, Math.max(wantedCacheSize, 1));
        this.currentIndex = 0;
    }

    currentValue(): T | undefined {
        if (this.currentIndex >= this.cacheSize) return undefined;
        return this.cache[this.currentIndex];
    }

    hasNext(): boolean {
        return this.currentIndex < this.cacheSize - 1 || (this.currentIndex == this.cacheSize - 1 && !this.isGeneratorDone);
    }

    hasPrevious(): boolean {
        return this.currentIndex > 0;
    }

    next(): void {
        if (this.currentIndex >= this.cacheSize) {
            return;
        } else if (this.currentIndex < this.usableCacheSize - 1) {
            this.currentIndex++;
        } else if (this.currentIndex == this.usableCacheSize - 1 && !this.isGeneratorDone) {
            const advanced = this.advanceCacheWindow();
            if (!advanced) this.currentIndex++;
        } else if (this.currentIndex == this.usableCacheSize - 1 && this.isGeneratorDone) {
            this.currentIndex++;
        } else {
            this.currentIndex++;
        }
    }

    previous(): void {
        if (this.currentIndex > 0) {
            this.currentIndex--;
        }
    }

    private advanceCacheWindow() : boolean {
        const next = this.generator.next();
        if (!next.done) {
            this.cache.push(next.value);
            this.cache.shift();
            return true;
        } else {
            this.isGeneratorDone = true;
            return false;
        }
    }
}