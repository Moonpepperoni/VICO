export class FlowObserveStore<T> {
    private innerMapping : Map<number,T>;
    private readonly comparator : (val1: T, val2 : T) => boolean;
    private lookedAt : Set<number>;
    private changed : Set<number>;

    constructor(mapping : Map<number,T>, comparator : (val1 : T, val2 : T) => boolean) {
        this.innerMapping = new Map(mapping);
        this.comparator = comparator;
        this.lookedAt = new Set<number>();
        this.changed = new Set<number>();
    }

    getValue(id : number) : T | undefined {
        if (!this.innerMapping.has(id)) return undefined;
        this.lookedAt.add(id);
        return this.innerMapping.get(id);
    }

    getValueRaw(id :number) : T | undefined {
        if (!this.innerMapping.has(id)) return undefined;
        return this.innerMapping.get(id);
    }

    changeWith(id: number, f : (prev: T) => T) {
        const old = this.innerMapping.get(id)!;
        const newValue = f(old);
        // something changed
        if (!this.comparator(old, newValue)) this.changed.add(id);
        this.innerMapping.set(id, newValue);
    }

    hasChanged(id : number) : boolean {
        return this.changed.has(id);
    }

    wasLookedAt(id : number) : boolean {
        return this.lookedAt.has(id);
    }

    resetObserve() {
        this.resetChanged();
        this.resetLookedAt();
    }

    resetChanged() {
        this.changed.clear();
    }

    resetLookedAt() {
        this.lookedAt.clear();
    }

}
