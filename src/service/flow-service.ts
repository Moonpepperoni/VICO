import type {TacProgram} from "../tac/program.ts";
import {GeneratorCache} from "./cache.ts";
import {
    extractUseAndDefFromBasicBlocks,
    extractUseAndDefFromInstructions,
    LivenessAnalysis,
    type LivenessCFG,
    type LivenessState
} from "../flow/liveness.ts";
import type {ControlFlowGraph} from "../cfg/graph.ts";
import {SingleInstructionGraph} from "../cfg/single-instruction.ts";
import {BasicBlockControlFlowGraph} from "../cfg/basic-blocks.ts";
import {
    extractGenAndKillFromBasicBlocks,
    ReachingDefinitions,
    type ReachingDefinitionsCFG,
    type ReachingDefinitionsState
} from "../flow/reaching-definitions.ts";
import {
    ConstantPropagation,
    type ConstantPropagationCFG,
    type ConstantPropagationState,
    extractDefinitions
} from "../flow/constant-propagation.ts";

export type FlowAlgorithmSelector =
    { kind: "liveness-single-instruction", liveOut: Set<string> }
    | { kind: "liveness-basic-blocks", liveOut: Set<string> }
    | { kind: "reaching-definitions-basic-blocks" }
    | { kind: "constant-propagation-basic-blocks" };

export type FlowServiceInitFunction<T> = (tacProgram: TacProgram, cacheSize: number) => {
    cfg: ControlFlowGraph,
    cache: GeneratorCache<T>
};

export type FlowConverterFunction<T> = (cfg: ControlFlowGraph, state: T) => FlowState;

export function getFlowServiceInstanceFor(tacProgram: TacProgram, algorithm: FlowAlgorithmSelector): FlowService {
    switch (algorithm.kind) {
        case "liveness-single-instruction":
            return new LivenessSingleInstructionService(tacProgram, algorithm.liveOut);
        case "liveness-basic-blocks":
            return new LivenessBasicBlockService(tacProgram, algorithm.liveOut);
        case "reaching-definitions-basic-blocks":
            return new ReachingDefinitionsService(tacProgram);
        case "constant-propagation-basic-blocks":
            return new ConstantPropagationService(tacProgram);
        default: {
            const exhaustiveCheck: never = algorithm;
            throw new Error(`Unknown algorithm: ${exhaustiveCheck}`);
        }
    }
}

export interface FlowService {
    advance(): void;

    currentValue(): FlowState | undefined;

    previous(): void;

    hasNext(): boolean;

    hasPrevious(): boolean;

    advanceToEnd(): void;
}

export class FlowServiceBase<T> {

    private readonly cache: GeneratorCache<T>;
    private readonly cfg: ControlFlowGraph;
    private readonly converter: FlowConverterFunction<T>;

    constructor(tacProgram: TacProgram, initFunction: FlowServiceInitFunction<T>, resultConverter: FlowConverterFunction<T>, cacheSize = 100) {
        const {cfg, cache} = initFunction(tacProgram, cacheSize);
        this.cfg = cfg;
        this.cache = cache;
        this.converter = resultConverter;
    }

    advance() {
        if (!this.cache.hasNext()) return;
        this.cache.next();
    }

    currentValue(): FlowState | undefined {
        const currentValue = this.cache.currentValue();
        if (currentValue === undefined) return undefined;
        return this.converter(this.cfg, currentValue);
    }

    previous() {
        if (this.cache === undefined || !this.cache.hasPrevious()) return;
        this.cache.previous();
    }

    hasPrevious(): boolean {
        return this.cache.hasPrevious();
    }

    advanceToEnd() {
        while (this.cache.hasNext()) {
            this.cache.next();
        }
    }

    hasNext(): boolean {
        return this.cache.hasNext();
    }
}

export class LivenessSingleInstructionService extends FlowServiceBase<LivenessState> {
    constructor(tacProgram: TacProgram, liveOut: Set<string>, cacheSize = 100) {
        super(tacProgram, selectLivenessForSingleInstructions(liveOut), convertToLiveness, cacheSize);
    }
}

