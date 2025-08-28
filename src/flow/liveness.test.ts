import {describe, expect, test} from "vitest";
import {
    extractUseAndDefFromBasicBlocks,
    extractUseAndDefFromInstructions,
    LivenessAnalysis,
    type LivenessInput,
    type LivenessState
} from "./liveness.ts";
import {enableMapSet} from "immer";
import type {TacInstruction} from "../tac/parser-types.ts";
import {readProgramFromText} from "../tac/program.ts";
import {SingleInstructionGraph} from "../cfg/single-instruction.ts";
import {BasicBlockControlFlowGraph} from "../cfg/basic-blocks.ts";
import {TestCfg} from "./test-cfg.ts";

// must be enabled for the tests
enableMapSet();



class LivenessInputBuilder {
    readonly entryId = 0;
    readonly exitId = -1;
    readonly edgeList: Array<[number, number]> = [];
    readonly dataNodeIds: number[] = [];
    readonly defSets = new Map<number, Set<string>>();
    readonly useSets = new Map<number, Set<string>>();
    private nextNodeId = 1;

    addNode({def = [], use = []}: { def?: string[], use?: string[] }) {
        const id = this.nextNodeId++;
        this.dataNodeIds.push(id);
        this.defSets.set(id, new Set(def));
        this.useSets.set(id, new Set(use));
        return id;
    }

    addEdges(src: number, ...targets: number[]) {
        this.edgeList.push(...(targets.map(t => [src, t] as [number, number])));
    }


    build(): LivenessInput {
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
            def: this.defSets,
            use: this.useSets,
        }
    }
}

function getFinalState(analysis: Generator<LivenessState>) {
    let finalState: LivenessState | undefined = undefined;

    for (const step of analysis) {
        finalState = step;
    }
    if (finalState === undefined) throw new Error("the generator yielded no steps");
    return finalState;
}

function expectLivenessOutEquals(testCFG: LivenessInput, expectedOut: Map<number, Set<string>>, liveOut: Set<string>) {
    const analysis = LivenessAnalysis(testCFG, liveOut);
    const finalState = getFinalState(analysis);
    for (const [id, set] of expectedOut) {
        const actual = finalState.state.get(id)?.outSet.data;
        expect(actual, `out set of node ${id} did not match`).toEqual(set);
    }
}

function expectLivenessInEquals(testCFG: LivenessInput, expectedIn: Map<number, Set<string>>, liveOut: Set<string>) {
    const analysis = LivenessAnalysis(testCFG, liveOut);
    const finalState = getFinalState(analysis);
    for (const [id, set] of expectedIn) {
        const actual = finalState.state.get(id)?.inSet.data;
        expect(actual, `in set of node ${id} did not match`).toEqual(set);
    }
}


const livenessSlidesExample = () => {
    const builder = new LivenessInputBuilder();
    // a = 0
    const i1 = builder.addNode({def: ['a']});
    // b = a + 1
    const i2 = builder.addNode({def: ['b'], use: ['a']});
    // c = c + b
    const i3 = builder.addNode({def: ['c'], use: ['c', 'b']});
    // a = b*2
    const i4 = builder.addNode({def: ['a'], use: ['b']});
    // a < 10
    const i5 = builder.addNode({use: ['a']});
    // return c
    const i6 = builder.addNode({use: ['c']});

    builder.addEdges(builder.entryId, i1);
    builder.addEdges(i1, i2);
    builder.addEdges(i2, i3);
    builder.addEdges(i3, i4);
    builder.addEdges(i4, i5);
    builder.addEdges(i5, i6, i2);
    builder.addEdges(i6, builder.exitId);

    return builder.build();
}

