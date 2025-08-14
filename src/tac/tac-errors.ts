export class TacCollectiveError extends Error {
    readonly errors: Array<TacError>;

    constructor(...errors: Array<TacError>) {
        super(`the submitted program is not valid, found ${errors.length} problem${errors.length > 1 ? 's' : ''}:
${errors.map(v => v.message).join('\n')}`);
        this.errors = errors;
    }
}

export class TacError extends Error {
    readonly line: number;
    readonly reason: string;

    constructor(reason: string, line: number) {
        super(`error on line ${line}: ${reason}`);
        this.name = "ProgramVerificationError"
        this.line = line;
        this.reason = reason;
    }
}


export class UnsupportedTokenError extends TacError {
    constructor(rawToken: string, line: number) {
        super(`illegal token ${rawToken} (could not determine type)"`, line);
        this.name = "UnsupportedTokenError";
    }
}

export class LabelNotDefinedError extends TacError {

    constructor(label: string, line: number) {
        const reason = `the label ${label} is never defined`;
        super(reason, line);
        this.name = "LabelNotDefinedError";
    }
}

export class LabelAlreadyDefinedError extends TacError {

    constructor(label: string, line: number) {
        const reason = `the label ${label} is already defined`;
        super(reason, line);
        this.name = "LabelDefinedMultipleTimes";
    }
}

export class UnexpectedEndOfInstructionError extends TacError {

    constructor(line: number, ...expectedTokenTypes: Array<string>) {
        const reason = `expected one of [${expectedTokenTypes.join(", ")}] but instruction ended`
        super(reason, line);
        this.name = "UnexpectedEndOfInstructionError";
    }
}

export class UnexpectedTokenError extends TacError {
    constructor(line: number, gotTokenType: string, ...expectedTokenTypes: Array<string>) {
        const reason = `expected one of [${expectedTokenTypes.join(", ")}] but got "${gotTokenType}"`
        super(reason, line);
        this.name = "UnexpectedTokenError";
    }
}

export class InvalidOperatorError extends TacError {
    constructor(line: number, symbol: string, expectedType: string) {
        super(`symbol ${symbol} is not a valid ${expectedType} operator`, line);
        this.name = "InvalidOperatorError";
    }
}

