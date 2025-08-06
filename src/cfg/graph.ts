import type {TacInstruction} from "../tac/parser-types.ts";

export interface ControlFlowGraph {
    entryId: number;
    nodeIds: Array<number>;
    exitId: number;
    dataNodeIds: Array<number>;

    getNodePredecessors(nodeId: number): Set<number> | undefined;

    getNodeSuccessors(nodeId: number): Set<number> | undefined;

    getNodeInstructions(nodeId: number): Array<TacInstruction> | undefined;

    isBackEdge(from: number, to: number): boolean;

    getAllSuccessors() : Map<number, Set<number>>;

    getAllPredecessors() : Map<number, Set<number>>;
}



