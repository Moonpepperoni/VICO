import {type BinaryOperator, type TacInstruction, type UnaryOperator} from "../tac/parser-types.ts";
import {FlowObserveStore} from "./observe.ts";
import {produce} from "immer";

type Definition = {
    kind: 'copy',
    target: string,
    use1: Variable | NumberConstant,
} | {
    kind: 'unary',
    target: string,
    use1: Variable | NumberConstant,
    op: PropagationUnaryOperator,
} | {
    kind: 'binary',
    target: string,
    op: PropagationBinaryOperator,
    use1: Variable | NumberConstant,
    use2: Variable | NumberConstant,
};

type PropagationBinaryOperator = '+' | '-' | '*' | '/' | '%' | '==' | '<=' | '>=' | '!=' | '>' | '<';

type PropagationUnaryOperator = '-' | '!';

type Variable = {
    kind: 'variable',
    value: string,
}

type NumberConstant = {
    kind: 'constant',
    value: number,
}

export function extractDefinitions(basicBlocks: Map<number, Array<TacInstruction>>): {
    definitions: Map<number, Array<Definition>>
} {
    const definitions = new Map<number, Array<Definition>>();

    for (const [id, blockInstructions] of basicBlocks) {
        const blockDefinitions = Array<Definition>();
        for (const instruction of blockInstructions) {
            const definition = extractDefinitionFromInstruction(instruction);
            if (definition !== undefined) {
                blockDefinitions.push(definition);
            }
        }
        definitions.set(id, blockDefinitions);
    }

    return {definitions};
}

function unaryOperatorFrom(operator: UnaryOperator): PropagationUnaryOperator {
    return operator as PropagationUnaryOperator;
}

function binaryOperatorFrom(operator: BinaryOperator): PropagationBinaryOperator {
    return operator as PropagationBinaryOperator;
}

function extractDefinitionFromInstruction(instruction: TacInstruction): Definition | undefined {
    switch (instruction.kind) {
        case "copy": {
            const target = instruction.target.val;
            const operand = instruction.operand;
            if (operand.kind === 'ident') {
                return {kind: "copy", target, use1: {kind: 'variable', value: operand.val}};
            } else {
                return {kind: "copy", target, use1: {kind: 'constant', value: +operand.val}};
            }
        }
        case "assignUnary": {
            const target = instruction.target.val;
            const operand = instruction.operand;
            const operator = instruction.operator;
            if (operand.kind === 'ident') {
                return {
                    kind: "unary",
                    target,
                    use1: {kind: "variable", value: operand.val},
                    op: unaryOperatorFrom(operator)
                };
            } else {
                return {
                    kind: 'unary',
                    target,
                    use1: {kind: 'constant', value: +operand.val},
                    op: unaryOperatorFrom(operator)
                };
            }
        }
        case "assignBinary": {
            const target = instruction.target.val;
            const operand1 = instruction.left;
            const operand2 = instruction.right;
            const operator = instruction.operator;
            const use1: Variable | NumberConstant = operand1.kind === 'ident' ? {
                kind: "variable",
                value: operand1.val
            } : {
                kind: 'constant',
                value: +operand1.val
            };
            const use2: Variable | NumberConstant = operand2.kind === 'ident' ? {
                kind: "variable",
                value: operand2.val
            } : {
                kind: 'constant',
                value: +operand2.val
            };
            return {kind: "binary", target, use1, use2, op: binaryOperatorFrom(operator)};
        }
        default:
            return undefined;
    }
}