export class LivenessBasicBlockService extends FlowServiceBase<LivenessState> {
    constructor(tacProgram: TacProgram, liveOut: Set<string>, cacheSize = 100) {
        super(tacProgram, selectLivenessForBasicBlocks(liveOut), convertToLiveness, cacheSize);
    }
}

function convertReachingToFlowOut(cfg: ControlFlowGraph, reachingDefinitionsState: ReachingDefinitionsState): FlowState {
    const nodes = new Array<FlowNodeData>();
    const edges = new Array<FlowEdgeData>();

    for (const nodeId of cfg.nodeIds) {
        const nodeData = reachingDefinitionsState.state.get(nodeId)!;
        const instructions = cfg.getNodeInstructions(nodeId)?.map(i => i.toString()) ?? [];
        const inSet: FlowValue = {
            lookedAt: nodeData.inSet.lookedAt,
            changed: nodeData.inSet.changed,
            value: {type: 'string-set', data: nodeData.inSet.data}
        };
        const outSet: FlowValue = {
            lookedAt: nodeData.outSet.lookedAt,
            changed: nodeData.outSet.changed,
            value: {type: 'string-set', data: nodeData.outSet.data}
        };

        if (nodeId === cfg.entryId) {
            nodes.push({
                isCurrent: reachingDefinitionsState.currentNodeId === nodeId,
                id: nodeId,
                kind: 'entry',
                inValue: inSet,
                outValue: outSet,
            });
            continue;
        }

        if (nodeId === cfg.exitId) {
            nodes.push({
                isCurrent: reachingDefinitionsState.currentNodeId === nodeId,
                id: nodeId,
                kind: 'exit',
                inValue: inSet,
                outValue: outSet,
            });
            continue;
        }

        const genSet: FlowValue = {
            lookedAt: nodeData.genSet.lookedAt,
            changed: nodeData.genSet.changed,
            value: {type: 'string-set', data: nodeData.genSet.data}
        };
        const killSet: FlowValue = {
            lookedAt: nodeData.killSet.lookedAt,
            changed: nodeData.killSet.changed,
            value: {type: 'string-set', data: nodeData.killSet.data}
        };


        const perNodeValues = new Map<string, FlowValue>([["gen", genSet], ["kill", killSet]]);

        nodes.push({
            isCurrent: reachingDefinitionsState.currentNodeId === nodeId,
            kind: "node",
            id: nodeId,
            outValue: outSet,
            inValue: inSet,
            perNodeValues,
            instructions,
        });
    }

    for (const [src, targets] of cfg.getAllSuccessors()) {
        targets.forEach(target => {
            edges.push({src, target, isBackEdge: cfg.isBackEdge(src, target)});
        });
    }
    return {
        reason: reachingDefinitionsState.reason,
        nodes,
        edges,
    }
}

export class ReachingDefinitionsService extends FlowServiceBase<ReachingDefinitionsState> {
    constructor(tacProgram: TacProgram, cacheSize = 100) {
        super(tacProgram, selectReachingDefinitionsForBasicBlocks, convertReachingToFlowOut, cacheSize);
    }
}

function selectLivenessForSingleInstructions(liveOut: Set<string>) {
    return (tacProgram: TacProgram, cacheSize: number) => {
        const cfg = new SingleInstructionGraph(tacProgram);

        const {use, def} = extractUseAndDefFromInstructions(
            new Map(cfg.dataNodeIds
                .map(id => [id, cfg.getNodeInstructions(id)![0]])));
        const livenessCFG: LivenessCFG = {
            use, def,
            entryId: cfg.entryId,
            exitId: cfg.exitId,
            nodes: cfg.nodeIds,
            edges: cfg.getAllSuccessors(),
        }
        return {cfg, cache: new GeneratorCache(LivenessAnalysis(livenessCFG, liveOut), cacheSize)};
    }
}

