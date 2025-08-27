import {describe, expect, test} from "vitest";
import {
    extractUseAndDefFromBasicBlocks,
    extractUseAndDefFromInstructions,
    LivenessAnalysis,
    type LivenessInput,
    type LivenessState
} from "./liveness.ts";
import {enableMapSet} from "immer";
import type {ControlFlowGraph} from "../cfg/graph.ts";
import type {TacInstruction} from "../tac/parser-types.ts";
import {readProgramFromText} from "../tac/program.ts";
import {SingleInstructionGraph} from "../cfg/single-instruction.ts";
import {BasicBlockControlFlowGraph} from "../cfg/basic-blocks.ts";

// must be enabled for the tests
enableMapSet();

class TestLivenessCfg implements ControlFlowGraph {
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
            cfg: new TestLivenessCfg(this.dataNodeIds, this.entryId, this.exitId, [this.entryId, ...this.dataNodeIds, this.exitId], predecessors, successors),
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
                test("variables defined in branches are live in joining node", () => {
                    const builder = new LivenessInputBuilder();
                    // x = 5
                    const n1 = builder.addNode({def: ['x']});
                    // if (x > 0) goto L1
                    const n2 = builder.addNode({use: ['x']});
                    // then: y = 10
                    const n3 = builder.addNode({def: ['y']});
                    // goto L2
                    const n4 = builder.addNode({});
                    // L1: else: z = 20
                    const n5 = builder.addNode({def: ['z']});
                    // L2: result = y + z
                    const n6 = builder.addNode({def: ['result'], use: ['y', 'z']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n3, n5); // Branch point
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n6);
                    builder.addEdges(n5, n6); // Paths join
                    builder.addEdges(n6, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set(['y', 'z'])],   // Entry: y,z needed after branch, not defined before
                        [1, new Set(['y', 'z'])],   // n1: y,z needed after branch, not defined before
                        [2, new Set(['x', 'y', 'z'])], // n2: x used here, y,z needed after branch
                        [3, new Set(['z'])],        // n3: z needed in n6, y defined here
                        [4, new Set(['y', 'z'])],   // n4: y,z needed in n6
                        [5, new Set(['y'])],        // n5: y needed in n6, z defined here
                        [6, new Set(['y', 'z'])],   // n6: y,z used here
                        [-1, new Set([])]             // Exit: nothing lives out
                    ]);

                    const expectedOut = new Map([
                        [0, new Set(['y', 'z'])],   // Entry -> n1
                        [1, new Set(['x', 'y', 'z'])], // n1 -> n2
                        [2, new Set(['y', 'z'])],   // n2 -> n3/n5
                        [3, new Set(['y', 'z'])],   // n3 -> n4
                        [4, new Set(['y', 'z'])],   // n4 -> n6
                        [5, new Set(['y', 'z'])],   // n5 -> n6
                        [6, new Set([])],            // n6 -> Exit
                        [-1, new Set([])]            // Exit
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });

                test("variables only used in one branch are not live in the other branch", () => {
                    const builder = new LivenessInputBuilder();
                    // x = 5
                    const n1 = builder.addNode({def: ['x']});
                    // if (x > 0) goto L1
                    const n2 = builder.addNode({use: ['x']});
                    // then: y = x + 10
                    const n3 = builder.addNode({def: ['y'], use: ['x']});
                    // goto L2
                    const n4 = builder.addNode({});
                    // L1: else: z = 20
                    const n5 = builder.addNode({def: ['z']});
                    // L2: return y
                    const n6 = builder.addNode({use: ['y']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n3, n5);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n6);
                    builder.addEdges(n5, n6);
                    builder.addEdges(n6, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set(['y'])],      // Entry: y needed after branch, not defined before
                        [1, new Set(['y'])],      // n1: y needed after branch, not defined before
                        [2, new Set(['x', 'y'])], // n2: x used here, y needed after branch
                        [3, new Set(['x'])],     // n3: x used here
                        [4, new Set(['y'])],     // n4: y needed for n6
                        [5, new Set(['y'])],     // n5: y needed for n6, not defined here
                        [6, new Set(['y'])],     // n6: y used here
                        [-1, new Set([])]          // Exit: nothing lives out
                    ]);

