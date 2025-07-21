import {type Token, tokenizeString} from "./tokenizer.ts";
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
} from "./parser-types.ts";

export class TacParser {

    readonly idGenerator : () => number;
    readonly tokens : Array<Token>;
    readonly instructions : Array<TacInstruction>;
    ran : boolean;

    constructor(idGenerator: () => number, input : string) {
        this.idGenerator = idGenerator;
        this.tokens = tokenizeString(input);
        this.tokens.reverse();
        this.instructions = [];
        this.ran = false;
    }

    parseTac(): Array<TacInstruction> {
        if (this.ran) return this.instructions;
        while (this.tokens.length !== 0) {
            this.tryParseInstruction();
        }
        this.ran = true;
        return this.instructions;
    }

    tryParseInstruction() {
        const label = this.extractOptionalLabel();
        const top = this.tokens.at(-1);
        if (top === undefined) {
            throw new UnexpectedEndOfInstructionError();
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
                throw new UnexpectedTokenError();
        }
    }

    extractOptionalLabel() {
        const top = this.tokens.at(-1);
        let label = undefined;
        if (top !== undefined && top.kind === "label") {
            label = top.val;
            // remove the label value
            this.tokens.pop();
            // read colon
            const colon = this.tokens.pop();
            if (colon === undefined) throw new UnexpectedEndOfInstructionError();
            if (colon.kind !== 'symbol' || colon.val !== ":") throw new UnexpectedTokenError();
        }
        return label;
    }

    parseGoto(label?: string) {
        const id = this.idGenerator();
        // remove goto
        this.tokens.pop();

        const jmpLabel = this.tokens.pop();
        if (jmpLabel === undefined) throw new UnexpectedEndOfInstructionError();
        if (jmpLabel.kind !== 'label') throw new UnexpectedTokenError();

        const eol = this.tokens.pop();
        if (eol === undefined) throw new UnexpectedEndOfInstructionError();
        this.instructions.push(new JumpInstruction(id, label, jmpLabel.val, jmpLabel.line));
    }

    parseIfRest() {
        const gotoToken = this.tokens.pop();
        if (gotoToken === undefined) throw new UnexpectedEndOfInstructionError();
        if (gotoToken.kind !== 'goto') throw new UnexpectedTokenError();

        const jumpLabelToken = this.tokens.pop();
        if (jumpLabelToken === undefined) throw new UnexpectedEndOfInstructionError();
        if (jumpLabelToken.kind !== 'label') throw new UnexpectedTokenError();
        const jumpLabel = jumpLabelToken.val;

        const eol = this.tokens.pop();
        if (eol === undefined) throw new UnexpectedEndOfInstructionError();
        if (eol.kind !== 'eol') throw new UnexpectedTokenError();
        return {jumpLabelToken, jumpLabel};
    }

    parseIf(label: undefined | string) {
        const id = this.idGenerator();
        // remove if
        this.tokens.pop();

        let leftOp = undefined;
        let operator = undefined;
        let rightOp = undefined;


        leftOp = this.extractOperand();
        const decisionToken = this.tokens.at(-1);
        if (decisionToken === undefined) throw new UnexpectedEndOfInstructionError();
        // if it's an if instruction with a relop and two operands
        if (decisionToken.kind === 'symbol') {
            operator = tryRelationOperatorFromSymbol(decisionToken.val);
            // remove the read token;
            this.tokens.pop();
            // continue with rightOp, which must exist now;
            rightOp = this.extractOperand();
        }
        const {jumpLabelToken, jumpLabel} = this.parseIfRest();

        if (operator !== undefined && rightOp !== undefined) {
            this.instructions.push(new IfWithOperatorInstruction(id, label, jumpLabel, jumpLabelToken.line, leftOp, rightOp, operator));
            return;
        }

        if (leftOp.kind !== 'ident') {
            throw new UnexpectedTokenError();
        }
        this.instructions.push(new IfSingleOperandInstruction(id, label, jumpLabel, jumpLabelToken.line, leftOp));
    }

    parseIfFalse(label: undefined | string) {
        const id = this.idGenerator();
        // remove ifFalse Token
        this.tokens.pop();
        const operandToken = this.tokens.pop()
        if (operandToken === undefined) throw new UnexpectedEndOfInstructionError();

        if (operandToken.kind !== 'identifier') throw new UnexpectedEndOfInstructionError();
        const identifier = {kind: 'ident', val: operandToken.val} as Ident;

        const {jumpLabelToken, jumpLabel} = this.parseIfRest();

        this.instructions.push(new IfFalseInstruction(id, label, jumpLabel, jumpLabelToken.line, identifier));
    }

    parseAssign(label: undefined | string) {
        const id = this.idGenerator();
        const identifierToken = this.tokens.pop();
        if (identifierToken === undefined) throw new UnexpectedEndOfInstructionError();
        if (identifierToken.kind !== 'identifier') throw new UnexpectedTokenError();
        const target: Ident = {kind: 'ident', val: identifierToken.val};

        const equalsToken = this.tokens.pop();
        if (equalsToken === undefined) throw new UnexpectedTokenError();
        if (equalsToken.kind !== 'symbol' || equalsToken.val !== '=') throw new UnexpectedTokenError();

        let leftOp = undefined;
        let operator = undefined;
        let rightOp = undefined;

        const firstDecisionToken = this.tokens.at(-1);
        if (firstDecisionToken === undefined) throw new UnexpectedEndOfInstructionError();
        if (firstDecisionToken.kind === 'symbol') {
            const unaryOperator = tryUnaryOperatorFromSymbol(firstDecisionToken.val);
            // must be removed
            this.tokens.pop();
            const singleOperand = this.extractOperand();

            const eol = this.tokens.pop();
            if (eol === undefined) throw new UnexpectedEndOfInstructionError();
            if (eol.kind !== 'eol') throw new UnexpectedTokenError();
            this.instructions.push(new UnaryAssignInstruction(id, label, eol.line, target, singleOperand, unaryOperator));
            return;
        }

        leftOp = this.extractOperand();

        const decisionToken = this.tokens.pop();
        if (decisionToken === undefined) throw new UnexpectedEndOfInstructionError();
        if (decisionToken.kind === 'eol') {
            this.instructions.push(new CopyInstruction(id, label, identifierToken.line, target, leftOp));
            return;
        }
        if (decisionToken.kind === 'symbol') {
            operator = tryBinaryOperatorFromSymbol(decisionToken.val);
            rightOp = this.extractOperand();
        }

        const eol = this.tokens.pop();
        if (eol === undefined) throw new UnexpectedEndOfInstructionError();
        if (eol.kind !== 'eol') throw new UnexpectedTokenError();

        if (operator === undefined || rightOp === undefined) {
            throw new UnexpectedEndOfInstructionError();
        }

        this.instructions.push(new BinaryAssignInstruction(id, label, eol.line, target, leftOp, rightOp, operator));
    }

    extractOperand(): Operand {
        const operandToken = this.tokens.pop()
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
}





