import {expect, test, describe} from "vitest";
import {TacParser} from "../tac/parser.ts";
import {type TacInstruction} from "../tac/parser-types.ts";
import {TacProgram} from "../tac/program.ts";
import {SingleInstructionGraph} from "./single-instruction.ts";

function parseTac(input: string): Array<TacInstruction> {
    return new TacParser(input).parseTac();
}

describe('SingleInstructionGraph', () => {
    test('should create entry and exit nodes', () => {
        const program = `a = 1`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        expect(cfg.entryId).toBeDefined();
        expect(cfg.exitId).toBeDefined();
        expect(cfg.entryId).not.toBe(cfg.exitId);
        expect(cfg.entryId).toBeGreaterThan(0); // Should be reserved after instruction IDs
        expect(cfg.exitId).toBeGreaterThan(0);
    });

    test('should include all instruction IDs plus entry and exit', () => {
        const program = `
        a = 1
        b = 2
        c = 3`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        const nodeIds = cfg.nodeIds;
        expect(nodeIds).toContain(cfg.entryId);
        expect(nodeIds).toContain(cfg.exitId);
        expect(nodeIds).toContain(0); // First instruction
        expect(nodeIds).toContain(1); // Second instruction
        expect(nodeIds).toContain(2); // Third instruction
        expect(nodeIds).toHaveLength(5); // 3 instructions + entry + exit
    });

    test('should connect entry to first instruction', () => {
        const program = `
        a = 1
        b = 2`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        const entrySuccessors = cfg.getNodeSuccessors(cfg.entryId);
        expect(entrySuccessors).toEqual(new Set([0])); // First instruction ID

        const firstPredecessors = cfg.getNodePredecessors(0);
        expect(firstPredecessors).toContain(cfg.entryId);
    });

    test('should connect last instruction to exit', () => {
        const program = `
        a = 1
        b = 2`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        const lastSuccessors = cfg.getNodeSuccessors(1); // Last instruction
        expect(lastSuccessors).toContain(cfg.exitId);

        const exitPredecessors = cfg.getNodePredecessors(cfg.exitId);
        expect(exitPredecessors).toContain(1); // Last instruction ID
    });

    test('should handle sequential flow', () => {
        const program = `
        a = 1
        b = 2
        c = 3`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        // First instruction should connect to second
        const firstSuccessors = cfg.getNodeSuccessors(0);
        expect(firstSuccessors).toContain(1);

        // Second instruction should connect to third
        const secondSuccessors = cfg.getNodeSuccessors(1);
        expect(secondSuccessors).toContain(2);

        // Check predecessors
        const secondPredecessors = cfg.getNodePredecessors(1);
        expect(secondPredecessors).toContain(0);

        const thirdPredecessors = cfg.getNodePredecessors(2);
        expect(thirdPredecessors).toContain(1);
    });

    test('should handle goto instruction', () => {
        const program = `
        a = 1
        goto TARGET
        b = 2
        TARGET: c = 3`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        // goto instruction (ID 1) should only connect to TARGET (ID 3), not next instruction
        const gotoSuccessors = cfg.getNodeSuccessors(1);
        expect(gotoSuccessors).toEqual(new Set([3]));
        expect(gotoSuccessors).not.toContain(2); // Should not connect to b = 2

        // TARGET should have goto as predecessor
        const targetPredecessors = cfg.getNodePredecessors(3);
        expect(targetPredecessors).toContain(1);

        // b = 2 should not have any predecessors (unreachable)
        const unreachablePredecessors = cfg.getNodePredecessors(2);
        expect(unreachablePredecessors).not.toContain(1);
    });

    test('should handle if instruction with two branches', () => {
        const program = `
        a = 1
        if a == 1 goto TARGET
        b = 2
        TARGET: c = 3`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        // if instruction (ID 1) should connect to both next instruction and jump target
        const ifSuccessors = cfg.getNodeSuccessors(1);
        expect(ifSuccessors).toContain(2); // Next instruction: b = 2
        expect(ifSuccessors).toContain(3); // Jump target: TARGET

        // Both b = 2 and TARGET should have if as predecessor
        const nextPredecessors = cfg.getNodePredecessors(2);
        expect(nextPredecessors).toContain(1);

        const targetPredecessors = cfg.getNodePredecessors(3);
        expect(targetPredecessors).toContain(1);
    });

    test('should handle ifFalse instruction', () => {
        const program = `
        a = 1
        ifFalse a goto TARGET
        b = 2
        TARGET: c = 3`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        // ifFalse instruction should connect to both branches
        const ifFalseSuccessors = cfg.getNodeSuccessors(1);
        expect(ifFalseSuccessors).toContain(2); // Next instruction
        expect(ifFalseSuccessors).toContain(3); // Jump target
    });

    test('should handle if with single operand', () => {
        const program = `
        a = 1
        if a goto TARGET
        b = 2
        TARGET: c = 3`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        // if instruction should connect to both branches
        const ifSuccessors = cfg.getNodeSuccessors(1);
        expect(ifSuccessors).toContain(2); // Next instruction
        expect(ifSuccessors).toContain(3); // Jump target
    });

    test('should return single instruction for each node', () => {
        const program = `
        a = 1
        b = 2`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        const firstInstructions = cfg.getNodeInstructions(0);
        expect(firstInstructions).toHaveLength(1);
        expect(firstInstructions[0].kind).toBe('copy');

        const secondInstructions = cfg.getNodeInstructions(1);
        expect(secondInstructions).toHaveLength(1);
        expect(secondInstructions[0].kind).toBe('copy');
    });

    test('should return empty instructions for entry and exit nodes', () => {
        const program = `a = 1`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        const entryInstructions = cfg.getNodeInstructions(cfg.entryId);
        expect(entryInstructions).toHaveLength(0);

        const exitInstructions = cfg.getNodeInstructions(cfg.exitId);
        expect(exitInstructions).toHaveLength(0);
    });

    test('should detect back edges correctly', () => {
        const program = `
        LOOP: a = 1
        if a == 1 goto LOOP
        b = 2`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        // Edge from if (ID 1) back to LOOP (ID 0) should be a back edge
        expect(cfg.isBackEdge(1, 0)).toBe(true);

        // Forward edges should not be back edges
        expect(cfg.isBackEdge(0, 1)).toBe(false); // LOOP to if
        expect(cfg.isBackEdge(1, 2)).toBe(false); // if to b = 2
    });

    test('should handle complex control flow with multiple jumps', () => {
        const program = `
        START: a = 1
        if a == 1 goto MIDDLE
        b = 2
        goto END
        MIDDLE: c = 3
        if c == 3 goto END
        d = 4
        END: e = 5`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        expect(cfg.nodeIds).toHaveLength(10); // 8 instructions + entry + exit

        // Test specific connections
        const startIfSuccessors = cfg.getNodeSuccessors(1); // if a == 1 goto MIDDLE
        expect(startIfSuccessors).toContain(2); // b = 2
        expect(startIfSuccessors).toContain(4); // MIDDLE

        const gotoEndSuccessors = cfg.getNodeSuccessors(3); // goto END
        expect(gotoEndSuccessors).toEqual(new Set([7])); // Only END

        const middleIfSuccessors = cfg.getNodeSuccessors(5); // if c == 3 goto END
        expect(middleIfSuccessors).toContain(6); // d = 4
        expect(middleIfSuccessors).toContain(7); // END
    });

    test('should handle single instruction program', () => {
        const program = `a = 1`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        expect(cfg.nodeIds).toHaveLength(3); // 1 instruction + entry + exit

        // Entry should connect to instruction
        const entrySuccessors = cfg.getNodeSuccessors(cfg.entryId);
        expect(entrySuccessors).toEqual(new Set([0]));

        // Instruction should connect to exit
        const instrSuccessors = cfg.getNodeSuccessors(0);
        expect(instrSuccessors).toContain(cfg.exitId);
    });

    test('should handle unreachable code', () => {
        const program = `
        a = 1
        goto END
        b = 2
        c = 3
        END: d = 4`;
        const tac = parseTac(program);
        const tacProgram = TacProgram.fromParsedInstructions(tac);
        const cfg = new SingleInstructionGraph(tacProgram);

        // Unreachable instructions should still be nodes but have no predecessors from reachable code
        const bPredecessors = cfg.getNodePredecessors(2); // b = 2
        expect(bPredecessors).not.toContain(1); // Should not be connected from goto

        const cPredecessors = cfg.getNodePredecessors(3); // c = 3
        expect(cPredecessors).toContain(2); // But b should connect to c sequentially
    });
});