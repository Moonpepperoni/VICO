import {expect, test} from "vitest";
import {TacParser} from "./parser.ts";
import {
    BinaryAssignInstruction,
    CopyInstruction,
    IfFalseInstruction,
    IfSingleOperandInstruction,
    IfWithOperatorInstruction,
    JumpInstruction, UnaryAssignInstruction
} from "./parser-types.ts";

const parser = (input : string) => {
    let id = 1;
    return new TacParser(() => {
        return id++;
    }, input);
}

test('should parse goto instruction', () => {
    expect(parser('goto SOME_LABEL1').parseTac()).toContainEqual(new JumpInstruction(1,undefined, 'SOME_LABEL1', 1));
})

test('should parse goto instruction with label', () => {
    expect(parser('LABEL1: goto SOME_LABEL1').parseTac()).toContainEqual(new JumpInstruction(1,"LABEL1", 'SOME_LABEL1', 1));
})

test('should parse if instruction with relop and two idents', () => {
    expect(parser('if a == b goto LABEL1').parseTac())
        .toContainEqual(new IfWithOperatorInstruction(1,undefined, 'LABEL1', 1, {kind: "ident", val: 'a'}, {kind: 'ident', val : 'b'}, '=='));
});

test('should parse if instruction with relop and two numbers', () => {
    expect(parser('if 1 <= 2 goto LABEL1').parseTac())
        .toContainEqual(new IfWithOperatorInstruction(1,undefined, 'LABEL1', 1, {kind: "integer", val: '1'}, {kind: 'integer', val : '2'}, '<='));
});

test('should parse if instruction with relop an ident and a number', () => {
    expect(parser('if a <= 2 goto LABEL1').parseTac())
        .toContainEqual(new IfWithOperatorInstruction(1,undefined, 'LABEL1', 1, {kind: "ident", val: 'a'}, {kind: 'integer', val : '2'}, '<='));
});

test('should parse if instruction with relop a number and an ident', () => {
    expect(parser('if 2 <= a goto LABEL1').parseTac())
        .toContainEqual(new IfWithOperatorInstruction(1,undefined, 'LABEL1', 1, {kind: "integer", val: '2'}, {kind: 'ident', val : 'a'}, '<='));
});

test('should parse if instruction with a label', () => {
    expect(parser('START: if 2 <= a goto LABEL1').parseTac())
        .toContainEqual(new IfWithOperatorInstruction(1,'START', 'LABEL1', 1, {kind: "integer", val: '2'}, {kind: 'ident', val : 'a'}, '<='));
});

test('should parse if instruction with one ident', () => {
    expect(parser('if a goto LABEL1').parseTac())
        .toContainEqual(new IfSingleOperandInstruction(1,undefined, 'LABEL1', 1, {kind: "ident", val: 'a'}));
});

test('should parse if instruction with one ident and a label', () => {
    expect(parser('START: if a goto LABEL1').parseTac())
        .toContainEqual(new IfSingleOperandInstruction(1,'START', 'LABEL1', 1, {kind: "ident", val: 'a'}));
});

test('should parse ifFalse instruction with one ident', () => {
    expect(parser('ifFalse a goto LABEL1').parseTac())
        .toContainEqual(new IfFalseInstruction(1,undefined, 'LABEL1', 1, {kind: "ident", val: 'a'}));
});

test('should parse ifFalse instruction with one ident and a label', () => {
    expect(parser('SOME_LABEL: ifFalse a goto LABEL1').parseTac())
        .toContainEqual(new IfFalseInstruction(1,"SOME_LABEL", 'LABEL1', 1, {kind: "ident", val: 'a'}));
});

test('should parse copy instruction with an integer literal', () => {
    expect(parser('a = 10').parseTac())
        .toContainEqual(new CopyInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}));
});

test('should parse copy instruction with an integer literal and a label', () => {
    expect(parser('HERE: a = 10').parseTac())
        .toContainEqual(new CopyInstruction(1,"HERE", 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}));
});

test('should parse copy instruction with another identifier', () => {
    expect(parser('a = b').parseTac())
        .toContainEqual(new CopyInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'b'}));
})

test('should parse copy instruction with another identifier and a label', () => {
    expect(parser('HERE: a = b').parseTac())
        .toContainEqual(new CopyInstruction(1,"HERE", 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'b'}));
})

test('should parse simple addition assign', () => {
    expect(parser('a = 1 + 1').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '1'}, {kind: 'integer', val : '1'}, "+"));
});

test('should parse simple subtraction assign', () => {
    expect(parser('a = 1 - 1').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '1'}, {kind: 'integer', val : '1'}, "-"));
});

test('should parse simple multiplication assign', () => {
    expect(parser('a = 1 * 2').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '1'}, {kind: 'integer', val : '2'}, "*"));
});

test('should parse simple divide assign', () => {
    expect(parser('a = 2 / 1').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '2'}, {kind: 'integer', val : '1'}, "/"));
});

test('should parse simple mod assign', () => {
    expect(parser('a = 2 % 1').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '2'}, {kind: 'integer', val : '1'}, "%"));
});

test('should parse simple addition assign with a label', () => {
    expect(parser('HERE: a = 1 + 1').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,"HERE", 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '1'}, {kind: 'integer', val : '1'}, "+"));
});


test('should parse addition assign of two identifiers', () => {
    expect(parser('HERE: a = b + a').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,"HERE", 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'b'}, {kind: 'ident', val : 'a'}, "+"));
});

test('should parse addition assign of number and identifier', () => {
    expect(parser('HERE: a = 10 + a').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,"HERE", 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}, {kind: 'ident', val : 'a'}, "+"));
});

test('should parse addition assign of identifier and number', () => {
    expect(parser('HERE: a = a + 10').parseTac())
        .toContainEqual(new BinaryAssignInstruction(1,"HERE", 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'a'}, {kind: 'integer', val : '10'}, "+"));
});

test('should parse simple negative number assign', () => {
    expect(parser('a = - 10').parseTac())
        .toContainEqual(new UnaryAssignInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}, "-"));
});

test('should parse negative number assign with identifier', () => {
    expect(parser('a = - b').parseTac())
        .toContainEqual(new UnaryAssignInstruction(1,undefined, 1, {kind: "ident", val: 'a'}, {kind: "ident", val: 'b'}, "-"));
});


test('should parse simple negative number assign with a label', () => {
    expect(parser('HERE: a = - 10').parseTac())
        .toContainEqual(new UnaryAssignInstruction(1,"HERE", 1, {kind: "ident", val: 'a'}, {kind: "integer", val: '10'}, "-"));
});

