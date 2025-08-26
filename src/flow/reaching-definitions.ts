import type {TacInstruction} from "../tac/parser-types.ts";
import {FlowObserveStore} from "./observe.ts";
import {produce} from "immer";
import type {YieldReason} from "./common.ts";
import {type ControlFlowGraph, getTopologicalOrder} from "../cfg/graph.ts";


export function* ReachingDefinitions(input: ReachingDefinitionsInput): Generator<ReachingDefinitionsState> {
    const {genSets, killSets, inSets, outSets} = convertToObserveStores(input);

    const iterationOrder = getTopologicalOrder(input.cfg);

    yield convertToReachingDefinitionsState(undefined, 'initialized', input.cfg.nodeIds, genSets, killSets, inSets, outSets, input.instructionGenNames);

    let changed = true;
    while (changed) {
        changed = false;
        for (const currentNodeId of iterationOrder) {

            // compute new inSet
            inSets.changeWith(currentNodeId, (prevSet) => {
                return produce(prevSet, (newSet) => {
                    // take union over all predecessor outsets
                    const predecessors = input.cfg.getNodePredecessors(currentNodeId);
                    if (predecessors === undefined) return;
                    for (const predecessor of predecessors) {
                        outSets.getValue(predecessor)?.forEach((v) => newSet.add(v));
                    }
                });
            });
            const oldOut = outSets.getValueRaw(currentNodeId)!;
            yield convertToReachingDefinitionsState(currentNodeId, 'in-computed', input.cfg.nodeIds, genSets, killSets, inSets, outSets, input.instructionGenNames);
            const currentGenSet = genSets.getValue(currentNodeId);
            const currentKillSet = killSets.getValue(currentNodeId);
            // compute new outSet
            outSets.changeWith(currentNodeId, (prevSet) => {
                // out = gen [union] (in - kill)
                return produce(prevSet, (newSet) => {
                    const inMinusKill = new Set([...inSets.getValue(currentNodeId)!].filter(v => !currentKillSet?.has(v)));
                    // union of the sets
                    currentGenSet?.forEach(v => newSet.add(v));
                    inMinusKill.forEach(v => newSet.add(v));
                });
            });

            const newOut = outSets.getValueRaw(currentNodeId)!;
            if (!genKillSetEqual(oldOut, newOut)) changed = true;
            yield convertToReachingDefinitionsState(currentNodeId, 'out-computed', input.cfg.nodeIds, genSets, killSets, inSets, outSets, input.instructionGenNames);
        }
    }
    yield convertToReachingDefinitionsState(undefined, 'ended', input.cfg.nodeIds, genSets, killSets, inSets, outSets, input.instructionGenNames);
}

function extractDataFromStore(store: ReachingDefinitionsDataStore, nodeId: number): ReachingsDefinitionsSetData {
    const innerSet = store.getValueRaw(nodeId)!;
    const copy = new Set(innerSet);
    return {data: copy, changed: store.hasChanged(nodeId), lookedAt: store.wasLookedAt(nodeId)};
}

function convertToReachingDefinitionsState(currentNodeId: number | undefined, reason: YieldReason, nodes: Array<number>, genSets: FlowObserveStore<Set<string>>, killSets: FlowObserveStore<Set<string>>, inSets: FlowObserveStore<Set<string>>, outSets: FlowObserveStore<Set<string>>, instructionGenNames: Map<number, string>) {
    const stateData = new Map<number, ReachingDefinitionsNodeData>();
    for (const node of nodes) {
        const genSet = extractDataFromStore(genSets, node);
        const killSet = extractDataFromStore(killSets, node);
        const inSet = extractDataFromStore(inSets, node);
        const outSet = extractDataFromStore(outSets, node);
        stateData.set(node, {genSet, killSet, inSet, outSet});
    }
    genSets.resetObserve();
    killSets.resetObserve();
    inSets.resetObserve();
    outSets.resetObserve();
    return {currentNodeId, reason, state: stateData, instructionGenNames};
}

type ReachingDefinitionsDataStore = FlowObserveStore<Set<string>>;

export type ReachingDefinitionsState = {
    reason: YieldReason,
    currentNodeId: number | undefined,
    state: Map<number, ReachingDefinitionsNodeData>,
    instructionGenNames: Map<number, string>,
}

