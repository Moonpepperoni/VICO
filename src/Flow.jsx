import { ReactFlow, Controls, Background, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import BlockNode from './BlockNode';
import EntryNode from './EntryNode';
import EndNode from './EndNode';
import { ElkEdge } from './ElkEdge';

const nodeTypes = {
    block: BlockNode,
    entry: EntryNode,
    end: EndNode,
}
const edgeTypes = {
    elk: ElkEdge,
}

function Flow({ nodes = [], edges = [], onNodesChange }) {
    return (
        <div style={{ height: '100%' }}>
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} fitView>
                <Background />
                <Controls showInteractive={false} />
                <MiniMap></MiniMap>
            </ReactFlow>
        </div>
    );
}

export default Flow;