import {readProgramFromText, TacProgram} from "../tac/program.ts";
import {TacCollectiveError} from "../tac/tac-errors.ts";
import {GeneratorStepper} from "../flow/stepper.ts";
import {type LivenessState} from "../flow/liveness.ts";
import type {ConstantPropagationState} from "../flow/constant-propagation.ts";
import {BasicBlockControlFlowGraph} from "../cfg/basic-blocks.ts";
import type {ControlFlowGraph} from "../cfg/graph.ts";
import {SingleInstructionGraph} from "../cfg/single-instruction.ts";
import {
    createConstantPropagationStepper,
    createLivenessBasicBlockStepper,
    createLivenessInstructionStepper,
    createReachingDefinitionsStepper
} from "../flow/common.ts";
import {explainLiveness, type Explanation, type ExplanationFunction} from "../explanation/engine.ts";
import type {ReachingDefinitionsState} from "../flow/reaching-definitions.ts";

export type FlowAlgorithmSelector =
    { kind: "liveness-single-instruction", liveOut: Set<string> }
    | { kind: "liveness-basic-blocks", liveOut: Set<string> }
    | { kind: "reaching-definitions-basic-blocks" }
    | { kind: "constant-propagation-basic-blocks" };

class AlgorithmExecutionEngine<T> {
    readonly algoName: FlowAlgorithmSelector["kind"];
    private readonly stepper: GeneratorStepper<T>;
    private readonly cfg: ControlFlowGraph;
    private readonly converter: ConversionFunction<T>;

    private constructor(stepper: GeneratorStepper<T>, cfg: ControlFlowGraph, converter: ConversionFunction<T>, algoName: FlowAlgorithmSelector["kind"]) {
        this.stepper = stepper;
        this.cfg = cfg;
        this.converter = converter;
        this.algoName = algoName;
    }

    static from(selector: FlowAlgorithmSelector, tacProgram: TacProgram) {
        switch (selector.kind) {
            case "liveness-single-instruction": {
                const cfg = new SingleInstructionGraph(tacProgram);
                const algo = createLivenessInstructionStepper(cfg, selector.liveOut);
                return new AlgorithmExecutionEngine<LivenessState>(algo, cfg, convertLivenessToFlowOut, selector.kind);
            }
            case "liveness-basic-blocks": {
                const cfg = new BasicBlockControlFlowGraph(tacProgram);
                const algo = createLivenessBasicBlockStepper(cfg, selector.liveOut);
                return new AlgorithmExecutionEngine<LivenessState>(algo, cfg, convertLivenessToFlowOut, selector.kind);
            }
            case "reaching-definitions-basic-blocks": {
                const cfg = new BasicBlockControlFlowGraph(tacProgram);
                const algo = createReachingDefinitionsStepper(cfg);
                return new AlgorithmExecutionEngine<ReachingDefinitionsState>(algo, cfg, convertReachingToFlowOut, selector.kind);
            }
            case "constant-propagation-basic-blocks": {
                const cfg = new BasicBlockControlFlowGraph(tacProgram);
                const algo = createConstantPropagationStepper(cfg);
                return new AlgorithmExecutionEngine<ConstantPropagationState>(algo, cfg, convertConstantPropagationToFlowOut, selector.kind);
            }
            default: {
                const exhaustiveCheck: never = selector;
                throw new Error(`Unknown algorithm: ${exhaustiveCheck}`);
            }
        }
    }

    stepForward(): void {
        this.stepper.next();
    }

    stepBackward(): void {
        this.stepper.previous();
    }

    hasNext(): boolean {
        return this.stepper.hasNext();
    }

    hasPrevious(): boolean {
        return this.stepper.hasPrevious();
    }

    currentValue(): FlowState | undefined {
        const current = this.stepper.currentValue();
        if (!current) return undefined;
        return this.converter(this.cfg, current, explainLiveness);
    }
}

export class DataFlowDriveService {
    private engine: AlgorithmExecutionEngine<LivenessState> | AlgorithmExecutionEngine<ConstantPropagationState> | AlgorithmExecutionEngine<ReachingDefinitionsState> | undefined;
    private currentProgram: { validity: 'valid', tacProgram: TacProgram, programText: string } | {
        validity: 'invalid',
        errors: Array<{ line: number, reason: string }>,
        programText: string
    } | undefined;

    constructor(initialProgramText: string) {
        this.currentProgram = undefined;
        this.trySetNewProgram(initialProgramText);
    }

    get errors(): Array<{ line: number, reason: string }> | undefined {
        return this.currentProgram?.validity === 'invalid' ? this.currentProgram.errors : undefined;
    }

    get programText(): string | undefined {
        return this.currentProgram?.programText;
    }

    get currentAlgorithm(): FlowAlgorithmSelector["kind"] | undefined {
        return this.engine?.algoName;
    }

