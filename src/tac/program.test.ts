import {expect, test} from "vitest";
import {TacParser} from "./parser.ts";
import {CopyInstruction, type TacInstruction} from "./parser-types.ts";
import {TacProgram} from "./program.ts";

function parseTac(input: string): Array<TacInstruction> {
    return new TacParser(input).parseTac();
}

test('should convert a simple copy assign correctly', () => {
    const program = `h = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const instruction = tacProgram.instructions[0][1] as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.label).toBeUndefined();
    expect(instruction.target).toEqual({kind: "ident", val: 'h'});
    expect(instruction.operand).toEqual({kind: 'integer', val: '1'});
});

test('should be able to find an instruction by its id', () => {
    const program = `h = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const instruction = tacProgram.getInstructionById(0)! as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.target).toEqual({kind: "ident", val: 'h'});
    expect(instruction.operand).toEqual({kind: 'integer', val: '1'});
});

test('should be able to find an instruction by its label', () => {
    const program = `LABEL1: h = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const instruction = tacProgram.getInstructionByLabel('LABEL1')! as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.label).toBe('LABEL1');
    expect(instruction.target).toEqual({kind: "ident", val: 'h'});
    expect(instruction.operand).toEqual({kind: 'integer', val: '1'});
});

test('should fail on goto to non defined instruction', () => {
    const program = `goto HELLO`;
    const tac = parseTac(program);
    expect(() => TacProgram.fromParsedInstructions(tac)).toThrowError(/HELLO/);
});

test('should fail on if goto to non defined instruction', () => {
    const program = `if a < b goto HELLO`;
    const tac = parseTac(program);
    expect(() => TacProgram.fromParsedInstructions(tac)).toThrowError(/HELLO is never defined/);
});



test('should fail if multiple instructions define the same label', () => {
    const program = `
    HELLO: a = b
    HELLO: b = a 
    if a == b goto HELLO`;
    const tac = parseTac(program);
    expect(() => TacProgram.fromParsedInstructions(tac)).toThrowError(/HELLO is already defined/);
});

test('should fail and report all errors', () => {
    const program = `
    HELLO: a = b
    HELLO: b = a
    HELLO: if a == c goto SOMETHING_ELSE
    goto HELLO1`;
    const tac = parseTac(program);
    const result = expect(() => TacProgram.fromParsedInstructions(tac));
    result.toThrowError(/found 4 problems/);
});

test('should return true if instruction is before another instruction', () => {
    const code = `
    FIRST: a = b
    SECOND: b = a
    if a == b goto FIRST`;
    const tac = parseTac(code);
    const program = TacProgram.fromParsedInstructions(tac);

    const firstId = program.getInstructionIdByLabel('FIRST')!;
    const secondId = program.getInstructionIdByLabel('SECOND')!;

    expect(program.instructionIsBefore(firstId, secondId)).toBe(true);
});

test('should return false if instruction is not before another instruction', () => {
    const code = `
    FIRST: a = b
    SECOND: b = a
    if a == b goto FIRST`;
    const tac = parseTac(code);
    const program = TacProgram.fromParsedInstructions(tac);

    const firstId = program.getInstructionIdByLabel('FIRST')!;
    const secondId = program.getInstructionIdByLabel('SECOND')!;

    expect(program.instructionIsBefore(secondId, firstId)).toBe(false);
});

test('should return false if instruction is compared to itself', () => {
    const code = `
    FIRST: a = b
    SECOND: b = a
    if a  == b goto FIRST`;
    const tac = parseTac(code);
    const program = TacProgram.fromParsedInstructions(tac);

    const firstId = program.getInstructionIdByLabel('FIRST')!;

    expect(program.instructionIsBefore(firstId, firstId)).toBe(false);
});


test('should generate sequential IDs starting from 0', () => {
    const program = `
        a = 1
        b = 2
        c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const instructions = tacProgram.instructions;
    expect(instructions[0][0]).toBe(0); // First instruction ID
    expect(instructions[1][0]).toBe(1); // Second instruction ID
    expect(instructions[2][0]).toBe(2); // Third instruction ID
});

test('should allow custom ID generator', () => {
    const program = `a = 1\nb = 2`;
    const tac = parseTac(program);

    let customId = 100;
    const customGenerator = () => customId += 10;

    const tacProgram = TacProgram.fromParsedInstructions(tac, customGenerator);
    const instructions = tacProgram.instructions;

    expect(instructions[0][0]).toBe(110); // 100 + 10
    expect(instructions[1][0]).toBe(120); // 110 + 10
});

