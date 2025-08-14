import {expect, test} from "vitest";
import {LivenessAnalysis, type LivenessCFG, type LivenessState} from "./liveness.ts";
import {enableMapSet} from "immer";

// must be enabled for the tests
enableMapSet();

class LivenessCFGBuilder {
    private readonly nodes: Array<number>;
    private readonly useSets: Map<number, Set<string>>;
    private readonly defSets: Map<number, Set<string>>;
    private readonly edges: Map<number, Set<number>>;
    private entryNode: number | undefined;
    private exitNode: number | undefined;
    private nextNode: number;

    constructor() {
        this.nodes = [];
        this.defSets = new Map();
        this.useSets = new Map();
        this.edges = new Map();
        this.nextNode = 0;
    }

    addNode(defData: Array<string>, useData: Array<string>): number {
        this.nodes.push(this.nextNode);
        this.useSets.set(this.nextNode, new Set(useData));
        this.defSets.set(this.nextNode, new Set(defData));
        return this.nextNode++;
    }

    addEntryNode(): number {
        this.nodes.push(this.nextNode);
        this.entryNode = this.nextNode;
        return this.nextNode++;
    }

    addExitNode() {
        this.nodes.push(this.nextNode);
        this.exitNode = this.nextNode;
        return this.nextNode++;
    }

    addEdges(nodeId: number, ...targets: number[]) {
        this.edges.set(nodeId, new Set(targets));
    }

    build(): LivenessCFG {
        return {
            use: this.useSets,
            def: this.defSets,
            entryId: this.entryNode!,
            exitId: this.exitNode!,
            nodes: this.nodes,
            edges: this.edges,
        }
    }
}

const livenessSlidesExample = () => {
    const builder = new LivenessCFGBuilder();
    // entry node
    const entry = builder.addEntryNode();
    // a = 0
    const i1 = builder.addNode(['a'], []);
    // b = a + 1
    const i2 = builder.addNode(['b'], ['a']);
    // c = c + b
    const i3 = builder.addNode(['c'], ['c', 'b']);
    // a = b*2
    const i4 = builder.addNode(['a'], ['b']);
    // a < 10
    const i5 = builder.addNode([], ['a']);
    // return c
    const i6 = builder.addNode([], ['c']);
    // exit node
    const exit = builder.addExitNode();

    builder.addEdges(entry, i1);
    builder.addEdges(i1, i2);
    builder.addEdges(i2, i3);
    builder.addEdges(i3, i4);
    builder.addEdges(i4, i5);
    builder.addEdges(i5, i6, i2);
    builder.addEdges(i6, exit);

    return builder.build();
}

const livenessSlideFinalIn = () => {
    return new Map([
        [1, new Set(['c'])],
        [2, new Set(['a', 'c'])],
        [3, new Set(['b', 'c'])],
        [4, new Set(['b', 'c'])],
        [5, new Set(['a', 'c'])],
        [6, new Set(['c'])]
    ]);
}

const livenessSlideFinalOut = () => {
    return new Map([
        [1, new Set(['a', 'c'])],
        [2, new Set(['b', 'c'])],
        [3, new Set(['b', 'c'])],
        [4, new Set(['a', 'c'])],
        [5, new Set(['a', 'c'])],
        [6, new Set([])]
    ]);
};

function getFinalState(analysis: Generator<LivenessState>) {
    let finalState: LivenessState | undefined = undefined;

    for (const step of analysis) {
        finalState = step;
    }
    if (finalState === undefined) throw new Error("the generator yielded no steps");
    return finalState;
}

