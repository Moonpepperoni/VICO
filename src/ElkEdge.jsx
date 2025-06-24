import { BaseEdge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

const style = {
    strokeWidth: 2,
    stroke: '#FF0072',
}

const internal = {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: '#FF0072',
}


export function ElkEdge({ id, data, markerEnd }) {
    const path = data.points
        .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
        .join(' ');

    console.log(markerEnd);

    console.log(internal);
    return <BaseEdge id={id} style={style} path={path} markerEnd={markerEnd} />;
}