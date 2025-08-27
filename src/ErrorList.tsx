import React from "react";
import {Badge, Card, ListGroup} from 'react-bootstrap';

interface ErrorListProps {
    errors: Array<{line: number, reason : string}>;
}

export const ErrorList: React.FC<ErrorListProps> = ({errors}) => {
    return (
        <Card
            data-cy='error-list'
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
                    <ListGroup data-cy="error-list-items" variant="flush" className="h-100">
                        {errors.map((error, index) => (
                            <ListGroup.Item
                                data-cy="error-list-item"
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
                    <Card.Body data-cy="error-list-no-errors" className="text-center text-muted">
                        Keine Fehler gefunden
                    </Card.Body>
                )}
            </div>
        </Card>
    );
};