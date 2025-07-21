import {type Token, tokenizeString} from "./tac-tokenizer";
import {
    BinaryAssignInstruction,
    CopyInstruction,
    type Ident,
    IfFalseInstruction,
    IfSingleOperandInstruction,
    IfWithOperatorInstruction,
    JumpInstruction,
    type Operand,
    type TacInstruction,
    tryBinaryOperatorFromSymbol,
    tryRelationOperatorFromSymbol,
    tryUnaryOperatorFromSymbol,
    UnaryAssignInstruction,
    UnexpectedEndOfInstructionError,
    UnexpectedTokenError
} from "./tac-parser-types.ts";

export function parseTac(input: string): Array<TacInstruction> {
    const tokens = tokenizeString(input);
    // reverse for O(1) popping
    tokens.reverse();
    const instructions: Array<TacInstruction> = [];
    while (tokens.length !== 0) {
        instructions.push(tryParseInstruction(tokens));
    }
    return instructions;
}

function tryParseInstruction(tokens: Array<Token>): TacInstruction {
    const label = extractOptionalLabel(tokens);
    const top = tokens.at(-1);
    if (top === undefined) {
        throw new UnexpectedEndOfInstructionError();
    }
    switch (top.kind) {
        case 'goto':
            return parseGoto(tokens, label);
        case 'if':
            return parseIf(tokens, label);
        case 'ifFalse':
            return parseIfFalse(tokens, label);
        case 'identifier':
            return parseAssign(tokens, label);
        default:
            throw new UnexpectedTokenError();
    }
}

function extractOptionalLabel(tokens: Token[]) {
    const top = tokens.at(-1);
    let label = undefined;
    if (top !== undefined && top.kind === "label") {
        label = top.val;
        // remove the label value
        tokens.pop();
        // read colon
        const colon = tokens.pop();
        if (colon === undefined) throw new UnexpectedEndOfInstructionError();
        if (colon.kind !== 'symbol' || colon.val !== ":") throw new UnexpectedTokenError();
    }
    return label;
}

function parseGoto(tokens: Array<Token>, label?: string): TacInstruction {
    // remove goto
    tokens.pop();

    const jmpLabel = tokens.pop();
    if (jmpLabel === undefined) throw new UnexpectedEndOfInstructionError();
    if (jmpLabel.kind !== 'label') throw new UnexpectedTokenError();

    const eol = tokens.pop();
    if (eol === undefined) throw new UnexpectedEndOfInstructionError();
    return new JumpInstruction(label, jmpLabel.val, jmpLabel.line);
}

function parseIfRest(tokens: Array<Token>) {
    const gotoToken = tokens.pop();
    if (gotoToken === undefined) throw new UnexpectedEndOfInstructionError();
    if (gotoToken.kind !== 'goto') throw new UnexpectedTokenError();

    const jumpLabelToken = tokens.pop();
    if (jumpLabelToken === undefined) throw new UnexpectedEndOfInstructionError();
    if (jumpLabelToken.kind !== 'label') throw new UnexpectedTokenError();
    const jumpLabel = jumpLabelToken.val;

    const eol = tokens.pop();
    if (eol === undefined) throw new UnexpectedEndOfInstructionError();
    if (eol.kind !== 'eol') throw new UnexpectedTokenError();
    return {jumpLabelToken, jumpLabel};
}

