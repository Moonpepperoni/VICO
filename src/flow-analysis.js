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
        for (let v of this.#verteces) {
            let uses = getUsesForInstruction(v.instruction);
            let defs = getDefsForInstruction(v.instruction);
            uses.forEach(u => v.data.use.push(u));
            defs.forEach(u => v.data.def.push(u));
            this.snapshot();
        }
        return this.#states;
    }

    snapshot() {
        this.#states.push({ verteces: JSON.parse(JSON.stringify(this.#verteces)), edges: JSON.parse(JSON.stringify(this.#edges)) });
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

