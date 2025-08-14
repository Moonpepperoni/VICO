import React from "react";
import type {TacError} from "./tac/tac-errors.ts";
import {Badge, Card, ListGroup} from 'react-bootstrap';

interface ErrorListProps {
    errors: Array<TacError>;
}

export const ErrorList: React.FC<ErrorListProps> = ({errors}) => {
    return (
        <Card
            className="h-100"
            style={{
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Card.Header
                className={errors.length > 0 ? 'bg-danger text-white' : 'bg-secondary-subtle text-black'}
                style={{ flex: '0 0 auto' }}
            >
                <strong>Fehler ({errors.length})</strong>
            </Card.Header>

            <div style={{
                flex: '1 1 auto',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {errors.length > 0 ? (
                    <ListGroup variant="flush" className="h-100">
                        {errors.map((error, index) => (
                            <ListGroup.Item
                                key={index}
                                variant="danger"
                                className="d-flex justify-content-between align-items-center"
                            >
                                <span>{error.reason}</span>
                                <Badge bg="secondary">Zeile {error.line}</Badge>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                ) : (
                    <Card.Body className="text-center text-muted">
                        Keine Fehler gefunden
                    </Card.Body>
                )}
            </div>
        </Card>
    );
};