function parseIf(tokens: Array<Token>, label: undefined | string): TacInstruction {
    // remove if
    tokens.pop();

    let leftOp = undefined;
    let operator = undefined;
    let rightOp = undefined;


    leftOp = extractOperand(tokens);
    const decisionToken = tokens.at(-1);
    if (decisionToken === undefined) throw new UnexpectedEndOfInstructionError();
    // if it's an if instruction with a relop and two operands
    if (decisionToken.kind === 'symbol') {
        operator = tryRelationOperatorFromSymbol(decisionToken.val);
        // remove the read token;
        tokens.pop();
        // continue with rightOp, which must exist now;
        rightOp = extractOperand(tokens);
    }
    const {jumpLabelToken, jumpLabel} = parseIfRest(tokens);

    if (operator !== undefined && rightOp !== undefined) {
        return new IfWithOperatorInstruction(label, jumpLabel, jumpLabelToken.line, leftOp, rightOp, operator);
    }

    if (leftOp.kind !== 'ident') {
        throw new UnexpectedTokenError();
    }
    return new IfSingleOperandInstruction(label, jumpLabel, jumpLabelToken.line, leftOp);
}

function parseIfFalse(tokens: Array<Token>, label: undefined | string): TacInstruction {
    // remove ifFalse Token
    tokens.pop();
    const operandToken = tokens.pop()
    if (operandToken === undefined) throw new UnexpectedEndOfInstructionError();

    if (operandToken.kind !== 'identifier') throw new UnexpectedEndOfInstructionError();
    const identifier = {kind: 'ident', val: operandToken.val} as Ident;

    const {jumpLabelToken, jumpLabel} = parseIfRest(tokens);

    return new IfFalseInstruction(label, jumpLabel, jumpLabelToken.line, identifier);
}

function parseAssign(tokens: Array<Token>, label: undefined | string): TacInstruction {
    const identifierToken = tokens.pop();
    if (identifierToken === undefined) throw new UnexpectedEndOfInstructionError();
    if (identifierToken.kind !== 'identifier') throw new UnexpectedTokenError();
    const target: Ident = {kind: 'ident', val: identifierToken.val};

    const equalsToken = tokens.pop();
    if (equalsToken === undefined) throw new UnexpectedTokenError();
    if (equalsToken.kind !== 'symbol' || equalsToken.val !== '=') throw new UnexpectedTokenError();

    let leftOp = undefined;
    let operator = undefined;
    let rightOp = undefined;

    const firstDecisionToken = tokens.at(-1);
    if (firstDecisionToken === undefined) throw new UnexpectedEndOfInstructionError();
    if (firstDecisionToken.kind === 'symbol') {
        const unaryOperator = tryUnaryOperatorFromSymbol(firstDecisionToken.val);
        // must be removed
        tokens.pop();
        const singleOperand = extractOperand(tokens);

        const eol = tokens.pop();
        if (eol === undefined) throw new UnexpectedEndOfInstructionError();
        if (eol.kind !== 'eol') throw new UnexpectedTokenError();
        return new UnaryAssignInstruction(label, eol.line, target, singleOperand, unaryOperator);
    }

    leftOp = extractOperand(tokens);

    const decisionToken = tokens.pop();
    if (decisionToken === undefined) throw new UnexpectedEndOfInstructionError();
    if (decisionToken.kind === 'eol') {
        return new CopyInstruction(label, identifierToken.line, target, leftOp);
    }
    if (decisionToken.kind === 'symbol') {
        operator = tryBinaryOperatorFromSymbol(decisionToken.val);
        rightOp = extractOperand(tokens);
    }

    const eol = tokens.pop();
    if (eol === undefined) throw new UnexpectedEndOfInstructionError();
    if (eol.kind !== 'eol') throw new UnexpectedTokenError();

    if (operator === undefined || rightOp === undefined) {
        throw new UnexpectedEndOfInstructionError();
    }

    return new BinaryAssignInstruction(label, eol.line, target, leftOp, rightOp, operator);
}


function extractOperand(tokens: Token[]): Operand {
    const operandToken = tokens.pop()
    if (operandToken === undefined) throw new UnexpectedEndOfInstructionError();

    switch (operandToken.kind) {
        case "identifier":
            return {kind: 'ident', val: operandToken.val} as Operand;
        case "integer_literal":
            return {kind: 'integer', val: operandToken.val} as Operand;
        default:
            throw new UnexpectedEndOfInstructionError();
    }
}
