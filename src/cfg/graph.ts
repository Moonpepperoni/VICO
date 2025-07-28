import type {TacInstruction} from "../tac/parser-types.ts";

export interface ControlFlowGraph {
    entryId: number;
    nodeIds: Array<number>;
    exitId: number;

    getNodePredecessors(nodeId: number): Set<number> | undefined;

    getNodeSuccessors(nodeId: number): Set<number> | undefined;

    getNodeInstructions(nodeId: number): Array<TacInstruction> | undefined;

    isBackEdge(from: number, to: number): boolean;
}



