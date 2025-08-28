describe('Code-Editor und Fehleranzeige', () => {
    beforeEach(() => {
        cy.visit('/');
        cy.get('[data-cy="start-example-button"]').click();
    });

    it('sollte den Code-Editor anzeigen und Änderungen speichern können', () => {

        cy.get('[data-cy="code-editor-area"]').should('be.visible');


        // leider muss hier css selector benutzt werden, da kein direkter zugriff auf den inhalt von code mirror geht
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');

        const newCode = 'a = 5\nb = 10\nc = a + b';
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(newCode);


        cy.get('[data-cy="code-editor-save-button"]').should('not.be.disabled');


        cy.get('[data-cy="code-editor-save-button"]').click();


        cy.get('[data-cy="code-editor-save-button"]').should('be.disabled');
    });

    it('sollte Fehler korrekt anzeigen, wenn der Code ungültig ist', () => {

        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');

        const invalidCode = 'a = \nb = 10\nc = a +';
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(invalidCode);


        cy.get('[data-cy="code-editor-save-button"]').click();


        cy.get('[data-cy="error-list"]').should('be.visible');

        cy.get('[data-cy="error-list-item"]').should('have.length', 2);

        cy.get('[data-cy="error-list-items"]').should('contain', '1');
        cy.get('[data-cy="error-list-items"]').should('contain', '3');
    });

    it('sollte die Datei anzeigen, mit der gearbeitet wird', () => {

        cy.contains('Datei:').should('be.visible');

    });

    it('sollte die Zeilennummern im Editor anzeigen', () => {

        cy.get('[data-cy="code-editor-area"]').find('.cm-gutters').should('be.visible');
        cy.get('[data-cy="code-editor-area"]').find('.cm-lineNumbers').should('be.visible');
    });

    it('sollte die aktive Zeile hervorheben', () => {

        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();


        cy.get('[data-cy="code-editor-area"]').find('.cm-activeLine').should('exist');
    });

    it('sollte den Programmablauf nach dem Speichern eines gültigen Codes starten können', () => {

        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');

        const validCode = 'a = 5\nb = 10\nc = a + b';
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(validCode);


        cy.get('[data-cy="code-editor-save-button"]').click();

        cy.get('[data-cy="algo-menu-select-liveness-single-instruction"]').should('be.enabled').click();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        cy.get('[data-cy="algo-graph-display"]').should('be.visible');
    });

    it('sollte den Programmablauf nach dem Speichern eines ungültigen Codes nicht starten können', () => {

        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');

        const invalidCode = 'a = \nb = 10\nc = a + b';
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(invalidCode);


        cy.get('[data-cy="code-editor-save-button"]').click();

        cy.get('[data-cy="algo-menu-select-liveness-single-instruction"]').should('be.disabled');
    });

    it('sollte die Fehleranzeige leeren, wenn ein gültiger Code gespeichert wird', () => {

        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');

        const invalidCode = 'a = \nb = 10\nc = a +';
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(invalidCode);
        cy.get('[data-cy="code-editor-save-button"]').click();


        cy.get('[data-cy="error-list"] ').should('exist');


        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');

        const validCode = 'a = 5\nb = 10\nc = a + b';
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(validCode);
        cy.get('[data-cy="code-editor-save-button"]').click();

        cy.get('[data-cy="error-list"] [data-cy="error-item"]').should('not.exist');
    });
});
