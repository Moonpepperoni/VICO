class Quadruple {
    op;
    arg1;
    arg2;
    result;
    type;
    label;

    constructor(op, arg1, arg2, result, type, label) {
        this.op = op;
        this.arg1 = arg1;
        this.arg2 = arg2;
        this.result = result;
        this.type = type;
        this.label = label;
    }

    static fromParts(tokens) {
        console.log('assembling from parts');
        let [first, second, ...rest] = tokens;
        let result;
        let arg1;
        let arg2;
        let op;
        let type;
        let label;

        if (first.type === 'ident' && second.type === 'ssymbol' && second.val === ':') {
            label = first;
            [first, second, ...rest] = rest;
        }

        switch (first.type) {
            case 'ident':
                result = first;
                ({ arg1, arg2, op } = parseAssignRest(rest));
                console.log(`after assign, arg1: ${arg1}, arg2: ${arg2}, op: ${op}, result: ${result}`)
                type = 'assign';
                break;
            case 'goto':
                result = second;
                type = 'jmp';
                break;
            case 'if':
                ({ arg1, arg2, op, result } = parseIfRest([second, ...rest]));
                console.log(`after if, arg1: ${arg1}, arg2: ${arg2}, op: ${op}, result: ${result}`)
                type = 'cjmp';
                break;
        }
        return new Quadruple(op, arg1, arg2, result, type, label);
    }

    toString() {
        console.log("calling to string");
        switch (this.type) {
            case 'assign': {
                let start = `${this.result.val} = `;
                if (this.arg2) {
                    start += `${this.arg1.val} ${this.op.val} ${this.arg2.val}`;
                } else if (this.op) {
                    start += `${this.op.val} ${this.arg1.val}`;
                } else {
                    start += `${this.arg1.val}`;
                }
                return start;
            }
            case 'jmp':
                return `goto ${this.result.val}`;
            case 'cjmp':
                return `if ${this.arg1?.val} ${this.op?.val} ${this.arg2?.val} goto ${this.result?.val}`
        }
    }
}

function parseIfRest(rest) {
    let arg1;
    let arg2;
    let op;
    let result;

    let gotoSeen = false;
    for (let token of rest) {
        console.log(token.toString());
        switch (token.type) {
            case 'ident':
            case 'numlit':
                if (arg1 === undefined) {
                    arg1 = token;
                } else if (gotoSeen) {
                    result = token;
                } else {
                    arg2 = token;
                }
                break;
            case 'ssymbol':
            case 'dsymbol':
                op = token;
                break;
            case 'goto':
                gotoSeen = true;
        }
    }
    return { arg1, arg2, op, result };
}

function parseAssignRest(rest) {
    let arg1;
    let arg2;
    let op;

    for (let token of rest) {
        console.log(`parsing token in assign ${token.toString()}`);
        switch (token.type) {
            case 'ident':
            case 'numlit':
                if (arg1 === undefined) {
                    arg1 = token;
                } else {
                    arg2 = token;
                }
                break;
            case 'ssymbol':
            case 'dsymbol':
                op = token;
                break;
        }
    }
    console.log(`before return ${arg1}, ${arg2}, ${op}`);
    return { arg1, arg2, op };
}



export default function parseTac(tokens) {
    let tokenStack = tokens.reverse();
    let quadruples = [];

    while (tokenStack.length > 0) {
        let instructionTokens = [];
        console.log(`found an instruction: ${tokenStack.at(-1)}`)
        while (tokenStack.at(-1).type != 'eoi') {
            instructionTokens.push(tokenStack.pop());
        }
        quadruples.push(Quadruple.fromParts(instructionTokens));
        // remove end of instruction
        tokenStack.pop();
    }

    let symbolTable = new Map();
    for (let [index, instruction] of quadruples.entries()) {
        if (instruction.label !== undefined) {
            symbolTable.set(instruction.label.val, index);
            console.log(`added label ${instruction.label.val} with index ${index}`)
        }
    }

    symbolTable.entries().forEach(([element, val]) => {
        console.log(`${element}: ${val}`)
    });

    for (let [index, instruction] of quadruples.entries()) {
        if (instruction.type === 'jmp' || instruction.type === 'cjmp') {
            let target = instruction.result.val;
            let pos = symbolTable.get(target);
            console.log(`pos for label ${target} is ${pos}`)
            instruction.result.val = pos;
        }
        instruction.label = index;
    }

    return quadruples;
}