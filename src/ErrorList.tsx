import React from "react";
import type {TacError} from "./tac/tac-errors.ts";

interface ErrorListProps {
    errors: Array<TacError>;
}

export const ErrorList: React.FC<ErrorListProps> = ({errors}) => {
    return (<div
            className="border rounded bg-light"
            style={{
                maxHeight: errors.length > 0 ? '150px' : 'auto',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div className={"p-2 text-white" + (errors.length > 0 ? ' bg-danger' : 'bg-secondary-subtle')}>
                <strong>Fehler ({errors.length})</strong>
            </div>
            {errors.length > 0 ? (<ul className="list-group list-group-flush mb-0">
                    {errors.map((error, index) => {

                        return (<li
                                key={index}
                                className="list-group-item list-group-item-danger d-flex justify-content-between align-items-center"
                            >
                                <span>{error.reason}</span>
                                <span className="badge bg-secondary">Zeile {error.line}</span>
                            </li>);
                    })}
                </ul>) : (<div className="p-3 text-center text-muted">
                    Keine Fehler gefunden
                </div>)}
        </div>);
};