function testLivenessHelper(name: string, testCFG : LivenessCFG, expectedIn : Map<number, Set<string>>, expectedOut : Map<number,Set<string>>) {
    test(`should yield correct final in for ${name}`, () => {
        const analysis = LivenessAnalysis(testCFG, new Set());
        const finalState = getFinalState(analysis);
        for (const [id, set] of expectedIn) {
            const actual = finalState.state.get(id)?.inSet.data;
            expect(actual, `in set of node ${id} did not match`).toEqual(set);
        }
    });

    test(`should yield correct final out for ${name}`, () => {
        const analysis = LivenessAnalysis(testCFG, new Set());
        const finalState = getFinalState(analysis);
        for (const [id, set] of expectedOut) {
            const actual = finalState.state.get(id)?.outSet.data;
            expect(actual, `out set of node ${id} did not match`).toEqual(set);
        }
    });
}

test(`should not break previous states`, () => {
   // TODO: add test
    throw new Error("not yet tested");
});

testLivenessHelper('slide example', livenessSlidesExample(), livenessSlideFinalIn(), livenessSlideFinalOut());

const test1 = () => {
    const builder = new LivenessCFGBuilder();
    const entry = builder.addEntryNode();
    const i1 = builder.addNode(['x'], []);
    const i2 = builder.addNode(['y'], ['x']);
    const i3 = builder.addNode(['z'], ['x', 'y']);
    const i4 = builder.addNode([], ['z']);
    const exit = builder.addExitNode();

    builder.addEdges(entry, i1);
    builder.addEdges(i1, i2);
    builder.addEdges(i2, i3);
    builder.addEdges(i3, i4);
    builder.addEdges(i4, exit);

    return builder.build();
};

const test1FinalIn = () => new Map<number, Set<string>>([
    [1, new Set()],
    [2, new Set(['x'])],
    [3, new Set(['x', 'y'])],
    [4, new Set(['z'])]
]);

const test1FinalOut = () => new Map<number, Set<string>>([
    [1, new Set(['x'])],
    [2, new Set(['x', 'y'])],
    [3, new Set(['z'])],
    [4, new Set()]
]);

testLivenessHelper('linear sequence with overlapping live ranges', test1(), test1FinalIn(), test1FinalOut());

const test3 = () => {
    const builder = new LivenessCFGBuilder();
    const entry = builder.addEntryNode();
    const i1 = builder.addNode(['a'], []);
    const i2 = builder.addNode([], ['a']); // if (a)
    const i3 = builder.addNode(['b'], ['a']); // then
    const i4 = builder.addNode(['c'], ['a']); // else
    const i5 = builder.addNode(['d'], ['b', 'c']); // join
    const exit = builder.addExitNode();

    builder.addEdges(entry, i1);
    builder.addEdges(i1, i2);
    builder.addEdges(i2, i3, i4);
    builder.addEdges(i3, i5);
    builder.addEdges(i4, i5);
    builder.addEdges(i5, exit);

    return builder.build();
};

const test3FinalIn = () => new Map<number, Set<string>>([
    [1, new Set(['b', 'c'])],
    [2, new Set(['a', 'b', 'c'])],
    [3, new Set(['a', 'c'])],
    [4, new Set(['a', 'b'])],
    [5, new Set(['b', 'c'])]
]);

const test3FinalOut = () => new Map<number, Set<string>>([
    [1, new Set(['a', 'b', 'c'])],
    [2, new Set(['a', 'b', 'c'])],
    [3, new Set(['b', 'c'])],
    [4, new Set(['b', 'c'])],
    [5, new Set()]
]);

testLivenessHelper('if-else-branch', test3(), test3FinalIn(), test3FinalOut());

const test4 = () => {
    const builder = new LivenessCFGBuilder();
    const entry = builder.addEntryNode();
    const i1 = builder.addNode(['a'], []);
    const i2 = builder.addNode(['c'], []);
    const i3 = builder.addNode(['b'], []);
    const i4 = builder.addNode([], ['a']);// if (a)
    const i5 = builder.addNode(['b'], ['a']); // then
    const i6 = builder.addNode(['c'], ['a']); // else
    const i7 = builder.addNode(['d'], ['b', 'c']); // join
    const exit = builder.addExitNode();

    builder.addEdges(entry, i1);
    builder.addEdges(i1, i2);
    builder.addEdges(i2, i3);
    builder.addEdges(i3, i4);
    builder.addEdges(i4, i5, i6);
    builder.addEdges(i5, i7);
    builder.addEdges(i6, i7);
    builder.addEdges(i7, exit);

    return builder.build();
};

