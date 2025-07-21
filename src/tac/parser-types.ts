export class UnexpectedEndOfInstructionError extends Error {

}

export class UnexpectedTokenError extends Error {

}

export type TacInstruction =
    JumpInstruction
    | IfWithOperatorInstruction
    | IfSingleOperandInstruction
    | IfFalseInstruction
    | CopyInstruction
    | BinaryAssignInstruction
    | UnaryAssignInstruction;

export type Operand = Ident | Integer;

export type Ident = { kind: 'ident', val: string };

export type Integer = { kind: 'integer', val: string };

export type UnaryLogicalOperator = '!';

export type UnaryArithmeticOperator = '-';

export type UnaryOperator = UnaryArithmeticOperator | UnaryLogicalOperator;

export type RelationOperator = "==" | "<=" | ">=" | "<" | ">" | "!=";

export type BinaryArithmaticOperator = "+" | "-" | "*" | "/" | "%";

export type BinaryOperator = RelationOperator | BinaryArithmaticOperator;

abstract class BaseInstruction {
    readonly label?: string;
    readonly line: number;
    readonly id : number;

    protected constructor(label: undefined | string, line: number, id : number) {
        this.label = label;
        this.line = line;
        this.id = id;
    }

    abstract toString(): string;
}

export class JumpInstruction extends BaseInstruction {
    readonly kind = 'jump';
    readonly jumpLabel: string;

    constructor(id : number, label: undefined | string, jmpLabel: string, line: number) {
        super(label, line, id);
        this.jumpLabel = jmpLabel;
    }

    toString(): string {
        return (this.label ? `${this.label}: ` : '') + `goto ${this.jumpLabel}`;
    }
}

export class IfWithOperatorInstruction extends BaseInstruction {
    readonly kind = 'ifWithOperator';
    readonly jumpLabel: string;
    readonly left: Operand;
    readonly right: Operand;
    readonly operator: RelationOperator;

    constructor(id : number, label: undefined | string, jmpLabel: string, line: number, left: Operand, right: Operand, operator: RelationOperator) {
        super(label, line, id);
        this.jumpLabel = jmpLabel;
        this.left = left;
        this.right = right;
        this.operator = operator;
    }

    toString(): string {
        return (this.label ? `${this.label}: ` : '') + `if ${this.left.val} ${this.operator} ${this.right.val} goto ${this.jumpLabel}`;
    }
}

export class IfSingleOperandInstruction extends BaseInstruction {
    readonly kind = 'ifSingleOperand';
    readonly jumpLabel: string;
    readonly operand: Ident;


    constructor(id : number, label: undefined | string, jmpLabel: string, line: number, operand: Ident) {
        super(label, line, id);
        this.jumpLabel = jmpLabel;
        this.operand = operand;
    }

    toString(): string {
        return (this.label ? `${this.label}: ` : '') + `if ${this.operand.val} goto ${this.jumpLabel}`;
    }
}

export class IfFalseInstruction extends BaseInstruction {
    readonly kind = 'ifFalse';
    readonly jumpLabel: string;
    readonly operand: Ident;


    constructor(id : number, label: undefined | string, jmpLabel: string, line: number, operand: Ident) {
        super(label, line, id);
        this.jumpLabel = jmpLabel;
        this.operand = operand;
    }

    toString(): string {
        return (this.label ? `${this.label}: ` : '') + `ifFalse ${this.operand.val} goto ${this.jumpLabel}`;
    }
}

export class CopyInstruction extends BaseInstruction {
    readonly kind = 'copy';
    readonly target: Ident;
    readonly operand: Operand;


    constructor(id : number, label: undefined | string, line: number, target: Ident, operand: Operand) {
        super(label, line, id);
        this.operand = operand;
        this.target = target;
    }

    toString(): string {
        return (this.label ? `${this.label}: ` : '') + `${this.target.val} = ${this.operand.val}`;
    }
}

export class BinaryAssignInstruction extends BaseInstruction {
    readonly kind = 'assignBinary';
    readonly target: Ident;
    readonly left: Operand;
    readonly right: Operand;
    readonly operator: BinaryOperator;

    constructor(id: number, label: undefined | string, line: number, target: Ident, left: Operand, right: Operand, operator: BinaryOperator) {
        super(label, line, id);
        this.left = left;
        this.target = target;
        this.right = right;
        this.operator = operator;
    }

    toString(): string {
        return (this.label ? `${this.label}: ` : '') + `${this.target.val} = ${this.left.val} ${this.operator} ${this.right.val}`;
    }
}

export class UnaryAssignInstruction extends BaseInstruction {
    readonly kind = 'assignUnary';
    readonly target: Ident;
    readonly operand: Operand;
    readonly operator: UnaryOperator;

    constructor(id : number, label: undefined | string, line: number, target: Ident, operand: Operand, operator: UnaryOperator) {
        super(label, line, id);
        this.operand = operand;
        this.target = target;
        this.operator = operator;
    }

    toString(): string {
        return (this.label ? `${this.label}: ` : '') + `${this.target.val} = ${this.operator} ${this.operand}`;
    }
}


export function tryBinaryArithmeticOperatorFromSymbol(symbol: string): BinaryArithmaticOperator {
    const valid = ["+", "-", "*", "/", "%"];
    if (valid.includes(symbol)) {
        return symbol as BinaryArithmaticOperator;
    }
    throw new Error(`symbol ${symbol} is not a binary arithmetic operator expected one of ${valid}`);
}

export function tryRelationOperatorFromSymbol(symbol: string): RelationOperator {
    const valid = ["==", "<=", ">=", "<", ">", "!="];
    if (valid.includes(symbol)) {
        return symbol as RelationOperator;
    }
    throw new Error(`symbol ${symbol} is not a binary relation operator expected one of ${valid}`);
}

export function tryBinaryOperatorFromSymbol(symbol: string): BinaryOperator {
    const valid = ["==", "<=", ">=", "<", ">", "!=", "+", "-", "*", "/", "%"];
    if (valid.includes(symbol)) {
        return symbol as BinaryOperator;
    }
    throw new Error(`symbol ${symbol} is not a binary operator expected one of ${valid}`);
}

export function tryUnaryOperatorFromSymbol(symbol: string): UnaryOperator {
    const valid = ["!", "-"];
    if (valid.includes(symbol)) {
        return symbol as UnaryOperator;
    }
    throw new Error(`symbol ${symbol} is not a unary operator expected one of ${valid}`);
}