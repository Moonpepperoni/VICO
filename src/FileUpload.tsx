// File Upload Component
import React from "react";
import { Container, Row, Col, Card, Form, Alert } from 'react-bootstrap';

export const FileUpload: React.FC<{
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
}> = ({ onFileUpload }) => (
    <Container fluid id="file-upload-section" className="py-5 bg-light">
        <Row className="justify-content-center">
            <Col lg={6}>
                <Card className="shadow">
                    <Card.Header className="bg-primary text-white text-center">
                        <h3 className="mb-0">Datei hochladen</h3>
                    </Card.Header>
                    <Card.Body>
                        <div className="text-center mb-4">
                            <i className="display-1 text-muted">📄</i>
                        </div>
                        <Form.Group className="mb-3">
                            <Form.Label htmlFor="fileInput">
                                Wählen Sie eine .tac Datei aus:
                            </Form.Label>
                            <Form.Control
                                type="file"
                                id="fileInput"
                                accept=".tac"
                                onChange={onFileUpload}
                            />
                        </Form.Group>
                        <Alert variant="info">
                            <small>
                                <strong>Hinweis:</strong> Nur .tac Dateien werden unterstützt.
                                Diese sollten gültigen 3-Adress-Code enthalten.
                            </small>
                        </Alert>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    </Container>
);