function selectLivenessForBasicBlocks(liveOut: Set<string>) {
    return (tacProgram: TacProgram, cacheSize: number) => {
        const cfg = new BasicBlockControlFlowGraph(tacProgram);
        const basicBlocks = new Map(cfg.dataNodeIds.map(id => [id, cfg.getNodeInstructions(id)!]));
        const {use, def} = extractUseAndDefFromBasicBlocks(basicBlocks);

        const livenessCFG: LivenessCFG = {
            use, def,
            entryId: cfg.entryId,
            exitId: cfg.exitId,
            nodes: cfg.nodeIds,
            edges: cfg.getAllSuccessors(),
        };
        return {cfg, cache: new GeneratorCache(LivenessAnalysis(livenessCFG, liveOut), cacheSize)};
    };
}

function selectReachingDefinitionsForBasicBlocks(tacProgram: TacProgram, cacheSize: number): {
    cfg: ControlFlowGraph,
    cache: GeneratorCache<ReachingDefinitionsState>
} {
    const cfg = new BasicBlockControlFlowGraph(tacProgram);
    const basicBlocks = new Map(cfg.dataNodeIds.map(id => [id, cfg.getNodeInstructions(id)!]));
    const {genSets, killSets} = extractGenAndKillFromBasicBlocks(basicBlocks);

    const reachingDefinitionsCFG: ReachingDefinitionsCFG = {
        entryId: cfg.entryId,
        exitId: cfg.exitId,
        gen: genSets,
        kill: killSets,
        successors: cfg.getAllSuccessors(),
        predecessors: cfg.getAllPredecessors(),
        nodes: cfg.nodeIds,
    }

    return {cfg, cache: new GeneratorCache(ReachingDefinitions(reachingDefinitionsCFG), cacheSize)};
}

export class ConstantPropagationService extends FlowServiceBase<ConstantPropagationState> {
    constructor(tacProgram: TacProgram, cacheSize = 100) {
        super(tacProgram, selectConstantPropagation, convertConstantPropagationToFlowOut, cacheSize);
    }
}

function selectConstantPropagation(tacProgram: TacProgram, cacheSize: number): {
    cache: GeneratorCache<ConstantPropagationState>,
    cfg: ControlFlowGraph
} {
    const cfg = new BasicBlockControlFlowGraph(tacProgram);
    const basicBlocks = new Map(cfg.dataNodeIds.map(id => [id, cfg.getNodeInstructions(id)!]));
    const {definitions} = extractDefinitions(basicBlocks);

    const constantPropagationCFG: ConstantPropagationCFG = {
        definitions,
        entryId: cfg.entryId,
        exitId: cfg.exitId,
        nodes: cfg.nodeIds,
        successors: cfg.getAllSuccessors(),
        predecessors: cfg.getAllPredecessors(),
    };
    return {cfg, cache: new GeneratorCache(ConstantPropagation(constantPropagationCFG), cacheSize)};
}

function convertConstantPropagationToFlowOut(cfg: ControlFlowGraph, constantPropagationState: ConstantPropagationState ) {

        const nodes = new Array<FlowNodeData>();
        const edges = new Array<FlowEdgeData>();

        for (const nodeId of cfg.nodeIds) {
            const nodeData = constantPropagationState.state.get(nodeId)!;
            const instructions = cfg.getNodeInstructions(nodeId)?.map(i =>  i.toString()) ?? [];

            const inMap: FlowValue = {
                lookedAt: nodeData.inMap.lookedAt,
                changed: nodeData.inMap.changed,
                value: {type: 'string-map', data: nodeData.inMap.data}
            };
            const outMap: FlowValue = {
                lookedAt: nodeData.outMap.lookedAt,
                changed: nodeData.outMap.changed,
                value: {type: 'string-map', data: nodeData.outMap.data}
            };

            if (nodeId === cfg.entryId) {
                nodes.push({
                    isCurrent: constantPropagationState.currentNodeId === nodeId,
                    id: nodeId,
                    kind: 'entry',
                    inValue: inMap,
                    outValue: outMap,
                });
                continue;
            }

            if (nodeId === cfg.exitId) {
                nodes.push({
                    isCurrent: constantPropagationState.currentNodeId === nodeId,
                    id: nodeId,
                    kind: 'exit',
                    inValue: inMap,
                    outValue: outMap,
                });
                continue;
            }


            const perNodeValues = new Map<string, FlowValue>();

            nodes.push({
                isCurrent: constantPropagationState.currentNodeId === nodeId,
                kind: "node",
                id: nodeId,
                outValue: outMap,
                inValue: inMap,
                perNodeValues,
                instructions,
            });

        }

        for (const [src, targets] of cfg.getAllSuccessors()) {
            targets.forEach(target => {
                edges.push({src, target, isBackEdge: cfg.isBackEdge(src, target)});
            });
        }

        return {
            reason: constantPropagationState.reason,
            nodes,
            edges,
        }
}


