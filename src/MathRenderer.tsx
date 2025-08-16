import React from 'react';
import { MathJax } from 'better-react-mathjax';

interface MathRendererProps {
    formula: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ formula }) => {
    return (
        <div className="math-container" style={{
            overflowX: 'auto',
            overflowY: 'visible', // allow long formulas to spill onto multiple lines
            maxWidth: '100%',  // allow the container to expand to fit its content
            display: 'block',   // prevent inline rendering from overflowing
            paddingBottom: '20px', // allow space for the scroll bar
        }}>
            <MathJax inline={false} >{formula}</MathJax>
        </div>
    );
};