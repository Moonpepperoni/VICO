import { Handle, Position } from "@xyflow/react";



export default function EntryNode() {

    return (
        <div>
            <p>ENTRY</p>
            <Handle type="source" position={Position.Bottom} id='next' />
        </div>
    );

}