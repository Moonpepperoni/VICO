import type {ControlFlowGraph} from "../cfg/graph.ts";
import type {TacInstruction} from "../tac/parser-types.ts";

export class TestCfg implements ControlFlowGraph {
    dataNodeIds: Array<number>;
    entryId: number;
    exitId: number;
    nodeIds: Array<number>;
    readonly predecessors: Map<number, Set<number>> = new Map();
    readonly successors: Map<number, Set<number>> = new Map();

    constructor(dataNodeIds: Array<number>, entryId: number, exitId: number, nodeIds: Array<number>, predecessors: Map<number, Set<number>>, successors: Map<number, Set<number>>) {
        this.dataNodeIds = dataNodeIds;
        this.entryId = entryId;
        this.exitId = exitId;
        this.nodeIds = nodeIds;
        this.predecessors = predecessors;
        this.successors = successors;
    }

    getAllPredecessors(): Map<number, Set<number>> {
        return this.predecessors;
    }

    getAllSuccessors(): Map<number, Set<number>> {
        return this.successors;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getNodeInstructions(_nodeId: number): Map<number, TacInstruction> | undefined {
        throw new Error("not mocked");
    }

    getNodePredecessors(nodeId: number): Set<number> | undefined {
        return this.predecessors.get(nodeId);
    }

    getNodeSuccessors(nodeId: number): Set<number> | undefined {
        return this.successors.get(nodeId);
    }


    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isBackEdge(_from: number, _to: number): boolean {
        throw new Error("not mocked");
    }


}