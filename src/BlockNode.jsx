function instructionToString(instr) {
    switch (instr.type) {
        case 'assign': {
            let start = `${instr.result.val} = `;
            if (instr.arg2) {
                start += `${instr.arg1.val} ${instr.op.val} ${instr.arg2.val}`;
            } else if (instr.op) {
                start += `${instr.op.val} ${instr.arg1.val}`;
            } else {
                start += `${instr.arg1.val}`;
            }
            return start;
        }
        case 'jmp':
            return `goto ${instr.result.val}`;
        case 'cjmp':
            return `if ${instr.arg1?.val} ${instr.op?.val} ${instr.arg2?.val} goto ${instr.result?.val}`
    }
}

export default function BlockNode({ data }) {

    return (
        <div>
            <p>ID: {data.block.id}, {data.label}</p>
            {data.block.instructions.map(i => <p>{instructionToString(i)}</p>)}
        </div>
    );

}