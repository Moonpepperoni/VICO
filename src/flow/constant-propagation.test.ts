import { describe, expect, it } from 'vitest';
import {
    ConstantPropagation,
    type ConstantPropagationInput, type ConstantPropagationState,
    type Definition,
    extractDefinitions, type PropagationBinaryArithmeticOperator, type PropagationUnaryOperator
} from './constant-propagation';
import { TacProgram } from '../tac/program';
import { BasicBlockControlFlowGraph } from '../cfg/basic-blocks';
import { TacParser } from "../tac/parser.ts";
import type { TacInstruction } from "../tac/parser-types.ts";
import {TestCfg} from "./test-cfg.ts";
import {enableMapSet} from "immer";

enableMapSet();

type UseVar = { kind: 'variable', value: string };
type UseConst = { kind: 'constant', value: number };

export const u = {
    v: (name: string): UseVar => ({ kind: 'variable', value: name }),
    c: (value: number): UseConst => ({ kind: 'constant', value }),
};

export const d = {
    copy: (target: string, use: UseVar | UseConst): Definition => ({
        kind: 'copy',
        target,
        use1: use,
    }),
    unary: (
        target: string,
        op: PropagationUnaryOperator,
        use: UseVar | UseConst
    ): Definition => ({
        kind: 'unary',
        target,
        op,
        use1: use,
    }),
    binary: (
        target: string,
        op: PropagationBinaryArithmeticOperator,
        left: UseVar | UseConst,
        right: UseVar | UseConst
    ): Definition => ({
        kind: 'binary',
        target,
        op,
        use1: left,
        use2: right,
    }),
};


class ConstantPropagationInputBuilder {
    readonly entryId = 0;
    readonly exitId = -1;
    readonly edgeList: Array<[number, number]> = [];
    readonly dataNodeIds: number[] = [];
    readonly definitions = new Map<number, Array<Definition>>();
    private nextNodeId = 1;

    addNode({definitions = []}: { definitions?: Definition[] }) {
        const id = this.nextNodeId++;
        this.dataNodeIds.push(id);
        this.definitions.set(id, definitions);
        return id;
    }

    addEdges(src: number, ...targets: number[]) {
        this.edgeList.push(...(targets.map(t => [src, t] as [number, number])));
    }

    build(): ConstantPropagationInput {
        const predecessors = new Map<number, Set<number>>();
        const successors = new Map<number, Set<number>>();
        for (const [src, dst] of this.edgeList) {
            if (!predecessors.has(dst)) {
                predecessors.set(dst, new Set([]));
            }
            predecessors.get(dst)?.add(src);
        }
        for (const [src, dst] of this.edgeList) {
            if (!successors.has(src)) {
                successors.set(src, new Set([]));
            }
            successors.get(src)?.add(dst);
        }

        return {
            cfg: new TestCfg(this.dataNodeIds, this.entryId, this.exitId, [this.entryId, ...this.dataNodeIds, this.exitId], predecessors, successors),
            definitions: this.definitions,
        }
    }
}

function getFinalState(analysis: Generator<ConstantPropagationState>) {
    let finalState: ConstantPropagationState | undefined = undefined;

    for (const step of analysis) {
        finalState = step;
    }
    if (finalState === undefined) throw new Error("the generator yielded no steps");
    return finalState;
}

function expectOutEquals(testCFG: ConstantPropagationInput, expectedOut: Map<number, Map<string, string>>) {
    const analysis = ConstantPropagation(testCFG);
    const finalState = getFinalState(analysis);
    for (const [id, map] of expectedOut) {
        const actual = finalState.state.get(id)?.outMap.data;
        expect(actual, `out map of node ${id} did not match`).toEqual(map);
    }
}

function expectInEquals(testCFG: ConstantPropagationInput, expectedIn: Map<number, Map<string, string>>) {
    const analysis = ConstantPropagation(testCFG);
    const finalState = getFinalState(analysis);
    for (const [id, map] of expectedIn) {
        const actual = finalState.state.get(id)?.inMap.data;
        expect(actual, `in map of node ${id} did not match`).toEqual(map);
    }
}

