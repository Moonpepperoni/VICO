export const DebugLine = Symbol.for('line');

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

export type InstructionType = 'jump' | 'ifWithOperator' | 'ifSingleOperand' | 'ifFalse' | 'copy' | 'assignBinary' | 'assignUnary';

abstract class BaseInstruction {
    readonly label?: string;
    readonly [DebugLine]: number;

    protected constructor(label: undefined | string, line: number) {
        this.label = label;
        this[DebugLine] = line;
    }

    abstract toString(): string;
}

export class JumpInstruction extends BaseInstruction {
    readonly kind = 'jump';
    readonly jumpLabel: string;

    constructor(label: undefined | string, jmpLabel: string, line: number) {
        super(label, line);
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

    constructor(label: undefined | string, jmpLabel: string, line: number, left: Operand, right: Operand, operator: RelationOperator) {
        super(label, line);
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


    constructor(label: undefined | string, jmpLabel: string, line: number, operand: Ident) {
        super(label, line);
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


    constructor(label: undefined | string, jmpLabel: string, line: number, operand: Ident) {
        super(label, line);
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


    constructor(label: undefined | string, line: number, target: Ident, operand: Operand) {
        super(label, line);
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

    constructor(label: undefined | string, line: number, target: Ident, left: Operand, right: Operand, operator: BinaryOperator) {
        super(label, line);
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

    constructor(label: undefined | string, line: number, target: Ident, operand: Operand, operator: UnaryOperator) {
        super(label, line);
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
    throw new OperatorConversionError(symbol, "binary arithmetic");
}

export function tryRelationOperatorFromSymbol(symbol: string): RelationOperator {
    const valid = ["==", "<=", ">=", "<", ">", "!="];
    if (valid.includes(symbol)) {
        return symbol as RelationOperator;
    }
    throw new OperatorConversionError(symbol, "relation");
}

export function tryBinaryOperatorFromSymbol(symbol: string): BinaryOperator {
    const valid = ["==", "<=", ">=", "<", ">", "!=", "+", "-", "*", "/", "%"];
    if (valid.includes(symbol)) {
        return symbol as BinaryOperator;
    }
    throw new OperatorConversionError(symbol, "binary");
}

export function tryUnaryOperatorFromSymbol(symbol: string): UnaryOperator {
    const valid = ["!", "-"];
    if (valid.includes(symbol)) {
        return symbol as UnaryOperator;
    }
    throw new OperatorConversionError(symbol, "unary");
}

export class OperatorConversionError extends Error {
    symbol: string;
    expectedType: string;

    constructor(symbol: string, expectedType: string) {
        super(`symbol '${symbol}' is not a valid ${expectedType} operator`);
        this.name = "OperatorConversionError";
        this.symbol = symbol;
        this.expectedType = expectedType;
    }
}