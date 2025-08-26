import {expect, test} from "vitest";
import {TacParser} from "../tac/parser.ts";
import {type TacInstruction} from "../tac/parser-types.ts";
import {TacProgram} from "../tac/program.ts";
import {BasicBlockControlFlowGraph} from "./basic-blocks.ts";

function parseTac(input: string): Array<TacInstruction> {
    return new TacParser(input).parseTac();
}

function idGenerator() {
    let i = 0;
    return () => i++;
}


test('should create entry and exit nodes', () => {
    const program = `a = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    expect(cfg.entryId).toBeDefined();
    expect(cfg.exitId).toBeDefined();
    expect(cfg.entryId).not.toBe(cfg.exitId);
    expect(cfg.entryId).toBeGreaterThan(0); // Should be reserved after instruction IDs
    expect(cfg.exitId).toBeGreaterThan(0);
});

test('should create single basic block for sequential instructions', () => {
    const program = `
        a = 1
        b = 2
        c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    const nodeIds = cfg.nodeIds;
    // Should have entry, exit, and one basic block (leader = first instruction ID)
    expect(nodeIds).toContain(cfg.entryId);
    expect(nodeIds).toContain(cfg.exitId);
    expect(nodeIds).toContain(0); // First instruction is the basic block leader
    expect(nodeIds).toHaveLength(3); // entry + exit + 1 basic block
});

test('should create multiple basic blocks with jump targets', () => {
    const program = `
        a = 1
        goto TARGET
        b = 2
        TARGET: c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    const nodeIds = cfg.nodeIds;
    expect(nodeIds).toContain(cfg.entryId);
    expect(nodeIds).toContain(cfg.exitId);
    expect(nodeIds).toContain(0); // First basic block (a = 1, goto TARGET)
    expect(nodeIds).toContain(2); // Second basic block (b = 2)
    expect(nodeIds).toContain(3); // Third basic block (TARGET: c = 3)
    expect(nodeIds).toHaveLength(5); // entry + exit + 3 basic blocks
});

test('should handle if instruction creating multiple basic blocks', () => {
    const program = `
        a = 1
        if a == 1 goto TARGET
        b = 2
        TARGET: c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    const nodeIds = cfg.nodeIds;
    expect(nodeIds).toContain(0); // First block (a = 1, if a == 1 goto TARGET)
    expect(nodeIds).toContain(2); // Second block (b = 2)
    expect(nodeIds).toContain(3); // Third block (TARGET: c = 3)
    expect(nodeIds).toHaveLength(5); // entry + exit + 3 basic blocks
});

test('should connect entry to first basic block', () => {
    const program = `
        a = 1
        b = 2`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    const entrySuccessors = cfg.getNodeSuccessors(cfg.entryId);
    expect(entrySuccessors).toEqual(new Set([0])); // First basic block leader

    const firstBlockPredecessors = cfg.getNodePredecessors(0);
    expect(firstBlockPredecessors).toContain(cfg.entryId);
});

test('should connect last basic block to exit', () => {
    const program = `
        a = 1
        b = 2`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    const lastBlockSuccessors = cfg.getNodeSuccessors(0); // Only one block
    expect(lastBlockSuccessors).toContain(cfg.exitId);

    const exitPredecessors = cfg.getNodePredecessors(cfg.exitId);
    expect(exitPredecessors).toContain(0); // First (and only) basic block
});

