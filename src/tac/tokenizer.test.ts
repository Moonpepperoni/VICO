import { test, expect } from "vitest";
import { tokenizeString } from "./tokenizer.ts";

test('should detect if token', () => {
    expect(tokenizeString('if')).toContainEqual({ kind: 'if', line: 1 });
})

test('should detect goto token', () => {
    expect(tokenizeString('goto')).toContainEqual({ kind: 'goto', line: 1 });
})

test('should detect ifFalse token', () => {
    expect(tokenizeString('ifFalse')).toContainEqual({ kind: 'ifFalse', line: 1 });
})

test('should detect valid identifier without numbers', () => {
    expect(tokenizeString('abc')).toContainEqual({ kind: 'identifier', val: 'abc', line: 1 });
})


test('should detect valid identifier with numbers', () => {
    expect(tokenizeString('abc123')).toContainEqual({ kind: 'identifier', val: 'abc123', line: 1 });
})

test('should detect invalid identifier starting with numbers', () => {
    expect(() => tokenizeString('123abc')).toThrowError(/123abc/);
})


test('should detect invalid identifier containing symbols', () => {
    expect(() => tokenizeString('abc_123')).toThrowError(/abc_123/);
})

test('should detect valid label', () => {
    expect(tokenizeString('LABEL')).toContainEqual({ kind: 'label', val: 'LABEL', line: 1 });
})

test('should detect invalid label starting with _', () => {
    expect(() => tokenizeString('_IF_STATEMENT')).toThrowError(/_IF_STATEMENT/);
})

test('should detect valid label with underscores', () => {
    expect(tokenizeString('IF_STATEMENT_HERE')).toContainEqual({ kind: 'label', val: 'IF_STATEMENT_HERE', line: 1 });
})

test('should detect valid label with underscores and numbers', () => {
    expect(tokenizeString('IF_STATEMENT_HERE_12')).toContainEqual({ kind: 'label', val: 'IF_STATEMENT_HERE_12', line: 1 });
})

test('should detect invalid label with starting number', () => {
    expect(() => tokenizeString('12HERE')).toThrowError(/12HERE/);
})

test('should return end of line token, even if no newline is present', () => {
    expect(tokenizeString('IF_STATEMENT_HERE_12')).toContainEqual({ kind: 'eol', line: 1 });
})


test('should detect 0 as number literal', () => {
    expect(tokenizeString('0')).toContainEqual({ kind: 'integer_literal', val: '0', line: 1 });
})

test('should detect arbitrary number as number literal', () => {
    expect(tokenizeString('123456789')).toContainEqual({ kind: 'integer_literal', val: '123456789', line: 1 });
})

test('should detect invalid number starting with 0', () => {
    expect(() => tokenizeString('0123456789')).toThrowError(/0123456789/);
})

test('should detect = operator', () => {
    expect(tokenizeString('=')).toContainEqual({ kind: 'symbol', val: '=', line: 1 });
})

test('should detect ! operator', () => {
    expect(tokenizeString('!')).toContainEqual({ kind: 'symbol', val: '!', line: 1 });
})

test('should detect + operator', () => {
    expect(tokenizeString('+')).toContainEqual({ kind: 'symbol', val: '+', line: 1 });
})

test('should detect - operator', () => {
    expect(tokenizeString('-')).toContainEqual({ kind: 'symbol', val: '-', line: 1 });
})

test('should detect * operator', () => {
    expect(tokenizeString('*')).toContainEqual({ kind: 'symbol', val: '*', line: 1 });
})

test('should detect / operator', () => {
    expect(tokenizeString('/')).toContainEqual({ kind: 'symbol', val: '/', line: 1 });
})

test('should detect % operator', () => {
    expect(tokenizeString('%')).toContainEqual({ kind: 'symbol', val: '%', line: 1 });
})

test('should detect == operator', () => {
    expect(tokenizeString('==')).toContainEqual({ kind: 'symbol', val: '==', line: 1 });
})

test('should detect != operator', () => {
    expect(tokenizeString('!=')).toContainEqual({ kind: 'symbol', val: '!=', line: 1 });
})

test('should detect <= operator', () => {
    expect(tokenizeString('<=')).toContainEqual({ kind: 'symbol', val: '<=', line: 1 });
})

test('should detect >= operator', () => {
    expect(tokenizeString('>=')).toContainEqual({ kind: 'symbol', val: '>=', line: 1 });
})

test('should detect > operator', () => {
    expect(tokenizeString('>')).toContainEqual({ kind: 'symbol', val: '>', line: 1 });
})

test('should detect < operator', () => {
    expect(tokenizeString('<')).toContainEqual({ kind: 'symbol', val: '<', line: 1 });
})

test('should detect : correctly', () => {
    expect(tokenizeString(':')).toContainEqual({ kind: 'symbol', val: ':', line: 1 });
})

test('should tokenize : even without white space before :', () => {
    expect(tokenizeString('HELLO: ')).toStrictEqual([
        { kind: 'label', val: 'HELLO', line: 1 },
        { kind: 'symbol', val: ':', line: 1 },
        { kind: 'eol', line: 1 },
    ]);
})

test('should tokenize single instruction', () => {
    expect(tokenizeString('a = b')).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '=', line: 1 },
        { kind: 'identifier', val: 'b', line: 1 },
        { kind: 'eol', line: 1 },
    ]);
})

test('should tokenize single instruction with mulit space', () => {
    expect(tokenizeString('a  =  b')).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '=', line: 1 },
        { kind: 'identifier', val: 'b', line: 1 },
        { kind: 'eol', line: 1 },
    ]);
})

