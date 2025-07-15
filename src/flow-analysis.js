// TODO: Refactor this entirely
// We dont need to return verteces and all this blah, and we can also extract the use and def data completely
// then we can also build a simple in/out/use/def store that auto tracks looking and changing for displaying
// this also adds a nice seperation of concerns, where things happen automatically, and the flowanalyser now
// does not depend on the instructions directly making this very nice to, which was a previous concern
// finally we can add nice descriptions to everything, because the code will become much cleaner and easier to follow
export function* LivenessAnalysis(cfg) {
    // convert everything to reactive containers, for easier working// for perfomance we might find a way to use immer here, but not now
    let { uses, defs, edges, n } = cfg;
    uses = uses.map(s => new ReactiveContainer(s, compareLivenessSets));
    defs = defs.map(s => new ReactiveContainer(s, compareLivenessSets));
    let ins = [];
    let outs = [];
    for (let i = 0; i < n; i++) {
        ins.push(new ReactiveContainer([], compareLivenessSets));
        outs.push(new ReactiveContainer([], compareLivenessSets));
    }
    yield convertToLivenessReturn("set initial state of all in and out sets to the empty set", uses, defs, ins, outs, n);
    // now just for testing we add look at all use sets and push "a" to all out sets
    uses.forEach(s => s.state);
    outs.forEach(s => s.changeWith(new Set(["a"])));
    yield convertToLivenessReturn("look at all out sets and add 'a' to all out-Sets");
}



// refactor to use "dto" for displaying
function convertToLivenessReturn(reason, uses, defs, ins, outs, n) {
    let state = { reason, nodes: [] };
    for (let i = 0; i < n; i++) {
        let useSet = uses[i];
        let defSet = defs[i];
        let inSet = ins[i];
        let outSet = outs[i];
        let node = {
            useSet: {
                values: [...useSet.values()],
                lookedAt: useSet.lookedAt,
                changed: useSet.changed
            },
            defSet: {
                values: [...defSet.values()],
                lookedAt: defSet.lookedAt,
                changed: defSet.changed,
            },
            inSet: {
                values: [...inSet.values()],
                lookedAt: inSet.lookedAt,
                changed: inSet.changed,
            },
            outSet: {
                values: [...outSet.values()],
                lookedAt: outSet.lookedAt,
                changed: outSet.changed,
            }
        };
        state.nodes.push(node);
    }
    uses.forEach(set => set.reset());
    defs.forEach(set => set.reset());
    ins.forEach(set => set.reset());
    outs.forEach(set => set.reset());
    return state;
}

function getUsesAndDefsForSingleInstructions(blocks) {
    let defs = new Map();
    let uses = new Map();
    for (let block of blocks) {
        // this must exist, so accessing [0] is safe
        let instruction = block.instructions[0];
        let id = block.id;
        let useSet = new Set();
        let defSet = new Set();
        // get uses
        switch (instruction.type) {
            case 'assign': {
                let { type: type1, val: val1 } = instruction.arg1;
                if (type1 === 'ident') {
                    useSet.add(val1);
                }
                if (!instruction.arg2) {
                    break;
                }
                let { type: type2, val: val2 } = instruction.arg2;
                if (type2 === 'ident') {
                    useSet.add(val2);
                }
                break;
            }
            case 'cjmp': {
                let { type: type1, val: val1 } = instruction.arg1;
                if (type1 === 'ident') {
                    useSet.add(val1);
                }
                if (!instruction.arg2) {
                    break;
                }
                let { type: type2, val: val2 } = instruction.arg2;
                if (type2 === 'ident') {
                    useSet.add(val2);
                }
            }
        }
        if (instruction.type === 'assign') {
            defSet.add(instruction.result.val);
        }
        defs[id] = defSet;
        uses[id] = useSet;
    }

    return { uses, defs };
}


function getUsesAndDefsForBasicBlocks(blocks) {
    let defs = new Map();
    let uses = new Map();
    for (let block of blocks) {
        let id = block.id;
        let useSet = new Set();
        let defSet = new Set();
        // this must exist, so accessing [0] is safe
        for (let instruction of block.instructions) {
            // get uses
            switch (instruction.type) {
                case 'assign': {
                    let { type: type1, val: val1 } = instruction.arg1;
                    if (type1 === 'ident' && !defs.has(val1)) {
                        useSet.add(val1);
                    }
                    if (!instruction.arg2) {
                        break;
                    }
                    let { type: type2, val: val2 } = instruction.arg2;
                    if (type2 === 'ident' && !defs.has(val2)) {
                        useSet.add(val2);
                    }
                    break;
                }
                case 'cjmp': {
                    let { type: type1, val: val1 } = instruction.arg1;
                    if (type1 === 'ident' && !defs.has(val1)) {
                        useSet.add(val1);
                    }
                    if (!instruction.arg2) {
                        break;
                    }
                    let { type: type2, val: val2 } = instruction.arg2;
                    if (type2 === 'ident' && !defs.has(val2)) {
                        useSet.add(val2);
                    }
                }
            }
            if (instruction.type === 'assign' && !uses.has(instruction.result.val)) {
                defSet.add(instruction.result.val);
            }
        }

        defs[id] = defSet;
        uses[id] = useSet;
    }

    return { uses, defs };
}

function compareLivenessSets(s1, s2) {
    return s1.size == s2.size && [...s1].every((x) => s2.has(x));
}

class ReactiveContainer {
    #state;
    #lookedAt;
    #changed;
    #compareFunc;

    constructor(initialState, compareFunc) {
        this.#state = new Set(initialState);
        this.#compareFunc = compareFunc;
    }


    changeWith(changeFunc) {
        let prev = new Set(this.#state);
        this.#state = changeFunc(this.#state);
        if (this.#compareFunc(prev, this.#state)) {
            this.#changed = true;
        }
    }

    get state() {
        this.#lookedAt = true;
        return new Set(this.#state);
    }

    get values() {
        return new Set(this.#state);
    }

    get lookedAt() {
        return this.#lookedAt;
    }

    get changed() {
        return this.#changed;
    }

    reset() {
        this.#changed = false;
        this.#lookedAt = false;
    }
}
