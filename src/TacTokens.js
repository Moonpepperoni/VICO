const IDENT_START = /[A-Za-z]/;
const IDENT_PART = /[A-Za-z0-9]/;
const NUM_LIT = /[0-9]/;
const OPERATOR = /[+|*|-|/|<|=|>|!]/
const VALID_TOKENS = /(?<goto>goto)|(?<if>if)|(?<ident>[A-Za-z][A-Za-z0-9]*)|(?<numlit>[0-9]+)|(?<dsymbol><=|>=|==|!=)|(?<ssymbol>[=+*-<>:\\])|(?<eoi>\n|$\r\n)|(?<space> |\t)/gm

class Token {
    constructor(type, val, line, col) {
        this.type = type;
        this.val = val;
        this.line = line;
        this.col = col;
    }

    toString() {
        return `Token(${this.type}): ${this.val}, on line ${this.line}, column ${this.col}`;
    }
}

export default function tokeniseRegex(text) {
    let tokens = [];
    let line = 1;
    let col = 1;
    for (let match of text.matchAll(VALID_TOKENS)) {
        for (let [groupName, value] of Object.entries(match.groups)) {
            if (value) {
                if (groupName === 'eoi') {
                    line += 1;
                    col = 1;
                }
                if (groupName !== 'space') {
                    tokens.push(new Token(groupName, value, line, col));
                }
                col += value.length;
            }
        }
    }
    return tokens;
}