const test4FinalIn = () => new Map<number, Set<string>>([
    [0, new Set()],
    [1, new Set()],
    [2, new Set(['a'])],
    [3, new Set(['a', 'c'])],
    [4, new Set(['a', 'b', 'c'])],
    [5, new Set(['a', 'c'])],
    [6, new Set(['a', 'b'])],
    [7, new Set(['b', 'c'])]
]);

const test4FinalOut = () => new Map<number, Set<string>>([
    [0, new Set()],
    [1, new Set(['a'])],
    [2, new Set(['a', 'c'])],
    [3, new Set(['a', 'b', 'c'])],
    [4, new Set(['a', 'b', 'c'])],
    [5, new Set(['b', 'c'])],
    [6, new Set(['b', 'c'])],
    [7, new Set()]
]);

testLivenessHelper('if-else-branch-all-defined', test4(), test4FinalIn(), test4FinalOut());

const test5 = () => {
    const builder = new LivenessCFGBuilder();
    const entry = builder.addEntryNode();
    const i1 = builder.addNode(['x'], []);
    const i2 = builder.addNode([], ['x']); // while (x)
    const i3 = builder.addNode(['x'], ['x']); // x = x - 1
    const exit = builder.addExitNode();

    builder.addEdges(entry, i1);
    builder.addEdges(i1, i2);
    builder.addEdges(i2, i3, exit);
    builder.addEdges(i3, i2);

    return builder.build();
};

const test5FinalIn = () => new Map<number, Set<string>>([
    [1, new Set()],
    [2, new Set(['x'])],
    [3, new Set(['x'])]
]);

const test5FinalOut = () => new Map<number, Set<string>>([
    [1, new Set(['x'])],
    [2, new Set(['x'])],
    [3, new Set(['x'])]
]);

testLivenessHelper('while condition', test5(), test5FinalIn(), test5FinalOut());

const test6 = () => {
    const builder = new LivenessCFGBuilder();
    const entry = builder.addEntryNode();
    const i1 = builder.addNode(['i'], []);
    const i2 = builder.addNode(['j'], ['i']);
    const i3 = builder.addNode(['k'], ['j']);
    const i4 = builder.addNode([], ['k']); // while(k)
    const i5 = builder.addNode(['j'], ['k']); // body: j = ...
    const i6 = builder.addNode(['k'], ['j']); // body: k = ...
    const i7 = builder.addNode([], ['j']); // end of while
    const exit = builder.addExitNode();

    builder.addEdges(entry, i1);
    builder.addEdges(i1, i2);
    builder.addEdges(i2, i3);
    builder.addEdges(i3, i4);
    builder.addEdges(i4, i5, i7);
    builder.addEdges(i5, i6);
    builder.addEdges(i6, i4);
    builder.addEdges(i7, exit);

    return builder.build();
};

const test6FinalIn = () => new Map<number, Set<string>>([
    [1, new Set()],
    [2, new Set(['i'])],
    [3, new Set(['j'])],
    [4, new Set(['j', 'k'])],
    [5, new Set(['k'])],
    [6, new Set(['j'])],
    [7, new Set(['j'])]
]);

const test6FinalOut = () => new Map<number, Set<string>>([
    [1, new Set(['i'])],
    [2, new Set(['j'])],
    [3, new Set(['j', 'k'])],
    [4, new Set(['j', 'k'])],
    [5, new Set(['j'])],
    [6, new Set(['j', 'k'])],
    [7, new Set()]
]);

testLivenessHelper('single loops', test6(), test6FinalIn(), test6FinalOut());