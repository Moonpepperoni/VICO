import {expect, test} from "vitest";
import {TacParser} from "./parser.ts";
import {
    BinaryAssignInstruction,
    CopyInstruction, DebugLine,
    IfFalseInstruction,
    IfSingleOperandInstruction,
    IfWithOperatorInstruction,
    JumpInstruction, UnaryAssignInstruction
} from "./parser-types.ts";

const parser = (input : string) => {
    return new TacParser(input);
}

test('should parse goto instruction', () => {
    const result = parser('goto SOME_LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as JumpInstruction;
    expect(instruction.kind).toBe('jump');
    expect(instruction.label).toBeUndefined();
    expect(instruction.jumpLabel).toBe('SOME_LABEL1');
})

test('should parse goto instruction with label', () => {
    const result = parser('LABEL1: goto SOME_LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as JumpInstruction;
    expect(instruction.kind).toBe('jump');
    expect(instruction.label).toBe('LABEL1');
    expect(instruction.jumpLabel).toBe('SOME_LABEL1');
})

test('should parse if instruction with relop and two idents', () => {
    const result = parser('if a == b goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfWithOperatorInstruction;
    expect(instruction.kind).toBe('ifWithOperator');
    expect(instruction.label).toBeUndefined();
    expect(instruction.jumpLabel).toBe('LABEL1');
    expect(instruction.left).toEqual({kind: "ident", val: 'a'});
    expect(instruction.right).toEqual({kind: 'ident', val: 'b'});
    expect(instruction.operator).toBe('==');
});

test('should parse if instruction with relop and two numbers', () => {
    const result = parser('if 1 <= 2 goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfWithOperatorInstruction;
    expect(instruction.kind).toBe('ifWithOperator');
    expect(instruction.left).toEqual({kind: "integer", val: '1'});
    expect(instruction.right).toEqual({kind: 'integer', val: '2'});
    expect(instruction.operator).toBe('<=');
});

test('should parse if instruction with relop an ident and a number', () => {
    const result = parser('if a <= 2 goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfWithOperatorInstruction;
    expect(instruction.kind).toBe('ifWithOperator');
    expect(instruction.left).toEqual({kind: "ident", val: 'a'});
    expect(instruction.right).toEqual({kind: 'integer', val: '2'});
    expect(instruction.operator).toBe('<=');
});

test('should parse if instruction with relop a number and an ident', () => {
    const result = parser('if 2 <= a goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfWithOperatorInstruction;
    expect(instruction.kind).toBe('ifWithOperator');
    expect(instruction.left).toEqual({kind: "integer", val: '2'});
    expect(instruction.right).toEqual({kind: 'ident', val: 'a'});
    expect(instruction.operator).toBe('<=');
});

test('should parse if instruction with a label', () => {
    const result = parser('START: if 2 <= a goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfWithOperatorInstruction;
    expect(instruction.kind).toBe('ifWithOperator');
    expect(instruction.label).toBe('START');
    expect(instruction.left).toEqual({kind: "integer", val: '2'});
    expect(instruction.right).toEqual({kind: 'ident', val: 'a'});
});

test('should parse if instruction with one ident', () => {
    const result = parser('if a goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfSingleOperandInstruction;
    expect(instruction.kind).toBe('ifSingleOperand');
    expect(instruction.jumpLabel).toBe('LABEL1');
    expect(instruction.operand).toEqual({kind: "ident", val: 'a'});
});

test('should parse if instruction with one ident and a label', () => {
    const result = parser('START: if a goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfSingleOperandInstruction;
    expect(instruction.kind).toBe('ifSingleOperand');
    expect(instruction.label).toBe('START');
    expect(instruction.operand).toEqual({kind: "ident", val: 'a'});
});

test('should parse ifFalse instruction with one ident', () => {
    const result = parser('ifFalse a goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfFalseInstruction;
    expect(instruction.kind).toBe('ifFalse');
    expect(instruction.jumpLabel).toBe('LABEL1');
    expect(instruction.operand).toEqual({kind: "ident", val: 'a'});
});

test('should parse ifFalse instruction with one ident and a label', () => {
    const result = parser('SOME_LABEL: ifFalse a goto LABEL1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as IfFalseInstruction;
    expect(instruction.kind).toBe('ifFalse');
    expect(instruction.label).toBe("SOME_LABEL");
    expect(instruction.operand).toEqual({kind: "ident", val: 'a'});
});

test('should parse copy instruction with an integer literal', () => {
    const result = parser('a = 10').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.target).toEqual({kind: "ident", val: 'a'});
    expect(instruction.operand).toEqual({kind: "integer", val: '10'});
});

test('should parse copy instruction with an integer literal and a label', () => {
    const result = parser('HERE: a = 10').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.label).toBe("HERE");
    expect(instruction.target).toEqual({kind: "ident", val: 'a'});
    expect(instruction.operand).toEqual({kind: "integer", val: '10'});
});

test('should parse copy instruction with another identifier', () => {
    const result = parser('a = b').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.target).toEqual({kind: "ident", val: 'a'});
    expect(instruction.operand).toEqual({kind: "ident", val: 'b'});
})

test('should parse copy instruction with another identifier and a label', () => {
    const result = parser('HERE: a = b').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as CopyInstruction;
    expect(instruction.kind).toBe('copy');
    expect(instruction.label).toBe("HERE");
    expect(instruction.target).toEqual({kind: "ident", val: 'a'});
    expect(instruction.operand).toEqual({kind: "ident", val: 'b'});
})

test('should parse simple addition assign', () => {
    const result = parser('a = 1 + 1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.target).toEqual({kind: "ident", val: 'a'});
    expect(instruction.left).toEqual({kind: "integer", val: '1'});
    expect(instruction.right).toEqual({kind: 'integer', val: '1'});
    expect(instruction.operator).toBe("+");
});

test('should parse simple subtraction assign', () => {
    const result = parser('a = 1 - 1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.operator).toBe("-");
});

test('should parse simple multiplication assign', () => {
    const result = parser('a = 1 * 2').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.operator).toBe("*");
    expect(instruction.right).toEqual({kind: 'integer', val: '2'});
});

test('should parse simple divide assign', () => {
    const result = parser('a = 2 / 1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.operator).toBe("/");
});

test('should parse simple mod assign', () => {
    const result = parser('a = 2 % 1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.operator).toBe("%");
});

test('should parse simple addition assign with a label', () => {
    const result = parser('HERE: a = 1 + 1').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.label).toBe("HERE");
    expect(instruction.operator).toBe("+");
});


test('should parse addition assign of two identifiers', () => {
    const result = parser('HERE: a = b + a').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.label).toBe("HERE");
    expect(instruction.left).toEqual({kind: "ident", val: 'b'});
    expect(instruction.right).toEqual({kind: 'ident', val: 'a'});
});

test('should parse addition assign of number and identifier', () => {
    const result = parser('HERE: a = 10 + a').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.left).toEqual({kind: "integer", val: '10'});
    expect(instruction.right).toEqual({kind: 'ident', val: 'a'});
});

test('should parse addition assign of identifier and number', () => {
    const result = parser('HERE: a = a + 10').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as BinaryAssignInstruction;
    expect(instruction.kind).toBe('assignBinary');
    expect(instruction.left).toEqual({kind: "ident", val: 'a'});
    expect(instruction.right).toEqual({kind: 'integer', val: '10'});
});

test('should parse simple negative number assign', () => {
    const result = parser('a = - 10').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as UnaryAssignInstruction;
    expect(instruction.kind).toBe('assignUnary');
    expect(instruction.target).toEqual({kind: "ident", val: 'a'});
    expect(instruction.operand).toEqual({kind: "integer", val: '10'});
    expect(instruction.operator).toBe("-");
});

test('should parse negative number assign with identifier', () => {
    const result = parser('a = - b').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as UnaryAssignInstruction;
    expect(instruction.kind).toBe('assignUnary');
    expect(instruction.operand).toEqual({kind: "ident", val: 'b'});
});


test('should parse simple negative number assign with a label', () => {
    const result = parser('HERE: a = - 10').parseTac();
    expect(result).toHaveLength(1);
    const instruction = result[0] as UnaryAssignInstruction;
    expect(instruction.kind).toBe('assignUnary');
    expect(instruction.label).toBe("HERE");
});

test('should attach debug line info to instructions', () => {
    const multiline = `HELLO: a = b
c = a
if c goto HELLO`;
    const result = parser(multiline).parseTac();
    expect(result[0][DebugLine]).toBe(1);
    expect(result[1][DebugLine]).toBe(2);
    expect(result[2][DebugLine]).toBe(3);
})


test('should throw error when goto is missing a target label', () => {
    expect(() => {
        new TacParser('goto').parseTac();
    }).toThrowError(/expected.*label/);
});

test('should throw error when if statement is incomplete', () => {
    expect(() => {
        new TacParser('if a').parseTac();
    }).toThrowError(/instruction ended/);
});

test('should throw error when if statement has no goto', () => {
    expect(() => {
        new TacParser('if a == b').parseTac();
    }).toThrowError(/expected.*goto/);
});

test('should throw error when ifFalse statement is incomplete', () => {
    expect(() => {
        new TacParser('ifFalse a').parseTac();
    }).toThrowError(/expected.*goto/);
});

test('should throw error when assignment is missing right side', () => {
    expect(() => {
        new TacParser('a =').parseTac();
    }).toThrowError(/instruction ended/);
});

test('should throw error when assignment has incomplete binary operation', () => {
    expect(() => {
        new TacParser('a = b +').parseTac();
    }).toThrowError(/instruction ended/);
});

test('should throw error when assignment has incomplete unary operation', () => {
    expect(() => {
        new TacParser('a = -').parseTac();
    }).toThrowError(/instruction ended/);
});

test('should throw error when label is used without colon', () => {
    expect(() => {
        new TacParser('LABEL goto TARGET').parseTac();
    }).toThrowError(/expected.*:/);
});

test('should throw error when binary operator is invalid', () => {
    expect(() => {
        new TacParser('a = b ! c').parseTac();
    }).toThrowError(/! is not a valid/);
});

test('should throw error when relation operator is invalid in if statement', () => {
    expect(() => {
        new TacParser('if a + b goto LABEL').parseTac();
    }).toThrowError(/\+ is not a valid/);
});

test('should throw error when using integer where identifier is required', () => {
    expect(() => {
        new TacParser('ifFalse 123 goto LABEL').parseTac();
    }).toThrowError(/expected.*identifier/);
});

test('should throw error when if statement uses integer as single operand', () => {
    expect(() => {
        new TacParser('if 123 goto LABEL').parseTac();
    }).toThrowError(/expected.*identifier/);
});

test('should throw collective error for multiple syntax errors in one input', () => {
    const input = `a = b +
c = 
if d ! e goto LABEL`;

    expect(() => {
        new TacParser(input).parseTac();
    }).toThrowError(/not valid/);
});

test('should throw error when parsing missing operand in binary operation', () => {
    expect(() => {
        new TacParser('a = + b').parseTac();
    }).toThrowError(/\+ is not a valid/);
});

test('should throw error for incomplete label declaration', () => {
    expect(() => {
        new TacParser('LABEL:').parseTac();
    }).toThrowError(/instruction ended/);
});

test('should throw error for invalid token in operand position', () => {
    expect(() => {
        new TacParser('a = goto').parseTac();
    }).toThrowError(/expected.*identifier.*integer_literal/);
});

test('should throw error when trying to use identifier as label', () => {
    expect(() => {
        new TacParser('invalidlabel: goto TARGET').parseTac();
    }).toThrowError(/expected.*=/);
});

test('should throw error when trying to use integer as label', () => {
    expect(() => {
        new TacParser('123: goto TARGET').parseTac();
    }).toThrowError(/got "integer_literal"/);
});

test('should throw error when using unsupported symbol in if condition', () => {
    expect(() => {
        new TacParser('if a ! b goto LABEL').parseTac();
    }).toThrowError(/! is not a valid/);
});

test('should throw error when using unsupported symbol in assignment', () => {
    expect(() => {
        new TacParser('a = b ! c').parseTac();
    }).toThrowError(/! is not a valid/);
});

test('should throw error when if condition uses invalid combination', () => {
    expect(() => {
        new TacParser('if 1 goto LABEL').parseTac();
    }).toThrowError(/expected.*identifier/);
});

test('should throw error when missing goto after if condition', () => {
    expect(() => {
        new TacParser('if a == b LABEL').parseTac();
    }).toThrowError(/expected.*goto/);
});

test('should throw error when missing target after goto', () => {
    expect(() => {
        new TacParser('if a == b goto').parseTac();
    }).toThrowError(/expected.*label/);
});

test('should throw error when using identifier in place of label', () => {
    expect(() => {
        new TacParser('if a == b goto somevar').parseTac();
    }).toThrowError(/expected.*label/);
});