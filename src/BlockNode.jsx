import { Handle, Position } from "@xyflow/react";

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

// TODO: extract this display logic out, so that names and descriptions are defined outside this node
// we gain better reusability from this node
export default function BlockNode({ data }) {

    return (
        <div>
            <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ alignSelf: "flex-end" }}>liveness in: {"{"}{data.liveness.in.join(", ")}{"}"}</p>
                <h2 style={{ marginLeft: '10px' }}>Block {data.block.id}</h2>
            </div>
            <div style={{ backgroundColor: 'black', height: "2px" }}></div>
            <div style={{ display: 'flex' }}>
                <div style={{ marginRight: "20px" }}>
                    <h3 style={{ borderBottom: "2px dashed black" }}>Code</h3>
                    {data.block.instructions.map(i => <p><code>{instructionToString(i)}</code></p>)}
                </div>
                <div style={{ marginLeft: "20px" }}>
                    <h3 style={{ borderBottom: "2px dashed black" }}>Liveness</h3>
                    <p>use: {"{"}{data.liveness.use.join(", ")}{"}"}</p>
                    <p>def: {"{"}{data.liveness.def.join(", ")}{"}"}</p>
                </div>
            </div>
            <div style={{ height: "2px", backgroundColor: 'black' }}></div>
            <p>liveness out: {"{"}{data.liveness.out.join(", ")}{"}"}</p>
            <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />

        </div>
    );

}