test('should tokenize multiple instructions', () => {
    const multi = `a = b
if a == 0 goto HELLO`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '=', line: 1 },
        { kind: 'identifier', val: 'b', line: 1 },
        { kind: 'eol', line: 1 },
        { kind: 'if', line: 2 },
        { kind: 'identifier', val: 'a', line: 2 },
        { kind: 'symbol', val: '==', line: 2 },
        { kind: 'integer_literal', val: '0', line: 2 },
        { kind: 'goto', line: 2 },
        { kind: 'label', val: 'HELLO', line: 2 },
        { kind: 'eol', line: 2 }
    ]);
})

test('should tokenize multiple instructions with leading blank lines', () => {
    const multi = `

a = b
if a == 0 goto HELLO`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '=', line: 1 },
        { kind: 'identifier', val: 'b', line: 1 },
        { kind: 'eol', line: 1 },
        { kind: 'if', line: 2 },
        { kind: 'identifier', val: 'a', line: 2 },
        { kind: 'symbol', val: '==', line: 2 },
        { kind: 'integer_literal', val: '0', line: 2 },
        { kind: 'goto', line: 2 },
        { kind: 'label', val: 'HELLO', line: 2 },
        { kind: 'eol', line: 2 }
    ]);
})

test('should tokenize multiple instructions with trailing blank lines', () => {
    const multi = `a = b
if a == 0 goto HELLO

`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '=', line: 1 },
        { kind: 'identifier', val: 'b', line: 1 },
        { kind: 'eol', line: 1 },
        { kind: 'if', line: 2 },
        { kind: 'identifier', val: 'a', line: 2 },
        { kind: 'symbol', val: '==', line: 2 },
        { kind: 'integer_literal', val: '0', line: 2 },
        { kind: 'goto', line: 2 },
        { kind: 'label', val: 'HELLO', line: 2 },
        { kind: 'eol', line: 2 }
    ]);
})

test('should tokenize multiple instructions with blank lines inbetween', () => {
    const multi = `a = b

if a == 0 goto HELLO`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '=', line: 1 },
        { kind: 'identifier', val: 'b', line: 1 },
        { kind: 'eol', line: 1 },
        { kind: 'if', line: 2 },
        { kind: 'identifier', val: 'a', line: 2 },
        { kind: 'symbol', val: '==', line: 2 },
        { kind: 'integer_literal', val: '0', line: 2 },
        { kind: 'goto', line: 2 },
        { kind: 'label', val: 'HELLO', line: 2 },
        { kind: 'eol', line: 2 }
    ]);
})

test('should tokenize multiple instructions with arbitrary white space', () => {
    const multi = `
    a  =  b


if  a ==  0     goto   HELLO

`;

    expect(tokenizeString(multi)).toStrictEqual([
        { kind: 'identifier', val: 'a', line: 1 },
        { kind: 'symbol', val: '=', line: 1 },
        { kind: 'identifier', val: 'b', line: 1 },
        { kind: 'eol', line: 1 },
        { kind: 'if', line: 2 },
        { kind: 'identifier', val: 'a', line: 2 },
        { kind: 'symbol', val: '==', line: 2 },
        { kind: 'integer_literal', val: '0', line: 2 },
        { kind: 'goto', line: 2 },
        { kind: 'label', val: 'HELLO', line: 2 },
        { kind: 'eol', line: 2 }
    ]);
});


test('should throw an error when a single invalid token is present', () => {
    const input = 'a = 123abc';
    expect(() => tokenizeString(input)).toThrowError(/found 1 problem/);
    expect(() => tokenizeString(input)).toThrowError(/illegal token 123abc/);
});

test('should collect multiple errors from the same line', () => {
    const input = 'a = 123abc + 456def';
    expect(() => tokenizeString(input)).toThrowError(/found 2 problem/);
    expect(() => tokenizeString(input)).toThrowError(/illegal token 123abc/);
    expect(() => tokenizeString(input)).toThrowError(/illegal token 456def/);
});

test('should collect errors from multiple lines', () => {
    const input = `a = 123abc
  b = 456def
  c = d`;

    expect(() => tokenizeString(input)).toThrowError(/found 2 problem/);
    expect(() => tokenizeString(input)).toThrowError(/line 1.*123abc/);
    expect(() => tokenizeString(input)).toThrowError(/line 2.*456def/);
});

test('should continue processing after encountering an error in a line', () => {
    const input = 'a = b + 123abc + c';

    expect(() => tokenizeString(input)).toThrowError(/found 1 problem/);
    expect(() => tokenizeString(input)).toThrowError(/illegal token 123abc/);
});

test('should handle complex inputs with errors in different lines', () => {
    const input = `a = b
  LABEL1: if c goto NEXT
  123invalid = d
  e = f + @invalid
  ifFalse g goto END`;

    expect(() => tokenizeString(input)).toThrowError(/found 2 problem/);
    expect(() => tokenizeString(input)).toThrowError(/line 3.*123invalid/);
    expect(() => tokenizeString(input)).toThrowError(/line 4.*@invalid/);
});

test('should report correct error count with plural form', () => {
    const input = `a = 123abc
  b = @invalid
  c = #error`;

    expect(() => tokenizeString(input)).toThrowError(/found 3 problems/);
});

test('should report error count with singular form for single error', () => {
    const input = 'a = 123abc';

    expect(() => tokenizeString(input)).toThrowError(/found 1 problem[^s]/);
});

test('should correctly report line numbers in error messages', () => {
    const input = `a = b
  c = 123invalid
  d = e`;

    expect(() => tokenizeString(input)).toThrowError(/line 2/);
    expect(() => tokenizeString(input)).toThrowError(/123invalid/);
});
