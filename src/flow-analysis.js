import { produce } from "immer";

export default class FlowAnalyser {
    #verteces;
    #edges;
    #states;

    constructor() {
        this.#edges = [];
        this.#verteces = [];
        this.#states = [];
    }

    fillGraph(tac) {
        for (let instruction of tac) {
            this.#verteces.push({ instruction, data: { use: new Set(), def: new Set(), inSet: new Set(), outSet: new Set() } });
            switch (instruction.type) {
                case 'jmp':
                    this.#edges.push({ src: instruction.id, end: instruction.result.val });
                    break;
                case 'cjmp':
                    this.#edges.push({ src: instruction.id, end: instruction.result.val })
                // eslint-disable-next-line no-fallthrough
                default:
                    // TODO: remove jump for last instruction
                    this.#edges.push({ src: instruction.id, end: instruction.id + 1 })
            }
        }
    }

    // i want to die XO
    do(tac) {
        this.fillGraph(tac);
        this.snapshot();
        for (let i = 0; i < this.#verteces.length; i++) {
            let v = this.#verteces[i];
            let uses = getUsesForInstruction(v.instruction);
            let defs = getDefsForInstruction(v.instruction);
            this.#verteces = produce(this.#verteces, (old) => {
                uses.forEach(u => {
                    old[i].data.use.add(u);
                });
                defs.forEach(d => {
                    old[i].data.def.add(d);
                });
            });
            this.snapshot();
        }

        let changed = true;
        while (changed) {
            console.log(0);
            changed = false;
            for (let i = this.#verteces.length - 1; i >= 0; i--) {
                console.log('looking at vertex ' + i);
                let v = this.#verteces[i];
                let oldOut = v.data.outSet;
                let oldIn = v.data.inSet;
                console.log(oldIn);
                this.#verteces = produce(this.#verteces, (old) => {
                    console.log('1');
                    console.log('2');
                    let successors = getSuccessors(this.#edges, old[i]);
                    for (let succ of successors) {
                        // careful last will still have jump to next instruction but there is none
                        let inSetSucc = old[succ]?.data.inSet;
                        inSetSucc?.forEach(elem => old[i].data.outSet.add(elem));
                    }
                    let diff = new Set([...old[i].data.outSet].filter(x => !old[i].data.def.has(x)));
                    let union = new Set([...diff, ...old[i].data.use]);
                    union.forEach(e => old[i].data.inSet.add(e));
                });
                v = this.#verteces[i];
                console.log(5);
                if (v.data.outSet.size != oldOut.size || v.data.inSet.size != oldIn.size) changed = true;
                console.log(6);
            }
            this.snapshot();
            console.log(7);
        }
        return this.#states;
    }

    snapshot() {
        this.#states.push({ verteces: this.#verteces, edges: this.#edges });
    }
}

function getSuccessors(edges, v) {
    let filtered = edges.filter(({ src }) => {
        return src === v.instruction.id;
    });
    return filtered.map(({ end }) => end);
}

function getUsesForInstruction(instr) {
    let uses = [];
    switch (instr.type) {
        case 'assign': {
            let { type: type1, val: val1 } = instr.arg1;
            if (type1 === 'ident') {
                uses.push(val1);
            }
            if (!instr.arg2) {
                break;
            }
            let { type: type2, val: val2 } = instr.arg2;
            if (type2 === 'ident') {
                uses.push(val2);
            }
            break;
        }
        case 'cjmp': {
            let { type: type1, val: val1 } = instr.arg1;
            if (type1 === 'ident') {
                uses.push(val1);
            }
            if (!instr.arg2) {
                break;
            }
            let { type: type2, val: val2 } = instr.arg2;
            if (type2 === 'ident') {
                uses.push(val2);
            }
        }
    }
    return uses;
}

function getDefsForInstruction(instr) {
    if (instr.type === 'assign') {
        return [instr.result.val];
    }
    return [];
}