test('should handle goto instruction connections', () => {
    const program = `
        a = 1
        goto TARGET
        b = 2
        TARGET: c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // First basic block (containing goto) should connect only to TARGET block
    const firstBlockSuccessors = cfg.getNodeSuccessors(0);
    expect(firstBlockSuccessors).toEqual(new Set([3])); // TARGET block
    expect(firstBlockSuccessors).not.toContain(2); // Should not connect to unreachable block

    // TARGET block should have first block as predecessor
    const targetPredecessors = cfg.getNodePredecessors(3);
    expect(targetPredecessors).toContain(0);

    // Unreachable block should have no predecessors from reachable code
    const unreachablePredecessors = cfg.getNodePredecessors(2);
    expect(unreachablePredecessors).not.toContain(0);
});

test('should handle if instruction with two branches', () => {
    const program = `
        a = 1
        if a == 1 goto TARGET
        b = 2
        TARGET: c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // First basic block should connect to both next block and jump target
    const firstBlockSuccessors = cfg.getNodeSuccessors(0);
    expect(firstBlockSuccessors).toContain(2); // Next basic block (b = 2)
    expect(firstBlockSuccessors).toContain(3); // Jump target (TARGET: c = 3)

    // Both target blocks should have first block as predecessor
    const nextBlockPredecessors = cfg.getNodePredecessors(2);
    expect(nextBlockPredecessors).toContain(0);

    const targetBlockPredecessors = cfg.getNodePredecessors(3);
    expect(targetBlockPredecessors).toContain(0);
});

test('should return all instructions in a basic block', () => {
    const program = `
        a = 1
        b = 2
        c = 3
        goto TARGET
        d = 4
        TARGET: e = 5`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // First basic block should contain all instructions before the jump target
    const firstBlockInstructions = [...cfg.getNodeInstructions(0).values()];
    expect(firstBlockInstructions).toHaveLength(4); // a=1, b=2, c=3, goto TARGET
    expect(firstBlockInstructions[0].kind).toBe('copy'); // a = 1
    expect(firstBlockInstructions[1].kind).toBe('copy'); // b = 2
    expect(firstBlockInstructions[2].kind).toBe('copy'); // c = 3
    expect(firstBlockInstructions[3].kind).toBe('jump'); // goto TARGET

    // Second basic block (unreachable)
    const secondBlockInstructions = [...cfg.getNodeInstructions(4).values()];
    expect(secondBlockInstructions).toHaveLength(1);
    expect(secondBlockInstructions[0].kind).toBe('copy'); // d = 4

    // Third basic block (TARGET)
    const thirdBlockInstructions = [...cfg.getNodeInstructions(5).values()];
    expect(thirdBlockInstructions).toHaveLength(1);
    expect(thirdBlockInstructions[0].kind).toBe('copy'); // e = 5
});

test('should return empty instructions for entry and exit nodes', () => {
    const program = `a = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    const entryInstructions = cfg.getNodeInstructions(cfg.entryId);
    expect(entryInstructions).toHaveLength(0);

    const exitInstructions = cfg.getNodeInstructions(cfg.exitId);
    expect(exitInstructions).toHaveLength(0);
});

test('should detect back edges correctly', () => {
    const program = `
        LOOP: a = 1
        b = 2
        if a == 1 goto LOOP
        c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // Edge from first block back to itself should not be a back edge
    expect(cfg.isBackEdge(0, 0)).toBe(false);

    // Forward edges should not be back edges
    expect(cfg.isBackEdge(0, 3)).toBe(false); // First block to c = 3
});

test('should handle complex control flow with multiple basic blocks', () => {
    const program = `
        START: a = 1
        b = 2
        if a == 1 goto MIDDLE
        c = 3
        goto END
        MIDDLE: d = 4
        e = 5
        if d == 4 goto END
        f = 6
        END: g = 7`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // Should have multiple basic blocks
    const nodeIds = cfg.nodeIds;
    expect(nodeIds).toContain(0); // START block
    expect(nodeIds).toContain(3); // Block after if
    expect(nodeIds).toContain(5); // MIDDLE block
    expect(nodeIds).toContain(8); // Block after second if
    expect(nodeIds).toContain(9); // END block

    // Check connections
    const startBlockSuccessors = cfg.getNodeSuccessors(0);
    expect(startBlockSuccessors).toContain(3); // Next block (c = 3)
    expect(startBlockSuccessors).toContain(5); // MIDDLE block

    const gotoEndSuccessors = cfg.getNodeSuccessors(3);
    expect(gotoEndSuccessors).toEqual(new Set([9])); // Only END block

    const middleBlockSuccessors = cfg.getNodeSuccessors(5);
    expect(middleBlockSuccessors).toContain(8); // Next block (f = 6)
    expect(middleBlockSuccessors).toContain(9); // END block
});

