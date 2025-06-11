import { produce } from "immer";

// edges are implicit
export default class FlowAnalyser {
    #verteces;
    #states;

    constructor() {
        this.#verteces = [];
        this.#states = [];
    }

    fillGraph(blocks) {
        for (let block of blocks) {
            this.#verteces.push({ block, data: { use: new Set(), def: new Set(), inSet: new Set(), outSet: new Set() } });
        }
    }

    do(blocks) {
        this.fillGraph(blocks);
        this.snapshot();
        for (let i = 0; i < this.#verteces.length; i++) {
            let v = this.#verteces[i];
            let { uses, defs } = getUsesAndDefsForBlock(v.block);
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
                let v = this.#verteces[i];
                let oldOut = v.data.outSet;
                let oldIn = v.data.inSet;
                console.log(oldIn);
                this.#verteces = produce(this.#verteces, (old) => {
                    let successors = old[i].block.targets;
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
        }
        return this.#states;
    }

    snapshot() {
        this.#states.push({ verteces: this.#verteces });
    }
}



function getUsesAndDefsForBlock(block) {
    let uses = new Set();
    let defs = new Set();
    
    for (let instruction of block.instructions) {
        // get uses
        switch (instruction.type) {
            case 'assign': {
                let { type: type1, val: val1 } = instruction.arg1;
                if (type1 === 'ident' && !defs.has(val1)) {
                    uses.add(val1);
                }
                if (!instruction.arg2) {
                    break;
                }
                let { type: type2, val: val2 } = instruction.arg2;
                if (type2 === 'ident' && !defs.has(val1)) {
                    uses.add(val2);
                }
                break;
            }
            case 'cjmp': {
                let { type: type1, val: val1 } = instruction.arg1;
                if (type1 === 'ident' && !defs.has(val1)) {
                    uses.add(val1);
                }
                if (!instruction.arg2) {
                    break;
                }
                let { type: type2, val: val2 } = instruction.arg2;
                if (type2 === 'ident' && !defs.has(val1)) {
                    uses.add(val2);
                }
            }
        }
        if (instruction.type === 'assign' && !uses.has(instruction.result.val)) {
            defs.add(instruction.result.val);
        }
    }

    return { uses, defs };
}