function convertToLiveness(cfg: ControlFlowGraph, livenessState: LivenessState): FlowState {
    const nodes = new Array<FlowNodeData>();
    const edges = new Array<FlowEdgeData>();

    for (const nodeId of cfg.nodeIds) {
        const nodeData = livenessState.state.get(nodeId)!;
        const instructions = cfg.getNodeInstructions(nodeId)?.map(i => i.toString()) ?? [];
        const inSet: FlowValue = {
            lookedAt: nodeData.inSet.lookedAt,
            changed: nodeData.inSet.changed,
            value: {type: 'string-set', data: nodeData.inSet.data}
        };
        const outSet: FlowValue = {
            lookedAt: nodeData.outSet.lookedAt,
            changed: nodeData.outSet.changed,
            value: {type: 'string-set', data: nodeData.outSet.data}
        };

        if (nodeId === cfg.entryId) {
            nodes.push({
                isCurrent: livenessState.currentNodeId === nodeId,
                id: nodeId,
                kind: 'entry',
                inValue: inSet,
                outValue: outSet,
            });
            continue;
        }

        if (nodeId === cfg.exitId) {
            nodes.push({
                isCurrent: livenessState.currentNodeId === nodeId,
                id: nodeId,
                kind: 'exit',
                inValue: inSet,
                outValue: outSet,
            });
            continue;
        }

        const useSet: FlowValue = {
            lookedAt: nodeData.useSet.lookedAt,
            changed: nodeData.useSet.changed,
            value: {type: 'string-set', data: nodeData.useSet.data}
        };
        const defSet: FlowValue = {
            lookedAt: nodeData.defSet.lookedAt,
            changed: nodeData.defSet.changed,
            value: {type: 'string-set', data: nodeData.defSet.data}
        };


        const perNodeValues = new Map<string, FlowValue>([["use", useSet], ["def", defSet]]);

        nodes.push({
            isCurrent: livenessState.currentNodeId === nodeId,
            kind: "node",
            id: nodeId,
            outValue: outSet,
            inValue: inSet,
            perNodeValues,
            instructions,
        });

    }


    for (const [src, targets] of cfg.getAllSuccessors()) {
        targets.forEach(target => {
            edges.push({src, target, isBackEdge: cfg.isBackEdge(src, target)});
        });
    }
    return {
        reason: livenessState.reason,
        nodes,
        edges,
    }
}

export type FlowState = {
    reason: string,
    nodes: Array<FlowNodeData>,
    edges: Array<FlowEdgeData>,
}

export type FlowDataNodeData = {
    isCurrent: boolean,
    id: number,
    kind: "node",
    instructions: Array<string>,
    inValue: FlowValue,
    outValue: FlowValue,
    perNodeValues: Map<string, FlowValue>
}

export type FlowEntryExitData = {
    id: number,
    isCurrent: boolean,
    kind: "entry" | "exit",
    inValue: FlowValue,
    outValue: FlowValue,
}

export type FlowNodeData = FlowDataNodeData | FlowEntryExitData;

export type FlowEdgeData = { src: number, target: number, isBackEdge: boolean };

export type FlowValue = { lookedAt: boolean, changed: boolean, value: FlowValueData };

export type FlowValueData = { type: 'string-set', data: Set<string> } | {
    type: 'string-map',
    data: Map<string, string>
};