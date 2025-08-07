import { useReactFlow, useNodesInitialized } from '@xyflow/react';
import { useEffect, useState } from 'react';
import {layoutElements} from "./layout.ts";

const options = {
    includeHiddenNodes: false,
};

interface LayoutHookProps {
    backEdges : Set<string>,
}

export default function useLayout({backEdges} : LayoutHookProps ) {
    const { getNodes, getEdges } = useReactFlow();
    const nodesInitialized = useNodesInitialized(options);
    const [layoutedNodes, setLayoutedNodes] = useState(getNodes());
    const [layoutedEdges, setLayoutedEdges] = useState(getEdges());

    // not passing backEdges to the dependency array is only safe because we know that the backEdges can never change
    // unless the entire outer component is rerendered, which then auto passed the new edges here
    // CARE: if graphs get editable in the future, this might break
    useEffect(() => {
        if (nodesInitialized) {
            layoutElements(getNodes(), getEdges(),backEdges, setLayoutedNodes, setLayoutedEdges);
        }
    }, [nodesInitialized]);

    return {layoutedNodes, layoutedEdges};
}