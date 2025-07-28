import {expect, test} from "vitest";
import {TacParser} from "./parser.ts";
import {CopyInstruction, type TacInstruction} from "./parser-types.ts";
import {TacProgram} from "./program.ts";

function parseTac(input : string) : Array<TacInstruction> {
    return new TacParser(input).parseTac();
}

test('should convert a simple copy assign correctly', () => {
    const program = `h = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const instruction = tacProgram.instructions[0] as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.label).toBeUndefined();
    expect(instruction.target).toEqual({kind : "ident", val: 'h'});
    expect(instruction.operand).toEqual({kind: 'integer', val: '1'});
});

test('should be able to find an instruction by its id', () => {
    const program = `h = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const instruction = tacProgram.getInstructionById(0)! as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.target).toEqual({kind : "ident", val: 'h'});
    expect(instruction.operand).toEqual({kind: 'integer', val: '1'});
});

test('should be able to find an instruction by its label', () => {
    const program = `LABEL1: h = 1`;
    const tac = parseTac(program);
    const tacProgram = TacProgram.fromParsedInstructions(tac);

    const instruction = tacProgram.getInstructionByLabel('LABEL1')! as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.label).toBe('LABEL1');
    expect(instruction.target).toEqual({kind : "ident", val: 'h'});
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

test('should fail on ifFalse goto to non defined instruction', () => {
    const program = `ifFalse a goto HELLO`;
    const tac = parseTac(program);
    expect(() => TacProgram.fromParsedInstructions(tac)).toThrowError(/HELLO is never defined/);
});

test('should fail on ifSingleOp goto to non defined instruction', () => {
    const program = `if a goto HELLO`;
    const tac = parseTac(program);
    expect(() => TacProgram.fromParsedInstructions(tac)).toThrowError(/HELLO is never defined/);
});

test('should fail if multiple instructions define the same label', () => {
    const program = `
    HELLO: a = b
    HELLO: b = a 
    if a goto HELLO`;
    const tac = parseTac(program);
    expect(() => TacProgram.fromParsedInstructions(tac)).toThrowError(/HELLO is already defined/);
});

test('should fail and report all errors', () => {
    const program = `
    HELLO: a = b
    HELLO: b = a
    HELLO: if a goto SOMETHING_ELSE
    goto HELLO1`;
    const tac = parseTac(program);
    const result = expect(() => TacProgram.fromParsedInstructions(tac));
    result.toThrowError(/found 4 problems/);
});

test('should return true if instruction is before another instruction', () => {
    const code = `
    FIRST: a = b
    SECOND: b = a
    if a goto FIRST`;
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
    if a goto FIRST`;
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
    if a goto FIRST`;
    const tac = parseTac(code);
    const program = TacProgram.fromParsedInstructions(tac);

    const firstId = program.getInstructionIdByLabel('FIRST')!;

    expect(program.instructionIsBefore(firstId, firstId)).toBe(false);
});