                    const expectedOut = new Map([
                        [0, new Set(['y'])],      // Entry -> n1
                        [1, new Set(['x', 'y'])], // n1 -> n2
                        [2, new Set(['x', 'y'])], // n2 -> n3/n5
                        [3, new Set(['y'])],     // n3 -> n4
                        [4, new Set(['y'])],     // n4 -> n6
                        [5, new Set(['y'])],     // n5 -> n6
                        [6, new Set([])],         // n6 -> Exit
                        [-1, new Set([])]         // Exit
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });

                test("liveness with variables defined before branch and used after join", () => {
                    const builder = new LivenessInputBuilder();
                    // x = 5, v = 100
                    const n1 = builder.addNode({def: ['x', 'v']});
                    // if (x > 0) goto L1
                    const n2 = builder.addNode({use: ['x']});
                    // then: y = 10
                    const n3 = builder.addNode({def: ['y']});
                    // goto L2
                    const n4 = builder.addNode({});
                    // L1: else: z = 20
                    const n5 = builder.addNode({def: ['z']});
                    // L2: result = v
                    const n6 = builder.addNode({def: ['result'], use: ['v']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n3, n5);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n6);
                    builder.addEdges(n5, n6);
                    builder.addEdges(n6, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set([])],          // Entry: nothing flows back, v defined in n1
                        [1, new Set([])],          // n1: nothing flows back
                        [2, new Set(['x', 'v'])], // n2: x used here, v needed for n6
                        [3, new Set(['v'])],     // n3: v needed for n6
                        [4, new Set(['v'])],     // n4: v needed for n6
                        [5, new Set(['v'])],     // n5: v needed for n6
                        [6, new Set(['v'])],     // n6: v used here
                        [-1, new Set([])]          // Exit: nothing lives out
                    ]);