describe('ReachingDefinitions Algo Test', () => {
    describe('linear code examples', () => {

        it('should overwrite variables from a previous block in new block', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 1
            // b = 2
            // c = 3
            // goto LABEL1
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(1)), d.copy('b', u.c(2)), d.copy('c', u.c(3))]});
            // LABEL1: a = 10
            // c = a + b
            // goto LABEL2
            const n2 = inputBuilder.addNode({definitions: [d.copy('a', u.c(10)), d.binary('c', '+',u.v('a'), u.v('b'))]});
            // LABEL2: result = - c
            // final = c + k
            const n3 = inputBuilder.addNode({definitions: [d.unary('result', '-', u.v('c')), d.binary('final', '+', u.v('c'), u.v('k'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n3, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '1'], ['b', '2'], ['c', '3']])],
                [n3, new Map([['a', '10'], ['b', '2'], ['c', '12']])],
                [inputBuilder.exitId, new Map([['a', '10'], ['b', '2'], ['c', '12'], ['result', '-12'], ['final', 'UNDEF']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '1'], ['b', '2'], ['c', '3']])],
                [n2, new Map([['a', '10'], ['b', '2'], ['c', '12']])],
                [n3, new Map([['a', '10'], ['b', '2'], ['c', '12'], ['result', '-12'], ['final', 'UNDEF']])],
                [inputBuilder.exitId, new Map([['a', '10'], ['b', '2'], ['c', '12'], ['result', '-12'], ['final', 'UNDEF']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });

        it('should apply lattice correctly to +', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();
            // a = 1
            // b = a + 2
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(1)), d.binary('b', '+', u.v('a'), u.c(2))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const algo = ConstantPropagation(algoInput);
            const finalState = getFinalState(algo);
            expect(finalState.state.get(inputBuilder.exitId)?.outMap.data).toEqual(new Map([['a', '1'], ['b', '3']]));
        });

        it('should apply lattice correctly to -', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();
            // a = 1
            // b = a - 2
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(1)), d.binary('b', '-', u.v('a'), u.c(2))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const algo = ConstantPropagation(algoInput);
            const finalState = getFinalState(algo);
            expect(finalState.state.get(inputBuilder.exitId)?.outMap.data).toEqual(new Map([['a', '1'], ['b', '-1']]));
        });

        it('should apply lattice correctly to *', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();
            // a = 1
            // b = a * 2
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(1)), d.binary('b', '*', u.v('a'), u.c(2))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const algo = ConstantPropagation(algoInput);
            const finalState = getFinalState(algo);
            expect(finalState.state.get(inputBuilder.exitId)?.outMap.data).toEqual(new Map([['a', '1'], ['b', '2']]));
        });

        it('should apply lattice correctly to /', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();
            // a = 1
            // b = a / 2
            // c = 4 / 2
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(1)), d.binary('b', '/', u.v('a'), u.c(2)), d.binary('c', '/',u.c(4),u.c(2) )]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const algo = ConstantPropagation(algoInput);
            const finalState = getFinalState(algo);
            expect(finalState.state.get(inputBuilder.exitId)?.outMap.data).toEqual(new Map([['a', '1'], ['b', '0'], ['c', '2']]));
        });

        it('should apply lattice correctly to %', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();
            // a = 3
            // b = a % 2
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(3)), d.binary('b', '%', u.v('a'), u.c(2))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const algo = ConstantPropagation(algoInput);
            const finalState = getFinalState(algo);
            expect(finalState.state.get(inputBuilder.exitId)?.outMap.data).toEqual(new Map([['a', '3'], ['b', '1']]));
        });

        it('should apply lattice correctly to copy', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();
            // a = 3
            // b = a
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(3)), d.copy('b',u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const algo = ConstantPropagation(algoInput);
            const finalState = getFinalState(algo);
            expect(finalState.state.get(inputBuilder.exitId)?.outMap.data).toEqual(new Map([['a', '3'], ['b', '3']]));
        });

        it('should apply lattice correctly to unary -', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();
            // a = 3
            // b = - a
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(3)), d.unary('b', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const algo = ConstantPropagation(algoInput);
            const finalState = getFinalState(algo);
            expect(finalState.state.get(inputBuilder.exitId)?.outMap.data).toEqual(new Map([['a', '3'], ['b', '-3']]));
        });
    });

    describe('two branches', () => {
        it('two_branches: variable assigned same constant in both branches, join keeps constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // x = 1
            // if x > 0 goto LABEL1
            const n1 = inputBuilder.addNode({definitions: [d.copy('x', u.c(1))]});

            // basic block 2:
            // LABEL1: a = 42
            // goto LABEL3
            const n2 = inputBuilder.addNode({definitions: [d.copy('a', u.c(42))]});

            // basic block 3:
            // LABEL2: a = 42
            const n3 = inputBuilder.addNode({definitions: [d.copy('a', u.c(42))]});

            // basic block 4:
            // LABEL3: c = a + 8
            // result = - a
            const n4 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(8)), d.unary('result', '-', u.v('a'))]});

            // wire CFG (include implicit entry/exit explicitly for jumps/flow)
            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2); // if-true to LABEL1
            inputBuilder.addEdges(n1, n3); // fallthrough/else to LABEL2
            inputBuilder.addEdges(n2, n4); // goto LABEL3
            inputBuilder.addEdges(n3, n4); // fallthrough to LABEL3
            inputBuilder.addEdges(n4, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['x', '1']])],
                [n3, new Map([['x', '1']])],
                [n4, new Map([['x', '1'], ['a', '42']])],
                [inputBuilder.exitId, new Map([['x', '1'], ['a', '42'], ['c', '50'], ['result', '-42']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['x', '1']])],
                [n2, new Map([['x', '1'], ['a', '42']])],
                [n3, new Map([['x', '1'], ['a', '42']])],
                [n4, new Map([['x', '1'], ['a', '42'], ['c', '50'], ['result', '-42']])],
                [inputBuilder.exitId, new Map([['x', '1'], ['a', '42'], ['c', '50'], ['result', '-42']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });

        it('two_branches: variable assigned different constants in the two branches so the join becomes non-constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // x = 0
            // if x > 0 goto LABEL1
            // goto LABEL2
            const n1 = inputBuilder.addNode({definitions: [d.copy('x', u.c(0))]});

            // basic block 2:
            // LABEL1: a = 5
            // goto LABEL3
            const n2 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5))]});

            // basic block 3:
            // LABEL2: a = 7
            // goto LABEL3
            const n3 = inputBuilder.addNode({definitions: [d.copy('a', u.c(7))]});

            // basic block 4:
            // LABEL3: c = a + 1
            // result = - a
            const n4 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2); // branch to LABEL1
            inputBuilder.addEdges(n1, n3); // branch to LABEL2
            inputBuilder.addEdges(n2, n4); // goto LABEL3
            inputBuilder.addEdges(n3, n4); // goto LABEL3
            inputBuilder.addEdges(n4, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['x', '0']])],
                [n3, new Map([['x', '0']])],
                [n4, new Map([['x', '0'], ['a', 'NAC']])],
                [inputBuilder.exitId, new Map([['x', '0'], ['a', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['x', '0']])],
                [n2, new Map([['x', '0'], ['a', '5']])],
                [n3, new Map([['x', '0'], ['a', '7']])],
                [n4, new Map([['x', '0'], ['a', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['x', '0'], ['a', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });

        it('two_branches: variable constant before split, one branch assigns UNDEF expression; join keeps the constant (ignore UNDEF)', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 10
            // x = 0
            // if x > 0 goto LABEL1
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(10)), d.copy('x', u.c(0))]});

            // basic block 2:
            // LABEL1: a = k + 1
            // goto LABEL3
            const n2 = inputBuilder.addNode({definitions: [d.binary('a', '+', u.v('k'), u.c(1))]});

            // basic block 3:
            // LABEL2: a = 10
            // goto LABEL3
            const n3 = inputBuilder.addNode({definitions: [d.copy('a', u.c(10))]});

            // basic block 4:
            // LABEL3: c = a + 2
            // result = - a
            const n4 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(2)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2); // true branch to LABEL1
            inputBuilder.addEdges(n1, n3); // false branch (fallthrough) to LABEL2
            inputBuilder.addEdges(n2, n4); // goto LABEL3
            inputBuilder.addEdges(n3, n4); // goto LABEL3
            inputBuilder.addEdges(n4, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '10'], ['x', '0']])],
                [n3, new Map([['a', '10'], ['x', '0']])],
                [n4, new Map([['a', '10'], ['x', '0']])],
                [inputBuilder.exitId, new Map([['a', '10'], ['x', '0'], ['c', '12'], ['result', '-10']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '10'], ['x', '0']])],
                [n2, new Map([['a', 'UNDEF'], ['x', '0']])],
                [n3, new Map([['a', '10'], ['x', '0']])],
                [n4, new Map([['a', '10'], ['x', '0'], ['c', '12'], ['result', '-10']])],
                [inputBuilder.exitId, new Map([['a', '10'], ['x', '0'], ['c', '12'], ['result', '-10']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('two_branches: variable constant before split, untouched in both branches so join preserves original constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 7
            // x = 1
            // if x > 0 goto LABEL1
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(7)), d.copy('x', u.c(1))]});

            // basic block 2:
            // LABEL1: x = x
            // goto LABEL3
            const n2 = inputBuilder.addNode({definitions: [d.copy('x', u.v('x'))]});

            // basic block 3:
            // LABEL2: x = x
            // goto LABEL3
            const n3 = inputBuilder.addNode({definitions: [d.copy('x', u.v('x'))]});

            // basic block 4:
            // LABEL3: c = a + 2
            // result = - a
            const n4 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(2)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2); // true branch to LABEL1
            inputBuilder.addEdges(n1, n3); // false branch to LABEL2
            inputBuilder.addEdges(n2, n4); // goto LABEL3
            inputBuilder.addEdges(n3, n4); // goto LABEL3
            inputBuilder.addEdges(n4, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '7'], ['x', '1']])],
                [n3, new Map([['a', '7'], ['x', '1']])],
                [n4, new Map([['a', '7'], ['x', '1']])],
                [inputBuilder.exitId, new Map([['a', '7'], ['x', '1'], ['c', '9'], ['result', '-7']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '7'], ['x', '1']])],
                [n2, new Map([['a', '7'], ['x', '1']])],
                [n3, new Map([['a', '7'], ['x', '1']])],
                [n4, new Map([['a', '7'], ['x', '1'], ['c', '9'], ['result', '-7']])],
                [inputBuilder.exitId, new Map([['a', '7'], ['x', '1'], ['c', '9'], ['result', '-7']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });

    })

    // 2
    describe('multiple branches', () => {
        it('three_branches: variable assigned the same constant in all arms so the join is that constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // b = 3
            // if y < 0 goto LABEL1
            const n1 = inputBuilder.addNode({definitions: [d.copy('b', u.c(3))]});

            // basic block 2:
            // LABEL1: a = 5
            // goto LABEL4
            const n2 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5))]});

            // basic block 3:
            // LABEL1B: if y > 0 goto LABEL2
            const n3 = inputBuilder.addNode({definitions: []});

            // basic block 4:
            // LABEL2: a = 5
            // goto LABEL4
            const n4 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5))]});

            // basic block 5:
            // LABEL3: a = 5
            // goto LABEL4
            const n5 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5))]});

            // basic block 6:
            // LABEL4: c = a + b
            // result = - a
            const n6 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(3)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2); // y < 0 -> LABEL1
            inputBuilder.addEdges(n1, n3); // else -> LABEL1B
            inputBuilder.addEdges(n3, n4); // y > 0 -> LABEL2
            inputBuilder.addEdges(n3, n5); // else -> LABEL3
            inputBuilder.addEdges(n2, n6); // -> LABEL4
            inputBuilder.addEdges(n4, n6); // -> LABEL4
            inputBuilder.addEdges(n5, n6); // -> LABEL4
            inputBuilder.addEdges(n6, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['b', '3']])],
                [n3, new Map([['b', '3']])],
                [n4, new Map([['b', '3']])],
                [n5, new Map([['b', '3']])],
                [n6, new Map([['a', '5'], ['b', '3']])],
                [inputBuilder.exitId, new Map([['a', '5'], ['b', '3'], ['c', '8'], ['result', '-5']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['b', '3']])],
                [n2, new Map([['a', '5'], ['b', '3']])],
                [n3, new Map([['b', '3']])],
                [n4, new Map([['a', '5'], ['b', '3']])],
                [n5, new Map([['a', '5'], ['b', '3']])],
                [n6, new Map([['a', '5'], ['b', '3'], ['c', '8'], ['result', '-5']])],
                [inputBuilder.exitId, new Map([['a', '5'], ['b', '3'], ['c', '8'], ['result', '-5']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('three_branches: variable assigned two different constants in two arms and untouched in the third so the join becomes NAC', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // x = 0
            // if x > 0 goto LABEL1
            const n1 = inputBuilder.addNode({definitions: [d.copy('x', u.c(0))]});

            // basic block 2:
            // LABEL1: a = 5
            // goto LABEL4
            const n2 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5))]});

            // basic block 3:
            // LABEL1B: if x < 0 goto LABEL2
            const n3 = inputBuilder.addNode({definitions: []});

            // basic block 4:
            // LABEL2: a = 7
            // goto LABEL4
            const n4 = inputBuilder.addNode({definitions: [d.copy('a', u.c(7))]});

            // basic block 5:
            // LABEL3: goto LABEL4
            const n5 = inputBuilder.addNode({definitions: []});

            // basic block 6:
            // LABEL4: c = a + 1
            // result = - a
            const n6 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2); // to LABEL1
            inputBuilder.addEdges(n1, n3); // to LABEL1B
            inputBuilder.addEdges(n3, n4); // to LABEL2
            inputBuilder.addEdges(n3, n5); // to LABEL3
            inputBuilder.addEdges(n2, n6); // to LABEL4
            inputBuilder.addEdges(n4, n6); // to LABEL4
            inputBuilder.addEdges(n5, n6); // to LABEL4
            inputBuilder.addEdges(n6, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['x', '0']])],
                [n3, new Map([['x', '0']])],
                [n4, new Map([['x', '0']])],
                [n5, new Map([['x', '0']])],
                [n6, new Map([['x', '0'], ['a', 'NAC']])],
                [inputBuilder.exitId, new Map([['x', '0'], ['a', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['x', '0']])],
                [n2, new Map([['x', '0'], ['a', '5']])],
                [n3, new Map([['x', '0']])],
                [n4, new Map([['x', '0'], ['a', '7']])],
                [n5, new Map([['x', '0']])],
                [n6, new Map([['x', '0'], ['a', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['x', '0'], ['a', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('three_branches: variable constant before split and only one arm redefines to a different constant so the join is NAC', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 4
            // x = 0
            // if x > 0 goto LABEL1
            // goto LABEL1B
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(4)), d.copy('x', u.c(0))]});

            // basic block 2:
            // LABEL1: goto LABEL4
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // LABEL1B: if x < 0 goto LABEL2
            // goto LABEL3
            const n3 = inputBuilder.addNode({definitions: []});

            // basic block 4:
            // LABEL2: a = 9
            // goto LABEL4
            const n4 = inputBuilder.addNode({definitions: [d.copy('a', u.c(9))]});

            // basic block 5:
            // LABEL3: goto LABEL4
            const n5 = inputBuilder.addNode({definitions: []});

            // basic block 6:
            // LABEL4: c = a + 1
            // result = - a
            const n6 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2); // -> LABEL1
            inputBuilder.addEdges(n1, n3); // -> LABEL1B
            inputBuilder.addEdges(n3, n4); // -> LABEL2
            inputBuilder.addEdges(n3, n5); // -> LABEL3
            inputBuilder.addEdges(n2, n6); // -> LABEL4
            inputBuilder.addEdges(n4, n6); // -> LABEL4
            inputBuilder.addEdges(n5, n6); // -> LABEL4
            inputBuilder.addEdges(n6, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '4'], ['x', '0']])],
                [n3, new Map([['a', '4'], ['x', '0']])],
                [n4, new Map([['a', '4'], ['x', '0']])],
                [n5, new Map([['a', '4'], ['x', '0']])],
                [n6, new Map([['a', 'NAC'], ['x', '0']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '4'], ['x', '0']])],
                [n2, new Map([['a', '4'], ['x', '0']])],
                [n3, new Map([['a', '4'], ['x', '0']])],
                [n4, new Map([['a', '9'], ['x', '0']])],
                [n5, new Map([['a', '4'], ['x', '0']])],
                [n6, new Map([['a', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('three_branches: same folded expression in each arm, join keeps that constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // x = 0
            // if x > 0 goto LABEL1
            // goto LABEL1B
            const n1 = inputBuilder.addNode({definitions: [d.copy('x', u.c(0))]});

            // basic block 2:
            // LABEL1: a = 2 + 3
            // goto LABEL4
            const n2 = inputBuilder.addNode({definitions: [d.binary('a', '+', u.c(2), u.c(3))]});

            // basic block 3:
            // LABEL1B: if x < 0 goto LABEL2
            // goto LABEL3
            const n3 = inputBuilder.addNode({definitions: []});

            // basic block 4:
            // LABEL2: a = 10 - 5
            // goto LABEL4
            const n4 = inputBuilder.addNode({definitions: [d.binary('a', '-', u.c(10), u.c(5))]});

            // basic block 5:
            // LABEL3: a = 1 * 5
            // goto LABEL4
            const n5 = inputBuilder.addNode({definitions: [d.binary('a', '*', u.c(1), u.c(5))]});

            // basic block 6:
            // LABEL4: c = a + 1
            // result = - a
            const n6 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n1, n3);
            inputBuilder.addEdges(n3, n4);
            inputBuilder.addEdges(n3, n5);
            inputBuilder.addEdges(n2, n6);
            inputBuilder.addEdges(n4, n6);
            inputBuilder.addEdges(n5, n6);
            inputBuilder.addEdges(n6, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['x', '0']])],
                [n3, new Map([['x', '0']])],
                [n4, new Map([['x', '0']])],
                [n5, new Map([['x', '0']])],
                [n6, new Map([['x', '0'], ['a', '5']])],
                [inputBuilder.exitId, new Map([['x', '0'], ['a', '5'], ['c', '6'], ['result', '-5']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['x', '0']])],
                [n2, new Map([['x', '0'], ['a', '5']])],
                [n3, new Map([['x', '0']])],
                [n4, new Map([['x', '0'], ['a', '5']])],
                [n5, new Map([['x', '0'], ['a', '5']])],
                [n6, new Map([['x', '0'], ['a', '5'], ['c', '6'], ['result', '-5']])],
                [inputBuilder.exitId, new Map([['x', '0'], ['a', '5'], ['c', '6'], ['result', '-5']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });



    });

    // 3
    describe('simple loop', () => {
        it('single_loop: variable initialized to a constant and never modified in the loop so it remains constant throughout and after the loop', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 5
            // i = 0
            // goto L1
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5)), d.copy('i', u.c(0))]});

            // basic block 2:
            // L1: if i < 3 goto L2
            // goto L3
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // L2: t = a + i
            // i = i + 1
            // goto L1
            const n3 = inputBuilder.addNode({definitions: [d.binary('t', '+', u.v('a'), u.v('i')), d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 4:
            // L3: c = a + 2
            // result = - a
            const n4 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(2)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n2, n4);
            inputBuilder.addEdges(n3, n2);
            inputBuilder.addEdges(n4, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '5'], ['i', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['a', '5'], ['i', 'NAC'], ['t', 'NAC']])],
                [n4, new Map([['a', '5'], ['i', 'NAC'], ['t', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', '5'], ['i', 'NAC'], ['t', 'NAC'], ['c', '7'], ['result', '-5']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '5'], ['i', '0']])],
                [n2, new Map([['a', '5'], ['i', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['a', '5'], ['i', 'NAC'], ['t', 'NAC']])],
                [n4, new Map([['a', '5'], ['i', 'NAC'], ['t', 'NAC'], ['c', '7'], ['result', '-5']])],
                [inputBuilder.exitId, new Map([['a', '5'], ['i', 'NAC'], ['t', 'NAC'], ['c', '7'], ['result', '-5']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('single_loop: variable initialized to a constant but incremented inside the loop so it becomes NAC at the header fixed point', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 5
            // i = 0
            // goto L1
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5)), d.copy('i', u.c(0))]});

            // basic block 2:
            // L1: if i < 3 goto L2
            // goto L3
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // L2: a = a + 1
            // i = i + 1
            // goto L1
            const n3 = inputBuilder.addNode({definitions: [d.binary('a', '+', u.v('a'), u.c(1)), d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 4:
            // L3: c = a + 2
            // result = - a
            const n4 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(2)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n2, n4);
            inputBuilder.addEdges(n3, n2);
            inputBuilder.addEdges(n4, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', 'NAC'], ['i', 'NAC']])],
                [n3, new Map([['a', 'NAC'], ['i', 'NAC']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '5'], ['i', '0']])],
                [n2, new Map([['a', 'NAC'], ['i', 'NAC']])],
                [n3, new Map([['a', 'NAC'], ['i', 'NAC']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('single_loop: loop-invariant constant computed inside loop body stabilizes as constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // i = 0
            // goto L1
            const n1 = inputBuilder.addNode({definitions: [d.copy('i', u.c(0))]});

            // basic block 2:
            // L1: if i < 3 goto L2
            // goto L3
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // L2: k = 2 + 3
            // i = i + 1
            // goto L1
            const n3 = inputBuilder.addNode({definitions: [d.binary('k', '+', u.c(2), u.c(3)), d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 4:
            // L3: c = k + 7
            // result = - k
            const n4 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('k'), u.c(7)), d.unary('result', '-', u.v('k'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n2, n4);
            inputBuilder.addEdges(n3, n2);
            inputBuilder.addEdges(n4, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['i', 'NAC'], ['k', '5']])],
                [n3, new Map([['i', 'NAC'], ['k', '5']])],
                [n4, new Map([['i', 'NAC'], ['k', '5']])],
                [inputBuilder.exitId, new Map([['i', 'NAC'], ['k', '5'], ['c', '12'], ['result', '-5']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['i', '0']])],
                [n2, new Map([['i', 'NAC'], ['k', '5']])],
                [n3, new Map([['i', 'NAC'], ['k', '5']])],
                [n4, new Map([['i', 'NAC'], ['k', '5'], ['c', '12'], ['result', '-5']])],
                [inputBuilder.exitId, new Map([['i', 'NAC'], ['k', '5'], ['c', '12'], ['result', '-5']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });


    });


    // 4
    describe('loop in loop', () => {
        it('loop_within_loop: variable constant before outer loop and only read inside both loops so it stays constant everywhere', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 7
            // i = 0
            // goto L_OUTER
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(7)), d.copy('i', u.c(0))]});

            // basic block 2:
            // L_OUTER: if i < 2 goto L_INNER_ENTRY
            // goto L_AFTER_OUTER
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // L_INNER_ENTRY: j = 0
            // goto L_INNER_HDR
            const n3 = inputBuilder.addNode({definitions: [d.copy('j', u.c(0))]});

            // basic block 4:
            // L_INNER_HDR: if j < 3 goto L_INNER_BODY
            // goto L_INNER_EXIT
            const n4 = inputBuilder.addNode({definitions: []});

            // basic block 5:
            // L_INNER_BODY: t = a + j
            // j = j + 1
            // goto L_INNER_HDR
            const n5 = inputBuilder.addNode({definitions: [d.binary('t', '+', u.v('a'), u.v('j')), d.binary('j', '+', u.v('j'), u.c(1))]});

            // basic block 6:
            // L_INNER_EXIT: i = i + 1
            // goto L_OUTER
            const n6 = inputBuilder.addNode({definitions: [d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 7:
            // L_AFTER_OUTER: c = a + 5
            // result = - a
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(5)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n2, n7);
            inputBuilder.addEdges(n3, n4);
            inputBuilder.addEdges(n4, n5);
            inputBuilder.addEdges(n4, n6);
            inputBuilder.addEdges(n5, n4);
            inputBuilder.addEdges(n6, n2);
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n4, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC'], ['c', '12'], ['result', '-7']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '7'], ['i', '0']])],
                [n2, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['a', '7'], ['i', 'NAC'], ['j', '0'], ['t', 'NAC']])],
                [n4, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC'], ['c', '12'], ['result', '-7']])],
                [inputBuilder.exitId, new Map([['a', '7'], ['i', 'NAC'], ['j', 'NAC'], ['t', 'NAC'], ['c', '12'], ['result', '-7']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('loop_within_loop: variable constant before outer loop but redefined in the inner loop body, making it NAC at the outer loop header after fixpoint', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 7
            // i = 0
            // goto L_OUTER
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(7)), d.copy('i', u.c(0))]});

            // basic block 2:
            // L_OUTER: if i < 2 goto L_INNER_ENTRY
            // goto L_AFTER_OUTER
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // L_INNER_ENTRY: j = 0
            // goto L_INNER_HDR
            const n3 = inputBuilder.addNode({definitions: [d.copy('j', u.c(0))]});

            // basic block 4:
            // L_INNER_HDR: if j < 3 goto L_INNER_BODY
            // goto L_INNER_EXIT
            const n4 = inputBuilder.addNode({definitions: []});

            // basic block 5:
            // L_INNER_BODY: a = a + j
            // j = j + 1
            // goto L_INNER_HDR
            const n5 = inputBuilder.addNode({definitions: [d.binary('a', '+', u.v('a'), u.v('j')), d.binary('j', '+', u.v('j'), u.c(1))]});

            // basic block 6:
            // L_INNER_EXIT: i = i + 1
            // goto L_OUTER
            const n6 = inputBuilder.addNode({definitions: [d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 7:
            // L_AFTER_OUTER: c = a + 5
            // result = - a
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(5)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n2, n7);
            inputBuilder.addEdges(n3, n4);
            inputBuilder.addEdges(n4, n5);
            inputBuilder.addEdges(n4, n6);
            inputBuilder.addEdges(n5, n4);
            inputBuilder.addEdges(n6, n2);
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n3, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n5, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n6, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n7, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '7'], ['i', '0']])],
                [n2, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n3, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', '0']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n5, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n6, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC']])],
                [n7, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['j', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('loop_within_loop: inner variable constant from constants inside inner loop; constant within inner iterations but does not escape if outer redefines it', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // i = 0
            // goto L_OUTER
            const n1 = inputBuilder.addNode({definitions: [d.copy('i', u.c(0))]});

            // basic block 2:
            // L_OUTER: if i < 2 goto L_INNER_ENTRY
            // goto L_AFTER_OUTER
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // L_INNER_ENTRY: k = 2 + 3
            // j = 0
            // goto L_INNER_HDR
            const n3 = inputBuilder.addNode({definitions: [d.binary('k', '+', u.c(2), u.c(3)), d.copy('j', u.c(0))]});

            // basic block 4:
            // L_INNER_HDR: if j < 3 goto L_INNER_BODY
            // goto L_INNER_EXIT
            const n4 = inputBuilder.addNode({definitions: []});

            // basic block 5:
            // L_INNER_BODY: t = k + j
            // j = j + 1
            // goto L_INNER_HDR
            const n5 = inputBuilder.addNode({definitions: [d.binary('t', '+', u.v('k'), u.v('j')), d.binary('j', '+', u.v('j'), u.c(1))]});

            // basic block 6:
            // L_INNER_EXIT: k = k + i
            // i = i + 1
            // goto L_OUTER
            const n6 = inputBuilder.addNode({definitions: [d.binary('k', '+', u.v('k'), u.v('i')), d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 7:
            // L_AFTER_OUTER: c = k + 2
            // result = - k
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('k'), u.c(2)), d.unary('result', '-', u.v('k'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n2, n7);
            inputBuilder.addEdges(n3, n4);
            inputBuilder.addEdges(n4, n5);
            inputBuilder.addEdges(n4, n6);
            inputBuilder.addEdges(n5, n4);
            inputBuilder.addEdges(n6, n2);
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['i', 'NAC'], ['k', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['i', 'NAC'], ['k', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n4, new Map([['i', 'NAC'], ['k', '5'], ['j', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['i', 'NAC'], ['k', '5'], ['j', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['i', 'NAC'], ['k', '5'], ['j', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['i', 'NAC'], ['k', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [inputBuilder.exitId, new Map([['i', 'NAC'], ['k', 'NAC'], ['j', 'NAC'], ['t', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['i', '0']])],
                [n2, new Map([['i', 'NAC'], ['k', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['i', 'NAC'], ['k', '5'], ['j', '0'], ['t', 'NAC']])],
                [n4, new Map([['i', 'NAC'], ['k', '5'], ['j', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['i', 'NAC'], ['k', '5'], ['j', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['i', 'NAC'], ['k', 'NAC'], ['j', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['i', 'NAC'], ['k', 'NAC'], ['j', 'NAC'], ['t', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['i', 'NAC'], ['k', 'NAC'], ['j', 'NAC'], ['t', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });


    });

    // 5
    describe('branches in a loop', () => {
        it('two_branches_in_loop: variable constant before loop, one branch reassigns different constant and the other leaves it, header converges to NAC', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 4
            // i = 0
            // goto L1
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(4)), d.copy('i', u.c(0))]});

            // basic block 2:
            // L1: if i < 3 goto L2
            // goto L4
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // L2: t = i % 2
            // if t > 0 goto L3
            // goto L5
            const n3 = inputBuilder.addNode({definitions: [d.binary('t', '%', u.v('i'), u.c(2))]});

            // basic block 4:
            // L3: a = 9
            // goto L6
            const n4 = inputBuilder.addNode({definitions: [d.copy('a', u.c(9))]});

            // basic block 5:
            // L5: goto L6
            const n5 = inputBuilder.addNode({definitions: []});

            // basic block 6:
            // L6: i = i + 1
            // goto L1
            const n6 = inputBuilder.addNode({definitions: [d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 7:
            // L4: c = a + 1
            // result = - a
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3); // i < 3 -> L2
            inputBuilder.addEdges(n2, n7); // else -> L4
            inputBuilder.addEdges(n3, n4); // t > 0 -> L3
            inputBuilder.addEdges(n3, n5); // else -> L5
            inputBuilder.addEdges(n4, n6); // -> L6
            inputBuilder.addEdges(n5, n6); // -> L6
            inputBuilder.addEdges(n6, n2); // back to L1
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '4'], ['i', '0']])],
                [n2, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n4, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['t', 'NAC'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('two_branches_in_loop: both branches assign the same constant each iteration so the loop header stabilizes to that constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 9
            // i = 0
            // goto L1
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(9)), d.copy('i', u.c(0))]});

            // basic block 2:
            // L1: if i < 3 goto L2
            // goto L4
            const n2 = inputBuilder.addNode({definitions: []});

            // basic block 3:
            // L2: t = i % 2
            // if t > 0 goto L3
            // goto L5
            const n3 = inputBuilder.addNode({definitions: [d.binary('t', '%', u.v('i'), u.c(2))]});

            // basic block 4:
            // L3: a = 9
            // goto L6
            const n4 = inputBuilder.addNode({definitions: [d.copy('a', u.c(9))]});

            // basic block 5:
            // L5: a = 9
            // goto L6
            const n5 = inputBuilder.addNode({definitions: [d.copy('a', u.c(9))]});

            // basic block 6:
            // L6: i = i + 1
            // goto L1
            const n6 = inputBuilder.addNode({definitions: [d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 7:
            // L4: c = a + 1
            // result = - a
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n2, n7);
            inputBuilder.addEdges(n3, n4);
            inputBuilder.addEdges(n3, n5);
            inputBuilder.addEdges(n4, n6);
            inputBuilder.addEdges(n5, n6);
            inputBuilder.addEdges(n6, n2);
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n4, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC'], ['c', '10'], ['result', '-9']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '9'], ['i', '0']])],
                [n2, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n3, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n4, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC'], ['c', '10'], ['result', '-9']])],
                [inputBuilder.exitId, new Map([['a', '9'], ['i', 'NAC'], ['t', 'NAC'], ['c', '10'], ['result', '-9']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });



    });

    // 6
    describe('loops with branches', () => {
        it('loop_in_branch: variable constant before split and redefined to a different constant inside the looped branch, making the join NAC', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 4
            // x = 0
            // if x > 0 goto L_LOOP_ENTRY
            // goto L_ELSE
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(4)), d.copy('x', u.c(0))]});

            // basic block 2:
            // L_LOOP_ENTRY: i = 0
            // goto L_HDR
            const n2 = inputBuilder.addNode({definitions: [d.copy('i', u.c(0))]});

            // basic block 3:
            // L_ELSE: goto L_JOIN
            const n3 = inputBuilder.addNode({definitions: []});

            // basic block 4:
            // L_HDR: if i < 3 goto L_BODY
            // goto L_EXIT
            const n4 = inputBuilder.addNode({definitions: []});

            // basic block 5:
            // L_BODY: a = 9
            // i = i + 1
            // goto L_HDR
            const n5 = inputBuilder.addNode({definitions: [d.copy('a', u.c(9)), d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 6:
            // L_EXIT: goto L_JOIN
            const n6 = inputBuilder.addNode({definitions: []});

            // basic block 7:
            // L_JOIN: c = a + 1
            // result = - a
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n1, n3);
            inputBuilder.addEdges(n2, n4);
            inputBuilder.addEdges(n4, n5);
            inputBuilder.addEdges(n4, n6);
            inputBuilder.addEdges(n5, n4);
            inputBuilder.addEdges(n3, n7);
            inputBuilder.addEdges(n6, n7);
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '4'], ['x', '0']])],
                [n3, new Map([['a', '4'], ['x', '0']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n5, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n6, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n7, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '4'], ['x', '0']])],
                [n2, new Map([['a', '4'], ['x', '0'], ['i', '0']])],
                [n3, new Map([['a', '4'], ['x', '0']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n5, new Map([['a', '9'], ['i', 'NAC'], ['x', '0']])],
                [n6, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n7, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('loop_in_branch: variable constant before split and untouched in both paths so the join preserves the constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 7
            // x = 0
            // if x > 0 goto L_LOOP_ENTRY
            // goto L_ELSE
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(7)), d.copy('x', u.c(0))]});

            // basic block 2:
            // L_LOOP_ENTRY: i = 0
            // goto L_HDR
            const n2 = inputBuilder.addNode({definitions: [d.copy('i', u.c(0))]});

            // basic block 3:
            // L_ELSE: goto L_JOIN
            const n3 = inputBuilder.addNode({definitions: []});

            // basic block 4:
            // L_HDR: if i < 3 goto L_BODY
            // goto L_EXIT
            const n4 = inputBuilder.addNode({definitions: []});

            // basic block 5:
            // L_BODY: t = a + i
            // i = i + 1
            // goto L_HDR
            const n5 = inputBuilder.addNode({definitions: [d.binary('t', '+', u.v('a'), u.v('i')), d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 6:
            // L_EXIT: goto L_JOIN
            const n6 = inputBuilder.addNode({definitions: []});

            // basic block 7:
            // L_JOIN: c = a + 1
            // result = - a
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n1, n3);
            inputBuilder.addEdges(n2, n4);
            inputBuilder.addEdges(n4, n5);
            inputBuilder.addEdges(n4, n6);
            inputBuilder.addEdges(n5, n4);
            inputBuilder.addEdges(n3, n7);
            inputBuilder.addEdges(n6, n7);
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '7'], ['x', '0']])],
                [n3, new Map([['a', '7'], ['x', '0']])],
                [n4, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC'], ['c', '8'], ['result', '-7']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '7'], ['x', '0']])],
                [n2, new Map([['a', '7'], ['x', '0'], ['i', '0']])],
                [n3, new Map([['a', '7'], ['x', '0']])],
                [n4, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC']])],
                [n5, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC']])],
                [n6, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC']])],
                [n7, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC'], ['c', '8'], ['result', '-7']])],
                [inputBuilder.exitId, new Map([['a', '7'], ['x', '0'], ['i', 'NAC'], ['t', 'NAC'], ['c', '8'], ['result', '-7']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('loop_in_branch: looped branch assigns the same constant and non-loop branch assigns the same constant; join preserves that constant', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // x = 0
            // if x > 0 goto L_LOOP_ENTRY
            // goto L_ELSE
            const n1 = inputBuilder.addNode({definitions: [d.copy('x', u.c(0))]});

            // basic block 2:
            // L_LOOP_ENTRY: i = 0
            // goto L_HDR
            const n2 = inputBuilder.addNode({definitions: [d.copy('i', u.c(0))]});

            // basic block 3:
            // L_HDR: if i < 2 goto L_BODY
            // goto L_EXIT
            const n3 = inputBuilder.addNode({definitions: []});

            // basic block 4:
            // L_BODY: a = 5
            // i = i + 1
            // goto L_HDR
            const n4 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5)), d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 5:
            // L_EXIT: a = 5
            // goto L_JOIN
            const n5 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5))]});

            // basic block 6:
            // L_ELSE: a = 5
            // goto L_JOIN
            const n6 = inputBuilder.addNode({definitions: [d.copy('a', u.c(5))]});

            // basic block 7:
            // L_JOIN: c = a + 1
            // result = - a
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(1)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n1, n6);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n3, n4);
            inputBuilder.addEdges(n3, n5);
            inputBuilder.addEdges(n4, n3);
            inputBuilder.addEdges(n5, n7);
            inputBuilder.addEdges(n6, n7);
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['x', '0']])],
                [n3, new Map([['x', '0'], ['i', 'NAC'], ['a', '5']])],
                [n4, new Map([['x', '0'], ['i', 'NAC'], ['a', '5']])],
                [n5, new Map([['x', '0'], ['i', 'NAC'], ['a', '5']])],
                [n6, new Map([['x', '0']])],
                [n7, new Map([['x', '0'], ['i', 'NAC'], ['a', '5']])],
                [inputBuilder.exitId, new Map([['x', '0'], ['i', 'NAC'], ['a', '5'], ['c', '6'], ['result', '-5']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['x', '0']])],
                [n2, new Map([['x', '0'], ['i', '0']])],
                [n3, new Map([['x', '0'], ['i', 'NAC'], ['a', '5']])],
                [n4, new Map([['x', '0'], ['i', 'NAC'], ['a', '5']])],
                [n5, new Map([['x', '0'], ['i', 'NAC'], ['a', '5']])],
                [n6, new Map([['x', '0'], ['a', '5']])],
                [n7, new Map([['x', '0'], ['i', 'NAC'], ['a', '5'], ['c', '6'], ['result', '-5']])],
                [inputBuilder.exitId, new Map([['x', '0'], ['i', 'NAC'], ['a', '5'], ['c', '6'], ['result', '-5']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });
        it('loop_in_branch: looped branch makes the variable non-constant while the other keeps it constant, so the join is NAC', () => {
            const inputBuilder = new ConstantPropagationInputBuilder();

            // basic block 1:
            // a = 4
            // x = 0
            // if x > 0 goto L_LOOP_ENTRY
            // goto L_ELSE
            const n1 = inputBuilder.addNode({definitions: [d.copy('a', u.c(4)), d.copy('x', u.c(0))]});

            // basic block 2:
            // L_LOOP_ENTRY: i = 0
            // goto L_HDR
            const n2 = inputBuilder.addNode({definitions: [d.copy('i', u.c(0))]});

            // basic block 3:
            // L_ELSE: goto L_JOIN
            const n3 = inputBuilder.addNode({definitions: []});

            // basic block 4:
            // L_HDR: if i < 3 goto L_BODY
            // goto L_EXIT
            const n4 = inputBuilder.addNode({definitions: []});

            // basic block 5:
            // L_BODY: a = a + 1
            // i = i + 1
            // goto L_HDR
            const n5 = inputBuilder.addNode({definitions: [d.binary('a', '+', u.v('a'), u.c(1)), d.binary('i', '+', u.v('i'), u.c(1))]});

            // basic block 6:
            // L_EXIT: goto L_JOIN
            const n6 = inputBuilder.addNode({definitions: []});

            // basic block 7:
            // L_JOIN: c = a + 2
            // result = - a
            const n7 = inputBuilder.addNode({definitions: [d.binary('c', '+', u.v('a'), u.c(2)), d.unary('result', '-', u.v('a'))]});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n1, n3);
            inputBuilder.addEdges(n2, n4);
            inputBuilder.addEdges(n4, n5);
            inputBuilder.addEdges(n4, n6);
            inputBuilder.addEdges(n5, n4);
            inputBuilder.addEdges(n3, n7);
            inputBuilder.addEdges(n6, n7);
            inputBuilder.addEdges(n7, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([])],
                [n2, new Map([['a', '4'], ['x', '0']])],
                [n3, new Map([['a', '4'], ['x', '0']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n5, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n6, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n7, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            const finalOutMaps = new Map<number, Map<string, string>>([
                [inputBuilder.entryId, new Map([])],
                [n1, new Map([['a', '4'], ['x', '0']])],
                [n2, new Map([['a', '4'], ['x', '0'], ['i', '0']])],
                [n3, new Map([['a', '4'], ['x', '0']])],
                [n4, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n5, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n6, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0']])],
                [n7, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
                [inputBuilder.exitId, new Map([['a', 'NAC'], ['i', 'NAC'], ['x', '0'], ['c', 'NAC'], ['result', 'NAC']])],
            ]);

            expectInEquals(algoInput, finalInMaps);
            expectOutEquals(algoInput, finalOutMaps);
        });

    });
});

describe('extractDefinitions', () => {
    function createBasicBlocksMapFromCode(code: string) {
        const program = TacProgram.fromParsedInstructions(new TacParser(code).parseTac());
        const cfg = new BasicBlockControlFlowGraph(program);

        // Convert the CFG to the required Map<number, Array<TacInstruction>> format
        const basicBlocks = new Map<number, TacInstruction[]>();
        for (const nodeId of cfg.dataNodeIds) {
            const instructions = cfg.getNodeInstructions(nodeId);
            basicBlocks.set(nodeId, [...instructions.values()]);
        }

        return basicBlocks;
    }

    it('should correctly extract a simple constant assignment', () => {
        const basicBlocks = createBasicBlocksMapFromCode('x = 42');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'copy',
            target: 'x',
            use1: { kind: 'constant', value: 42 }
        });
    });

    it('should correctly extract a variable assignment', () => {
        const basicBlocks = createBasicBlocksMapFromCode('y = x');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'copy',
            target: 'y',
            use1: { kind: 'variable', value: 'x' }
        });
    });

    it('should correctly handle binary operations with two variables', () => {
        const basicBlocks = createBasicBlocksMapFromCode('z = x + y');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'binary',
            target: 'z',
            op: '+',
            use1: { kind: 'variable', value: 'x' },
            use2: { kind: 'variable', value: 'y' }
        });
    });

    it('should correctly handle binary operations with constants and variables', () => {
        const basicBlocks = createBasicBlocksMapFromCode('z = 5 + y');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'binary',
            target: 'z',
            op: '+',
            use1: { kind: 'constant', value: 5 },
            use2: { kind: 'variable', value: 'y' }
        });
    });

    it('should correctly handle unary operations with variables', () => {
        const basicBlocks = createBasicBlocksMapFromCode('y = - x');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'unary',
            target: 'y',
            op: '-',
            use1: { kind: 'variable', value: 'x' }
        });
    });

    it('should correctly handle unary operations with constants', () => {
        const basicBlocks = createBasicBlocksMapFromCode('y = - 5');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'unary',
            target: 'y',
            op: '-',
            use1: { kind: 'constant', value: 5 }
        });
    });

    it('should correctly extract definitions from multiple blocks', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            x = 10
            if x == 1 goto L1
            y = 20
            goto L2
            L1: y = 30
            L2: z = x + y
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        // Überprüfe, dass wir mehrere Blöcke haben
        expect(definitions.size).toBeGreaterThan(1);

        // Zähle die Gesamtanzahl der Definitionen
        let totalDefs = 0;
        for (const defs of definitions.values()) {
            totalDefs += defs.length;
        }

        // Wir sollten 4 Definitionen haben: x=10, y=20, y=30, z=x+y
        expect(totalDefs).toBe(4);

        // Prüfe, ob wir beide y-Definitionen haben
        let yDefs = 0;
        for (const defs of definitions.values()) {
            for (const def of defs) {
                if (def.target === 'y') {
                    yDefs++;
                    expect(def.kind).toBe('copy');
                    expect(def.use1.kind).toBe('constant');
                    expect([20, 30]).toContain(def.use1.value);
                }
            }
        }
        expect(yDefs).toBe(2);
    });

    it('should correctly extract definitions from copy instructions', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            x = 5
            y = x
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(2);

        // Check first definition
        expect(blockDefs?.[0]).toEqual({
            kind: 'copy',
            target: 'x',
            use1: { kind: 'constant', value: 5 }
        });

        // Check copy definition
        expect(blockDefs?.[1]).toEqual({
            kind: 'copy',
            target: 'y',
            use1: { kind: 'variable', value: 'x' }
        });
    });

    it('should not extract definitions from non-assignment instructions', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            x = 5
            L2: if x == 10 goto L1
            L1: goto L2
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        // Zähle die Gesamtanzahl der Definitionen
        let totalDefs = 0;
        for (const defs of definitions.values()) {
            totalDefs += defs.length;
        }

        // Wir sollten nur eine Definition haben: x=5
        expect(totalDefs).toBe(1);
    });

    it('should handle complex expressions with multiple blocks and assignments', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            i = 0
            sum = 0
            L1: if i >= 5 goto L2
            sum = sum + i
            i = i + 1
            goto L1
            L2: result = sum
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        // Zähle die Gesamtanzahl der Definitionen
        let totalDefs = 0;
        for (const defs of definitions.values()) {
            totalDefs += defs.length;
        }

        // Wir sollten 5 Definitionen haben: i=0, sum=0, sum=sum+i, i=i+1, result=sum
        expect(totalDefs).toBe(5);

        // Prüfe, ob wir die Loop-Inkrementierung haben
        let foundIncrement = false;
        for (const defs of definitions.values()) {
            for (const def of defs) {
                if (def.target === 'i' && def.kind === 'binary' && def.op === '+' &&
                    def.use1?.kind === 'variable' && def.use1.value === 'i' &&
                    def.use2?.kind === 'constant' && def.use2.value === 1) {
                    foundIncrement = true;
                }
            }
        }
        expect(foundIncrement).toBe(true);
    });

    it('should correctly extract multiple definitions in a single block', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            a = 1
            b = 2
            c = 3
            d = a + b
            e = b * c
            f = d - e
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(6);

        // Check last definition
        const lastDef = blockDefs?.[5];
        expect(lastDef).toBeDefined();
        expect(lastDef?.kind).toEqual('binary');
        expect(lastDef?.target).toBe('f');
        if (lastDef?.kind !== 'binary') {
            throw new Error('should never happen');
        }
        expect(lastDef?.op).toBe('-');
        expect(lastDef?.use1).toEqual({ kind: 'variable', value: 'd' });
        expect(lastDef?.use2).toEqual({ kind: 'variable', value: 'e' });
    });

    it('should correctly extract redefinitions in a single block', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            y = 0
            x = y + 10
            x = x + x
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(3);

        // First definition: y = 0
        expect(blockDefs?.[0]).toEqual({
            kind: 'copy',
            target: 'y',
            use1: { kind: 'constant', value: 0 }
        });

        // Second definition: x = y + 10
        expect(blockDefs?.[1]).toEqual({
            kind: 'binary',
            target: 'x',
            op: '+',
            use1: { kind: 'variable', value: 'y' },
            use2: { kind: 'constant', value: 10 }
        });

        // Third definition: x = x + x
        expect(blockDefs?.[2]).toEqual({
            kind: 'binary',
            target: 'x',
            op: '+',
            use1: { kind: 'variable', value: 'x' },
            use2: { kind: 'variable', value: 'x' }
        });
    });
});