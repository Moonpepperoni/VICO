import {DebugLine, type TacInstruction} from "./parser-types.ts";
import {LabelTable} from "./label-table.ts";
import {
    LabelAlreadyDefinedError,
    LabelNotDefinedError,
    TacCollectiveError,
    type TacError
} from "./tac-errors.ts";
import {TacParser} from "./parser.ts";

export function readProgramFromText(text : string) {
    return TacProgram.fromParsedInstructions(new TacParser(text).parseTac());
}

// for now this step only verifies that all labels are correct, but this can be changed in the future
function verifyTac(instructions: Map<number, TacInstruction>): {
    verifiedInstructions: Map<number, TacInstruction>,
    labelTable: LabelTable
} {
    const allErrors: Array<TacError> = [];
    const {table, errors: fillErrors} = fillLabelTable(instructions);
    allErrors.push(...fillErrors);
    allErrors.push(...verifyLabelUsage(instructions, table));
    if (allErrors.length !== 0) {
        throw new TacCollectiveError(...allErrors);
    }
    return {verifiedInstructions: instructions, labelTable: table};
}

function fillLabelTable(instructions: Map<number, TacInstruction>): {
    table: LabelTable,
    errors: Array<TacError>
} {
    const errors = [];
    const labelTable = new LabelTable();
    for (const [id, instruction] of instructions.entries()) {
        const label = instruction.label;
        if (label === undefined) continue;
        if (labelTable.getInstructionIdFromLabel(label) !== undefined) {
            errors.push(new LabelAlreadyDefinedError(label, instruction[DebugLine]));
            continue;
        }
        labelTable.addNewInstruction(label, id);
    }
    return {table: labelTable, errors};
}

function verifyLabelUsage(instructions: Map<number, TacInstruction>, labelTable: LabelTable): Array<TacError> {
    const errors = [];
    for (const instruction of instructions.values()) {
        switch (instruction.kind) {
            case "jump":
            case "ifFalse":
            case "ifWithOperator":
            case "ifSingleOperand": {
                const target = instruction.jumpLabel;
                if (labelTable.getInstructionIdFromLabel(target) === undefined) errors.push(new LabelNotDefinedError(target, instruction[DebugLine]));
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

    get instructions(): Array<[number,TacInstruction]> {
        return this.instructionOrder.map(i => [i, this.instructionLookupTable.get(i)!]);
    }

    get lastInstructionId() :  number {
        return this.instructionOrder.at(-1)!;
    }

    get firstInstructionId() : number {
        return this.instructionOrder[0];
    }

    get instructionIdsOrdered(): Array<number> {
        return this.instructionOrder;
    }

    get numberOfInstructions() : number {
        return this.instructionLookupTable.size;
    }

    getExplicitJumpTargetIds(instructionId : number) : Set<number> {
        const instruction = this.instructionLookupTable.get(instructionId)!;
        switch (instruction.kind) {
            case "ifFalse":
            case "jump":
            case "ifWithOperator":
            case "ifSingleOperand":
                return new Set([this.labelTable.getInstructionIdFromLabel(instruction.jumpLabel)!]);
        }
        return new Set();
    }

    getInstructionAfter(instructionId : number) : number | undefined {
        for (let i = 0; i < this.instructionOrder.length - 1 ; i++) {
            if (this.instructionOrder[i] === instructionId) return this.instructionOrder[i+1];
        }
        return undefined;
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

    getInstructionIdsExecutedAfter(instructionId : number) : Set<number> {
        const after = new Set<number>();
        const instruction = this.instructionLookupTable.get(instructionId);
        if (instruction === undefined) return after;
        const instructionIndex = this.instructionOrder.indexOf(instructionId);
        if (instruction.kind !== 'jump' && instructionIndex < this.numberOfInstructions - 1) after.add(instructionIndex+1);
        switch (instruction.kind) {
            case "jump":
            case "ifSingleOperand":
            case "ifWithOperator":
            case "ifFalse":
                after.add(this.labelTable.getInstructionIdFromLabel(instruction.jumpLabel)!);
                break;
        }
        return after;
    }

    getInstructionIdsRanging(from : number, to? : number) : Array<number> {
        return this.instructionIdsOrdered.slice(from, to);
    }

    instructionIsBefore(instructionId: number, otherId: number): boolean {
        const instructionIndex = this.instructionOrder.indexOf(instructionId);
        const otherIndex = this.instructionOrder.indexOf(otherId);
        if (instructionIndex === -1 || otherIndex === -1) return false;
        return instructionIndex < otherIndex;
    }

    reserveNextId(): number {
        return this.idGenerator();
    }
}

function countingGenerator(start: number) {
    return () => start++;
}

