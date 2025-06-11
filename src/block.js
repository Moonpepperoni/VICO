export class SingleInstructionBlock {
    instruction;
    #targets;

    constructor (instruction) {
        this.instruction = instruction;
    }

    static fromInstruction(quadruple) {
        return new SingleInstructionBlock(quadruple);
    }

    get instructions() {
        return [this.instruction];
    }

    get id() {
        return this.instruction.id;
    }

    get targets() {
        if (this.#targets !== undefined) {
            return this.#targets;
        }
        this.#targets = [];
        if (this.instruction.type === 'cjmp' || this.instruction.type === 'jmp') {
            this.#targets.push(this.instruction.result.val);
        }
        if (this.instruction.type !== 'jmp') {
            this.#targets.push(this.id + 1);
        }
        return this.#targets;
    }
}