import type {TacInstruction} from "../tac/parser-types.ts";
import {FlowObserveStore} from "./observe.ts";
import {produce} from "immer";


export function* ReachingDefinitions(cfg: ReachingDefinitionsCFG): Generator<ReachingDefinitionsState> {
    const {genSets, killSets, inSets, outSets} = convertToObserveStores(cfg);

    const iterationOrder = getTopologicalOrder(cfg.entryId, cfg);

    yield convertToReachingDefinitionsState(undefined, 'Initial werden alle Gen- und Kill-Sets basierend auf den Instruktionen gesetzt', cfg.nodes, genSets, killSets, inSets, outSets);


    let changed = true;
    while (changed) {
        changed = false;
        for (const currentNodeId of iterationOrder) {
            const oldIn = inSets.getValueRaw(currentNodeId)!;
            const currentGenSet = genSets.getValue(currentNodeId);
            const currentKillSet = killSets.getValue(currentNodeId);
            // compute new inSet
            inSets.changeWith(currentNodeId, (prevSet) => {
                return produce(prevSet, (newSet) => {
                    // take union over all successor inSets
                    const predecessors = cfg.predecessors.get(currentNodeId);
                    if (predecessors === undefined) return;
                    for (const predecessor of predecessors) {
                        outSets.getValue(predecessor)?.forEach((v) => newSet.add(v));
                    }
                });
            });
            // compute new outSet
            outSets.changeWith(currentNodeId, (prevSet) => {
                // out = use [union] (out - def)
                return produce(prevSet, (newSet) => {
                    const inMinusKill = new Set([...inSets.getValue(currentNodeId)!].filter(v => !currentKillSet?.has(v)));
                    // union of the sets
                    currentGenSet?.forEach(v => newSet.add(v));
                    inMinusKill.forEach(v => newSet.add(v));
                });
            });

            const newIn = inSets.getValueRaw(currentNodeId)!;
            if (!genKillSetEqual(oldIn, newIn)) changed = true;
            yield convertToReachingDefinitionsState(currentNodeId, 'dont know yet', cfg.nodes, genSets, killSets, inSets, outSets);
        }
    }
    yield convertToReachingDefinitionsState(undefined, 'Der Algorithmus ist zu Ende, da es keine weiteren Änderungen gab', cfg.nodes, genSets, killSets, inSets, outSets);
}

function extractDataFromStore(store: ReachingDefinitionsDataStore, nodeId: number): ReachingsDefinitionsSetData {
    const innerSet = store.getValueRaw(nodeId)!;
    const copy = new Set(innerSet);
    return {data: copy, changed: store.hasChanged(nodeId), lookedAt: store.wasLookedAt(nodeId)};
}

function convertToReachingDefinitionsState(currentNodeId: number | undefined, reason: string, nodes: Array<number>, genSets: FlowObserveStore<Set<string>>, killSets: FlowObserveStore<Set<string>>, inSets: FlowObserveStore<Set<string>>, outSets: FlowObserveStore<Set<string>>) {
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
    return {currentNodeId, reason, state: stateData};
}

function getTopologicalOrder(entryId: number, cfg: ReachingDefinitionsCFG): Array<number> {
    const nodeOrder = [];
    const visited = new Set();
    const shouldVisit = [entryId];
    while (shouldVisit.length !== 0) {
        const newNode = shouldVisit.shift()!;
        if (visited.has(newNode)) continue;
        visited.add(newNode);

        const follow = cfg.successors.get(newNode);
        if (follow !== undefined) shouldVisit.push(...follow);
        nodeOrder.push(newNode);
    }
    return nodeOrder;
}

type ReachingDefinitionsDataStore = FlowObserveStore<Set<string>>;

export type ReachingDefinitionsState = {
    reason: string,
    currentNodeId: number | undefined,
    state: Map<number, ReachingDefinitionsNodeData>,
}

export type ReachingDefinitionsNodeData = {
    genSet: ReachingsDefinitionsSetData,
    killSet: ReachingsDefinitionsSetData,
    inSet: ReachingsDefinitionsSetData,
    outSet: ReachingsDefinitionsSetData
};

export type ReachingsDefinitionsSetData = { data: Set<string>, lookedAt: boolean, changed: boolean };

export type ReachingDefinitionsCFG = {
    entryId: number,
    exitId: number,
    gen: Map<number, Set<string>>,
    kill: Map<number, Set<string>>,
    successors: Map<number, Set<number>>,
    predecessors: Map<number, Set<number>>,
    nodes: Array<number>,
};

function genKillSetEqual(s1: Set<string>, s2: Set<string>): boolean {
    return s1.size == s2.size && [...s1].every(v => s2.has(v));
}

function convertToObserveStores(cfg: ReachingDefinitionsCFG,) {
    const genSets = new FlowObserveStore<Set<string>>(cfg.gen, genKillSetEqual);
    const killSets = new FlowObserveStore<Set<string>>(cfg.kill, genKillSetEqual);
    const inSetsRaw = new Map();
    const outSetsRaw = new Map();
    for (const node of cfg.nodes) {
        inSetsRaw.set(node, new Set());
        outSetsRaw.set(node, new Set());
    }
    outSetsRaw.set(cfg.exitId, new Set());

    const inSets = new FlowObserveStore<Set<string>>(inSetsRaw, genKillSetEqual);
    const outSets = new FlowObserveStore<Set<string>>(outSetsRaw, genKillSetEqual);
    return {genSets, killSets, inSets, outSets};
}

function getAllBlockGens(basicBlocks: Map<number, Array<TacInstruction>>) {
    const blockGens = new Map<number, Map<string, string>>();
    const instructionGenNames = new Map<number, string>();
    let genNumber = 1;

    for (const [id, block] of basicBlocks.entries()) {
        const thisBlockGens = new Map<string, string>();
        for (const instruction of block) {
            const variable = extractGenFromInstruction(instruction);
            if (variable !== undefined) {
                const genName = `d${genNumber}`;
                // this will automatically remove gens that are no longer valid
                thisBlockGens.set(variable, genName);
                genNumber++;
            }
        }
        blockGens.set(id, thisBlockGens);
    }
    return {blockGens, instructionGenNames};
}

function getGensByVariable(blockGens: Map<number, Map<string, string>>) {
    const variableGens = new Map<string, Set<string>>();
    for (const [, thisBlockGens] of blockGens.entries()) {
        for (const [variable, genName] of thisBlockGens.entries()) {
            const genSetByVariable = variableGens.get(variable);
            if (genSetByVariable === undefined) {
                variableGens.set(variable, new Set([genName]));
            } else {
                genSetByVariable.add(genName);
            }
        }
    }
    return variableGens;
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

export function extractGenAndKillFromBasicBlocks(basicBlocks: Map<number, Array<TacInstruction>>): {
    genSets: Map<number, Set<string>>,
    killSets: Map<number, Set<string>>,
    instructionGenNames: Map<number, string>,
} {


    const {blockGens, instructionGenNames} = getAllBlockGens(basicBlocks);

    const variableGens = getGensByVariable(blockGens);
    const blockKills = getAllBlockKills(blockGens, variableGens);


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