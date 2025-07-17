import { test, expect } from "vitest";
import { tokenizeString } from "./tac-tokenizer";

test('should detect if token', () => {
    expect(tokenizeString('if')).toContainEqual({ kind: 'if', line: 0 });
})

test('should detect goto token', () => {
    expect(tokenizeString('goto')).toContainEqual({ kind: 'goto', line: 0 });
})

test('should detect ifFalse token', () => {
    expect(tokenizeString('ifFalse')).toContainEqual({ kind: 'ifFalse', line: 0 });
})

test('should detect valid identifier without numbers', () => {
    expect(tokenizeString('abc')).toContainEqual({ kind: 'identifier', val: 'abc', line: 0 });
})


test('should detect valid identifier with numbers', () => {
    expect(tokenizeString('abc123')).toContainEqual({ kind: 'identifier', val: 'abc123', line: 0 });
})

test('should detect invalid identifier starting with numbers', () => {
    expect(() => tokenizeString('123abc')).toThrowError(/123abc/);
})


test('should detect invalid identifier containing symbols', () => {
    expect(() => tokenizeString('abc_123')).toThrowError(/abc_123/);
})

test('should detect valid label', () => {
    expect(tokenizeString('LABEL')).toContainEqual({ kind: 'label', val: 'LABEL', line: 0 });
})

test('should detect invalid label starting with _', () => {
    expect(() => tokenizeString('_IF_STATEMENT')).toThrowError(/_IF_STATEMENT/);
})

test('should detect valid label with underscores', () => {
    expect(tokenizeString('IF_STATEMENT_HERE')).toContainEqual({ kind: 'label', val: 'IF_STATEMENT_HERE', line: 0 });
})

test('should detect valid label with underscores and numbers', () => {
    expect(tokenizeString('IF_STATEMENT_HERE_12')).toContainEqual({ kind: 'label', val: 'IF_STATEMENT_HERE_12', line: 0 });
})

test('should detect invalid label with starting number', () => {
    expect(() => tokenizeString('12HERE')).toThrowError(/12HERE/);
})

test('should return end of line token, even if no newline is present', () => {
    expect(tokenizeString('IF_STATEMENT_HERE_12')).toContainEqual({ kind: 'eol', line: 0 });
})


test('should detect 0 as number literal', () => {
    expect(tokenizeString('0')).toContainEqual({ kind: 'integer_literal', val: '0', line: 0 });
})

test('should detect arbitrary number as number literal', () => {
    expect(tokenizeString('123456789')).toContainEqual({ kind: 'integer_literal', val: '123456789', line: 0 });
})

test('should detect invalid number starting with 0', () => {
    expect(() => tokenizeString('0123456789')).toThrowError(/0123456789/);
})

test('should detect = operator', () => {
    expect(tokenizeString('=')).toContainEqual({ kind: 'symbol', val: '=', line: 0 });
})

test('should detect ! operator', () => {
    expect(tokenizeString('!')).toContainEqual({ kind: 'symbol', val: '!', line: 0 });
})

test('should detect + operator', () => {
    expect(tokenizeString('+')).toContainEqual({ kind: 'symbol', val: '+', line: 0 });
})

test('should detect - operator', () => {
    expect(tokenizeString('-')).toContainEqual({ kind: 'symbol', val: '-', line: 0 });
})

test('should detect * operator', () => {
    expect(tokenizeString('*')).toContainEqual({ kind: 'symbol', val: '*', line: 0 });
})

test('should detect / operator', () => {
    expect(tokenizeString('/')).toContainEqual({ kind: 'symbol', val: '/', line: 0 });
})

test('should detect % operator', () => {
    expect(tokenizeString('%')).toContainEqual({ kind: 'symbol', val: '%', line: 0 });
})

test('should detect == operator', () => {
    expect(tokenizeString('==')).toContainEqual({ kind: 'symbol', val: '==', line: 0 });
})

test('should detect != operator', () => {
    expect(tokenizeString('!=')).toContainEqual({ kind: 'symbol', val: '!=', line: 0 });
})

test('should detect <= operator', () => {
    expect(tokenizeString('<=')).toContainEqual({ kind: 'symbol', val: '<=', line: 0 });
})

test('should detect >= operator', () => {
    expect(tokenizeString('>=')).toContainEqual({ kind: 'symbol', val: '>=', line: 0 });
})

