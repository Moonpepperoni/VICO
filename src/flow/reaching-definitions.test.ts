import {describe, expect, it, test} from 'vitest';
import {
    extractGenAndKillFromBasicBlocks, ReachingDefinitions,
    type ReachingDefinitionsInput,
    type ReachingDefinitionsState
} from './reaching-definitions';
import { TacProgram } from '../tac/program';
import { BasicBlockControlFlowGraph } from '../cfg/basic-blocks';
import {TacParser} from "../tac/parser.ts";
import {enableMapSet} from "immer";
import {TestCfg} from "./test-cfg.ts";

// must be enabled for the tests
enableMapSet();


class ReachingDefinitionsInputBuilder {
    readonly entryId = 0;
    readonly exitId = -1;
    readonly edgeList: Array<[number, number]> = [];
    readonly dataNodeIds: number[] = [];
    readonly genSets = new Map<number, Set<string>>();
    readonly killSets = new Map<number, Set<string>>();
    private nextNodeId = 1;

    addNode({gen = [], kill = []}: { gen?: string[], kill?: string[] }) {
        const id = this.nextNodeId++;
        this.dataNodeIds.push(id);
        this.genSets.set(id, new Set(gen));
        this.killSets.set(id, new Set(kill));
        return id;
    }

    addEdges(src: number, ...targets: number[]) {
        this.edgeList.push(...(targets.map(t => [src, t] as [number, number])));
    }


    build(): ReachingDefinitionsInput {
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
            // not necessary for the tests
            instructionGenNames: new Map<number, string>(),
            cfg: new TestCfg(this.dataNodeIds, this.entryId, this.exitId, [this.entryId, ...this.dataNodeIds, this.exitId], predecessors, successors),
            gen: this.genSets,
            kill: this.killSets
        }
    }
}

function getFinalState(analysis: Generator<ReachingDefinitionsState>) {
    let finalState: ReachingDefinitionsState | undefined = undefined;

    for (const step of analysis) {
        finalState = step;
    }
    if (finalState === undefined) throw new Error("the generator yielded no steps");
    return finalState;
}

function expectOutEquals(testCFG: ReachingDefinitionsInput, expectedOut: Map<number, Set<string>>) {
    const analysis = ReachingDefinitions(testCFG);
    const finalState = getFinalState(analysis);
    for (const [id, set] of expectedOut) {
        const actual = finalState.state.get(id)?.outSet.data;
        expect(actual, `out set of node ${id} did not match`).toEqual(set);
    }
}

function expectInEquals(testCFG: ReachingDefinitionsInput, expectedIn: Map<number, Set<string>>) {
    const analysis = ReachingDefinitions(testCFG);
    const finalState = getFinalState(analysis);
    for (const [id, set] of expectedIn) {
        const actual = finalState.state.get(id)?.inSet.data;
        expect(actual, `in set of node ${id} did not match`).toEqual(set);
    }
}