    trySetAlgorithm(selector: FlowAlgorithmSelector) {
        if (this.currentProgram === undefined || this.currentProgram.validity === 'invalid') return;
        this.engine = AlgorithmExecutionEngine.from(selector, this.currentProgram.tacProgram);
    }

    deselectAlgorithm() {
        this.engine = undefined;
    }

    trySetNewProgram(programText: string) {
        // reset the engine if it is currently running
        this.engine = undefined;
        try {
            this.currentProgram = {validity: 'valid', tacProgram: readProgramFromText(programText), programText};
        } catch (error) {
            if (error instanceof TacCollectiveError) {
                const errors = error.errors.map(e => ({
                    line: e.line,
                    reason: e.reason
                })).sort((a, b) => a.line - b.line) as Array<{ line: number, reason: string }>;
                this.currentProgram = {validity: 'invalid', errors, programText};
                return errors;
            } else {
                throw error;
            }
        }
        return [];
    }

    tryStepForward(): void {
        this.engine?.stepForward();
    }

    tryStepBackward(): void {
        this.engine?.stepBackward();
    }

    canStepForward(): boolean {
        return this.engine?.hasNext() ?? false;
    }

    canStepBackward(): boolean {
        return this.engine?.hasPrevious() ?? false;
    }

    stepToEnd(): void {
        while (this.engine?.hasNext()) {
            this.engine?.stepForward();
        }
    }

    currentStepValue(): FlowState | undefined {
        return this.engine?.currentValue();
    }
}

type ConversionFunction<T> = (cfg: ControlFlowGraph, state: T, explanationFunction: ExplanationFunction) => FlowState;

function convertConstantPropagationToFlowOut(cfg: ControlFlowGraph, constantPropagationState: ConstantPropagationState, explanationFunction: ExplanationFunction) {

    const nodes = new Array<FlowNodeState>();
    const edges = new Array<FlowEdge>();

    for (const nodeId of cfg.nodeIds) {
        const nodeData = constantPropagationState.state.get(nodeId)!;


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

        // all other nodes have instructions
        const instructions = [...cfg.getNodeInstructions(nodeId)!].map(([, instr]) => {
            return {marker: "", instruction: instr.toString()}
        }) ?? [];

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
        explanation: explanationFunction(constantPropagationState.reason),
        nodes,
        edges,
    }
}

function convertReachingToFlowOut(cfg: ControlFlowGraph, reachingDefinitionsState: ReachingDefinitionsState, explanationFunction: ExplanationFunction): FlowState {
    const nodes = new Array<FlowNodeState>();
    const edges = new Array<FlowEdge>();

    for (const nodeId of cfg.nodeIds) {
        const nodeData = reachingDefinitionsState.state.get(nodeId)!;

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

        // all other nodes have instructions
        const instructions = [...cfg.getNodeInstructions(nodeId)!].map(([id, instr]) => {
            return {marker: reachingDefinitionsState.instructionGenNames.get(id) ?? "", instruction: instr.toString()}
        }) ?? [];

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
        explanation: explanationFunction(reachingDefinitionsState.reason),
        nodes,
        edges,
    }
}


function convertLivenessToFlowOut(cfg: ControlFlowGraph, livenessState: LivenessState, explanationFunction: ExplanationFunction): FlowState {
    const nodes = new Array<FlowNodeState>();
    const edges = new Array<FlowEdge>();

    for (const nodeId of cfg.nodeIds) {
        const nodeData = livenessState.state.get(nodeId)!;
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

        // all other nodes have instructions
        const instructions = [...cfg.getNodeInstructions(nodeId)!].map(([, instr]) => {
            return {marker: "", instruction: instr.toString()}
        }) ?? [];

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
        explanation: explanationFunction(livenessState.reason),
        nodes,
        edges,
    }
}


export type FlowState = {
    explanation: Explanation,
    nodes: Array<FlowNodeState>,
    edges: Array<FlowEdge>,
}

export type FlowDataNodeState = {
    isCurrent: boolean,
    id: number,
    kind: "node",
    instructions: Array<{ marker: string, instruction: string }>,
    inValue: FlowValue,
    outValue: FlowValue,
    perNodeValues: Map<string, FlowValue>
}

export type FlowEntryExitState = {
    id: number,
    isCurrent: boolean,
    kind: "entry" | "exit",
    inValue: FlowValue,
    outValue: FlowValue,
}

export type FlowNodeState = FlowDataNodeState | FlowEntryExitState;

export type FlowEdge = { src: number, target: number, isBackEdge: boolean };

export type FlowValue = { lookedAt: boolean, changed: boolean, value: FlowValueData };

export type FlowValueData = { type: 'string-set', data: Set<string> } | {
    type: 'string-map',
    data: Map<string, string>
};
