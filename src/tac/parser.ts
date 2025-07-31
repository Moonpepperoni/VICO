import {type Token, tokenizeString} from "./tokenizer.ts";
import {
    BinaryAssignInstruction,
    CopyInstruction,
    type Ident,
    IfFalseInstruction,
    IfSingleOperandInstruction,
    IfWithOperatorInstruction,
    JumpInstruction,
    type Operand, OperatorConversionError,
    type TacInstruction,
    tryBinaryOperatorFromSymbol,
    tryRelationOperatorFromSymbol,
    tryUnaryOperatorFromSymbol,
    UnaryAssignInstruction,
} from "./parser-types.ts";
import {
    InvalidOperatorError,
    TacCollectiveError,
    TacError,
    UnexpectedEndOfInstructionError,
    UnexpectedTokenError
} from "./tac-errors.ts";

export class TacParser {

    readonly tokens: Array<Token>;
    readonly instructions: Array<TacInstruction>;
    ran: boolean;
    private readonly errors: Array<TacError>;
    private currentLine = 0;

    constructor(input: string) {
        this.tokens = tokenizeString(input);
        this.tokens.reverse();
        this.instructions = [];
        this.ran = false;
        this.errors = [];
        this.currentLine = 1;
    }

    parseTac(): Array<TacInstruction> {
        if (this.ran && this.errors.length !== 0) throw new TacCollectiveError(...this.errors);
        if (this.ran) return this.instructions;
        while (this.tokens.length !== 0) {
            try {
                this.tryParseInstruction();
            } catch (e) {
                if (e instanceof TacError) {
                    this.errors.push(e);
                    this.skipToNextLine();
                } else {
                    throw e;
                }
            }
            this.currentLine++;
        }
        this.ran = true;
        if (this.errors.length !== 0) {
            throw new TacCollectiveError(...this.errors);
        }
        return this.instructions;
    }

    private tryParseInstruction() {
        const label = this.extractOptionalLabel();
        const top = this.tokens.at(-1);
        if (top === undefined || top.kind === 'eol') {
            throw new UnexpectedEndOfInstructionError(this.currentLine, 'goto', 'if', 'ifFalse', 'identifier');
        }
        switch (top.kind) {
            case 'goto':
                this.parseGoto(label);
                break;
            case 'if':
                this.parseIf(label);
                break;
            case 'ifFalse':
                this.parseIfFalse(label);
                break;
            case 'identifier':
                this.parseAssign(label);
                break;
            default:
                throw new UnexpectedTokenError(this.currentLine, top.kind, 'goto', 'if', 'ifFalse', 'identifier');
        }
    }

    private extractOptionalLabel() {
        const top = this.tokens.at(-1);
        let label = undefined;
        if (top !== undefined && top.kind === "label") {
            label = top.val;
            // remove the label value
            this.tokens.pop();
            // read colon
            const colon = this.tokens.pop();
            if (colon === undefined || colon.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, ':');
            if (colon.kind !== 'symbol' || colon.val !== ":") throw new UnexpectedTokenError(this.currentLine, colon.kind, ':');
        }
        return label;
    }

    private parseGoto(label?: string) {
        // remove goto
        this.tokens.pop();

        const jmpLabel = this.tokens.pop();
        if (jmpLabel === undefined || jmpLabel.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, 'label');
        if (jmpLabel.kind !== 'label') throw new UnexpectedTokenError(this.currentLine, jmpLabel.kind, 'label');

        const eol = this.tokens.pop();
        if (eol === undefined) throw new UnexpectedEndOfInstructionError(this.currentLine, 'eol');
        this.instructions.push(new JumpInstruction(label, jmpLabel.val, jmpLabel.line));
    }

    private parseIfRest() {
        const gotoToken = this.tokens.pop();
        if (gotoToken === undefined || gotoToken.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, 'goto');
        if (gotoToken.kind !== 'goto') throw new UnexpectedTokenError(this.currentLine, gotoToken.kind, 'goto');

        const jumpLabelToken = this.tokens.pop();
        if (jumpLabelToken === undefined || jumpLabelToken.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, 'label');
        if (jumpLabelToken.kind !== 'label') throw new UnexpectedTokenError(this.currentLine, jumpLabelToken.kind, 'label');
        const jumpLabel = jumpLabelToken.val;

        const eol = this.tokens.pop();
        if (eol === undefined) throw new UnexpectedEndOfInstructionError(this.currentLine, 'eol');
        if (eol.kind !== 'eol') throw new UnexpectedTokenError(this.currentLine, eol.kind, 'eol');
        return {jumpLabelToken, jumpLabel};
    }

