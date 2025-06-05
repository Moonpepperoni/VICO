import { Handle, Position } from "@xyflow/react";

function instructionToString(instr) {

    console.log("calling to string");
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

export default function InstructionNode({ data }) {

    return (
        <div>
            <Handle type="target" position={Position.Top} id='prev' />
            <Handle type="target" position={Position.Top} id='backin' style={{ left: 0 }} />
            <p>{`${data.instruction.label}| ${instructionToString(data.instruction)}, ${data.label}`}</p>
            <Handle type="source" position={Position.Bottom} id='backout' style={{ left: 0 }} />
            <Handle type="source" position={Position.Bottom} id='next' />

        </div>
    );

}