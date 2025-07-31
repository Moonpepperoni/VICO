// TODO: refactor to allow no space between certain tokens
// this will most likely need a complete rewrite because we use the fact that we can split this up into tokens at spaces

import {UnsupportedTokenError} from "./tac-errors.ts";

export function tokenizeString(input: string): Array<Token> {
    const tokens: Array<Token> = [];
    const parts = input.split(/(?:\r\n|\n)+/).map(l => l.trim()).filter(l => l !== "");
    for (const [i, line] of parts.entries()) {
        // this is to handle the special case of label declarations
        // which is the only token, that doesnt need to be split by at least one space
        const lineCleaned = line.split(/(:)/).join(" ").trim();
        const lineParts = lineCleaned.split(/(?: |\t)+/);
        lineParts.forEach(p => tokens.push(readSingleToken(p, i + 1)));
        tokens.push({ kind: 'eol', line: i +1 } as Token);
    }
    return tokens;
}

const LABEL_REGEX = /^([A-Z](_|[A-Z0-9])*[A-Z0-9])$/;
const IDENT_REGEX = /^([a-z][a-z0-9]*)$/;
const INT_REGEX = /^(0|([1-9][0-9]*))$/;
const IF_REGEX = /^if$/;
const IF_FALSE_REGEX = /^ifFalse$/;
const GOTO_REGEX = /^goto$/;
const SYMBOL_REGEX = /^(\+|-|\*|\/|%|(==)|(<=)|(>=)|(!=)|<|>|=|:|!)$/;

function readSingleToken(rawToken: string, line: number): Token {
    if (LABEL_REGEX.test(rawToken)) {
        return { kind: 'label', val: rawToken, line };
    } else if (IF_REGEX.test(rawToken)) {
        return { kind: 'if', line };
    } else if (IF_FALSE_REGEX.test(rawToken)) {
        return { kind: 'ifFalse', line };
    } else if (GOTO_REGEX.test(rawToken)) {
        return { kind: 'goto', line };
    } else if (SYMBOL_REGEX.test(rawToken)) {
        return { kind: "symbol", val: rawToken, line };
    } else if (INT_REGEX.test(rawToken)) {
        return { kind: 'integer_literal', val: rawToken, line };
    } else if (IDENT_REGEX.test(rawToken)) {
        return { kind: 'identifier', val: rawToken, line };
    } else {
        throw new UnsupportedTokenError(rawToken, line);
    }
}


export type TokenVal = { line: number }

export type Token = TokenVal &
    ({ kind: 'identifier', val: string } |
    { kind: 'integer_literal', val: string } |
    { kind: 'symbol', val: string } |
    { kind: 'label', val: string } |
    { kind: 'goto' } |
    { kind: 'eol' } |
    { kind: 'ifFalse' } |
    { kind: 'if' });
