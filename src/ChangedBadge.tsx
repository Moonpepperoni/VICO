import React from "react";
import {Badge} from "react-bootstrap";

interface ChangedBadgeProps {
    show : boolean,
}

export const ChangedBadge : React.FC<ChangedBadgeProps> = ({show}) => {
    return <Badge style={{display: (show) ? 'inline-block': 'none', textAlign: 'center'}} bg={"success"} className="py-1">
        <svg height="20px" width="20px" viewBox="0 0 24 24" fill="none">
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
                <path id="primary" d="M5.07,8A8,8,0,0,1,20,12" style={{fill: 'none', stroke: '#ffffff', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2}}></path>
                <path id="primary-2" data-name="primary" d="M18.93,16A8,8,0,0,1,4,12"
                      style={{fill: 'none', stroke: '#ffffff', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2}}></path>
                <polyline id="primary-3" data-name="primary" points="5 3 5 8 10 8"
                          style={{fill: 'none', stroke: '#ffffff', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2}}></polyline>
                <polyline id="primary-4" data-name="primary" points="19 21 19 16 14 16"
                          style={{fill: 'none', stroke: '#ffffff', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2}}></polyline>
            </g>
        </svg>
    </Badge>
}