describe('ReachingDefinitions Algo Test', () => {
    describe('linear code examples', () => {
        it('should overwrite variables from a previous block in new block', () => {
            const inputBuilder = new ReachingDefinitionsInputBuilder();

            // basic block 1:
            // d1 | a = 1
            // d2 | b = 2
            // d3 | c = 3
            // goto LABEL1
            const n1 = inputBuilder.addNode({gen: ['d1', 'd2', 'd3'], kill: ['d4', 'd5', 'd6']});
            // LABEL1: d4 | a = 2
            // d5 | b = 3
            // d6 | c  = 4
            // d7 | d = 5
            const n2 = inputBuilder.addNode({gen: ['d4', 'd5', 'd6', 'd7'], kill: ['d1', 'd2', 'd3']});
            // LABEL2:
            // d8 | result = d
            const n3 = inputBuilder.addNode({gen: ['d8']});

            inputBuilder.addEdges(inputBuilder.entryId, n1);
            inputBuilder.addEdges(n1, n2);
            inputBuilder.addEdges(n2, n3);
            inputBuilder.addEdges(n3, inputBuilder.exitId);

            const algoInput = inputBuilder.build();

            const finalInSets = new Map<number, Set<string>>([
                [inputBuilder.entryId, new Set([])],
                [n1, new Set([])],
                [n2, new Set(['d1', 'd2', 'd3'])],
                [n3, new Set(['d4', 'd5', 'd6', 'd7'])],
                [inputBuilder.exitId, new Set(['d4', 'd5', 'd6', 'd7', 'd8'])],
            ]);

            const finalOutSets = new Map<number, Set<string>>([
                [inputBuilder.entryId, new Set([])],
                [n1, new Set(['d1', 'd2', 'd3'])],
                [n2, new Set(['d4', 'd5', 'd6', 'd7'])],
                [n3, new Set(['d4', 'd5', 'd6', 'd7', 'd8'])],
                [inputBuilder.exitId, new Set(['d4', 'd5', 'd6', 'd7', 'd8'])],
            ])

            expectInEquals(algoInput, finalInSets);
            expectOutEquals(algoInput, finalOutSets);
        })



    });


    describe('complex control flow examples', () => {

        describe('two branches', () =>{
            it('two_branches, same variable defined in both branches and its reaching definition at the join should be the set of both defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // if x < 0 goto LABEL1
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: [] });

                // LABEL1:
                // d3 | a = 1
                // goto LABEL3
                const n2 = inputBuilder.addNode({ gen: ['d3'], kill: ['d4'] });

                // LABEL2:
                // d4 | a = 2
                // goto LABEL3
                const n3 = inputBuilder.addNode({ gen: ['d4'], kill: ['d3'] });

                // LABEL3:
                // d5 | result = a
                const n4 = inputBuilder.addNode({ gen: ['d5'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n1, n3);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n3, n4);
                inputBuilder.addEdges(n4, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd3', 'd4', 'd5'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1', 'd3'])],
                    [n3, new Set(['d1', 'd4'])],
                    [n4, new Set(['d1', 'd3', 'd4', 'd5'])],
                    [inputBuilder.exitId, new Set(['d1', 'd3', 'd4', 'd5'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });

            it('two_branches, variable defined before the branch and killed by a redefinition in only one branch so the join sees either one or two reaching defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | a = 1
                // if a < 0 goto LABEL1
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // LABEL1:
                // d2 | a = 2
                // goto LABEL3
                const n2 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // LABEL2:
                // d3 | b = 0
                // goto LABEL3
                const n3 = inputBuilder.addNode({ gen: ['d3'], kill: [] });

                // LABEL3:
                // d4 | result = a
                const n4 = inputBuilder.addNode({ gen: ['d4'], kill: [] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2); // true branch to LABEL1
                inputBuilder.addEdges(n1, n3); // fallthrough to LABEL2
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n3, n4);
                inputBuilder.addEdges(n4, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d2'])],
                    [n3, new Set(['d1', 'd3'])],
                    [n4, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });

            it('two_branches, variable defined only in one branch and used after the join so the analysis must include the pre-branch def to avoid an empty set', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 1
                // if x < 0 goto L1
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // L1:
                // d2 | x = 2
                // goto L3
                const n2 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // L2:
                // d3 | y = 0
                // goto L3
                const n3 = inputBuilder.addNode({ gen: ['d3'] });

                // L3:
                // d4 | result = x
                const n4 = inputBuilder.addNode({ gen: ['d4'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2); // true branch to L1
                inputBuilder.addEdges(n1, n3); // fallthrough to L2
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n3, n4);
                inputBuilder.addEdges(n4, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d2'])],
                    [n3, new Set(['d1', 'd3'])],
                    [n4, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('two_branches, two different variables each redefined in separate branches to test independent gen/kill sets', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | a = 1
                // d2 | b = 2
                // if a < b goto L1
                const n1 = inputBuilder.addNode({ gen: ['d1', 'd2'], kill: ['d3', 'd4'] });

                // L1:
                // d3 | a = 3
                // goto L3
                const n2 = inputBuilder.addNode({ gen: ['d3'], kill: ['d1'] });

                // L2:
                // d4 | b = 4
                // goto L3
                const n3 = inputBuilder.addNode({ gen: ['d4'], kill: ['d2'] });

                // L3:
                // d5 | result = a + b
                const n4 = inputBuilder.addNode({ gen: ['d5'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n1, n3);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n3, n4);
                inputBuilder.addEdges(n4, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1', 'd2'])],
                    [n2, new Set(['d2', 'd3'])],
                    [n3, new Set(['d1', 'd4'])],
                    [n4, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });




        });

        //2
        describe('multiple branches', () => {
            it('three_branches, variable defined in all three arms and the join point collects three reaching defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // if 1 < 0 goto L1
                const n1 = inputBuilder.addNode({ gen: [], kill: [] });

                // LTEST2:
                // if 2 < 1 goto L2
                const n2 = inputBuilder.addNode({ gen: [], kill: [] });

                // L1:
                // d1 | a = 10
                // goto LJOIN
                const n3 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2', 'd3'] });

                // L2:
                // d2 | a = 20
                // goto LJOIN
                const n4 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1', 'd3'] });

                // L3:
                // d3 | a = 30
                // goto LJOIN
                const n5 = inputBuilder.addNode({ gen: ['d3'], kill: ['d1', 'd2'] });

                // LJOIN:
                // d4 | result = a
                const n6 = inputBuilder.addNode({ gen: ['d4'], kill: [] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n3);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n5);
                inputBuilder.addEdges(n3, n6);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n5, n6);
                inputBuilder.addEdges(n6, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set([])],
                    [n3, new Set([])],
                    [n4, new Set([])],
                    [n5, new Set([])],
                    [n6, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set([])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d2'])],
                    [n5, new Set(['d3'])],
                    [n6, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('three_branches, variable defined before split and redefined in exactly one arm so the join has old+new defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 1
                // goto LTEST1
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // LTEST1:
                // if 1 < 0 goto L1
                const n2 = inputBuilder.addNode({ gen: [] });

                // L1:
                // d2 | x = 2
                // goto LJOIN
                const n3 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // LTEST2:
                // if 2 < 0 goto L2
                const n4 = inputBuilder.addNode({ gen: [] });

                // L2:
                // d3 | y = 0
                // goto LJOIN
                const n5 = inputBuilder.addNode({ gen: ['d3'] });

                // L3:
                // d4 | z = 0
                // goto LJOIN
                const n6 = inputBuilder.addNode({ gen: ['d4'] });

                // LJOIN:
                // d5 | result = x
                const n7 = inputBuilder.addNode({ gen: ['d5'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n3, n7);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1'])],
                    [n6, new Set(['d1'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d2'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1', 'd3'])],
                    [n6, new Set(['d1', 'd4'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('three_branches, variable redefined in two arms but not the third so the join has a mix of original and new defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 1
                // goto LTEST1
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2', 'd3'] });

                // LTEST1:
                // if x < 0 goto L1
                const n2 = inputBuilder.addNode({ gen: [] });

                // L1:
                // d2 | x = 2
                // goto LJOIN
                const n3 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1', 'd3'] });

                // LTEST2:
                // if 0 < 1 goto L2
                const n4 = inputBuilder.addNode({ gen: [] });

                // L2:
                // d3 | x = 3
                // goto LJOIN
                const n5 = inputBuilder.addNode({ gen: ['d3'], kill: ['d1', 'd2'] });

                // L3:
                // d4 | y = 0
                // goto LJOIN
                const n6 = inputBuilder.addNode({ gen: ['d4'], kill: [] });

                // LJOIN:
                // d5 | result = x
                const n7 = inputBuilder.addNode({ gen: ['d5'], kill: [] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n3, n7);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1'])],
                    [n6, new Set(['d1'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d2'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d3'])],
                    [n6, new Set(['d1', 'd4'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('three_branches, different variables defined in disjoint arms to ensure unrelated defs don’t pollute other paths', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | a = 1
                // d2 | b = 2
                // d3 | c = 3
                // goto LTEST1
                const n1 = inputBuilder.addNode({ gen: ['d1', 'd2', 'd3'], kill: ['d4', 'd5', 'd6'] });

                // LTEST1:
                // if a < b goto L1
                const n2 = inputBuilder.addNode({ gen: [] });

                // L1:
                // d4 | a = 10
                // goto LJOIN
                const n3 = inputBuilder.addNode({ gen: ['d4'], kill: ['d1'] });

                // LTEST2:
                // if b < c goto L2
                const n4 = inputBuilder.addNode({ gen: [] });

                // L2:
                // d5 | b = 20
                // goto LJOIN
                const n5 = inputBuilder.addNode({ gen: ['d5'], kill: ['d2'] });

                // L3:
                // d6 | c = 30
                // goto LJOIN
                const n6 = inputBuilder.addNode({ gen: ['d6'], kill: ['d3'] });

                // LJOIN:
                // d7 | t = a + b
                // d8 | result = t + c
                const n7 = inputBuilder.addNode({ gen: ['d7', 'd8'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n3, n7);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2', 'd3'])],
                    [n3, new Set(['d1', 'd2', 'd3'])],
                    [n4, new Set(['d1', 'd2', 'd3'])],
                    [n5, new Set(['d1', 'd2', 'd3'])],
                    [n6, new Set(['d1', 'd2', 'd3'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4', 'd5', 'd6'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1', 'd2', 'd3'])],
                    [n2, new Set(['d1', 'd2', 'd3'])],
                    [n3, new Set(['d2', 'd3', 'd4'])],
                    [n4, new Set(['d1', 'd2', 'd3'])],
                    [n5, new Set(['d1', 'd3', 'd5'])],
                    [n6, new Set(['d1', 'd2', 'd6'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });



        });

        //3
        describe('single loop', () => {
            it('single_loop, variable defined before the loop and never redefined inside so the preheader def reaches the entire loop and the exit', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 1
                // goto LHEAD
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: [] });

                // LHEAD:
                // if x < 3 goto L_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (fallthrough after LHEAD false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_BODY:
                // goto LHEAD
                const n4 = inputBuilder.addNode({ gen: [] });

                // L_EXIT:
                // d2 | result = x
                const n5 = inputBuilder.addNode({ gen: ['d2'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4); // true to L_BODY
                inputBuilder.addEdges(n2, n3); // false to fallthrough
                inputBuilder.addEdges(n4, n2); // back edge to LHEAD
                inputBuilder.addEdges(n3, n5); // to exit block
                inputBuilder.addEdges(n5, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('single_loop, variable redefined in the loop body so the loop forms a fixed point where the reaching set at the header includes both preheader and loop-carried defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 1
                // goto LHEAD
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // LHEAD:
                // if x < 3 goto L_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (fallthrough from LHEAD false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_BODY:
                // d2 | x = x + 1
                // goto LHEAD
                const n4 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // L_EXIT:
                // d3 | result = x
                const n5 = inputBuilder.addNode({ gen: ['d3'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4); // true branch to L_BODY
                inputBuilder.addEdges(n2, n3); // false branch to fallthrough
                inputBuilder.addEdges(n4, n2); // back edge to LHEAD
                inputBuilder.addEdges(n3, n5); // to exit block
                inputBuilder.addEdges(n5, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d2'])],
                    [n5, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('single_loop, conditional redefinition inside the loop so the header’s reaching set contains a conditional mix of defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 1
                // goto LHEAD
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // LHEAD:
                // if x < 5 goto L_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (fallthrough after LHEAD false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_BODY:
                // if x < 3 goto L_SET
                const n4 = inputBuilder.addNode({ gen: [] });

                // L_SET:
                // d2 | x = x + 1
                // goto L_BACK
                const n5 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // L_SKIP:
                // goto L_BACK
                const n6 = inputBuilder.addNode({ gen: [] });

                // L_BACK:
                // goto LHEAD
                const n7 = inputBuilder.addNode({ gen: [] });

                // L_EXIT:
                // d4 | result = x
                const n8 = inputBuilder.addNode({ gen: ['d4'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n3, n8);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, n2);
                inputBuilder.addEdges(n8, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('single_loop, variable defined only in the loop and used after the loop to ensure the reaching set at exit includes loop-body defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // goto LHEAD
                const n1 = inputBuilder.addNode({ gen: [], kill: [] });

                // LHEAD:
                // if 1 < 10 goto L_BODY
                const n2 = inputBuilder.addNode({ gen: [], kill: [] });

                // (fallthrough from LHEAD false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_BODY:
                // d1 | x = 1
                // goto LHEAD
                const n4 = inputBuilder.addNode({ gen: ['d1'], kill: [] });

                // L_EXIT:
                // d2 | result = x
                const n5 = inputBuilder.addNode({ gen: ['d2'], kill: [] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4); // true branch to L_BODY
                inputBuilder.addEdges(n2, n3); // false branch to fallthrough
                inputBuilder.addEdges(n4, n2); // back edge to LHEAD
                inputBuilder.addEdges(n3, n5); // to exit block
                inputBuilder.addEdges(n5, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });


        });


        //4
        describe('loop in loop', () => {
            it('loop_within_loop, variable defined before the outer loop and redefined only in the inner loop so outer-header in later iterations sees preheader+inner defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // goto L_OUTER_HEAD
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // L_OUTER_HEAD:
                // if x < 5 goto L_OUTER_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (outer false branch):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_OUTER_BODY:
                // goto L_INNER_HEAD
                const n4 = inputBuilder.addNode({ gen: [] });

                // L_INNER_HEAD:
                // if x < 3 goto L_INNER_BODY
                const n5 = inputBuilder.addNode({ gen: [] });

                // (inner false branch):
                // goto L_AFTER_INNER
                const n6 = inputBuilder.addNode({ gen: [] });

                // L_INNER_BODY:
                // d2 | x = x + 1
                // goto L_INNER_HEAD
                const n7 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // L_AFTER_INNER:
                // goto L_OUTER_HEAD
                const n8 = inputBuilder.addNode({ gen: [] });

                // L_EXIT:
                // d3 | result = x
                const n9 = inputBuilder.addNode({ gen: ['d3'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4); // true: into outer body
                inputBuilder.addEdges(n2, n3); // false: exit outer loop
                inputBuilder.addEdges(n3, n9);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n5, n7); // true: into inner body
                inputBuilder.addEdges(n5, n6); // false: after inner
                inputBuilder.addEdges(n7, n5); // back edge of inner loop
                inputBuilder.addEdges(n6, n8);
                inputBuilder.addEdges(n8, n2); // back to outer head
                inputBuilder.addEdges(n9, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2'])],
                    [n9, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d2'])],
                    [n8, new Set(['d1', 'd2'])],
                    [n9, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('loop_within_loop, variable redefined in outer loop before entering inner loop to test kill-before-inner and inner’s propagation back to outer header', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // goto L_OUTER_HEAD
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2', 'd3'] });

                // L_OUTER_HEAD:
                // if x < 5 goto L_OUTER_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (outer false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_OUTER_BODY:
                // d2 | x = x + 1
                // goto L_INNER_HEAD
                const n4 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1', 'd3'] });

                // L_INNER_HEAD:
                // if x < 3 goto L_INNER_BODY
                const n5 = inputBuilder.addNode({ gen: [] });

                // (inner false):
                // goto L_AFTER_INNER
                const n6 = inputBuilder.addNode({ gen: [] });

                // L_INNER_BODY:
                // d3 | x = x + 2
                // goto L_INNER_HEAD
                const n7 = inputBuilder.addNode({ gen: ['d3'], kill: ['d1', 'd2'] });

                // L_AFTER_INNER:
                // goto L_OUTER_HEAD
                const n8 = inputBuilder.addNode({ gen: [] });

                // L_EXIT:
                // d4 | result = x
                const n9 = inputBuilder.addNode({ gen: ['d4'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n3, n9);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n5, n6);
                inputBuilder.addEdges(n7, n5);
                inputBuilder.addEdges(n6, n8);
                inputBuilder.addEdges(n8, n2);
                inputBuilder.addEdges(n9, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2', 'd3'])],
                    [n3, new Set(['d1', 'd2', 'd3'])],
                    [n4, new Set(['d1', 'd2', 'd3'])],
                    [n5, new Set(['d2', 'd3'])],
                    [n6, new Set(['d2', 'd3'])],
                    [n7, new Set(['d2', 'd3'])],
                    [n8, new Set(['d2', 'd3'])],
                    [n9, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1', 'd2', 'd3'])],
                    [n3, new Set(['d1', 'd2', 'd3'])],
                    [n4, new Set(['d2'])],
                    [n5, new Set(['d2', 'd3'])],
                    [n6, new Set(['d2', 'd3'])],
                    [n7, new Set(['d3'])],
                    [n8, new Set(['d2', 'd3'])],
                    [n9, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('loop_within_loop, separate variables redefined in inner vs outer loops to confirm no cross-contamination of reaching sets', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | a = 1
                // d2 | b = 2
                // goto L_OUTER_HEAD
                const n1 = inputBuilder.addNode({ gen: ['d1', 'd2'], kill: ['d3', 'd4'] });

                // L_OUTER_HEAD:
                // if a < 10 goto L_OUTER_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (outer false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_OUTER_BODY:
                // d3 | a = a + 1
                // goto L_INNER_HEAD
                const n4 = inputBuilder.addNode({ gen: ['d3'], kill: ['d1'] });

                // L_INNER_HEAD:
                // if b < 5 goto L_INNER_BODY
                const n5 = inputBuilder.addNode({ gen: [] });

                // L_AFTER_INNER:
                // goto L_OUTER_HEAD
                const n6 = inputBuilder.addNode({ gen: [] });

                // L_INNER_BODY:
                // d4 | b = b + 2
                // goto L_INNER_HEAD
                const n7 = inputBuilder.addNode({ gen: ['d4'], kill: ['d2'] });

                // L_EXIT:
                // d5 | result = a + b
                const n8 = inputBuilder.addNode({ gen: ['d5'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4); // true to outer body
                inputBuilder.addEdges(n2, n3); // false to exit path
                inputBuilder.addEdges(n3, n8);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n5, n7); // true to inner body
                inputBuilder.addEdges(n5, n6); // false after inner
                inputBuilder.addEdges(n7, n5); // inner back edge
                inputBuilder.addEdges(n6, n2); // back to outer head
                inputBuilder.addEdges(n8, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [n3, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [n4, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [n5, new Set(['d2', 'd3', 'd4'])],
                    [n6, new Set(['d2', 'd3', 'd4'])],
                    [n7, new Set(['d2', 'd3', 'd4'])],
                    [n8, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1', 'd2'])],
                    [n2, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [n3, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [n4, new Set(['d2', 'd3', 'd4'])],
                    [n5, new Set(['d2', 'd3', 'd4'])],
                    [n6, new Set(['d2', 'd3', 'd4'])],
                    [n7, new Set(['d3', 'd4'])],
                    [n8, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4', 'd5'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('loop_within_loop, variable defined in inner loop and used after both loops so only inner defs reach the final use', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // goto L_OUTER_HEAD
                const n1 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_OUTER_HEAD:
                // if 1 < 10 goto L_OUTER_BODY
                const n2 = inputBuilder.addNode({ gen: [], kill: [] });

                // (fallthrough when outer condition is false):
                // goto L_AFTER_OUTER
                const n3 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_OUTER_BODY:
                // goto L_INNER_HEAD
                const n4 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_INNER_HEAD:
                // if 1 < 10 goto L_INNER_BODY
                const n5 = inputBuilder.addNode({ gen: [], kill: [] });

                // (fallthrough when inner condition is false):
                // goto L_AFTER_INNER
                const n6 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_INNER_BODY:
                // d1 | x = x + 1
                // goto L_INNER_HEAD
                const n7 = inputBuilder.addNode({ gen: ['d1'], kill: [] });

                // L_AFTER_INNER:
                // goto L_OUTER_HEAD
                const n8 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_AFTER_OUTER:
                // d2 | result = x
                const n9 = inputBuilder.addNode({ gen: ['d2'], kill: [] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n3, n9);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n5, n6);
                inputBuilder.addEdges(n7, n5);
                inputBuilder.addEdges(n6, n8);
                inputBuilder.addEdges(n8, n2);
                inputBuilder.addEdges(n9, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1'])],
                    [n6, new Set(['d1'])],
                    [n7, new Set(['d1'])],
                    [n8, new Set(['d1'])],
                    [n9, new Set(['d1'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1'])],
                    [n6, new Set(['d1'])],
                    [n7, new Set(['d1'])],
                    [n8, new Set(['d1'])],
                    [n9, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });


        });

        //5
        describe('branch in loop', () => {
            it('two_branches_in_loop, variable defined before the loop and redefined in one branch of the loop body so the loop header accumulates preheader+branch defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // goto LHEAD
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // LHEAD:
                // if x < 10 goto L_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (fallthrough from LHEAD false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_BODY:
                // if x < 5 goto L_SET
                const n4 = inputBuilder.addNode({ gen: [] });

                // L_SET:
                // d2 | x = x + 1
                // goto L_BACK
                const n5 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // L_SKIP:
                // goto L_BACK
                const n6 = inputBuilder.addNode({ gen: [] });

                // L_BACK:
                // goto LHEAD
                const n7 = inputBuilder.addNode({ gen: [] });

                // L_EXIT:
                // d3 | result = x
                const n8 = inputBuilder.addNode({ gen: ['d3'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4); // true to L_BODY
                inputBuilder.addEdges(n2, n3); // false to exit path
                inputBuilder.addEdges(n3, n8);
                inputBuilder.addEdges(n4, n5); // branch that redefines x
                inputBuilder.addEdges(n4, n6); // branch that skips redefinition
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, n2); // back edge to loop header
                inputBuilder.addEdges(n8, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('two_branches_in_loop, variable redefined differently in both branches each iteration so the header’s reaching set contains both loop-body defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // goto LHEAD
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2', 'd3'] });

                // LHEAD:
                // if x < 10 goto L_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (fallthrough from LHEAD false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_BODY:
                // if x < 5 goto L_SET1
                const n4 = inputBuilder.addNode({ gen: [] });

                // L_SET1:
                // d2 | x = x + 1
                // goto L_BACK
                const n5 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1', 'd3'] });

                // L_SET2:
                // d3 | x = x + 2
                // goto L_BACK
                const n6 = inputBuilder.addNode({ gen: ['d3'], kill: ['d1', 'd2'] });

                // L_BACK:
                // goto LHEAD
                const n7 = inputBuilder.addNode({ gen: [] });

                // L_EXIT:
                // d4 | result = x
                const n8 = inputBuilder.addNode({ gen: ['d4'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n3, n8);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, n2);
                inputBuilder.addEdges(n8, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2', 'd3'])],
                    [n3, new Set(['d1', 'd2', 'd3'])],
                    [n4, new Set(['d1', 'd2', 'd3'])],
                    [n5, new Set(['d1', 'd2', 'd3'])],
                    [n6, new Set(['d1', 'd2', 'd3'])],
                    [n7, new Set(['d2', 'd3'])],
                    [n8, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1', 'd2', 'd3'])],
                    [n3, new Set(['d1', 'd2', 'd3'])],
                    [n4, new Set(['d1', 'd2', 'd3'])],
                    [n5, new Set(['d2'])],
                    [n6, new Set(['d3'])],
                    [n7, new Set(['d2', 'd3'])],
                    [n8, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('two_branches_in_loop, variable killed in one branch and untouched in the other so reaching sets alternate by path within the loop', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // goto LHEAD
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // LHEAD:
                // if x < 10 goto L_BODY
                const n2 = inputBuilder.addNode({ gen: [] });

                // (fallthrough from LHEAD false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [] });

                // L_BODY:
                // if x < 5 goto L_KILL
                const n4 = inputBuilder.addNode({ gen: [] });

                // L_KILL:
                // d2 | x = x + 1
                // goto L_BACK
                const n5 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // L_KEEP:
                // goto L_BACK
                const n6 = inputBuilder.addNode({ gen: [] });

                // L_BACK:
                // goto LHEAD
                const n7 = inputBuilder.addNode({ gen: [] });

                // L_EXIT:
                // d3 | result = x
                const n8 = inputBuilder.addNode({ gen: ['d3'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n3, n8);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, n2);
                inputBuilder.addEdges(n8, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('two_branches_in_loop, variable defined only in the loop body branches and used after the loop so exit has a union of both branch defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // goto LHEAD
                const n1 = inputBuilder.addNode({ gen: [], kill: [] });

                // LHEAD:
                // if 1 < 10 goto L_BODY
                const n2 = inputBuilder.addNode({ gen: [], kill: [] });

                // (fallthrough from LHEAD false):
                // goto L_EXIT
                const n3 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_BODY:
                // if x < 5 goto L_SET1
                const n4 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_SET1:
                // d1 | x = 1
                // goto L_BACK
                const n5 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // L_SET2:
                // d2 | x = 2
                // goto L_BACK
                const n6 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // L_BACK:
                // goto LHEAD
                const n7 = inputBuilder.addNode({ gen: [], kill: [] });

                // L_EXIT:
                // d3 | result = x
                const n8 = inputBuilder.addNode({ gen: ['d3'], kill: [] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n3, n8);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, n2);
                inputBuilder.addEdges(n8, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1', 'd2'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1'])],
                    [n6, new Set(['d2'])],
                    [n7, new Set(['d1', 'd2'])],
                    [n8, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });


        });

        //6
        describe('loop in branch', () => {
            it('loop_in_branch, variable defined before the split and redefined inside the looped branch so the join after the branch sees old+loop defs', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // goto LSPLIT
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2'] });

                // LSPLIT:
                // if x < 0 goto LLOOP_HEAD
                const n2 = inputBuilder.addNode({ gen: [] });

                // LOTHER:
                // d4 | y = 1
                // goto LJOIN
                const n3 = inputBuilder.addNode({ gen: ['d4'] });

                // LLOOP_HEAD:
                // if x < 5 goto LLOOP_BODY
                const n4 = inputBuilder.addNode({ gen: [] });

                // LAFTER_LOOP:
                // goto LJOIN
                const n5 = inputBuilder.addNode({ gen: [] });

                // LLOOP_BODY:
                // d2 | x = x + 1
                // goto LLOOP_HEAD
                const n6 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1'] });

                // LJOIN:
                // d3 | result = x
                const n7 = inputBuilder.addNode({ gen: ['d3'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n3, n7);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n6, n4);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n7, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1', 'd4'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d2'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('loop_in_branch, variable defined only inside the looped branch and used after the join so reaching defs at join must include that branch-only def', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // goto LSPLIT
                const n1 = inputBuilder.addNode({ gen: [], kill: [] });

                // LSPLIT:
                // if 1 < 2 goto LLOOP_HEAD
                // goto LOTHER
                const n2 = inputBuilder.addNode({ gen: [], kill: [] });

                // LOTHER:
                // d3 | y = 0
                // goto LJOIN
                const n3 = inputBuilder.addNode({ gen: ['d3'], kill: [] });

                // LLOOP_HEAD:
                // if 1 < 2 goto LLOOP_BODY
                // goto LAFTER_LOOP
                const n4 = inputBuilder.addNode({ gen: [], kill: [] });

                // LLOOP_BODY:
                // d1 | x = 1
                // goto LLOOP_HEAD
                const n5 = inputBuilder.addNode({ gen: ['d1'], kill: [] });

                // LAFTER_LOOP:
                // goto LJOIN
                const n6 = inputBuilder.addNode({ gen: [], kill: [] });

                // LJOIN:
                // d2 | result = x
                const n7 = inputBuilder.addNode({ gen: ['d2'], kill: [] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4); // to looped branch
                inputBuilder.addEdges(n2, n3); // to other branch
                inputBuilder.addEdges(n3, n7); // other branch to join
                inputBuilder.addEdges(n4, n5); // loop head to body
                inputBuilder.addEdges(n4, n6); // loop head to after-loop
                inputBuilder.addEdges(n5, n4); // loop back edge
                inputBuilder.addEdges(n6, n7); // after-loop to join
                inputBuilder.addEdges(n7, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set([])],
                    [n3, new Set([])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1'])],
                    [n6, new Set(['d1'])],
                    [n7, new Set(['d1', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set([])],
                    [n3, new Set(['d3'])],
                    [n4, new Set(['d1'])],
                    [n5, new Set(['d1'])],
                    [n6, new Set(['d1'])],
                    [n7, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('loop_in_branch, variable redefined in the non-loop branch to test competing defs at the join from loop vs non-loop paths', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // goto LSPLIT
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: ['d2', 'd3'] });

                // LSPLIT:
                // if x < 0 goto LLOOP_HEAD
                const n2 = inputBuilder.addNode({ gen: [] });

                // LLOOP_HEAD:
                // if x < 5 goto LLOOP_BODY
                const n3 = inputBuilder.addNode({ gen: [] });

                // LLOOP_BODY:
                // d2 | x = x + 1
                // goto LLOOP_HEAD
                const n4 = inputBuilder.addNode({ gen: ['d2'], kill: ['d1', 'd3'] });

                // LAFTER_LOOP:
                // goto LJOIN
                const n5 = inputBuilder.addNode({ gen: [] });

                // LNON:
                // d3 | x = 100
                // goto LJOIN
                const n6 = inputBuilder.addNode({ gen: ['d3'], kill: ['d1', 'd2'] });

                // LJOIN:
                // d4 | result = x
                const n7 = inputBuilder.addNode({ gen: ['d4'] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n2, n6);
                inputBuilder.addEdges(n3, n4);
                inputBuilder.addEdges(n3, n5);
                inputBuilder.addEdges(n4, n3);
                inputBuilder.addEdges(n5, n7);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1'])],
                    [n7, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1', 'd2'])],
                    [n4, new Set(['d2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d3'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });
            it('loop_in_branch, variable defined before the split and not touched in either path to confirm the pre-branch def uniquely reaches the join', () => {
                const inputBuilder = new ReachingDefinitionsInputBuilder();

                // basic block 1:
                // d1 | x = 0
                // goto LSPLIT
                const n1 = inputBuilder.addNode({ gen: ['d1'], kill: [] });

                // LSPLIT:
                // if 1 < 2 goto LLOOP_HEAD
                const n2 = inputBuilder.addNode({ gen: [], kill: [] });

                // LOTHER:
                // d3 | y = 1
                // goto LJOIN
                const n3 = inputBuilder.addNode({ gen: ['d3'], kill: ['d2'] });

                // LLOOP_HEAD:
                // if 1 < 2 goto LLOOP_BODY
                const n4 = inputBuilder.addNode({ gen: [], kill: [] });

                // LLOOP_BODY:
                // d2 | y = y + 1
                // goto LLOOP_HEAD
                const n5 = inputBuilder.addNode({ gen: ['d2'], kill: ['d3'] });

                // LAFTER_LOOP:
                // goto LJOIN
                const n6 = inputBuilder.addNode({ gen: [], kill: [] });

                // LJOIN:
                // d4 | result = x
                const n7 = inputBuilder.addNode({ gen: ['d4'], kill: [] });

                inputBuilder.addEdges(inputBuilder.entryId, n1);
                inputBuilder.addEdges(n1, n2);
                inputBuilder.addEdges(n2, n4);
                inputBuilder.addEdges(n2, n3);
                inputBuilder.addEdges(n3, n7);
                inputBuilder.addEdges(n4, n5);
                inputBuilder.addEdges(n4, n6);
                inputBuilder.addEdges(n5, n4);
                inputBuilder.addEdges(n6, n7);
                inputBuilder.addEdges(n7, inputBuilder.exitId);

                const algoInput = inputBuilder.build();

                const finalInSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set([])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2', 'd3'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                const finalOutSets = new Map<number, Set<string>>([
                    [inputBuilder.entryId, new Set([])],
                    [n1, new Set(['d1'])],
                    [n2, new Set(['d1'])],
                    [n3, new Set(['d1', 'd3'])],
                    [n4, new Set(['d1', 'd2'])],
                    [n5, new Set(['d1', 'd2'])],
                    [n6, new Set(['d1', 'd2'])],
                    [n7, new Set(['d1', 'd2', 'd3', 'd4'])],
                    [inputBuilder.exitId, new Set(['d1', 'd2', 'd3', 'd4'])],
                ]);

                expectInEquals(algoInput, finalInSets);
                expectOutEquals(algoInput, finalOutSets);
            });

        })



    })

})

describe("Data Access Tests", () => {

    const inputBuilder = new ReachingDefinitionsInputBuilder();

    // basic block 1:
    // d1 | a = 1
    // d2 | b = 2
    // d3 | c = 3
    // goto LABEL1
    const n1 = inputBuilder.addNode({gen: ['d1', 'd2', 'd3'], kill: ['d4', 'd5', 'd6']});
    // LABEL1: d4 | a = 2
    // d5 | b = 3
    // d6 | c  = 4
    // d7 | d = 5
    const n2 = inputBuilder.addNode({gen: ['d4', 'd5', 'd6', 'd7'], kill: ['d1', 'd2', 'd3']});
    // LABEL2:
    // d8 | result = d
    const n3 = inputBuilder.addNode({gen: ['d8']});

    inputBuilder.addEdges(inputBuilder.entryId, n1);
    inputBuilder.addEdges(n1, n2);
    inputBuilder.addEdges(n2, n3);
    inputBuilder.addEdges(n3, inputBuilder.exitId);

    const algoInput = inputBuilder.build();

    test('should look at the out set of successors when computing the in set', () => {

        const analysis = ReachingDefinitions(algoInput);
        for (const step of analysis) {
            if (step.reason === 'in-computed') {
                for (const [id, nodeData] of step.state.entries()) {
                    if (algoInput.cfg.getNodeSuccessors(id)?.has(step.currentNodeId!)) {
                        expect(nodeData.outSet.lookedAt).toBe(true);
                    } else {
                        expect(nodeData.outSet.lookedAt).toBe(false);
                    }
                }
            }
        }
    });

    test('should not look at any other set than out-set of successors when computing the in set', () => {
        const analysis = ReachingDefinitions(algoInput);
        for (const step of analysis) {
            if (step.reason === 'in-computed') {
                for (const [, nodeData] of step.state.entries()) {
                    expect(nodeData.inSet.lookedAt).toBe(false);
                    expect(nodeData.genSet.lookedAt).toBe(false);
                    expect(nodeData.killSet.lookedAt).toBe(false);
                }
            }
        }
    });

    test('should only look at in, gen and kill set of the current node when computing the out set', () => {
        const analysis = ReachingDefinitions(algoInput);
        for (const step of analysis) {
            if (step.reason === 'out-computed') {
                for (const [id, nodeData] of step.state.entries()) {
                    if (id === step.currentNodeId && id !== algoInput.cfg.entryId && id !== algoInput.cfg.exitId) {
                        expect(nodeData.inSet.lookedAt).toBe(true);
                        expect(nodeData.killSet.lookedAt).toBe(true);
                        expect(nodeData.genSet.lookedAt).toBe(true);
                    } else if (id === step.currentNodeId && (id === algoInput.cfg.entryId || id === algoInput.cfg.exitId)) {
                        expect(nodeData.inSet.lookedAt).toBe(true);
                    } else {
                        expect(nodeData.outSet.lookedAt).toBe(false);
                        expect(nodeData.inSet.lookedAt).toBe(false);
                        expect(nodeData.killSet.lookedAt).toBe(false);
                        expect(nodeData.genSet.lookedAt).toBe(false);
                    }
                }
            }
        }
    });

})

describe('extractGenAndKillFromBasicBlocks', () => {
    function createBasicBlocksFromCode(code: string) {
        const program = TacProgram.fromParsedInstructions(new TacParser(code).parseTac());
        const cfg = new BasicBlockControlFlowGraph(program);

        // Convert the CFG to a Map of basic blocks with their instructions
        const basicBlocks = new Map();
        for (const nodeId of cfg.dataNodeIds) {
            basicBlocks.set(nodeId, cfg.getNodeInstructions(nodeId));
        }

        return basicBlocks;
    }


    it('should extract gen set with a single definition', () => {
        const basicBlocks = createBasicBlocksFromCode('x = 5');
        const blockId = [...basicBlocks.keys()][0];

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // The gen set should contain a single definition
        expect(genSets.get(blockId)?.size).toBe(1);
        expect([...genSets.get(blockId)!][0].startsWith('d')).toBe(true);

        // The kill set should be empty
        expect(killSets.get(blockId)?.size).toBe(0);
    });

    it('single basic block should contain last definition of single variable as gen and all other definitions as kill', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 1
      x = 5
      x = 10
    `);
        const blockId = [...basicBlocks.keys()][0];

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // The gen set should contain the last definition
        expect(genSets.get(blockId)?.size).toBe(1);

        const killSet = killSets.get(blockId)!;
        // the kill set should contain the first definition within the block
        expect([...killSet]).toEqual(['d1', 'd2']);
    });

    it('should handle definitions across multiple blocks', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 5
      if x goto L1
      x = 10
      L1: y = x
    `);

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // We should have multiple blocks, each with gen sets
        expect(genSets.size).toBeGreaterThanOrEqual(2);

        // Count the total number of definitions
        let totalDefs = 0;
        for (const genSet of genSets.values()) {
            totalDefs += genSet.size;
        }

        // Expecting at least 3 definitions: x=5, x=10, y=x
        expect(totalDefs).toBeGreaterThanOrEqual(3);

        // Look for a block with a kill set (should be the one that redefines x)
        let foundKill = false;
        for (const killSet of killSets.values()) {
            if (killSet.size > 0) {
                foundKill = true;
                break;
            }
        }

        expect(foundKill).toBe(true);
    });

    it('should handle independent variables correctly', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 1
      y = 2
      z = 3
    `);
        const blockId = [...basicBlocks.keys()][0];

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // The gen set should contain three definitions
        expect(genSets.get(blockId)?.size).toBe(3);

        // The kill set should be empty
        expect(killSets.get(blockId)?.size).toBe(0);
    });

    it('should handle binary and unary operations', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 5
      y = x + 10
      z = - y
    `);
        const blockId = [...basicBlocks.keys()][0];

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // The gen set should contain three definitions
        expect(genSets.get(blockId)?.size).toBe(3);

        // The kill set should be empty
        expect(killSets.get(blockId)?.size).toBe(0);
    });

    it('should not generate definitions for non-assignment instructions', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 5
      if x goto L1
      goto L2
      L1: y = 10
      L2: z = 15
    `);

        const { genSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // Count the total number of definitions
        let totalDefs = 0;
        for (const genSet of genSets.values()) {
            totalDefs += genSet.size;
        }

        // We should have exactly 3 definitions (x=5, y=10, z=15)
        // Jump and conditional instructions don't generate definitions
        expect(totalDefs).toBe(3);
    });

    it('should handle complex control flow with multiple branches', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 1
      if x goto L1
      x = 2
      goto L2
      L1: x = 3
      L2: y = x
    `);

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // We should have at least 3 blocks
        expect(genSets.size).toBeGreaterThanOrEqual(3);

        // Count the total number of definitions
        let totalDefs = 0;
        for (const genSet of genSets.values()) {
            totalDefs += genSet.size;
        }

        // We should have 4 definitions (x=1, x=2, x=3, y=x)
        expect(totalDefs).toBe(4);

        // Look for blocks with kill sets
        let blocksWithKills = 0;
        for (const killSet of killSets.values()) {
            if (killSet.size > 0) {
                blocksWithKills++;
            }
        }

        // Both x=2 and x=3 should kill x=1
        expect(blocksWithKills).toBeGreaterThanOrEqual(2);
    });

    it('should handle loops correctly', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      i = 0
      L1: if i >= 5 goto L2
      i = i + 1
      goto L1
      L2: x = i
    `);

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // Count the total number of definitions
        let totalDefs = 0;
        for (const genSet of genSets.values()) {
            totalDefs += genSet.size;
        }

        // We should have 3 definitions (i=0, i=i+1, x=i)
        expect(totalDefs).toBe(3);

        // Find the block with i=i+1 and check that it kills i=0
        let foundKillInLoop = false;
        for (const [blockId, genSet] of genSets.entries()) {
            // Find the block with i=i+1
            const iIncBlock = [...genSet].some(def => def.startsWith('d'));
            if (iIncBlock) {
                const killSet = killSets.get(blockId);
                if (killSet && killSet.size > 0) {
                    foundKillInLoop = true;
                    break;
                }
            }
        }

        expect(foundKillInLoop).toBe(true);
    });
});