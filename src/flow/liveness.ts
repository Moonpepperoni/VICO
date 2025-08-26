import type {TacInstruction} from "../tac/parser-types.ts";
import {FlowObserveStore} from "./observe.ts";
import {produce} from "immer";
import type {YieldReason} from "./common.ts";
import {type ControlFlowGraph, getReverseTopologicalOrder} from "../cfg/graph.ts";


export function* LivenessAnalysis(input: LivenessInput, liveOut: Set<string>): Generator<LivenessState> {
    // setup all the required data and use auto change and look at
    const {defSets, useSets, inSets, outSets} = convertToObserveStores(input, liveOut);

    const iterationOrder = getReverseTopologicalOrder(input.cfg);
    yield convertToLivenessState(undefined, 'initialized', input.cfg.nodeIds, defSets, useSets, inSets, outSets);

    let changed = true;
    while (changed) {
        changed = false;
        for (const currentNodeId of iterationOrder) {

            // compute new outSet
            outSets.changeWith(currentNodeId, (prevSet) => {
                return produce(prevSet, (newSet) => {
                    // take union over all successor inSets
                    const successors = input.cfg.getNodeSuccessors(currentNodeId);
                    if (successors === undefined) return;
                    for (const successorId of successors) {
                        inSets.getValue(successorId)?.forEach((v) => newSet.add(v));
                    }
                });
            });
            yield convertToLivenessState(currentNodeId, 'out-computed', input.cfg.nodeIds, defSets, useSets, inSets, outSets);
            const oldIn = inSets.getValueRaw(currentNodeId)!;
            const currentDefSet = defSets.getValue(currentNodeId);
            const currentUseSet = useSets.getValue(currentNodeId);
            // compute new inSet
            inSets.changeWith(currentNodeId, (prevSet) => {
                // out = use [union] (out - def)
                return produce(prevSet, (newSet) => {
                    const outMinusDef = new Set([...outSets.getValue(currentNodeId)!].filter(v => !currentDefSet?.has(v)));
                    // union of the sets
                    currentUseSet?.forEach(v => newSet.add(v));
                    outMinusDef.forEach(v => newSet.add(v));
                });
            });
            const newIn = inSets.getValueRaw(currentNodeId)!;
            if (!livenessSetEqual(oldIn, newIn)) changed = true;
            yield convertToLivenessState(currentNodeId, 'in-computed', input.cfg.nodeIds, defSets, useSets, inSets, outSets);
        }
    }
    yield convertToLivenessState(undefined, 'ended', input.cfg.nodeIds, defSets, useSets, inSets, outSets);
}

function convertToObserveStores(input: LivenessInput, liveOut: Set<string>) {
    const defSets = new FlowObserveStore<Set<string>>(input.def, livenessSetEqual);
    const useSets = new FlowObserveStore<Set<string>>(input.use, livenessSetEqual);
    const inSetsRaw = new Map();
    const outSetsRaw = new Map();
    for (const node of input.cfg.nodeIds) {
        inSetsRaw.set(node, new Set());
        outSetsRaw.set(node, new Set());
    }
    outSetsRaw.set(input.cfg.exitId, liveOut);

    const inSets = new FlowObserveStore<Set<string>>(inSetsRaw, livenessSetEqual);
    const outSets = new FlowObserveStore<Set<string>>(outSetsRaw, livenessSetEqual);
    return {defSets, useSets, inSets, outSets};
}

type LivenessDataStore = FlowObserveStore<Set<string>>;

function convertToLivenessState(currentNodeId: number | undefined, reason: YieldReason, nodes: Array<number>, defSets: LivenessDataStore, useSets: LivenessDataStore, inSets: LivenessDataStore, outSets: LivenessDataStore): LivenessState {
    const stateData = new Map<number, LivenessNodeData>();
    for (const node of nodes) {
        const defSet = extractDataFromStore(defSets, node);
        const useSet = extractDataFromStore(useSets, node);
        const inSet = extractDataFromStore(inSets, node);
        const outSet = extractDataFromStore(outSets, node);
        stateData.set(node, {defSet, useSet, inSet, outSet});
    }
    defSets.resetObserve();
    useSets.resetObserve();
    inSets.resetObserve();
    outSets.resetObserve();
    return {currentNodeId, reason, state: stateData};
}