    private parseIf(label: undefined | string) {
        // remove if
        this.tokens.pop();

        let leftOp = undefined;
        let operator = undefined;
        let rightOp = undefined;


        leftOp = this.extractOperand();
        const decisionToken = this.tokens.at(-1);
        if (decisionToken === undefined || decisionToken.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, 'symbol', 'goto');
        // if it's an if instruction with a relop and two operands
        if (decisionToken.kind === 'symbol') {
            try {
                operator = tryRelationOperatorFromSymbol(decisionToken.val);
            } catch (e) {
                if (e instanceof OperatorConversionError) {
                    throw new InvalidOperatorError(this.currentLine, e.symbol, e.expectedType);
                }
                else {
                    throw e;
                }
            }

            // remove the read token;
            this.tokens.pop();
            // continue with rightOp, which must exist now;
            rightOp = this.extractOperand();
        }
        const {jumpLabelToken, jumpLabel} = this.parseIfRest();

        if (operator !== undefined && rightOp !== undefined) {
            this.instructions.push(new IfWithOperatorInstruction(label, jumpLabel, jumpLabelToken.line, leftOp, rightOp, operator));
            return;
        }

        if (leftOp.kind !== 'ident') {
            throw new UnexpectedTokenError(this.currentLine, leftOp.kind, 'identifier');
        }
        this.instructions.push(new IfSingleOperandInstruction(label, jumpLabel, jumpLabelToken.line, leftOp));
    }

    private parseIfFalse(label: undefined | string) {
        // remove ifFalse Token
        this.tokens.pop();
        const operandToken = this.tokens.pop()
        if (operandToken === undefined || operandToken.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, 'identifier');

        if (operandToken.kind !== 'identifier') throw new UnexpectedTokenError(this.currentLine, operandToken.kind, 'identifier');
        const identifier = {kind: 'ident', val: operandToken.val} as Ident;

        const {jumpLabelToken, jumpLabel} = this.parseIfRest();

        this.instructions.push(new IfFalseInstruction(label, jumpLabel, jumpLabelToken.line, identifier));
    }

    private parseAssign(label: undefined | string) {
        const identifierToken = this.tokens.pop();
        if (identifierToken === undefined || identifierToken.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, 'identifier');
        if (identifierToken.kind !== 'identifier') throw new UnexpectedTokenError(this.currentLine, identifierToken.kind, 'identifier');
        const target: Ident = {kind: 'ident', val: identifierToken.val};

        const equalsToken = this.tokens.pop();
        if (equalsToken === undefined || equalsToken.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, '=');
        if (equalsToken.kind !== 'symbol' || equalsToken.val !== '=') throw new UnexpectedTokenError(this.currentLine, equalsToken.kind, '=');

        let leftOp = undefined;
        let operator = undefined;
        let rightOp = undefined;
        let unaryOperator = undefined;

        const firstDecisionToken = this.tokens.at(-1);
        if (firstDecisionToken === undefined || firstDecisionToken.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, 'symbol', 'integer_literal', 'identifier');
        if (firstDecisionToken.kind === 'symbol') {
            try {
                unaryOperator = tryUnaryOperatorFromSymbol(firstDecisionToken.val);
            } catch (e) {
                if (e instanceof OperatorConversionError) {
                    throw new InvalidOperatorError(this.currentLine, e.symbol, e.expectedType);
                }
                else {
                    throw e;
                }
            }

            // must be removed
            this.tokens.pop();
            const singleOperand = this.extractOperand();

            const eol = this.tokens.pop();
            if (eol === undefined) throw new UnexpectedEndOfInstructionError(this.currentLine, 'eol');
            if (eol.kind !== 'eol') throw new UnexpectedTokenError(this.currentLine, eol.kind, 'eol');
            this.instructions.push(new UnaryAssignInstruction(label, eol.line, target, singleOperand, unaryOperator));
            return;
        }

        leftOp = this.extractOperand();

        const decisionToken = this.tokens.pop();
        if (decisionToken === undefined) throw new UnexpectedEndOfInstructionError(this.currentLine, 'symbol', 'integer_literal', 'identifier');
        if (decisionToken.kind === 'eol') {
            this.instructions.push(new CopyInstruction(label, identifierToken.line, target, leftOp));
            return;
        }
        if (decisionToken.kind === 'symbol') {
            try {
                operator = tryBinaryOperatorFromSymbol(decisionToken.val);
            } catch (e) {
                if (e instanceof OperatorConversionError) {
                    throw new InvalidOperatorError(this.currentLine, e.symbol, e.expectedType);
                }
                else {
                    throw e;
                }
            }
            rightOp = this.extractOperand();
        }

        const eol = this.tokens.pop();
        if (eol === undefined) throw new UnexpectedEndOfInstructionError(this.currentLine, 'eol');
        if (eol.kind !== 'eol') throw new UnexpectedTokenError(this.currentLine, eol.kind, 'eol');

        if (operator === undefined || rightOp === undefined) {
            throw new Error("Operator or right operand is undefined. This should not happen.")
        }

        this.instructions.push(new BinaryAssignInstruction(label, eol.line, target, leftOp, rightOp, operator));
    }

    private extractOperand(): Operand {
        const operandToken = this.tokens.pop()
        if (operandToken === undefined || operandToken.kind === 'eol') throw new UnexpectedEndOfInstructionError(this.currentLine, 'identifier', 'integer_literal');

        switch (operandToken.kind) {
            case "identifier":
                return {kind: 'ident', val: operandToken.val} as Operand;
            case "integer_literal":
                return {kind: 'integer', val: operandToken.val} as Operand;
            default:
                throw new UnexpectedTokenError(this.currentLine, operandToken.kind, 'identifier', 'integer_literal');
        }
    }

    private skipToNextLine() {
        let top = this.tokens.pop();
        while (top !== undefined && top.kind !== 'eol') {
            top = this.tokens.pop();
        }
    }
}