test('should detect > operator', () => {
    expect(tokenizeString('>')).toContainEqual({ kind: 'symbol', val: '>', line: 0 });
})

test('should detect < operator', () => {
    expect(tokenizeString('<')).toContainEqual({ kind: 'symbol', val: '<', line: 0 });
})

test('should detect : correctly', () => {
    expect(tokenizeString(':')).toContainEqual({ kind: 'symbol', val: ':', line: 0 });
})

test('should tokenize : even without white space before :', () => {
    expect(tokenizeString('HELLO: ')).toStrictEqual([
        { kind: 'label', val: 'HELLO', line: 0 },
        { kind: 'symbol', val: ':', line: 0 },
        { kind: 'eol', line: 0 },
    ]);
})

test('should tokenize single instruction', () => {
    expect(tokenizeString('a = b')).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 0 },
        { kind: 'symbol', val: '=', line: 0 },
        { kind: 'identifier', val: 'b', line: 0 },
        { kind: 'eol', line: 0 },
    ]);
})

test('should tokenize single instruction with mulit space', () => {
    expect(tokenizeString('a  =  b')).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 0 },
        { kind: 'symbol', val: '=', line: 0 },
        { kind: 'identifier', val: 'b', line: 0 },
        { kind: 'eol', line: 0 },
    ]);
})

test('should tokenize multiple instructions', () => {
    let multi = `a = b
if a == 0 goto HELLO`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 0 },
        { kind: 'symbol', val: '=', line: 0 },
        { kind: 'identifier', val: 'b', line: 0 },
        { kind: 'eol', line: 0 },
        { kind: 'if', line: 1 },
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '==', line: 1 },
        { kind: 'integer_literal', val: '0', line: 1 },
        { kind: 'goto', line: 1 },
        { kind: 'label', val: 'HELLO', line: 1 },
        { kind: 'eol', line: 1 }
    ]);
})

test('should tokenize multiple instructions with leading blank lines', () => {
    let multi = `

a = b
if a == 0 goto HELLO`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 0 },
        { kind: 'symbol', val: '=', line: 0 },
        { kind: 'identifier', val: 'b', line: 0 },
        { kind: 'eol', line: 0 },
        { kind: 'if', line: 1 },
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '==', line: 1 },
        { kind: 'integer_literal', val: '0', line: 1 },
        { kind: 'goto', line: 1 },
        { kind: 'label', val: 'HELLO', line: 1 },
        { kind: 'eol', line: 1 }
    ]);
})

test('should tokenize multiple instructions with trailing blank lines', () => {
    let multi = `a = b
if a == 0 goto HELLO

`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 0 },
        { kind: 'symbol', val: '=', line: 0 },
        { kind: 'identifier', val: 'b', line: 0 },
        { kind: 'eol', line: 0 },
        { kind: 'if', line: 1 },
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '==', line: 1 },
        { kind: 'integer_literal', val: '0', line: 1 },
        { kind: 'goto', line: 1 },
        { kind: 'label', val: 'HELLO', line: 1 },
        { kind: 'eol', line: 1 }
    ]);
})

test('should tokenize multiple instructions with blank lines inbetween', () => {
    let multi = `a = b

if a == 0 goto HELLO`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 0 },
        { kind: 'symbol', val: '=', line: 0 },
        { kind: 'identifier', val: 'b', line: 0 },
        { kind: 'eol', line: 0 },
        { kind: 'if', line: 1 },
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '==', line: 1 },
        { kind: 'integer_literal', val: '0', line: 1 },
        { kind: 'goto', line: 1 },
        { kind: 'label', val: 'HELLO', line: 1 },
        { kind: 'eol', line: 1 }
    ]);
})

test('should tokenize multiple instructions with arbitrary white space', () => {
    let multi = `
    a  =  b


if  a ==  0     goto   HELLO

`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 0 },
        { kind: 'symbol', val: '=', line: 0 },
        { kind: 'identifier', val: 'b', line: 0 },
        { kind: 'eol', line: 0 },
        { kind: 'if', line: 1 },
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '==', line: 1 },
        { kind: 'integer_literal', val: '0', line: 1 },
        { kind: 'goto', line: 1 },
        { kind: 'label', val: 'HELLO', line: 1 },
        { kind: 'eol', line: 1 }
    ]);
})