test('should handle single instruction program', () => {
    const program = `a = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    expect(cfg.nodeIds).toHaveLength(3); // entry + 1 basic block + exit

    // Entry should connect to the basic block
    const entrySuccessors = cfg.getNodeSuccessors(cfg.entryId);
    expect(entrySuccessors).toEqual(new Set([0]));

    // Basic block should connect to exit
    const blockSuccessors = cfg.getNodeSuccessors(0);
    expect(blockSuccessors).toContain(cfg.exitId);

    // Basic block should contain one instruction
    const blockInstructions = [...cfg.getNodeInstructions(0).values()];
    expect(blockInstructions).toHaveLength(1);
    expect(blockInstructions[0].kind).toBe('copy');
});

test('should handle multiple labels at same instruction', () => {
    const program = `
        a = 1
        goto TARGET
        TARGET: b = 2
        c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // TARGET should be a basic block leader
    const nodeIds = cfg.nodeIds;
    expect(nodeIds).toContain(2); // TARGET instruction should be a basic block leader

    // First block should connect to TARGET block
    const firstBlockSuccessors = cfg.getNodeSuccessors(0);
    expect(firstBlockSuccessors).toEqual(new Set([2]));

    // TARGET block should contain both instructions (b = 2, c = 3)
    const targetBlockInstructions = cfg.getNodeInstructions(2);
    expect(targetBlockInstructions).toHaveLength(2);
});

test('should handle nested control structures', () => {
    const program = `
        OUTER: a = 1
        if a == 1 goto INNER
        b = 2
        goto END
        INNER: c = 3
        if c == 3 goto OUTER
        d = 4
        END: e = 5`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // Should have correct number of basic blocks
    expect(cfg.nodeIds).toHaveLength(7); // entry + exit + 5 basic blocks

    // Check back edge from INNER to OUTER
    expect(cfg.isBackEdge(4, 0)).toBe(true);

    // Check forward edges
    expect(cfg.isBackEdge(0, 4)).toBe(false); // OUTER to INNER
    expect(cfg.isBackEdge(2, 7)).toBe(false); // goto END
});

test('should handle unreachable code blocks', () => {
    const program = `
        a = 1
        goto END
        UNREACHABLE: b = 2
        c = 3
        if b == 2 goto UNREACHABLE
        END: d = 4`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // Unreachable code should still form basic blocks
    const nodeIds = cfg.nodeIds;
    expect(nodeIds).toContain(2); // UNREACHABLE block
    expect(nodeIds).toContain(6); // END block

    // UNREACHABLE block should not have predecessors from reachable code
    const unreachablePredecessors = cfg.getNodePredecessors(2);
    expect(unreachablePredecessors).not.toContain(0); // Should not be connected from first block

    // But should be self-connected due to internal loop
    const unreachableSuccessors = cfg.getNodeSuccessors(2);
    expect(unreachableSuccessors).toContain(2); // Self-loop within unreachable code
});

test('should handle empty basic blocks correctly', () => {
    const program = `
        goto TARGET
        TARGET: goto END
        END: a = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac, idGenerator());
    const cfg = new BasicBlockControlFlowGraph(tacProgram);

    // Each goto should be its own basic block
    const firstBlockInstructions = [...cfg.getNodeInstructions(0).values()];
    expect(firstBlockInstructions).toHaveLength(1);
    expect(firstBlockInstructions[0].kind).toBe('jump');

    const targetBlockInstructions = [...cfg.getNodeInstructions(1).values()];
    expect(targetBlockInstructions).toHaveLength(1);
    expect(targetBlockInstructions[0].kind).toBe('jump');

    const endBlockInstructions = [...cfg.getNodeInstructions(2).values()];
    expect(endBlockInstructions).toHaveLength(1);
    expect(endBlockInstructions[0].kind).toBe('copy');
});
