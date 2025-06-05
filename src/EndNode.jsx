import { Handle, Position } from "@xyflow/react";



export default function EndNode() {


    return (
        <div>
            <Handle type="target" position={Position.Top} id='prev' />
            <p>END</p>
        </div>
    );

}