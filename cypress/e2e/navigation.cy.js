describe('Application Navigation', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('should open welcome page', () => {
        cy.get('h1').should('contain', 'Willkommen bei VICO');
        cy.get('[data-cy="start-example-button"]').should('be.visible');
        cy.get('[data-cy="start-scroll-upload-button"]').should('be.visible');
    });

    it('should navigate to editor', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="code-editor-area"]').should('be.visible');
        cy.get('[data-cy="error-list"]').should('be.visible');
        cy.get('[data-cy="error-list-no-errors"]').should('be.visible');
    });

    it('should show algorithm selection menu', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
    });

    it('should be able to hide algorithm selection menu', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
        cy.get('[data-cy="algo-menu-toggle"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('not.be.visible');
    });

    it('should be able to show algorithm selection menu after hiding', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
        cy.get('[data-cy="algo-menu-toggle"]').click();
        cy.get('[data-cy="algo-menu-toggle"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
    });

    it('should be able to go back to start', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
        cy.get('[data-cy="algo-menu-back-button"]').should('be.visible').click();
    });

    it('should be able to select an algorithm', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
        cy.get('[data-cy="algo-menu-flow-button-group"]').should('have.length.at.least', 1);
        cy.get('[data-cy="algo-menu-flow-button-group"]').first().click();
        cy.get('[data-cy="pre-algo-modal"]').should('be.visible');
    });

    it('should be able to select an algorithm', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
        cy.get('[data-cy="algo-menu-flow-button-group"]').should('have.length.at.least', 1);
        cy.get('[data-cy="algo-menu-flow-button-group"]').first().click();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
    });

    it('should show algorithm display after start', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
        cy.get('[data-cy="algo-menu-flow-button-group"]').should('have.length.at.least', 1);
        cy.get('[data-cy="algo-menu-flow-button-group"]').first().click();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        cy.get('[data-cy="algo-graph-display"]').should('be.visible');
    });

    it('should be able to stop a visualisation algorithm', () => {
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="algo-menu-panel"]').should('be.visible');
        cy.get('[data-cy="algo-menu-flow-button-group"]').should('have.length.at.least', 1);
        cy.get('[data-cy="algo-menu-flow-button-group"]').first().click();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        cy.get('[data-cy="algo-control-stop-button"]').should('be.visible').click();
        cy.get('[data-cy="code-editor-area"]').should('be.visible');
    })
});