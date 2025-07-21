import {expect, test} from "vitest";
import {parseTac} from "./tac-parser.ts";
import {
    BinaryAssignInstruction,
    CopyInstruction,
    IfFalseInstruction,
    IfSingleOperandInstruction,
    IfWithOperatorInstruction,
    JumpInstruction, UnaryAssignInstruction
} from "./tac-parser-types.ts";


test('should parse goto instruction', () => {
    expect(parseTac('goto SOME_LABEL1')).toContainEqual(new JumpInstruction(undefined, 'SOME_LABEL1', 1));
})

test('should parse goto instruction with label', () => {
    expect(parseTac('LABEL1: goto SOME_LABEL1')).toContainEqual(new JumpInstruction("LABEL1", 'SOME_LABEL1', 1));
})

test('should parse if instruction with relop and two idents', () => {
    expect(parseTac('if a == b goto LABEL1'))
        .toContainEqual(new IfWithOperatorInstruction(undefined, 'LABEL1', 1, {kind: "ident", val: 'a'}, {kind: 'ident', val : 'b'}, '=='));
});

test('should parse if instruction with relop and two numbers', () => {
    expect(parseTac('if 1 <= 2 goto LABEL1'))
        .toContainEqual(new IfWithOperatorInstruction(undefined, 'LABEL1', 1, {kind: "integer", val: '1'}, {kind: 'integer', val : '2'}, '<='));
});

test('should parse if instruction with relop an ident and a number', () => {
    expect(parseTac('if a <= 2 goto LABEL1'))
        .toContainEqual(new IfWithOperatorInstruction(undefined, 'LABEL1', 1, {kind: "ident", val: 'a'}, {kind: 'integer', val : '2'}, '<='));
});

test('should parse if instruction with relop a number and an ident', () => {
    expect(parseTac('if 2 <= a goto LABEL1'))
        .toContainEqual(new IfWithOperatorInstruction(undefined, 'LABEL1', 1, {kind: "integer", val: '2'}, {kind: 'ident', val : 'a'}, '<='));
});

test('should parse if instruction with a label', () => {
    expect(parseTac('START: if 2 <= a goto LABEL1'))
        .toContainEqual(new IfWithOperatorInstruction('START', 'LABEL1', 1, {kind: "integer", val: '2'}, {kind: 'ident', val : 'a'}, '<='));
});

test('should parse if instruction with one ident', () => {
    expect(parseTac('if a goto LABEL1'))
        .toContainEqual(new IfSingleOperandInstruction(undefined, 'LABEL1', 1, {kind: "ident", val: 'a'}));
});

test('should parse if instruction with one ident and a label', () => {
    expect(parseTac('START: if a goto LABEL1'))
        .toContainEqual(new IfSingleOperandInstruction('START', 'LABEL1', 1, {kind: "ident", val: 'a'}));
});

test('should parse ifFalse instruction with one ident', () => {
    expect(parseTac('ifFalse a goto LABEL1'))
        .toContainEqual(new IfFalseInstruction(undefined, 'LABEL1', 1, {kind: "ident", val: 'a'}));
});

test('should parse ifFalse instruction with one ident and a label', () => {
    expect(parseTac('SOME_LABEL: ifFalse a goto LABEL1'))
        .toContainEqual(new IfFalseInstruction("SOME_LABEL", 'LABEL1', 1, {kind: "ident", val: 'a'}));
});

test('should parse copy instruction with an integer literal', () => {
    expect(parseTac('a = 10'))
        .toContainEqual(new CopyInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}));
});

test('should parse copy instruction with an integer literal and a label', () => {
    expect(parseTac('HERE: a = 10'))
        .toContainEqual(new CopyInstruction("HERE", 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}));
});

test('should parse copy instruction with another identifier', () => {
    expect(parseTac('a = b'))
        .toContainEqual(new CopyInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'b'}));
})

test('should parse copy instruction with another identifier and a label', () => {
    expect(parseTac('HERE: a = b'))
        .toContainEqual(new CopyInstruction("HERE", 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'b'}));
})

test('should parse simple addition assign', () => {
    expect(parseTac('a = 1 + 1'))
        .toContainEqual(new BinaryAssignInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '1'}, {kind: 'integer', val : '1'}, "+"));
});

test('should parse simple subtraction assign', () => {
    expect(parseTac('a = 1 - 1'))
        .toContainEqual(new BinaryAssignInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '1'}, {kind: 'integer', val : '1'}, "-"));
});

test('should parse simple multiplication assign', () => {
    expect(parseTac('a = 1 * 2'))
        .toContainEqual(new BinaryAssignInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '1'}, {kind: 'integer', val : '2'}, "*"));
});

test('should parse simple divide assign', () => {
    expect(parseTac('a = 2 / 1'))
        .toContainEqual(new BinaryAssignInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '2'}, {kind: 'integer', val : '1'}, "/"));
});

test('should parse simple mod assign', () => {
    expect(parseTac('a = 2 % 1'))
        .toContainEqual(new BinaryAssignInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '2'}, {kind: 'integer', val : '1'}, "%"));
});

test('should parse simple addition assign with a label', () => {
    expect(parseTac('HERE: a = 1 + 1'))
        .toContainEqual(new BinaryAssignInstruction("HERE", 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '1'}, {kind: 'integer', val : '1'}, "+"));
});


test('should parse addition assign of two identifiers', () => {
    expect(parseTac('HERE: a = b + a'))
        .toContainEqual(new BinaryAssignInstruction("HERE", 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'b'}, {kind: 'ident', val : 'a'}, "+"));
});

test('should parse addition assign of number and identifier', () => {
    expect(parseTac('HERE: a = 10 + a'))
        .toContainEqual(new BinaryAssignInstruction("HERE", 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}, {kind: 'ident', val : 'a'}, "+"));
});

test('should parse addition assign of identifier and number', () => {
    expect(parseTac('HERE: a = a + 10'))
        .toContainEqual(new BinaryAssignInstruction("HERE", 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'a'}, {kind: 'integer', val : '10'}, "+"));
});

test('should parse simple negative number assign', () => {
    expect(parseTac('a = - 10'))
        .toContainEqual(new UnaryAssignInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}, "-"));
});

test('should parse negative number assign with identifier', () => {
    expect(parseTac('a = - b'))
        .toContainEqual(new UnaryAssignInstruction(undefined, 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'b'}, "-"));
});


test('should parse simple negative number assign with a label', () => {
    expect(parseTac('HERE: a = - 10'))
        .toContainEqual(new UnaryAssignInstruction("HERE", 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}, "-"));
});