                    const expectedOut = new Map([
                        [0, new Set([])],          // Entry -> n1
                        [1, new Set(['x', 'v'])], // n1 -> n2
                        [2, new Set(['v'])],     // n2 -> n3/n5
                        [3, new Set(['v'])],     // n3 -> n4
                        [4, new Set(['v'])],     // n4 -> n6
                        [5, new Set(['v'])],     // n5 -> n6
                        [6, new Set([])],          // n6 -> Exit
                        [-1, new Set([])]          // Exit
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });
            });

            // 2. Complex Branching - Three execution paths
            describe("Complex Branching with Three Paths", () => {
                test("three-way branches - def before branch, use after join", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 5
                    const n1 = builder.addNode({def: ['x']});
                    // if (x < 0) goto L1
                    const n2 = builder.addNode({use: ['x']});
                    // if (x > 10) goto L2
                    const n3 = builder.addNode({use: ['x']});
                    // goto L3 (middle)
                    const n4 = builder.addNode({});
                    // L1:
                    const n5 = builder.addNode({});
                    // L2:
                    const n6 = builder.addNode({});
                    // L3: result = x
                    const n7 = builder.addNode({def: ['result'], use: ['x']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n5, n3);
                    builder.addEdges(n3, n4, n6);
                    builder.addEdges(n4, n7);
                    builder.addEdges(n5, n7);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set([])],
                        [1, new Set([])],
                        [2, new Set(['x'])],
                        [3, new Set(['x'])],
                        [4, new Set(['x'])],
                        [5, new Set(['x'])],
                        [6, new Set(['x'])],
                        [7, new Set(['x'])],
                        [-1, new Set([])]
                    ]);

                    const expectedOut = new Map([
                        [0, new Set([])],
                        [1, new Set(['x'])],
                        [2, new Set(['x'])],
                        [3, new Set(['x'])],
                        [4, new Set(['x'])],
                        [5, new Set(['x'])],
                        [6, new Set(['x'])],
                        [7, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });


                test("three-way branches - def in left branch, use after join", () => {
                    const builder = new LivenessInputBuilder();

                    // if (1 < 2) goto L1
                    const n1 = builder.addNode({});
                    // if (2 < 3) goto L2
                    const n2 = builder.addNode({});
                    // goto L3 (middle)
                    const n3 = builder.addNode({});
                    // L1: x = 10
                    const n4 = builder.addNode({def: ['x']});
                    // goto L4
                    const n5 = builder.addNode({});
                    // L2:
                    const n6 = builder.addNode({});
                    // L3:
                    const n7 = builder.addNode({});
                    // L4: result = x
                    const n8 = builder.addNode({def: ['result'], use: ['x']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n4, n2);
                    builder.addEdges(n2, n7, n6);
                    builder.addEdges(n3, n7); // not used but for symmetry
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n8);
                    builder.addEdges(n6, n8);
                    builder.addEdges(n7, n8);
                    builder.addEdges(n8, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set(['x'])],
                        [1, new Set(['x'])],
                        [2, new Set(['x'])],
                        [3, new Set(['x'])],
                        [4, new Set([])],
                        [5, new Set(['x'])],
                        [6, new Set(['x'])],
                        [7, new Set(['x'])],
                        [8, new Set(['x'])],
                        [-1, new Set([])]
                    ]);

                    const expectedOut = new Map([
                        [0, new Set(['x'])],
                        [1, new Set(['x'])],
                        [2, new Set(['x'])],
                        [3, new Set(['x'])],
                        [4, new Set(['x'])],
                        [5, new Set(['x'])],
                        [6, new Set(['x'])],
                        [7, new Set(['x'])],
                        [8, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });
                test("three-way branches - defs in all three branches, merge at join", () => {
                    const builder = new LivenessInputBuilder();

                    // if (1 < 2) goto L1
                    const n1 = builder.addNode({});
                    // if (2 < 3) goto L2
                    const n2 = builder.addNode({});
                    // goto L3 (middle)
                    const n3 = builder.addNode({});
                    // L1: x = 10
                    const n4 = builder.addNode({def: ['x']});
                    // goto L4
                    const n5 = builder.addNode({});
                    // L2: x = 20
                    const n6 = builder.addNode({def: ['x']});
                    // goto L4
                    const n7 = builder.addNode({});
                    // L3: x = 30
                    const n8 = builder.addNode({def: ['x']});
                    // goto L4
                    const n9 = builder.addNode({});
                    // L4: result = x
                    const n10 = builder.addNode({def: ['result'], use: ['x']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n4, n2);
                    builder.addEdges(n2, n8, n6);
                    builder.addEdges(n3, n8);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n6, n7);
                    builder.addEdges(n8, n9);
                    builder.addEdges(n5, n10);
                    builder.addEdges(n7, n10);
                    builder.addEdges(n9, n10);
                    builder.addEdges(n10, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set([])],
                        [1, new Set([])],
                        [2, new Set([])],
                        [3, new Set([])],
                        [4, new Set([])],
                        [5, new Set(['x'])],
                        [6, new Set([])],
                        [7, new Set(['x'])],
                        [8, new Set([])],
                        [9, new Set(['x'])],
                        [10, new Set(['x'])],
                        [-1, new Set([])]
                    ]);

                    const expectedOut = new Map([
                        [0, new Set([])],
                        [1, new Set([])],
                        [2, new Set([])],
                        [3, new Set([])],
                        [4, new Set(['x'])],
                        [5, new Set(['x'])],
                        [6, new Set(['x'])],
                        [7, new Set(['x'])],
                        [8, new Set(['x'])],
                        [9, new Set(['x'])],
                        [10, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });

            });


            // 3. Simple Loop
            describe("Simple Loop", () => {
                test("loop - def before loop, use after loop", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 5
                    const n1 = builder.addNode({def: ['x']});
                    // L1: if (x < 10) goto L2
                    const n2 = builder.addNode({use: ['x']});
                    // goto L3
                    const n3 = builder.addNode({});
                    // L2: x = x + 1
                    const n4 = builder.addNode({def: ['x'], use: ['x']});
                    // goto L1
                    const n5 = builder.addNode({});
                    // L3: result = x
                    const n6 = builder.addNode({def: ['result'], use: ['x']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n2); // loop back edge
                    builder.addEdges(n3, n6);
                    builder.addEdges(n6, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set([])],
                        [1, new Set([])],
                        [2, new Set(['x'])],
                        [3, new Set(['x'])],
                        [4, new Set(['x'])],
                        [5, new Set(['x'])],
                        [6, new Set(['x'])],
                        [-1, new Set([])]
                    ]);

                    const expectedOut = new Map([
                        [0, new Set([])],
                        [1, new Set(['x'])],
                        [2, new Set(['x'])],
                        [3, new Set(['x'])],
                        [4, new Set(['x'])],
                        [5, new Set(['x'])],
                        [6, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });


                test("loop - def inside loop, use after loop", () => {
                    const builder = new LivenessInputBuilder();

                    // L1: if (1 < 2) goto L2
                    const n1 = builder.addNode({});
                    // goto L3
                    const n2 = builder.addNode({});
                    // L2: x = 10
                    const n3 = builder.addNode({def: ['x']});
                    // goto L1
                    const n4 = builder.addNode({});
                    // L3: result = x
                    const n5 = builder.addNode({def: ['result'], use: ['x']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n3, n2);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n1); // loop back edge
                    builder.addEdges(n2, n5);
                    builder.addEdges(n5, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set(['x'])],
                        [1, new Set(['x'])],
                        [2, new Set(['x'])],
                        [3, new Set([])],
                        [4, new Set(['x'])],
                        [5, new Set(['x'])],
                        [-1, new Set([])]
                    ]);

                    const expectedOut = new Map([
                        [0, new Set(['x'])],
                        [1, new Set(['x'])],
                        [2, new Set(['x'])],
                        [3, new Set(['x'])],
                        [4, new Set(['x'])],
                        [5, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });


                test("loop - def before loop, used only inside loop", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 5
                    const n1 = builder.addNode({def: ['x']});
                    // L1: if x < 10 goto L2
                    const n2 = builder.addNode({use: ['x']});
                    // goto L3
                    const n3 = builder.addNode({});
                    // L2: y = x
                    const n4 = builder.addNode({def: ['y'], use: ['x']});
                    // goto L1
                    const n5 = builder.addNode({});
                    // L3: result = y
                    const n6 = builder.addNode({def: ['result'], use: ['y']});

                    // Build edges
                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);  // branch inside loop
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n2);      // back edge
                    builder.addEdges(n3, n6);
                    builder.addEdges(n6, builder.exitId);

                    const testCFG = builder.build();

                    // Corrected expected liveness sets
                    const expectedIn = new Map([
                        [0, new Set(['y'])],           // entry
                        [1, new Set(['y'])],        // n1
                        [2, new Set(['x', 'y'])],    // n2
                        [3, new Set(['y'])],        // n3
                        [4, new Set(['x'])],        // n4
                        [5, new Set(['x', 'y'])],    // n5
                        [6, new Set(['y'])],        // n6
                        [-1, new Set([])]           // exit
                    ]);

                    const expectedOut = new Map([
                        [0, new Set(['y'])],        // entry
                        [1, new Set(['x', 'y'])],    // n1
                        [2, new Set(['x', 'y'])],    // n2
                        [3, new Set(['y'])],        // n3
                        [4, new Set(['x', 'y'])],    // n4
                        [5, new Set(['x', 'y'])],    // n5
                        [6, new Set([])],            // n6
                        [-1, new Set([])]           // exit
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });


                test("loop - induction variable live across iterations", () => {
                    const builder = new LivenessInputBuilder();

                    // i = 0
                    const n1 = builder.addNode({def: ['i']});
                    // L1: if (i < 10) goto L2
                    const n2 = builder.addNode({use: ['i']});
                    // goto L3
                    const n3 = builder.addNode({});
                    // L2: i = i + 1
                    const n4 = builder.addNode({def: ['i'], use: ['i']});
                    // goto L1
                    const n5 = builder.addNode({});
                    // L3: result = i
                    const n6 = builder.addNode({def: ['result'], use: ['i']});

                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n4, n3);
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n2); // loop back edge
                    builder.addEdges(n3, n6);
                    builder.addEdges(n6, builder.exitId);

                    const testCFG = builder.build();

                    const expectedIn = new Map([
                        [0, new Set([])],
                        [1, new Set([])],
                        [2, new Set(['i'])],
                        [3, new Set(['i'])],
                        [4, new Set(['i'])],
                        [5, new Set(['i'])],
                        [6, new Set(['i'])],
                        [-1, new Set([])]
                    ]);

                    const expectedOut = new Map([
                        [0, new Set([])],
                        [1, new Set(['i'])],
                        [2, new Set(['i'])],
                        [3, new Set(['i'])],
                        [4, new Set(['i'])],
                        [5, new Set(['i'])],
                        [6, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });


            });

            // 4. Nested Loops
            describe("Nested Loops", () => {
                test("nested loops - def before outer, used in inner and after", () => {
                    const builder = new LivenessInputBuilder();

                    // x = 5
                    const n1 = builder.addNode({def: ['x']});

                    // Outer loop start: if x < 10 goto inner loop, else goto after outer
                    const n2 = builder.addNode({use: ['x']});

                    // Inner loop start: if x < 8 goto inner body, else after inner
                    const n3 = builder.addNode({use: ['x']});

                    // Inner body: y = x + 1
                    const n4 = builder.addNode({def: ['y'], use: ['x']});

                    // Back to inner loop start
                    const n5 = builder.addNode({});

                    // After inner loop
                    const n6 = builder.addNode({});

                    // Outer loop continuation
                    const n7 = builder.addNode({});

                    // After outer loop: result = x + y
                    const n8 = builder.addNode({def: ['result'], use: ['x', 'y']});

                    // Build edges
                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n3, n8); // outer loop branch
                    builder.addEdges(n3, n4, n6); // inner loop branch
                    builder.addEdges(n4, n5);
                    builder.addEdges(n5, n3);     // inner loop back edge
                    builder.addEdges(n6, n7);
                    builder.addEdges(n7, n2);     // outer loop back edge
                    builder.addEdges(n8, builder.exitId);

                    const testCFG = builder.build();

                    // Corrected expected liveness sets
                    const expectedIn = new Map([
                        [0, new Set(['y'])],           // entry
                        [1, new Set(['y'])],        // n1
                        [2, new Set(['x', 'y'])],    // n2
                        [3, new Set(['x', 'y'])],    // n3
                        [4, new Set(['x'])],        // n4
                        [5, new Set(['x', 'y'])],    // n5
                        [6, new Set(['x', 'y'])],    // n6
                        [7, new Set(['x', 'y'])],    // n7
                        [8, new Set(['x', 'y'])],    // n8
                        [-1, new Set([])]           // exit
                    ]);

                    const expectedOut = new Map([
                        [0, new Set(['y'])],
                        [1, new Set(['x', 'y'])],
                        [2, new Set(['x', 'y'])],
                        [3, new Set(['x', 'y'])],
                        [4, new Set(['x', 'y'])],
                        [5, new Set(['x', 'y'])],
                        [6, new Set(['x', 'y'])],
                        [7, new Set(['x', 'y'])],
                        [8, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });


                test("nested loops - def inside inner loop only, use after outer", () => {
                    const builder = new LivenessInputBuilder();

                    // Outer loop start
                    // if 1<2 goto inner
                    const n1 = builder.addNode({});

                    // Inner loop start
                    // if 1<2 goto body
                    const n2 = builder.addNode({});
                    // z = 42
                    const n3 = builder.addNode({def: ['z']});
                    // goto inner loop start
                    const n4 = builder.addNode({});

                    // After inner loop
                    const n5 = builder.addNode({});
                    // goto outer loop start
                    const n6 = builder.addNode({});

                    // After outer loop
                    const n7 = builder.addNode({def: ['result'], use: ['z']});

                    // Build CFG
                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2, n7);
                    builder.addEdges(n2, n3, n5);
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n2);     // inner loop back
                    builder.addEdges(n5, n6);
                    builder.addEdges(n6, n1);     // outer loop back
                    builder.addEdges(n7, builder.exitId);

                    const testCFG = builder.build();

                    // Computed liveIn/liveOut
                    const expectedIn = new Map([
                        [0, new Set(['z'])],
                        [1, new Set(['z'])],
                        [2, new Set(['z'])],
                        [3, new Set([])],
                        [4, new Set(['z'])],
                        [5, new Set(['z'])],
                        [6, new Set(['z'])],
                        [7, new Set(['z'])],
                        [-1, new Set([])]
                    ]);

                    const expectedOut = new Map([
                        [0, new Set(['z'])],
                        [1, new Set(['z'])],
                        [2, new Set(['z'])],
                        [3, new Set(['z'])],
                        [4, new Set(['z'])],
                        [5, new Set(['z'])],
                        [6, new Set(['z'])],
                        [7, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
                });

                test("nested loops - induction variables outer and inner", () => {
                    const builder = new LivenessInputBuilder();

                    // i = 0 (outer loop induction variable)
                    const n1 = builder.addNode({def: ['i']});
                    // outer loop start: if i<10 goto inner loop else after outer
                    const n2 = builder.addNode({use: ['i']});

                    // j = 0 (inner loop induction variable)
                    const n3 = builder.addNode({def: ['j']});
                    // if j<5 goto inner body else after inner
                    const n4 = builder.addNode({use: ['j']});
                    // j = j + 1
                    const n5 = builder.addNode({def: ['j'], use: ['j']});
                    // goto inner loop start
                    const n6 = builder.addNode({});

                    // outer loop increment i
                    const n7 = builder.addNode({def: ['i'], use: ['i']});
                    // goto outer loop start
                    const n8 = builder.addNode({});

                    // after outer loop
                    const n9 = builder.addNode({def: ['result'], use: ['i', 'j']});

                    // Build CFG edges
                    builder.addEdges(builder.entryId, n1);
                    builder.addEdges(n1, n2);
                    builder.addEdges(n2, n3, n9); // outer loop branch
                    builder.addEdges(n3, n4);
                    builder.addEdges(n4, n5, n7); // inner loop branch
                    builder.addEdges(n5, n6);
                    builder.addEdges(n6, n4);      // inner loop back
                    builder.addEdges(n7, n8);
                    builder.addEdges(n8, n2);      // outer loop back
                    builder.addEdges(n9, builder.exitId);

                    const testCFG = builder.build();

                    // Corrected expected liveness sets
                    const expectedIn = new Map([
                        [0, new Set(['j'])],        // entry
                        [1, new Set(['j'])],        // n1
                        [2, new Set(['i', 'j'])],    // n2
                        [3, new Set(['i'])],        // n3
                        [4, new Set(['i', 'j'])],    // n4
                        [5, new Set(['i', 'j'])],    // n5
                        [6, new Set(['i', 'j'])],    // n6
                        [7, new Set(['i', 'j'])],    // n7
                        [8, new Set(['i', 'j'])],    // n8
                        [9, new Set(['i', 'j'])],    // n9
                        [-1, new Set([])]           // exit
                    ]);

                    const expectedOut = new Map([
                        [0, new Set(['j'])],
                        [1, new Set(['i', 'j'])],
                        [2, new Set(['i', 'j'])],
                        [3, new Set(['i', 'j'])],
                        [4, new Set(['i', 'j'])],
                        [5, new Set(['i', 'j'])],
                        [6, new Set(['i', 'j'])],
                        [7, new Set(['i', 'j'])],
                        [8, new Set(['i', 'j'])],
                        [9, new Set([])],
                        [-1, new Set([])]
                    ]);

                    expectLivenessInEquals(testCFG, expectedIn, new Set([]));
                    expectLivenessOutEquals(testCFG, expectedOut, new Set([]));
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