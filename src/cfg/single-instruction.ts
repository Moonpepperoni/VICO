import type {ControlFlowGraph} from "./graph.ts";
import type {TacProgram} from "../tac/program.ts";
import type {TacInstruction} from "../tac/parser-types.ts";

/**
 * Special type of ControlFlowGraph that returns an Instruction-Array of exactly size 1 for each node
 *
 */
export class SingleInstructionGraph implements ControlFlowGraph {
    private readonly tacProgram: TacProgram;
    readonly entryId: number;
    readonly exitId: number;
    private readonly successors: Map<number, Set<number>>;
    private readonly predecessors: Map<number, Set<number>>;

    constructor(tacProgram: TacProgram) {
        this.tacProgram = tacProgram;
        this.entryId = tacProgram.reserveNextId();
        this.exitId = tacProgram.reserveNextId();
        this.successors = getSuccessorsFromInstructions(tacProgram, this.entryId, this.exitId);
        this.predecessors = getPredecessorsFromInstructions(tacProgram, this.entryId, this.exitId);
    }

    get nodeIds(): Array<number> {
        return [this.entryId, this.exitId, ...this.tacProgram.instructionIdsOrdered];
    }

    getNodeSuccessors(nodeId: number): Set<number> | undefined {
        return this.successors.get(nodeId);
    }

    getNodePredecessors(nodeId: number): Set<number> | undefined {
        return this.predecessors.get(nodeId);
    }

    getNodeInstructions(nodeId: number): Array<TacInstruction> {
        return this.tacProgram.instructions
            .filter(([id, ]) => id == nodeId)
            .map(([, instr]) => instr);
    }

    isBackEdge(from: number, to: number): boolean {
        // exit and entry can never part of a back edge
        if (from === this.exitId || to === this.exitId || from === this.entryId || to === this.entryId) return false;
        return this.tacProgram.instructionIsBefore(to, from);
    }
}

function getSuccessorsFromInstructions(tacProgram: TacProgram, entryId : number, exitId : number):  Map<number, Set<number>> {
    const successors = new Map();
    for (const instructionId of tacProgram.instructionIdsOrdered) {
        const executedAfter = tacProgram.getInstructionIdsExecutedAfter(instructionId);
        successors.set(instructionId, new Set<number>(executedAfter));
    }
    successors.set(entryId, new Set([tacProgram.firstInstructionId]));
    successors.set(tacProgram.lastInstructionId, new Set([exitId]));
    return successors;
}

function getPredecessorsFromInstructions(tacProgram : TacProgram, entryId : number, exitId : number) : Map<number, Set<number>> {
    const predecessors = new Map();
    for (const instructionId of tacProgram.instructionIdsOrdered) {
        if (instructionId === tacProgram.firstInstructionId) {
            predecessors.set(instructionId, new Set([entryId]));
            continue;
        }
        predecessors.set(instructionId, new Set());
    }

    predecessors.set(entryId, new Set());

    for (const instructionId of tacProgram.instructionIdsOrdered) {
        const after = tacProgram.getInstructionIdsExecutedAfter(instructionId);
        after.forEach(id => predecessors.get(id)?.add(instructionId));
    }

    const lastInstruction = tacProgram.lastInstructionId;
    predecessors.set(exitId, new Set([lastInstruction]));

    return predecessors;
}
