import {BaseEdge, type Edge, type EdgeProps} from '@xyflow/react';

type FlowEdgeData = Edge<{ points: Array<{x: number, y: number}> | undefined, isBackEdge: boolean }, 'flow'>;

const style = {
    strokeWidth: 2,
    stroke: '#FF0072',
}

const markerEnd = 'url(\'#1__color=#FF0072&height=20&type=arrowclosed&width=20\')'

export default function FlowEdge({
                                     id,
                                     data,
                                 }: EdgeProps<FlowEdgeData>) {
    const edgePath = data?.points?.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
        .join(' ') ?? '';

    return < BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd}/>;
}
