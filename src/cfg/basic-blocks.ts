import type {ControlFlowGraph} from "./graph.ts";
import type {TacProgram} from "../tac/program.ts";
import type {TacInstruction} from "../tac/parser-types.ts";

function getSuccessorsFromInstructions(basicBlocks: Map<number, BasicBlock>, tacProgram: TacProgram, entryId: number, exitId: number): Map<number, Set<number>> {
    const successors = new Map<number, Set<number>>();
    // first instruction ID is also the first basic block id
    successors.set(entryId, new Set([tacProgram.firstInstructionId]));
    for (const [id, block] of basicBlocks) {
        const after = tacProgram.getInstructionIdsExecutedAfter(block.lastInstruction);
        const newSet = new Set(after);
        // lastInstruction leaves to exit block
        if (block.lastInstruction == tacProgram.lastInstructionId) {
            newSet.add(exitId);
        }
        successors.set(id, newSet);
    }
    return successors;
}

function getPredecessorsFromInstructions(basicBlocks: Map<number, BasicBlock>, tacProgram: TacProgram, entryId: number, exitId: number): Map<number, Set<number>> {
    const predecessors = new Map<number, Set<number>>();
    for (const basicBlockId of basicBlocks.keys()) {
        predecessors.set(basicBlockId, new Set());
    }

    // first InstructionId is also the first basic block id
    predecessors.set(tacProgram.firstInstructionId, new Set([entryId]));

    for (const [id, block] of basicBlocks) {
        const after = tacProgram.getInstructionIdsExecutedAfter(block.lastInstruction);
        after.forEach(afterId => predecessors.get(afterId)?.add(id));
    }

    // exit has last BasicBlock as predecessor
    const [lastBlockId] = [...basicBlocks].filter(([, b]) => b.lastInstruction === tacProgram.lastInstructionId)[0];
    predecessors.set(exitId, new Set([lastBlockId]));

    return predecessors;
}

/**
 * Basic Block Control Flow Graph
 *
 */
export class BasicBlockControlFlowGraph implements ControlFlowGraph {
    readonly entryId: number;
    readonly exitId: number;
    private readonly tacProgram: TacProgram;
    private readonly successors: Map<number, Set<number>>;
    private readonly predecessors: Map<number, Set<number>>;
    private readonly basicBlocks: Map<number, BasicBlock>;

    constructor(tacProgram: TacProgram) {
        this.tacProgram = tacProgram;
        this.entryId = tacProgram.reserveNextId();
        this.exitId = tacProgram.reserveNextId();
        this.basicBlocks = getBasicBlocks(tacProgram);
        this.successors = getSuccessorsFromInstructions(this.basicBlocks, tacProgram, this.entryId, this.exitId);
        this.predecessors = getPredecessorsFromInstructions(this.basicBlocks, tacProgram, this.entryId, this.exitId);
    }

    get nodeIds(): Array<number> {
        return [this.entryId, this.exitId, ...[...this.basicBlocks.values()].map(b => b.blockLeader)];
    }

    get dataNodeIds(): Array<number> {
        return [...this.basicBlocks.keys()];
    }

    getNodeSuccessors(nodeId: number): Set<number> | undefined {
        return this.successors.get(nodeId);
    }

    getNodePredecessors(nodeId: number): Set<number> | undefined {
        return this.predecessors.get(nodeId);
    }

    getAllSuccessors() : Map<number, Set<number>> {
        return this.successors;
    }

    getAllPredecessors() : Map<number, Set<number>> {
        return this.predecessors;
    }

    getNodeInstructions(nodeId: number): Map<number, TacInstruction> {
        const block = this.basicBlocks.get(nodeId);
        if (block === undefined) return new Map();
        return new Map(block.instructionIds.map(id => [id, this.tacProgram.getInstructionById(id)!]));
    }

    isBackEdge(from: number, to: number): boolean {
        if (this.successors.get(from) === undefined || !this.successors.get(from)?.has(to)) return false;
        return this.tacProgram.instructionIsBefore(to, from);
    }
}

class BasicBlock {
    readonly instructionIds: Array<number>;

    constructor(instructionIds: Array<number>) {
        this.instructionIds = instructionIds;
    }

    get blockLeader(): number {
        return this.instructionIds[0];
    }

    get lastInstruction(): number {
        return this.instructionIds.at(-1)!;
    }
}


function getBasicBlocks(tacProgram: TacProgram): Map<number, BasicBlock> {
    const basicBlocks = new Map();
    // the first instruction is always a leader
    const leaders = new Set<number>([tacProgram.firstInstructionId]);
    for (const instructionId of tacProgram.instructionIdsOrdered) {
        const explicitJumpTargetIds = tacProgram.getExplicitJumpTargetIds(instructionId);
        explicitJumpTargetIds.forEach(i => leaders.add(i));
        if (explicitJumpTargetIds.size > 0) {
            const nextInstruction = tacProgram.getInstructionAfter(instructionId);
            if (nextInstruction !== undefined) leaders.add(nextInstruction);
        }
    }
    const leaderIdsSorted = tacProgram.instructionIdsOrdered.filter(id => leaders.has(id));

    // this only does something if the size is at least 2
    for (let i = 0; i < leaderIdsSorted.length - 1; i++) {
        const blockInstructions = tacProgram.getInstructionIdsRanging(leaderIdsSorted[i], leaderIdsSorted[i + 1]);
        const block = new BasicBlock(blockInstructions);
        basicBlocks.set(block.blockLeader, block);
    }
    // there is always at least one last block
    const lastBlockInstructions = tacProgram.getInstructionIdsRanging(leaderIdsSorted.at(-1)!);
    const block = new BasicBlock(lastBlockInstructions);
    basicBlocks.set(block.blockLeader, block);
    return basicBlocks;
}


