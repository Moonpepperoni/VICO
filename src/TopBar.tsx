// TopBar Component
import React from "react";
import { Navbar, Container } from 'react-bootstrap';

export const TopBar: React.FC = () => (
    <Navbar bg="dark" variant="dark">
        <Container fluid className="justify-content-center">
            <Navbar.Brand className="mb-0 h1 fs-2 fw-bold">VICO</Navbar.Brand>
        </Container>
    </Navbar>
);