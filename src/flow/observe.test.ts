import {expect, test } from "vitest";
import {FlowObserveStore} from "./observe.ts";
import {enableMapSet, produce} from "immer";

// required for using immer in testing
enableMapSet();

const StringSetComparator = (s1 : Set<string>, s2 : Set<string>) : boolean => {
    return s1.size == s2.size && [...s1].every(value => s2.has(value));
}

const StringSetObserver = () => {
    const stringSets = new Map();
    stringSets.set(0, new Set(["Jens", "Jan"]));
    stringSets.set(1, new Set(['Markus', 'Christian']));
    return new FlowObserveStore(stringSets, StringSetComparator);
}

const StringMapComparator = (m1 : Map<string, string>, m2 : Map<string, string>) : boolean => {
    return m1.size == m2.size && [...m1.entries()].every(([k, v]) => m2.has(k) && m2.get(k)! === v);
}

const StringMapObserver = () => {
    const stringMaps = new Map();
    stringMaps.set(0, new Map([["Jens", "Jan"], ["Christian", "Martin"]]));
    stringMaps.set(1, new Map([['Markus', 'Christian']]));
    return new FlowObserveStore<Map<string, string>>(stringMaps, StringMapComparator);
}

test('should detect that an inner set is looked at', () => {
    const setObserver = StringSetObserver();
    setObserver.getValue(1);
    expect(setObserver.wasLookedAt(1)).toBe(true);
})

test('should detect that an inner set is not looked at', () => {
    const setObserver = StringSetObserver();
    setObserver.getValue(1);
    expect(setObserver.wasLookedAt(0)).toBe(false);
})

test('should retrieve the inner value correctly', () => {
    const setObserver = StringSetObserver();
    const innerValue = setObserver.getValue(0)!;
    expect(innerValue).toContain("Jens");
    expect(innerValue).toContain("Jan");
})

test('should change the inner value correctly', () => {
    const setObserver = StringSetObserver();
    setObserver.changeWith(0, (prev) => {
        return produce(prev, (newSet) => {
            newSet.add("Martin");
        })
    });
    expect(setObserver.getValue(0)).toContain("Martin");
})

test('should track changing of the inner value correctly', () => {
    const setObserver = StringSetObserver();
    setObserver.changeWith(0, (prev) => {
        return produce(prev, (newSet) => {
            newSet.add("Martin");
        })
    });
    expect(setObserver.hasChanged(0)).toBe(true);
})

test('should not return hasChanged for inner values that are not targeted by changeWith', () => {
    const setObserver = StringSetObserver();
    setObserver.changeWith(0, (prev) => {
        return produce(prev, (newSet) => {
            newSet.add("Martin");
        })
    });
    expect(setObserver.hasChanged(1)).toBe(false);
})

test('should not return hasChanged for a set that has not changed', () => {
    const setObserver = StringSetObserver();
    setObserver.changeWith(0, (prev) => {
        return prev;
    });
    expect(setObserver.hasChanged(0)).toBe(false);
})

test('should not return hasChanged for a set that has not changed', () => {
    const setObserver = StringSetObserver();
    setObserver.changeWith(0, (prev) => {
        return produce(prev, (newSet) => {
            newSet.add("Agathe");
        })
    });
    expect(setObserver.hasChanged(0)).toBe(false);
});

test('should reset hasChanged after change and resetting the change state', () => {
    const setObserver = StringSetObserver();
    setObserver.changeWith(0, (prev) => {
        return produce(prev, (newSet) => {
            newSet.add("Agathe");
        })
    });
    setObserver.resetChanged();
    expect(setObserver.hasChanged(0)).toBe(false);
});

test('should reset lookedAt after looking and resetting the lookedAt state', () => {
    const setObserver = StringSetObserver();
    setObserver.getValue(0);
    setObserver.resetLookedAt();
    expect(setObserver.wasLookedAt(0)).toBe(false);
});

test('should reset lookedAt after looking and resetting the observe state', () => {
    const setObserver = StringSetObserver();
    setObserver.getValue(0);
    setObserver.resetObserve();
    expect(setObserver.wasLookedAt(0)).toBe(false);
});

test('should reset hasChanged after change and resetting the observe state', () => {
    const setObserver = StringSetObserver();
    setObserver.changeWith(0, (prev) => {
        const newSet = new Set(prev);
        newSet.add("Marting");
        return newSet;
    });
    setObserver.resetObserve();
    expect(setObserver.hasChanged(0)).toBe(false);
});

test('should detect changes after insert into map', () => {
    const mapObserver = StringMapObserver();
    mapObserver.changeWith(0, (prev) => {
        return produce(prev, (newValue) => {
            newValue.set("Tino", "Mino");
        });
    });
    expect(mapObserver.hasChanged(0)).toBe(true);
});



