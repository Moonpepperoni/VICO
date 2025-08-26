export const DebugLine = Symbol.for('line');

export type TacInstruction =
    JumpInstruction
    | IfWithOperatorInstruction
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


abstract class BaseInstruction {
    readonly label?: string;
    readonly [DebugLine]: number;

    protected constructor(label: undefined | string, line: number) {
        this.label = label;
        this[DebugLine] = line;
    }

    abstract getVariables(): Set<string>;

    abstract toString(): string;
}

export class JumpInstruction extends BaseInstruction {
    readonly kind = 'jump';
    readonly jumpLabel: string;

    constructor(label: undefined | string, jmpLabel: string, line: number) {
        super(label, line);
        this.jumpLabel = jmpLabel;
    }

    getVariables(): Set<string> {
        return new Set();
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

    getVariables(): Set<string> {
        const variables = new Set<string>();
        if (this.left.kind === 'ident') variables.add(this.left.val);
        if (this.right.kind === 'ident') variables.add(this.right.val);
        return variables;
    }

    toString(): string {
        return (this.label ? `${this.label}: ` : '') + `if ${this.left.val} ${this.operator} ${this.right.val} goto ${this.jumpLabel}`;
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

    getVariables(): Set<string> {
        const variables = new Set<string>();
        if (this.operand.kind === 'ident') variables.add(this.operand.val);
        if (this.target.kind === 'ident') variables.add(this.target.val);
        return variables;
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
    readonly operator: BinaryArithmaticOperator;

    constructor(label: undefined | string, line: number, target: Ident, left: Operand, right: Operand, operator: BinaryArithmaticOperator) {
        super(label, line);
        this.left = left;
        this.target = target;
        this.right = right;
        this.operator = operator;
    }

    getVariables(): Set<string> {
        const variables = new Set<string>();
        if (this.left.kind === 'ident') variables.add(this.left.val);
        if (this.right.kind === 'ident') variables.add(this.right.val);
        variables.add(this.target.val);
        return variables;
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

    getVariables(): Set<string> {
        const variables = new Set<string>();
        if (this.operand.kind === 'ident') variables.add(this.operand.val);
        variables.add(this.target.val);
        return variables;
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