export function* ConstantPropagation(cfg: ConstantPropagationCFG) {
    const {definitions, inMaps, outMaps} = convertToObserveStores(cfg);
    const iterationOrder = getTopologicalOrder(cfg.entryId, cfg);

    yield convertToConstantPropagationState(undefined, 'Initial werden alle In- und Out-Sets auf eine leere Map gesetzt', cfg.nodes, inMaps, outMaps);
    let changed = true;
    while (changed) {
        changed = false;
        for (const currentNodeId of iterationOrder) {
            const oldIn = inMaps.getValueRaw(currentNodeId)!;
            const currentDefinitions = definitions.getValue(currentNodeId);
            // compute new inMap
            inMaps.changeWith(currentNodeId, (prevSet) => {
                return produce(prevSet, (newInMap) => {
                    // compute meet operator over all predecessor maps
                    const predecessors = cfg.predecessors.get(currentNodeId);
                    if (predecessors === undefined) return;
                    for (const predecessor of predecessors) {
                        outMaps.getValue(predecessor)?.forEach((value, key) => newInMap.set(key, meetOperator(newInMap.get(key) ?? {kind: 'UNDEF'}, value)));
                    }
                });
            });
            // this must exist because we initialize the inMaps for all possible ids
            const newIn = inMaps.getValue(currentNodeId)!;
            // first copy all definitions from the inMap to the outMap
            // then apply the meet operator to all definitions
            outMaps.changeWith(currentNodeId, (prevSet) => {
                return produce(prevSet, (newMap) => {
                    newIn.forEach((value, variable) => {
                        newMap.set(variable, meetOperator(value, newMap.get(variable) ?? {kind: 'UNDEF'}));
                    });
                    const changesAtEachInstruction = new Map<string, PropagationValue>([...newIn.entries()]);
                    currentDefinitions?.forEach(definition => {
                        changesAtEachInstruction.set(definition.target, meetInstruction(changesAtEachInstruction, definition));
                    })
                    changesAtEachInstruction.forEach((value, variable) => {
                        newMap.set(variable, value);
                    })
                });
            });

            if (!inOutMapsEqual(oldIn, newIn)) changed = true;
            yield convertToConstantPropagationState(currentNodeId, 'dont know yet', cfg.nodes, inMaps, outMaps);
        }
    }
    yield convertToConstantPropagationState(undefined, 'Der Algorithmus ist zu Ende, da es keine weiteren Änderungen gab', cfg.nodes, inMaps, outMaps);
}

function convertToConstantPropagationState(currentNodeId: number | undefined, reason: string, nodes: Array<number>, inMaps: FlowObserveStore<InOutMap>, outMaps: FlowObserveStore<InOutMap>) {
    const stateData = new Map<number, ConstantPropagationNodeData>();
    for (const node of nodes) {
        const inMap = extractDataFromStore(inMaps, node);
        const outMap = extractDataFromStore(outMaps, node);
        stateData.set(node, {inMap, outMap});
    }
    inMaps.resetObserve();
    outMaps.resetObserve();
    return {currentNodeId, reason, state: stateData};
}

function extractDataFromStore(store: InOutMapStore, nodeId: number): InOutMapData {
    const innerMap = store.getValueRaw(nodeId)!;
    const copy = new Map([...innerMap].map(([key, value]) => [key, (value.kind === 'constant-number' ? value.value : value.kind)  as string]));
    return {data: copy, changed: store.hasChanged(nodeId), lookedAt: store.wasLookedAt(nodeId)};
}

export type ConstantPropagationState = { currentNodeId: number | undefined, reason: string, state: Map<number, ConstantPropagationNodeData> };

export type ConstantPropagationNodeData = {
    inMap: InOutMapData,
    outMap: InOutMapData,
};

export type InOutMapData = { data: Map<string, string>, lookedAt: boolean, changed: boolean };

function meetOperator(v1: PropagationValue, v2: PropagationValue): PropagationValue {
    if (v1.kind === 'NAC' || v2.kind === 'NAC') return {kind: 'NAC'};
    if (v1.kind === 'UNDEF' && v2.kind === 'UNDEF') return {kind: 'UNDEF'};
    if (v1.kind === 'constant-number' && v2.kind === 'constant-number' && v1.value === v2.value) return {
        kind: 'constant-number',
        value: v1.value
    };
    if (v1.kind === 'constant-number' && v2.kind === 'UNDEF') return {kind: 'constant-number', value: v1.value};
    if (v2.kind === 'constant-number' && v1.kind === 'UNDEF') return {kind: 'constant-number', value: v2.value};
    return {kind: 'NAC'};
}

function applyUnaryOp(value: number, op: PropagationUnaryOperator): number {
    switch (op) {
        case "-":
            return -value;
        case '!':
            return ~value;
        default: {
            const exhaustiveCheck: never = op;
            throw new Error(`Unknown operator: ${exhaustiveCheck}`);
        }
    }
}

function applyBinaryOp(value1: number, value2: number, op: PropagationBinaryOperator): number {
    switch (op) {
        case "-":
            return value1 - value2;
        case "+":
            return value1 + value2;
        case "*":
            return value1 * value2;
        case "/":
            return Math.floor(value1 / value2);
        case '%':
            return value1 % value2;
        case "==":
            if (value1 === value2) return 0;
            return -1;
        case "<=":
            if (value1 <= value2) return 0;
            return -1;
        case ">=":
            if (value1 >= value2) return 0;
            return -1;
        case ">":
            if (value1 > value2) return 0;
            return -1;
        case "!=":
            if (value1 !== value2) return 0;
            return -1;
        case "<":
            if (value1 < value2) return 0;
            return -1;
        default: {
            const exhaustiveCheck: never = op;
            throw new Error(`Unknown operator: ${exhaustiveCheck}`);
        }
    }
}