export type ReachingDefinitionsNodeData = {
    genSet: ReachingsDefinitionsSetData,
    killSet: ReachingsDefinitionsSetData,
    inSet: ReachingsDefinitionsSetData,
    outSet: ReachingsDefinitionsSetData,
};

export type ReachingsDefinitionsSetData = { data: Set<string>, lookedAt: boolean, changed: boolean };

export type ReachingDefinitionsInput = {
    cfg: ControlFlowGraph,
    gen: Map<number, Set<string>>,
    kill: Map<number, Set<string>>,
    instructionGenNames: Map<number, string>,
};

function genKillSetEqual(s1: Set<string>, s2: Set<string>): boolean {
    return s1.size == s2.size && [...s1].every(v => s2.has(v));
}

function convertToObserveStores(input: ReachingDefinitionsInput,) {
    const genSets = new FlowObserveStore<Set<string>>(input.gen, genKillSetEqual);
    const killSets = new FlowObserveStore<Set<string>>(input.kill, genKillSetEqual);
    const inSetsRaw = new Map();
    const outSetsRaw = new Map();
    for (const node of input.cfg.nodeIds) {
        inSetsRaw.set(node, new Set());
        outSetsRaw.set(node, new Set());
    }
    outSetsRaw.set(input.cfg.exitId, new Set());

    const inSets = new FlowObserveStore<Set<string>>(inSetsRaw, genKillSetEqual);
    const outSets = new FlowObserveStore<Set<string>>(outSetsRaw, genKillSetEqual);
    return {genSets, killSets, inSets, outSets};
}

function getAllBlockGens(basicBlocks: Map<number, Map<number, TacInstruction>>) {
    const blockGens = new Map<number, Map<string, string>>();
    const instructionGenNames = new Map<number, string>();
    const gensByVariable = new Map<string, Set<string>>();
    let genNumber = 1;

    for (const [id, block] of basicBlocks.entries()) {
        const thisBlockGens = new Map<string, string>();
        for (const [id, instruction] of block) {
            const variable = extractGenFromInstruction(instruction);
            if (variable !== undefined) {
                const genName = `d${genNumber}`;
                // this will automatically remove gens that are no longer valid
                thisBlockGens.set(variable, genName);
                const genSetByVariable = gensByVariable.get(variable);
                if (genSetByVariable === undefined) {
                    gensByVariable.set(variable, new Set([genName]));
                } else {
                    genSetByVariable.add(genName);
                }
                genNumber++;
                instructionGenNames.set(id, genName);
            }
        }
        blockGens.set(id, thisBlockGens);
    }
    return {blockGens, instructionGenNames, gensByVariable};
}


function getAllBlockKills(blockGens: Map<number, Map<string, string>>, variableGens: Map<string, Set<string>>) {
    const blockKills = new Map<number, Set<string>>();
    for (const [id, thisBlockGens] of blockGens.entries()) {
        const thisBlockKills = new Set<string>();
        for (const [variable] of thisBlockGens.entries()) {
            const genSetByVariable = variableGens.get(variable);
            if (genSetByVariable !== undefined) {
                for (const genLabel of genSetByVariable) {
                    if (![...thisBlockGens.values()].includes(genLabel)) {
                        thisBlockKills.add(genLabel);
                    }
                }
            }
        }
        blockKills.set(id, thisBlockKills);
    }
    return blockKills;
}

export function extractGenAndKillFromBasicBlocks(basicBlocks: Map<number, Map<number, TacInstruction>>): {
    genSets: Map<number, Set<string>>,
    killSets: Map<number, Set<string>>,
    instructionGenNames: Map<number, string>,
} {


    const {blockGens, instructionGenNames, gensByVariable} = getAllBlockGens(basicBlocks);

    const blockKills = getAllBlockKills(blockGens, gensByVariable);


    return {
        genSets: new Map([...blockGens.entries()].map(([id, inner]) => [id, new Set(inner.values())])),
        killSets: blockKills,
        instructionGenNames,
    };
}

function extractGenFromInstruction(instruction: TacInstruction): string | undefined {
    switch (instruction.kind) {
        case "assignBinary":
        case "assignUnary":
        case "copy":
            return instruction.target.val;
        default:
            return undefined;
    }
}