function extractDataFromStore(store: LivenessDataStore, nodeId: number): LivenessSetData {
    const innerSet = store.getValueRaw(nodeId)!;
    const copy = new Set(innerSet);
    return {data: copy, changed: store.hasChanged(nodeId), lookedAt: store.wasLookedAt(nodeId)};
}



function livenessSetEqual(s1: Set<string>, s2: Set<string>): boolean {
    return s1.size == s2.size && [...s1].every(v => s2.has(v));
}

export type LivenessState = { currentNodeId: number | undefined, reason: YieldReason, state: Map<number, LivenessNodeData> };

export type LivenessNodeData = {
    defSet: LivenessSetData,
    useSet: LivenessSetData,
    inSet: LivenessSetData,
    outSet: LivenessSetData
};

export type LivenessSetData = { data: Set<string>, lookedAt: boolean, changed: boolean };

export type LivenessInput = {
    def: Map<number, Set<string>>,
    use: Map<number, Set<string>>,
    cfg : ControlFlowGraph,
};

export function extractUseAndDefFromInstructions(instructions: Map<number, TacInstruction>): {
    use: Map<number, Set<string>>,
    def: Map<number, Set<string>>
} {
    const use = new Map();
    const def = new Map();
    for (const [id, instruction] of instructions) {
        const {useSet, defSet} = getUseAndDefFromInstruction(instruction);
        use.set(id, useSet);
        def.set(id, defSet);
    }
    return {use, def};
}

function getUseAndDefFromInstruction(instruction: TacInstruction): { useSet: Set<string>, defSet: Set<string> } {
    const useSet = new Set<string>();
    const defSet = new Set<string>();
    switch (instruction.kind) {
        case "assignBinary":
            defSet.add(instruction.target.val);
            if (instruction.left.kind === 'ident') {
                useSet.add(instruction.left.val);
            }
            if (instruction.right.kind === 'ident') {
                useSet.add(instruction.right.val);
            }
            break;
        case 'copy':
            defSet.add(instruction.target.val);
            if (instruction.operand.kind === 'ident') {
                useSet.add(instruction.operand.val);
            }
            break;
        case 'assignUnary':
            defSet.add(instruction.target.val);
            if (instruction.operand.kind === 'ident') {
                useSet.add(instruction.operand.val);
            }
            break;
        case 'ifWithOperator':
            if (instruction.left.kind === 'ident') {
                useSet.add(instruction.left.val);
            }
            if (instruction.right.kind === 'ident') {
                useSet.add(instruction.right.val);
            }
            break;
        case "jump":
            break;
    }
    return {defSet, useSet};
}

function getUseAndDefFromBlocksInstructions(instructions: Array<TacInstruction>) {
    const useSet = new Set<string>();
    const defSet = new Set<string>();
    const safeAddToUse = (val: string) => {
        if (!defSet.has(val)) useSet.add(val);
    }

    const safeAddToDef = (val: string) => {
        if (!useSet.has(val)) defSet.add(val);
    }

    for (const instruction of instructions) {

        switch (instruction.kind) {
            case "assignBinary":
                if (instruction.left.kind === 'ident') {
                    safeAddToUse(instruction.left.val);
                }
                if (instruction.right.kind === 'ident') {
                    safeAddToUse(instruction.right.val);
                }
                safeAddToDef(instruction.target.val);
                break;
            case 'copy':
                if (instruction.operand.kind === 'ident') {
                    safeAddToUse(instruction.operand.val);
                }
                safeAddToDef(instruction.target.val);
                break;
            case 'assignUnary':
                if (instruction.operand.kind === 'ident') {
                    safeAddToUse(instruction.operand.val);
                }
                safeAddToDef(instruction.target.val);
                break;
            case 'ifWithOperator':
                if (instruction.left.kind === 'ident') {
                    safeAddToUse(instruction.left.val);
                }
                if (instruction.right.kind === 'ident') {
                    safeAddToUse(instruction.right.val);
                }
                break;
            case "jump":
                break;
        }
    }
    return {defSet, useSet};

}

export function extractUseAndDefFromBasicBlocks(basicBlocks: Map<number, Array<TacInstruction>>): {
    use: Map<number, Set<string>>,
    def: Map<number, Set<string>>
} {
    const use = new Map();
    const def = new Map();
    for (const [id, instructions] of basicBlocks) {
        const {useSet, defSet} = getUseAndDefFromBlocksInstructions(instructions);
        use.set(id, useSet);
        def.set(id, defSet);
    }
    return {use, def};
}