function meetInstruction(inMap: Map<string, PropagationValue>, def: Definition): PropagationValue {
    const target = def.target;
    const targetCurrentValue = inMap.get(target) ?? {'kind': 'UNDEF'};
    switch (def.kind) {
        case "copy":
            if (def.use1.kind === 'constant') {
                return meetOperator(targetCurrentValue, {kind: 'constant-number', value: def.use1.value});
            } else {
                return meetOperator(targetCurrentValue, inMap.get(def.use1.value) ?? {kind: 'UNDEF'});
            }
        case 'unary':
            if (def.use1.kind === 'constant') {
                return meetOperator(targetCurrentValue, {
                    kind: 'constant-number',
                    value: applyUnaryOp(def.use1.value, def.op)
                });
            } else {
                let newPropagationValue = inMap.get(def.use1.value) ?? {kind: 'UNDEF'};
                if (newPropagationValue.kind === 'constant-number') {
                    newPropagationValue = {
                        ...newPropagationValue,
                        value: applyUnaryOp(newPropagationValue.value, def.op)
                    };
                }
                return meetOperator(targetCurrentValue, newPropagationValue);
            }
        case 'binary': {
            let propValue1: PropagationValue | undefined;
            let propValue2: PropagationValue | undefined;
            if (def.use1.kind === 'constant') {
                propValue1 = {kind: 'constant-number', value: def.use1.value};
            } else {
                propValue1 = inMap.get(def.use1.value) ?? {kind: 'UNDEF'};
            }
            if (def.use2.kind === 'constant') {
                propValue2 = {kind: 'constant-number', value: def.use2.value};
            } else {
                propValue2 = inMap.get(def.use2.value) ?? {kind: 'UNDEF'};
            }
            if (propValue1.kind === 'constant-number' && propValue2.kind === 'constant-number') {
                return meetOperator(targetCurrentValue, {
                    kind: 'constant-number',
                    value: applyBinaryOp(propValue1.value, propValue2.value, def.op)
                });
            }
            if (propValue1.kind === 'NAC' || propValue2.kind === 'NAC') return meetOperator(targetCurrentValue, {kind: 'NAC'});
            return meetOperator(targetCurrentValue, {kind: 'UNDEF'});
        }
    }
}

function getTopologicalOrder(entryId: number, cfg: ConstantPropagationCFG): Array<number> {
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

function convertToObserveStores(cfg: ConstantPropagationCFG) {
    const definitions: DefinitionArrayStore = new FlowObserveStore(cfg.definitions, definitionsArrayEqual);
    const inSetsRaw = new Map();
    const outSetsRaw = new Map();
    for (const node of cfg.nodes) {
        inSetsRaw.set(node, new Map());
        outSetsRaw.set(node, new Map());
    }

    const inMaps: InOutMapStore = new FlowObserveStore(inSetsRaw, inOutMapsEqual);
    const outMaps: InOutMapStore = new FlowObserveStore(outSetsRaw, inOutMapsEqual);
    return {definitions, inMaps, outMaps};
}

export type ConstantPropagationCFG = {
    entryId: number,
    exitId: number,
    successors: Map<number, Set<number>>,
    predecessors: Map<number, Set<number>>,
    nodes: Array<number>,
    definitions: Map<number, Array<Definition>>,
};

export type PropagationValue = { kind: 'NAC' } | { kind: 'UNDEF' } | { kind: 'constant-number', value: number };

export type InOutMap = Map<string, PropagationValue>

type InOutMapStore = FlowObserveStore<InOutMap>;

type DefinitionArrayStore = FlowObserveStore<Array<Definition>>;

function definitionsArrayEqual(a1: Array<Definition>, a2: Array<Definition>): boolean {
    return a1.length === a2.length && a1.every((d1, i) => definitionsEqual(d1, a2[i]));
}

function inOutMapsEqual(m1: InOutMap, m2: InOutMap): boolean {
    return m1.size === m2.size && [...m1.entries()].every(([k, v]) => m2.has(k) && propagationValuesEqual(v, m2.get(k)!));
}

function propagationValuesEqual(v1: PropagationValue, v2: PropagationValue): boolean {
    if (v1.kind === v2.kind && (v1.kind === 'NAC' || v1.kind === 'UNDEF')) return true;
    if (v1.kind === 'constant-number' && v2.kind === 'constant-number') return v1.value === v2.value;
    return false;
}

function definitionsEqual(d1: Definition, d2: Definition): boolean {
    return d1.target === d2.target
        && d1.use1.kind === d2.use1.kind
        && d1.use1.value === d2.use1.value
        && d1.kind === 'binary' && d2.kind === 'binary'
        && d1.use2.kind === d2.use2.kind
        && d1.use2.value === d2.use2.kind;
}