test('should return correct first and last instruction IDs', () => {
    const program = `
        FIRST: a = 1
        b = 2
        LAST: c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    expect(tacProgram.firstInstructionId).toBe(0);
    expect(tacProgram.lastInstructionId).toBe(2);
});

test('should return correct number of instructions', () => {
    const program = `
        a = 1
        b = 2
        c = 3
        d = 4`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    expect(tacProgram.numberOfInstructions).toBe(4);
});

test('should return ordered instruction IDs', () => {
    const program = `
        a = 1
        b = 2
        c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    expect(tacProgram.instructionIdsOrdered).toEqual([0, 1, 2]);
});

test('should get explicit jump target IDs for goto instruction', () => {
    const program = `
        a = 1
        goto TARGET
        TARGET: b = 2`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const jumpTargets = tacProgram.getExplicitJumpTargetIds(1); // goto instruction
    expect(jumpTargets).toEqual(new Set([2])); // TARGET instruction ID
});

test('should get explicit jump target IDs for if instruction', () => {
    const program = `
        a = 1
        if a == 1 goto TARGET
        b = 2
        TARGET: c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const jumpTargets = tacProgram.getExplicitJumpTargetIds(1); // if instruction
    expect(jumpTargets).toEqual(new Set([3])); // TARGET instruction ID
});

test('should return empty set for non-jump instructions', () => {
    const program = `
        a = 1
        b = 2`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const jumpTargets = tacProgram.getExplicitJumpTargetIds(0); // assignment instruction
    expect(jumpTargets).toEqual(new Set());
});

test('should get instruction IDs executed after assignment', () => {
    const program = `
        a = 1
        b = 2
        c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const afterFirst = tacProgram.getInstructionIdsExecutedAfter(0);
    expect(afterFirst).toEqual(new Set([1])); // Next instruction

    const afterSecond = tacProgram.getInstructionIdsExecutedAfter(1);
    expect(afterSecond).toEqual(new Set([2])); // Next instruction
});

test('should get instruction IDs executed after goto', () => {
    const program = `
        a = 1
        goto TARGET
        b = 2
        TARGET: c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const afterGoto = tacProgram.getInstructionIdsExecutedAfter(1); // goto instruction
    expect(afterGoto).toEqual(new Set([3])); // Only TARGET, not next sequential
});

test('should get instruction IDs executed after if with two branches', () => {
    const program = `
        a = 1
        if a == 1 goto TARGET
        b = 2
        TARGET: c = 3`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const afterIf = tacProgram.getInstructionIdsExecutedAfter(1); // if instruction
    expect(afterIf).toEqual(new Set([2, 3])); // Both sequential and jump target
});

test('should get instruction IDs executed after last instruction', () => {
    const program = `
        a = 1
        b = 2`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const afterLast = tacProgram.getInstructionIdsExecutedAfter(1); // last instruction
    expect(afterLast).toEqual(new Set()); // No instructions after
});

test('should get instruction IDs in range', () => {
    const program = `
        a = 1
        b = 2
        c = 3
        d = 4
        e = 5`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    expect(tacProgram.getInstructionIdsRanging(1, 4)).toEqual([1, 2, 3]);
    expect(tacProgram.getInstructionIdsRanging(0, 2)).toEqual([0, 1]);
    expect(tacProgram.getInstructionIdsRanging(3)).toEqual([3, 4]); // From 3 to end
});


test('should reserve next ID correctly', () => {
    const program = `a = 1\nb = 2`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const nextId1 = tacProgram.reserveNextId();
    const nextId2 = tacProgram.reserveNextId();

    expect(nextId1).toBe(2); // Instructions have IDs 0, 1
    expect(nextId2).toBe(3); // Next reserved ID
    expect(nextId2).toBeGreaterThan(nextId1);
});

test('should handle complex control flow', () => {
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

    // Test various aspects
    expect(tacProgram.numberOfInstructions).toBe(8);
    expect(tacProgram.getInstructionIdByLabel('START')).toBe(0);
    expect(tacProgram.getInstructionIdByLabel('MIDDLE')).toBe(4);
    expect(tacProgram.getInstructionIdByLabel('END')).toBe(7);

    // Test jump targets
    const startJumpTargets = tacProgram.getExplicitJumpTargetIds(1); // if a == 1 goto MIDDLE
    expect(startJumpTargets).toEqual(new Set([4]));

    const gotoEndTargets = tacProgram.getExplicitJumpTargetIds(3); // goto END
    expect(gotoEndTargets).toEqual(new Set([7]));
});

test('should handle instructions with same content but different IDs', () => {
    const program = `
        a = 1
        a = 1
        a = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const instructions = tacProgram.instructions;
    expect(instructions).toHaveLength(3);
    expect(instructions[0][0]).toBe(0);
    expect(instructions[1][0]).toBe(1);
    expect(instructions[2][0]).toBe(2);

    // All instructions should have same content but different IDs
    expect(instructions[0][1].kind).toBe('copy');
    expect(instructions[1][1].kind).toBe('copy');
    expect(instructions[2][1].kind).toBe('copy');
});
