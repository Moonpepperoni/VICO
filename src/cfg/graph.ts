import type {TacInstruction} from "../tac/parser-types.ts";

export interface ControlFlowGraph {
    entryId: number;
    nodeIds: Array<number>;
    exitId: number;
    dataNodeIds: Array<number>;

    getNodePredecessors(nodeId: number): Set<number> | undefined;

    getNodeSuccessors(nodeId: number): Set<number> | undefined;

    getNodeInstructions(nodeId: number): Map<number, TacInstruction> | undefined;

    isBackEdge(from: number, to: number): boolean;

    getAllSuccessors(): Map<number, Set<number>>;

    getAllPredecessors(): Map<number, Set<number>>;
}

// CARE: this is not implemented yet, but will be needed for the CFG
export function getTopologicalOrder(cfg: ControlFlowGraph): Array<number> {
    return [...cfg.nodeIds];
}

// CARE: this is not implemented yet, but will be needed for the reverse CFG
export function getReverseTopologicalOrder(cfg: ControlFlowGraph): Array<number> {
    return [...cfg.nodeIds.reverse()];
}



