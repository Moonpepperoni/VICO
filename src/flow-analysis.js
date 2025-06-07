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
            this.#verteces.push({ instruction, data: { use: [], def: [], liveIn: [], liveOut: [] } });
            switch (instruction.type) {
                case 'jmp':
                    this.#edges.push({ src: instruction.label, end: instruction.result.val });
                    break;
                case 'cjmp':
                    this.#edges.push({ src: instruction.label, end: instruction.result.val })
                // eslint-disable-next-line no-fallthrough
                default:
                    this.#edges.push({ src: instruction.label, end: instruction.label + 1 })
            }
        }
    }

    do(tac) {
        this.fillGraph(tac);
        this.snapshot();
        for (let i = 0; i < this.#verteces.length; i++) {
            let v = this.#verteces[i];
            let uses = getUsesForInstruction(v.instruction);
            let defs = getDefsForInstruction(v.instruction);
            this.#verteces = produce(this.#verteces, (old) => {
                uses.forEach(u => {
                    old[i].data.use.push(u);
                });
                defs.forEach(d => {
                    old[i].data.def.push(d);
                });
            });
            this.snapshot();
        }
        return this.#states;
    }

    snapshot() {
        this.#states.push({ verteces: this.#verteces, edges: this.#edges });
    }
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

