import {DebugLine, type TacInstruction} from "./parser-types.ts";
import {LabelTable} from "./label-table.ts";


// for now this step only verifies that all labels are correct, but this can be changed in the future
function verifyTac(instructions: Map<number, TacInstruction>): {
    verifiedInstructions: Map<number, TacInstruction>,
    labelTable: LabelTable
} {
    const allErrors: Array<ProgramVerificationError> = [];
    const {table, errors: fillErrors} = fillLabelTable(instructions);
    allErrors.push(...fillErrors);
    allErrors.push(...verifyLabelUsage(instructions, table));
    if (allErrors.length !== 0) {
        throw new ProgramCollectiveError(...allErrors);
    }
    return {verifiedInstructions: instructions, labelTable: table};
}

function fillLabelTable(instructions: Map<number, TacInstruction>): {
    table: LabelTable,
    errors: Array<ProgramVerificationError>
} {
    const errors = [];
    const labelTable = new LabelTable();
    for (const [id, instruction] of instructions.entries()) {
        const label = instruction.label;
        if (label === undefined) continue;
        if (labelTable.getInstructionIdFromLabel(label) !== undefined) {
            errors.push(new LabelAlreadyDefinedError(label, instruction));
            continue;
        }
        labelTable.addNewInstruction(label, id);
    }
    return {table: labelTable, errors};
}

function verifyLabelUsage(instructions: Map<number, TacInstruction>, labelTable: LabelTable): Array<ProgramVerificationError> {
    const errors = [];
    for (const instruction of instructions.values()) {
        switch (instruction.kind) {
            case "jump":
            case "ifFalse":
            case "ifWithOperator":
            case "ifSingleOperand": {
                const target = instruction.jumpLabel;
                if (labelTable.getInstructionIdFromLabel(target) === undefined) errors.push(new LabelNotDefinedError(target, instruction));
                break;
            }
        }
    }
    return errors;
}

/**
 * TacProgram gets parsed instructions and verifies that the program is semantically valid and then represents a valid program from there on out
 */
export class TacProgram {

    // id in the lookupTable
    private readonly instructionOrder: Array<number>;
    private readonly labelTable: LabelTable;
    private readonly instructionLookupTable: Map<number, TacInstruction>;
    private readonly idGenerator: () => number;

    private constructor(instructionLookuptable: Map<number, TacInstruction>, instructionOrder: Array<number>, labelTable: LabelTable, idGenerator: () => number) {
        this.labelTable = labelTable;
        this.instructionOrder = instructionOrder;
        this.instructionLookupTable = instructionLookuptable;
        this.idGenerator = idGenerator;
    }

    get instructions(): Array<TacInstruction> {
        return this.instructionOrder.map(i => this.instructionLookupTable.get(i)!);
    }

    get instructionIds(): Array<number> {
        return this.instructionOrder;
    }

    static fromParsedInstructions(instructions: Array<TacInstruction>, idGenerator = countingGenerator(0)): TacProgram {
        const lookupTable = new Map<number, TacInstruction>();
        const instructionOrder = [];
        for (const instr of instructions) {
            const newId = idGenerator();
            lookupTable.set(newId, instr);
            instructionOrder.push(newId);
        }
        const {verifiedInstructions, labelTable} = verifyTac(lookupTable);
        return new TacProgram(verifiedInstructions, instructionOrder, labelTable, idGenerator);
    }

    getInstructionById(instructionId: number): TacInstruction | undefined {
        return this.instructionLookupTable.get(instructionId);
    }

    getInstructionByLabel(label: string): TacInstruction | undefined {
        const id = this.labelTable.getInstructionIdFromLabel(label);
        return this.instructionLookupTable.get(id!);
    }

    getInstructionIdByLabel(label: string): number | undefined {
        return this.labelTable.getInstructionIdFromLabel(label);
    }

    instructionIsBefore(instructionId: number, otherId: number): boolean {
        const instructionIndex = this.instructionOrder.indexOf(instructionId);
        const otherIndex = this.instructionOrder.indexOf(otherId);
        if (instructionIndex === -1 || otherIndex === -1) return false;
        return instructionId < otherIndex;
    }

    reserveNextId(): number {
        return this.idGenerator();
    }
}

function countingGenerator(start: number) {
    return () => start++;
}

export class ProgramCollectiveError extends Error {
    readonly errors: Array<ProgramVerificationError>;

    constructor(...errors: Array<ProgramVerificationError>) {
        super(`the submitted program is not valid, found ${errors.length} problem${errors.length > 1 ? 's' : ''}:
${errors.map(v => v.message).join('\n')}`);
        this.errors = errors;
    }

}

export class ProgramVerificationError extends Error {
    constructor(message: string, instruction: TacInstruction) {
        super(`error on line ${instruction[DebugLine]}: ${message}`);
        this.name = "ProgramVerificationError"
    }
}

export class LabelNotDefinedError extends ProgramVerificationError {
    constructor(label: string, instruction: TacInstruction) {
        super(`the label ${label} is never defined`, instruction);
        this.name = "LabelNotDefinedError";
    }
}

export class LabelAlreadyDefinedError extends ProgramVerificationError {
    constructor(label: string, instruction: TacInstruction) {
        super(`the label ${label} is already defined`, instruction);
        this.name = "LabelDefinedMultipleTimes";
    }
}