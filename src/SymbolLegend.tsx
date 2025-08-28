import React from "react";
import {Alert, AlertHeading} from "react-bootstrap";
import {ChangedBadge} from "./ChangedBadge.tsx";
import {LookAtBadge} from "./LookAtBadge.tsx";

export const SymbolLegend : React.FC = () => {
    return <Alert data-cy={'graph-symbols-legend'} variant="info">
        <small>
            <AlertHeading>Legende</AlertHeading>
            <p><ChangedBadge show={true}/> Wert geändert</p>
            <p><LookAtBadge show={true}/> Wert berücksichtigt</p>
        </small>
    </Alert>

}