describe("Liveness Analysis", () => {
    describe('Liveness Algo Result Tests', () => {
        describe('liveness slide example | linear code', () => {
            test('liveness slide example final in is correct', () => {
                const testCFG = livenessSlidesExample();
                const livenessSlideFinalIn = () => {
                    return new Map([
                        [0, new Set(['c'])],
                        [1, new Set(['c'])],
                        [2, new Set(['a', 'c'])],
                        [3, new Set(['b', 'c'])],
                        [4, new Set(['b', 'c'])],
                        [5, new Set(['a', 'c'])],
                        [6, new Set(['c'])],
                        [-1, new Set<string>()]
                    ]);
                }
                expectLivenessInEquals(testCFG, livenessSlideFinalIn(), new Set([]));
            });

            test('liveness slide example final out is correct', () => {
                const testCFG = livenessSlidesExample();
                const livenessSlideFinalOut = () => {
                    return new Map([
                        [0, new Set(['c'])],
                        [1, new Set(['a', 'c'])],
                        [2, new Set(['b', 'c'])],
                        [3, new Set(['b', 'c'])],
                        [4, new Set(['a', 'c'])],
                        [5, new Set(['a', 'c'])],
                        [6, new Set<string>()],
                        [-1, new Set<string>()]
                    ]);
                };
                expectLivenessOutEquals(testCFG, livenessSlideFinalOut(), new Set([]));
            });

            test('should propagate exit live out variables to in sets', () => {
                const testCFG = livenessSlidesExample();
                const livenessSlideFinalIn = () => {
                    return new Map([
                        [0, new Set(['c'])],
                        [1, new Set(['c'])],
                        [2, new Set(['a', 'c'])],
                        [3, new Set(['b', 'c'])],
                        [4, new Set(['b', 'c'])],
                        [5, new Set(['a', 'c', 'b'])],
                        [6, new Set(['c', 'b'])],
                        [-1, new Set<string>(['c', 'b'])]
                    ]);
                }
                expectLivenessInEquals(testCFG, livenessSlideFinalIn(), new Set(['c', 'b']));
            });

            test('should propagate exit live out variables to out sets', () => {
                const testCFG = livenessSlidesExample();
                const livenessSlideFinalOut = () => {
                    return new Map([
                        [0, new Set(['c'])],
                        [1, new Set(['a', 'c'])],
                        [2, new Set(['b', 'c'])],
                        [3, new Set(['b', 'c'])],
                        [4, new Set(['a', 'c', 'b'])],   // 'b' hinzugefügt
                        [5, new Set(['a', 'c', 'b'])],   // 'b' hinzugefügt
                        [6, new Set<string>(['c', 'b'])], // 'b' hinzugefügt
                        [-1, new Set<string>(['c', 'b'])]
                    ]);
                };
                expectLivenessOutEquals(testCFG, livenessSlideFinalOut(), new Set(['c', 'b']));
            });
        });

        describe("Complex Control Flow Tests", () => {
            // 1. Simple Branching - Two execution paths
            describe("Simple Branching with Two Paths", () => {
                test("two_branches, variable defined before the branch and used in both branches", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 5
                    const n1 = builder.addNode({def: ["x"]});

                    // if (1 < 2) goto L1
                    const n2 = builder.addNode({});

                    // goto L2
                    const n3 = builder.addNode({});

                    // L1: y = x
                    const n4 = builder.addNode({def: ["y"], use: ["x"]});

                    // goto L3
                    const n5 = builder.addNode({});

                    // L2: z = x
                    const n6 = builder.addNode({def: ["z"], use: ["x"]});

                    // goto L3
                    const n7 = builder.addNode({});

                    // L3: result = 0
                    const n8 = builder.addNode({def: ["result"]});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n3, n6);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n8);
                    builder.addEdges(n8, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [n6, new Set(["x"])],
                        [n7, new Set([])],
                        [n8, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set([])],
                        [n5, new Set([])],
                        [n6, new Set([])],
                        [n7, new Set([])],
                        [n8, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });

                test("two_branches, variable defined in only one branch and used after the join", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto L1
                    const n1 = builder.addNode({});
                    // goto L2
                    const n2 = builder.addNode({});
                    // L1: x = 10
                    const n3 = builder.addNode({def: ["x"]});
                    // goto L3
                    const n4 = builder.addNode({});
                    // L2: y = 0
                    const n5 = builder.addNode({def: ["y"]});
                    // goto L3
                    const n6 = builder.addNode({});
                    // L3: result = x
                    const n7 = builder.addNode({def: ["result"], use: ["x"]});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n5);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n7);
                    builder.addEdges(n5, n6);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });

                test("two_branches, variable defined in both branches and used after the join", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto L1
                    const n1 = builder.addNode({});
                    // goto L2
                    const n2 = builder.addNode({});
                    // L1: x = 10
                    const n3 = builder.addNode({ def: ["x"] });
                    // goto L3
                    const n4 = builder.addNode({});
                    // L2: x = 20
                    const n5 = builder.addNode({ def: ["x"] });
                    // goto L3
                    const n6 = builder.addNode({});
                    // L3: result = x
                    const n7 = builder.addNode({ def: ["result"], use: ["x"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n5);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n7);
                    builder.addEdges(n5, n6);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set([])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set([])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("two_branches, variable defined in one branch and only used in that branch", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto L1
                    const n1 = builder.addNode({});
                    // goto L2
                    const n2 = builder.addNode({});
                    // L1: x = 10
                    const n3 = builder.addNode({ def: ["x"] });
                    // L1: y = x
                    const n4 = builder.addNode({ def: ["y"], use: ["x"] });
                    // goto L3
                    const n5 = builder.addNode({});
                    // L2: z = 0
                    const n6 = builder.addNode({ def: ["z"] });
                    // goto L3
                    const n7 = builder.addNode({});
                    // L3: result = 0
                    const n8 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n6);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n8);
                    builder.addEdges(n8, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set([])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [n6, new Set([])],
                        [n7, new Set([])],
                        [n8, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set([])],
                        [n3, new Set(["x"])],
                        [n4, new Set([])],
                        [n5, new Set([])],
                        [n6, new Set([])],
                        [n7, new Set([])],
                        [n8, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });


            });

            // 2. Complex Branching - Three execution paths
            describe("Complex Branching with Three Paths", () => {
                test("three_branches, variable defined before the branch and used in all three arms", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 5
                    const n1 = builder.addNode({ def: ["x"] });
                    // if (1 < 2) goto L1
                    const n2 = builder.addNode({});
                    // if (2 < 3) goto L2
                    const n3 = builder.addNode({});
                    // L1: y = x
                    const n4 = builder.addNode({ def: ["y"], use: ["x"] });
                    // goto L4
                    const n5 = builder.addNode({});
                    // L2: z = x
                    const n6 = builder.addNode({ def: ["z"], use: ["x"] });
                    // goto L4
                    const n7 = builder.addNode({});
                    // L3: w = x
                    const n8 = builder.addNode({ def: ["w"], use: ["x"] });
                    // goto L4
                    const n9 = builder.addNode({});
                    // L4: result = 0
                    const n10 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n3, n6, n8);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n10);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n10);
                    builder.addEdges(n8, n9);
                    builder.addEdges(n9, n10);
                    builder.addEdges(n10, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [n6, new Set(["x"])],
                        [n7, new Set([])],
                        [n8, new Set(["x"])],
                        [n9, new Set([])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set([])],
                        [n5, new Set([])],
                        [n6, new Set([])],
                        [n7, new Set([])],
                        [n8, new Set([])],
                        [n9, new Set([])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("three_branches, variable defined in only one arm and used after the join", () => {
                    const builder = new LivenessInputBuilder();

                    // if (1 < 2) goto L1
                    const n1 = builder.addNode({});
                    // if (2 < 3) goto L2
                    const n2 = builder.addNode({});
                    // goto L3
                    const n3 = builder.addNode({});
                    // L1: x = 10
                    const n4 = builder.addNode({ def: ["x"] });
                    // goto L4
                    const n5 = builder.addNode({});
                    // L2: y = 20
                    const n6 = builder.addNode({ def: ["y"] });
                    // goto L4
                    const n7 = builder.addNode({});
                    // L3: z = 30
                    const n8 = builder.addNode({ def: ["z"] });
                    // goto L4
                    const n9 = builder.addNode({});
                    // L4: result = x
                    const n10 = builder.addNode({ def: ["result"], use: ["x"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n4, n2);
                    builder.addEdges(n2, n6, n3);
                    builder.addEdges(n3, n8);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n10);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n10);
                    builder.addEdges(n8, n9);
                    builder.addEdges(n9, n10);
                    builder.addEdges(n10, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set([])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("three_branches, variable defined in two arms and used after the join", () => {
                    const builder = new LivenessInputBuilder();

                    // if (1 < 2) goto L1
                    const n1 = builder.addNode({});
                    // if (2 < 3) goto L2
                    const n2 = builder.addNode({});
                    // goto L3
                    const n3 = builder.addNode({});
                    // L1: x = 10
                    const n4 = builder.addNode({ def: ["x"] });
                    // goto L4
                    const n5 = builder.addNode({});
                    // L2: x = 20
                    const n6 = builder.addNode({ def: ["x"] });
                    // goto L4
                    const n7 = builder.addNode({});
                    // L3: y = 30
                    const n8 = builder.addNode({ def: ["y"] });
                    // goto L4
                    const n9 = builder.addNode({});
                    // L4: result = x
                    const n10 = builder.addNode({ def: ["result"], use: ["x"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n4, n2);
                    builder.addEdges(n2, n6, n3);
                    builder.addEdges(n3, n8);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n10);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n10);
                    builder.addEdges(n8, n9);
                    builder.addEdges(n9, n10);
                    builder.addEdges(n10, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set([])],
                        [n5, new Set(["x"])],
                        [n6, new Set([])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });


            });


            // 3. Simple Loop
            describe("Simple Loop", () => {
                test("single_loop, variable defined before the loop and used inside the loop", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 10
                    const n1 = builder.addNode({ def: ["x"] });
                    // if (1 < 2) goto Lloop
                    const n2 = builder.addNode({});
                    // goto Lexit
                    const n3 = builder.addNode({});
                    // Lloop: y = x
                    const n4 = builder.addNode({ def: ["y"], use: ["x"] });
                    // goto Lcond
                    const n5 = builder.addNode({});
                    // Lexit: result = 0
                    const n6 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n3, n6);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n2);
                    builder.addEdges(n6, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("single_loop, variable defined in the loop body and used at the loop header for the next iteration", () => {
                    const builder = new LivenessInputBuilder();

                    // Lcond: if x < 10 goto Lbody
                    const n1 = builder.addNode({ use: ["x"] });
                    // goto Lexit
                    const n2 = builder.addNode({});
                    // Lbody: x = x + 1
                    const n3 = builder.addNode({ def: ["x"], use: ["x"] });
                    // goto Lcond
                    const n4 = builder.addNode({});
                    // Lexit: result = 0
                    const n5 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n5);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n1);
                    builder.addEdges(n5, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set([])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set([])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("single_loop, variable defined in the loop body and used after the loop", () => {
                    const builder = new LivenessInputBuilder();

                    // Lcond: if 1 < 2 goto Lbody
                    const n1 = builder.addNode({});
                    // goto Lexit
                    const n2 = builder.addNode({});
                    // Lbody: x = 1
                    const n3 = builder.addNode({ def: ["x"] });
                    // goto Lcond
                    const n4 = builder.addNode({});
                    // Lexit: result = x
                    const n5 = builder.addNode({ def: ["result"], use: ["x"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n5);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n1);
                    builder.addEdges(n5, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("single_loop, variable defined in the loop body and only used in the loop body", () => {
                    const builder = new LivenessInputBuilder();

                    // Lcond: if 1 < 2 goto Lbody
                    const n1 = builder.addNode({});
                    // goto Lexit
                    const n2 = builder.addNode({});
                    // Lbody: x = 1
                    const n3 = builder.addNode({ def: ["x"] });
                    // Lbody: y = x
                    const n4 = builder.addNode({ def: ["y"], use: ["x"] });
                    // goto Lcond
                    const n5 = builder.addNode({});
                    // Lexit: result = 0
                    const n6 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n6);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n1);
                    builder.addEdges(n6, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set([])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [n6, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set([])],
                        [n3, new Set(["x"])],
                        [n4, new Set([])],
                        [n5, new Set([])],
                        [n6, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });


            });

            // 4. Nested Loops
            describe("Nested Loops", () => {
                test("loop_within_loop, variable defined before the outer loop and used in the inner loop body", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 42
                    const n1 = builder.addNode({ def: ["x"] });

                    // if 1 < 2 goto LouterBody
                    const n2 = builder.addNode({});

                    // goto LafterOuter
                    const n3 = builder.addNode({});

                    // LouterBody: goto LinnerCond
                    const n4 = builder.addNode({});

                    // LinnerCond: if 2 < 3 goto LinnerBody
                    const n5 = builder.addNode({});

                    // goto LafterInner
                    const n6 = builder.addNode({});

                    // LinnerBody: y = x
                    const n7 = builder.addNode({ def: ["y"], use: ["x"] });

                    // goto LinnerCond
                    const n8 = builder.addNode({});

                    // LafterInner: goto LouterCond
                    const n9 = builder.addNode({});

                    // LafterOuter: result = 0
                    const n10 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n3, n10);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n7, n6);
                    builder.addEdges(n6, n9);
                    builder.addEdges(n7, n8);
                    builder.addEdges(n8, n5);
                    builder.addEdges(n9, n2);
                    builder.addEdges(n10, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("loop_within_loop, variable defined in the inner loop body and used at the inner loop header", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto LouterBody
                    const n1 = builder.addNode({});
                    // goto LafterOuter
                    const n2 = builder.addNode({});
                    // LouterBody: goto LinnerCond
                    const n3 = builder.addNode({});
                    // LinnerCond: if x < 10 goto LinnerBody
                    const n4 = builder.addNode({ use: ["x"] });
                    // goto LafterInner
                    const n5 = builder.addNode({});
                    // LinnerBody: x = 1
                    const n6 = builder.addNode({ def: ["x"] });
                    // goto LinnerCond
                    const n7 = builder.addNode({});
                    // LafterInner: goto LouterCond
                    const n8 = builder.addNode({});
                    // LafterOuter: result = 0
                    const n9 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n9);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n6, n5);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n4);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n8, n1);
                    builder.addEdges(n9, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set([])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set([])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set([])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("loop_within_loop, variable defined in the inner loop body and used after the outer loop", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto LouterBody
                    const n1 = builder.addNode({});
                    // goto LafterOuter
                    const n2 = builder.addNode({});
                    // LouterBody: goto LinnerCond
                    const n3 = builder.addNode({});
                    // LinnerCond: if 2 < 3 goto LinnerBody
                    const n4 = builder.addNode({});
                    // goto LafterInner
                    const n5 = builder.addNode({});
                    // LinnerBody: x = 1
                    const n6 = builder.addNode({ def: ["x"] });
                    // goto LinnerCond
                    const n7 = builder.addNode({});
                    // LafterInner: goto LouterCond
                    const n8 = builder.addNode({});
                    // LafterOuter: result = x
                    const n9 = builder.addNode({ def: ["result"], use: ["x"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n9);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n6, n5);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n4);
                    builder.addEdges(n8, n1);
                    builder.addEdges(n9, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set([])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("loop_within_loop, variable defined in the inner loop body and only used in the inner loop body", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto LouterBody
                    const n1 = builder.addNode({});
                    // goto LafterOuter
                    const n2 = builder.addNode({});
                    // LouterBody: goto LinnerCond
                    const n3 = builder.addNode({});
                    // LinnerCond: if 2 < 3 goto LinnerBody
                    const n4 = builder.addNode({});
                    // goto LafterInner
                    const n5 = builder.addNode({});
                    // LinnerBody: x = 1
                    const n6 = builder.addNode({ def: ["x"] });
                    // LinnerBody: y = x
                    const n7 = builder.addNode({ def: ["y"], use: ["x"] });
                    // goto LinnerCond
                    const n8 = builder.addNode({});
                    // LafterInner: goto LouterCond
                    const n9 = builder.addNode({});
                    // LafterOuter: result = 0
                    const n10 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n10);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n6, n5);
                    builder.addEdges(n5, n9);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n8);
                    builder.addEdges(n8, n4);
                    builder.addEdges(n9, n1);
                    builder.addEdges(n10, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set([])],
                        [n3, new Set([])],
                        [n4, new Set([])],
                        [n5, new Set([])],
                        [n6, new Set([])],
                        [n7, new Set(["x"])],
                        [n8, new Set([])],
                        [n9, new Set([])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set([])],
                        [n3, new Set([])],
                        [n4, new Set([])],
                        [n5, new Set([])],
                        [n6, new Set(["x"])],
                        [n7, new Set([])],
                        [n8, new Set([])],
                        [n9, new Set([])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });

            });

            // 5
            describe("Branches in a loop", () => {
                test("two_branches_in_loop, variable defined before the loop and used in both branches inside the loop", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 10
                    const n1 = builder.addNode({ def: ["x"] });
                    // if (1 < 2) goto Lloop
                    const n2 = builder.addNode({});
                    // goto Lexit
                    const n3 = builder.addNode({});
                    // Lloop: if (2 < 3) goto Lleft
                    const n4 = builder.addNode({});
                    // goto Lright
                    const n5 = builder.addNode({});
                    // Lleft: y = x
                    const n6 = builder.addNode({ def: ["y"], use: ["x"] });
                    // goto Ljoin
                    const n7 = builder.addNode({});
                    // Lright: z = x
                    const n8 = builder.addNode({ def: ["z"], use: ["x"] });
                    // goto Ljoin
                    const n9 = builder.addNode({});
                    // Ljoin: goto Lcond
                    const n10 = builder.addNode({});
                    // Lexit: result = 0
                    const n11 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n3, n11);
                    builder.addEdges(n4, n6, n5);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n10);
                    builder.addEdges(n8, n9);
                    builder.addEdges(n9, n10);
                    builder.addEdges(n10, n2);
                    builder.addEdges(n11, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set(["x"])],
                        [n11, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set(["x"])],
                        [n11, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("two_branches_in_loop, variable defined in one branch and used at the loop header", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto Lhdr
                    const n1 = builder.addNode({});
                    // Lhdr: if x < 0 goto Lleft
                    const n2 = builder.addNode({ use: ["x"] });
                    // goto Lright
                    const n3 = builder.addNode({});
                    // Lleft: x = 1
                    const n4 = builder.addNode({ def: ["x"] });
                    // goto Ljoin
                    const n5 = builder.addNode({});
                    // Lright: y = 0
                    const n6 = builder.addNode({ def: ["y"] });
                    // goto Ljoin
                    const n7 = builder.addNode({});
                    // Ljoin: goto Lhdr
                    const n8 = builder.addNode({});
                    // Lexit: result = 0
                    const n9 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2, n9);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n3, n6);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n8);
                    builder.addEdges(n8, n2);
                    builder.addEdges(n9, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set([])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });

                test("two_branches_in_loop, variable defined in one branch and used after the loop", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 10
                    const n1 = builder.addNode({ def: ["x"] });
                    // if (1 < 2) goto Lloop
                    const n2 = builder.addNode({});
                    // goto Lexit
                    const n3 = builder.addNode({});
                    // Lloop: if (2 < 3) goto Lleft
                    const n4 = builder.addNode({});
                    // goto Lright
                    const n5 = builder.addNode({});
                    // Lleft: x = 10
                    const n6 = builder.addNode({ def: ["x"] });
                    // goto Ljoin
                    const n7 = builder.addNode({});
                    // Lright: y = 0
                    const n8 = builder.addNode({ def: ["y"] });
                    // goto Ljoin
                    const n9 = builder.addNode({});
                    // Ljoin: goto Lcond
                    const n10 = builder.addNode({});
                    // Lexit: result = x
                    const n11 = builder.addNode({ def: ["result"], use: ["x"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n3, n11);
                    builder.addEdges(n4, n6, n5);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n10);
                    builder.addEdges(n8, n9);
                    builder.addEdges(n9, n10);
                    builder.addEdges(n10, n2);
                    builder.addEdges(n11, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set([])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set(["x"])],
                        [n11, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set(["x"])],
                        [n11, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });



            });


            // 6
            describe("Loop in a branch", () => {
                test("loop_in_branch, variable defined before the branch and used inside the loop of one branch", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 5
                    const n1 = builder.addNode({ def: ["x"] });
                    // if (1 < 2) goto LloopCond
                    const n2 = builder.addNode({});
                    // goto Lother
                    const n3 = builder.addNode({});
                    // LloopCond: if (2 < 3) goto LloopBody
                    const n4 = builder.addNode({});
                    // goto LafterLoop
                    const n5 = builder.addNode({});
                    // LloopBody: y = x
                    const n6 = builder.addNode({ def: ["y"], use: ["x"] });
                    // goto LloopCond
                    const n7 = builder.addNode({});
                    // LafterLoop: goto Ljoin
                    const n8 = builder.addNode({});
                    // Lother: z = 0
                    const n9 = builder.addNode({ def: ["z"] });
                    // goto Ljoin
                    const n10 = builder.addNode({});
                    // Ljoin: result = 0
                    const n11 = builder.addNode({ def: ["result"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n3, n9);
                    builder.addEdges(n4, n6, n5);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n4);
                    builder.addEdges(n8, n11);
                    builder.addEdges(n9, n10);
                    builder.addEdges(n10, n11);
                    builder.addEdges(n11, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set([])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set([])],
                        [n9, new Set([])],
                        [n10, new Set([])],
                        [n11, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set([])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set([])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set([])],
                        [n9, new Set([])],
                        [n10, new Set([])],
                        [n11, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("loop_in_branch, variable defined inside the loop branch and used after the join", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto LloopCond
                    const n1 = builder.addNode({});
                    // goto Lother
                    const n2 = builder.addNode({});
                    // LloopCond: if 2 < 3 goto LloopBody
                    const n3 = builder.addNode({});
                    // goto LafterLoop
                    const n4 = builder.addNode({});
                    // LloopBody: x = 1
                    const n5 = builder.addNode({ def: ["x"] });
                    // goto LloopCond
                    const n6 = builder.addNode({});
                    // LafterLoop: goto Ljoin
                    const n7 = builder.addNode({});
                    // Lother: y = 0
                    const n8 = builder.addNode({ def: ["y"] });
                    // goto Ljoin
                    const n9 = builder.addNode({});
                    // Ljoin: result = x
                    const n10 = builder.addNode({ def: ["result"], use: ["x"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n2, n8);
                    builder.addEdges(n3, n5, n4);
                    builder.addEdges(n4, n7);
                    builder.addEdges(n5, n6);
                    builder.addEdges(n6, n3);
                    builder.addEdges(n7, n10);
                    builder.addEdges(n8, n9);
                    builder.addEdges(n9, n10);
                    builder.addEdges(n10, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set([])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [n9, new Set(["x"])],
                        [n10, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });
                test("loop_in_branch, variable defined in the other branch and used after the join", () => {
                    const builder = new LivenessInputBuilder();

                    // if 1 < 2 goto LLoopCond
                    const n1 = builder.addNode({});
                    // LLoopCond: if 2 < 3 goto LLoopBody
                    const n2 = builder.addNode({});
                    // LLoopBody: y = 0
                    const n3 = builder.addNode({ def: ["y"] });
                    // goto LLoopCond
                    const n4 = builder.addNode({});
                    // LAfterLoop: goto LJoin
                    const n5 = builder.addNode({});
                    // LDefine: x = 10
                    const n6 = builder.addNode({ def: ["x"] });
                    // goto LJoin
                    const n7 = builder.addNode({});
                    // LJoin: result = x
                    const n8 = builder.addNode({ def: ["result"], use: ["x"] });

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2, n6);
                    builder.addEdges(n2, n3, n5);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n2);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n8);
                    builder.addEdges(n8, builder.exitId);

                    const testInput = builder.build();

                    const expectedIn = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set([])],
                        [n7, new Set(["x"])],
                        [n8, new Set(["x"])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    const expectedOut = new Map([
                        [testInput.cfg.entryId, new Set(["x"])],
                        [n1, new Set(["x"])],
                        [n2, new Set(["x"])],
                        [n3, new Set(["x"])],
                        [n4, new Set(["x"])],
                        [n5, new Set(["x"])],
                        [n6, new Set(["x"])],
                        [n7, new Set(["x"])],
                        [n8, new Set([])],
                        [testInput.cfg.exitId, new Set([])],
                    ]);

                    expectLivenessInEquals(testInput, expectedIn, new Set([]));
                    expectLivenessOutEquals(testInput, expectedOut, new Set([]));
                });

            });
        });


    })

    describe("Data Access Tests", () => {
        test('should look at the in set of predecessors when computing the out set', () => {
            const testCFG = livenessSlidesExample();

            const analysis = LivenessAnalysis(testCFG, new Set([]));
            for (const step of analysis) {
                if (step.reason === 'out-computed') {
                    for (const [id, nodeData] of step.state.entries()) {
                        if (testCFG.cfg.getNodePredecessors(id)?.has(step.currentNodeId!)) {
                            expect(nodeData.inSet.lookedAt).toBe(true);
                        } else {
                            expect(nodeData.inSet.lookedAt).toBe(false);
                        }
                    }
                }
            }
        });

        test('should not look at any other set than inset of predecessors when computing the out set', () => {
            const testCFG = livenessSlidesExample();

            const analysis = LivenessAnalysis(testCFG, new Set([]));
            for (const step of analysis) {
                if (step.reason === 'out-computed') {
                    for (const [, nodeData] of step.state.entries()) {
                        expect(nodeData.outSet.lookedAt).toBe(false);
                        expect(nodeData.defSet.lookedAt).toBe(false);
                        expect(nodeData.useSet.lookedAt).toBe(false);
                    }
                }
            }
        });

        test('should only look at out, def and use set when computing the in set', () => {
            const testCFG = livenessSlidesExample();
            const analysis = LivenessAnalysis(testCFG, new Set([]));
            for (const step of analysis) {
                if (step.reason === 'in-computed') {
                    for (const [id, nodeData] of step.state.entries()) {
                        if (id === step.currentNodeId && id !== testCFG.cfg.entryId && id !== testCFG.cfg.exitId) {
                            expect(nodeData.outSet.lookedAt).toBe(true);
                            expect(nodeData.useSet.lookedAt).toBe(true);
                            expect(nodeData.defSet.lookedAt).toBe(true);
                        }
                    }
                }
            }
        })
    })


    describe('Liveness Analysis Extraction Functions', () => {
        describe('extractUseAndDefFromInstructions', () => {
            function createSingleInstructionsFromCode(code: string) {
                const program = readProgramFromText(code);
                const cfg = new SingleInstructionGraph(program);

                const instructions = new Map();
                for (const nodeId of cfg.dataNodeIds) {
                    instructions.set(nodeId, [...cfg.getNodeInstructions(nodeId).values()][0]);
                }

                return instructions;
            }

            test('should extract def and use sets from a simple assignment', () => {
                const instructions = createSingleInstructionsFromCode('x = 5');

                const {def, use} = extractUseAndDefFromInstructions(instructions);
                const nodeId = [...instructions.keys()][0];

                expect(def.get(nodeId)).toEqual(new Set(['x']));
                expect(use.get(nodeId)).toEqual(new Set([]));
            });

            test('should extract def and use sets from a binary operation', () => {
                const instructions = createSingleInstructionsFromCode(`
                a = 5
                b = 10
                c = a + b
            `);

                const {def, use} = extractUseAndDefFromInstructions(instructions);
                const nodeIds = [...instructions.keys()];

                // Check first instruction: a = 5
                expect(def.get(nodeIds[0])).toEqual(new Set(['a']));
                expect(use.get(nodeIds[0])).toEqual(new Set([]));

                // Check second instruction: b = 10
                expect(def.get(nodeIds[1])).toEqual(new Set(['b']));
                expect(use.get(nodeIds[1])).toEqual(new Set([]));

                // Check third instruction: c = a + b
                expect(def.get(nodeIds[2])).toEqual(new Set(['c']));
                expect(use.get(nodeIds[2])).toEqual(new Set(['a', 'b']));
            });

            test('should extract def and use sets from a unary operation', () => {
                const instructions = createSingleInstructionsFromCode(`
                x = 10
                y = - x
            `);

                const {def, use} = extractUseAndDefFromInstructions(instructions);
                const nodeIds = [...instructions.keys()];

                // Check first instruction: x = 10
                expect(def.get(nodeIds[0])).toEqual(new Set(['x']));
                expect(use.get(nodeIds[0])).toEqual(new Set([]));

                // Check second instruction: y = - x
                expect(def.get(nodeIds[1])).toEqual(new Set(['y']));
                expect(use.get(nodeIds[1])).toEqual(new Set(['x']));
            });

            test('should extract def and use sets from a copy operation', () => {
                const instructions = createSingleInstructionsFromCode(`
                x = 5
                y = x
            `);

                const {def, use} = extractUseAndDefFromInstructions(instructions);
                const nodeIds = [...instructions.keys()];

                // Check first instruction: x = 5
                expect(def.get(nodeIds[0])).toEqual(new Set(['x']));
                expect(use.get(nodeIds[0])).toEqual(new Set([]));

                // Check second instruction: y = x
                expect(def.get(nodeIds[1])).toEqual(new Set(['y']));
                expect(use.get(nodeIds[1])).toEqual(new Set(['x']));
            });

            test('should extract def and use sets from a conditional branch', () => {
                const instructions = createSingleInstructionsFromCode(`
                x = 10
                if x > 5 goto L1
                y = 20
                L1: z = 30
            `);

                const {def, use} = extractUseAndDefFromInstructions(instructions);
                const nodeIds = [...instructions.keys()];

                // Check conditional branch: if x > 5 goto L1
                const branchNodeId = nodeIds.find(id => {
                    const instr = instructions.get(id);
                    return instr.kind === 'ifWithOperator';
                });

                expect(branchNodeId).toBeDefined();
                expect(def.get(branchNodeId!)).toEqual(new Set([]));
                expect(use.get(branchNodeId!)).toEqual(new Set(['x']));
            });

        });

        describe('extractUseAndDefFromBasicBlocks', () => {
            function createBasicBlocksFromCode(code: string): Map<number, TacInstruction[]> {
                const program = readProgramFromText(code);
                const cfg = new BasicBlockControlFlowGraph(program);

                // Convert the CFG to a Map of basic blocks with their instructions
                const basicBlocks = new Map();
                for (const nodeId of cfg.dataNodeIds) {
                    basicBlocks.set(nodeId, [...cfg.getNodeInstructions(nodeId).values()]);
                }

                return basicBlocks;
            }

            test('should extract def and use sets from a simple basic block', () => {
                const basicBlocks = createBasicBlocksFromCode('x = 5');
                const blockId = [...basicBlocks.keys()][0];

                const {def, use} = extractUseAndDefFromBasicBlocks(basicBlocks);

                expect(def.get(blockId)).toEqual(new Set(['x']));
                expect(use.get(blockId)).toEqual(new Set([]));
            });

            test('should extract def set from a basic block with multiple instructions', () => {
                const basicBlocks = createBasicBlocksFromCode(`
                a = 5
                b = 10
                c = 15
            `);

                // Sollte nur einen Basic Block ergeben
                expect(basicBlocks.size).toBe(1);

                const blockId = [...basicBlocks.keys()][0];
                const {def} = extractUseAndDefFromBasicBlocks(basicBlocks);

                expect(def.get(blockId)).toEqual(new Set(['a', 'b', 'c']));
            });

            test('basic block use set should only contain variables that arent defined before their use within the block', () => {
                const basicBlocks = createBasicBlocksFromCode(`
                x = 5
                y = x
                x = 10
                z = x + y
            `);

                const blockId = [...basicBlocks.keys()][0];
                const {def, use} = extractUseAndDefFromBasicBlocks(basicBlocks);

                expect(def.get(blockId)).toEqual(new Set(['x', 'y', 'z']));
                expect(use.get(blockId)?.size).toEqual(0);
            });

            test('basic block def set should only contain variables that arent used before their definition', () => {
                const basicBlocks = createBasicBlocksFromCode(`
                x = x + y
                y = x
                x = 10
                z = x + y
            `);

                const blockId = [...basicBlocks.keys()][0];
                const {def, use} = extractUseAndDefFromBasicBlocks(basicBlocks);

                expect(use.get(blockId)).toEqual(new Set(['x', 'y']));
                expect(def.get(blockId)).toEqual(new Set(['z']));
            });

            test('should extract def and use sets from multiple basic blocks', () => {
                const basicBlocks = createBasicBlocksFromCode(`
                x = 5
                if x > y goto L1
                y = 10
                if x == 10 goto L1
                L1: y = 20
                z = x + y
            `);

                const {def, use} = extractUseAndDefFromBasicBlocks(basicBlocks);

                const basicBlockIds = [...basicBlocks.keys()];
                const firstBlockId = basicBlockIds[0];

                expect(firstBlockId).toBeDefined();
                expect(def.get(firstBlockId!)).toEqual(new Set(['x']));
                expect(use.get(firstBlockId!)).toEqual(new Set('y')); // Verwendet x nach der Definition

                const secondBlockId = basicBlockIds[1];

                expect(secondBlockId).toBeDefined();
                expect(def.get(secondBlockId)).toEqual(new Set(['y']));
                expect(use.get(secondBlockId)).toEqual(new Set(['x']));

                const lastBlockId = basicBlockIds[2];
                expect(def.get(lastBlockId)).toEqual(new Set(['y', 'z']));
                expect(use.get(lastBlockId)).toEqual(new Set(['x']));
            });

            test('should handle loop structures correctly', () => {
                const basicBlocks = createBasicBlocksFromCode(`
                i = 0
                L1: if i >= 5 goto L2
                i = i + 1
                goto L1
                L2: result = i
            `);

                const {def, use} = extractUseAndDefFromBasicBlocks(basicBlocks);

                // Finde den Block mit 'i = i + 1'
                const loopBlockId = [...basicBlocks.keys()][1];

                expect(loopBlockId).toBeDefined();
                expect(def.get(loopBlockId!)).toEqual(new Set([])); // uses i before definition
                expect(use.get(loopBlockId!)).toEqual(new Set(['i']));
            });

        });
    });
});