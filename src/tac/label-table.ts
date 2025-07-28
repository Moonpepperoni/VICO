export class LabelTable {
    private readonly mapping : Map<string, number>;

    constructor() {
        this.mapping = new Map();
    }

    getInstructionIdFromLabel(label: string) : number | undefined {
        return this.mapping.get(label);
    }

    addNewInstruction(label : string, instructionId : number) {
        this.mapping.set(label, instructionId);
    }
}

