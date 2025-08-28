describe('Visualisation of liveness single instruction', () => {
    describe('basic interactions', () => {

        const code = 'a = 5\nb = 10\nc = a + b';

        // setup custom code
        beforeEach(() => {
            cy.visit('/');
            cy.get('[data-cy="start-example-button"]').click();
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
            cy.get('[data-cy="code-editor-save-button"]').click();
            cy.get('[data-cy="algo-menu-select-liveness-single-instruction"]').should('be.enabled').click();
            cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        });

        it('should show nodes', () => {
            cy.get('[data-cy="algo-graph-display"]').should('be.visible');
            // three instructions + entry / exit node
            cy.get('[data-cy="flow-node"]').should('have.length', 5);
        });

        it('should not be able step back at beginning', () => {
            cy.get('[data-cy="algo-control-step-back-button"]').should('be.disabled');
        });

        it('should be able to step forward', () => {
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.enabled').click();
        });

        it('should be able to step back after stepping forward', () => {
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-control-step-back-button"]').should('be.enabled').click();
        });

        it('should be able to step to end and not step further', () => {
            cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.disabled');
            cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.disabled');
        });


        it('should be able to end the algorithm', () => {
            cy.get('[data-cy="algo-control-stop-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-graph-display"]').should('not.exist');
        });

        it('should have explanation text', () => {
            cy.get('[data-cy="algo-step-explanation-line"]').should('have.length.at.least', 1);
        });

        it('nodes should have def data', () => {
            cy.get('[data-cy="flow-node-algo-specific-values"]').each(($el) => {
                expect($el.text()).contains('def');
            });
        });

        it('nodes should have use data', () => {
            cy.get('[data-cy="flow-node-algo-specific-values"]').each(($el) => {
                expect($el.text()).contains('use');
            });
        });

        it('all nodes should have in set', () => {
            cy.get('[data-cy="flow-node"]').each(($el) => {
                expect($el.text()).contains('in');
            });
        });

        it('all nodes should have out set', () => {
            cy.get('[data-cy="flow-node"]').each(($el) => {
                expect($el.text()).contains('out');
            });
        });

    });


    it('should set live out for exit correctly', () => {
        const code = 'a = 5\nb = 10\nc = a + b';

        cy.visit('/');
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
        cy.get('[data-cy="code-editor-save-button"]').click();
        cy.get('[data-cy="algo-menu-select-liveness-single-instruction"]').should('be.enabled').click();
        cy.get('[data-cy="pre-algo-modal-check-all-live-out"]').should('be.visible').check();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();

        cy.get('[data-cy="flow-node"]').each(($el) => {
            if($el.text().includes('EXIT')){
                expect($el.text()).contains('a');
                expect($el.text()).contains('b');
                expect($el.text()).contains('c');

            }
        });
    });

    it('should propagate liveness of a correctly', () => {

        const code = 'a = 5\nb = 10\nc = a + b';


        cy.visit('/');
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
        cy.get('[data-cy="code-editor-save-button"]').click();
        cy.get('[data-cy="algo-menu-select-liveness-single-instruction"]').should('be.enabled').click();
        cy.get('[data-cy="pre-algo-modal-check-all-live-out"]').should('be.visible').click();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.enabled').click();

        cy.get('[data-cy="flow-node"]').each(($el) => {
            if(!($el.text().includes('ENTRY'))){
                cy.wrap($el).get('[data-cy="flow-node-out-set"]').contains('a');
                cy.wrap($el).get('[data-cy="flow-node-in-set"]').contains('a');
            }
        });

    });

});

describe('Visualisation of liveness basic blocks', () => {

    const code = `
        a = 5
        b = 10
        if a < 10 goto ELSE
        c = a + b
        goto END
        ELSE: c = 0
        END: result = c`;


    describe('basic interactions', () => {


        // setup custom code
        beforeEach(() => {
            cy.visit('/');
            cy.get('[data-cy="start-example-button"]').click();
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
            cy.get('[data-cy="code-editor-save-button"]').click();
            cy.get('[data-cy="algo-menu-select-liveness-basic-blocks"]').should('be.enabled').click();
            cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        });

        it('should show nodes', () => {
            cy.get('[data-cy="algo-graph-display"]').should('be.visible');
            // 4 basic blocks + entry / exit node
            cy.get('[data-cy="flow-node"]').should('have.length', 6);
        });

        it('should not be able step back at beginning', () => {
            cy.get('[data-cy="algo-control-step-back-button"]').should('be.disabled');
        });

        it('should be able to step forward', () => {
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.enabled').click();
        });

        it('should be able to step back after stepping forward', () => {
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-control-step-back-button"]').should('be.enabled').click();
        });

        it('should be able to step to end and not step further', () => {
            cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.disabled');
            cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.disabled');
        });


        it('should be able to end the algorithm', () => {
            cy.get('[data-cy="algo-control-stop-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-graph-display"]').should('not.exist');
        });

        it('should have explanation text', () => {
            cy.get('[data-cy="algo-step-explanation-line"]').should('have.length.at.least', 1);
        });

        it('nodes should have def data', () => {
            cy.get('[data-cy="flow-node-algo-specific-values"]').each(($el) => {
                expect($el.text()).contains('def');
            });
        });

        it('nodes should have use data', () => {
            cy.get('[data-cy="flow-node-algo-specific-values"]').each(($el) => {
                expect($el.text()).contains('use');
            });
        });

        it('all nodes should have in set', () => {
            cy.get('[data-cy="flow-node"]').each(($el) => {
                expect($el.text()).contains('in');
            });
        });

        it('all nodes should have out set', () => {
            cy.get('[data-cy="flow-node"]').each(($el) => {
                expect($el.text()).contains('out');
            });
        });

    });

    it('should set live out for exit correctly', () => {
        cy.visit('/');
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
        cy.get('[data-cy="code-editor-save-button"]').click();
        cy.get('[data-cy="algo-menu-select-liveness-single-instruction"]').should('be.enabled').click();
        cy.get('[data-cy="pre-algo-modal-check-all-live-out"]').should('be.visible').check();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();

        cy.get('[data-cy="flow-node"]').each(($el) => {
            if($el.text().includes('EXIT')){
                expect($el.text()).contains('a');
                expect($el.text()).contains('b');
                expect($el.text()).contains('c');
                expect($el.text()).contains('result');
            }
        });
    });

    it('should propagate liveness of "a" correctly', () => {
        cy.visit('/');
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
        cy.get('[data-cy="code-editor-save-button"]').click();
        cy.get('[data-cy="algo-menu-select-liveness-single-instruction"]').should('be.enabled').click();
        cy.get('[data-cy="pre-algo-modal-check-all-live-out"]').should('be.visible').click();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.enabled').click();

        cy.get('[data-cy="flow-node"]').each(($el) => {
            if(!($el.text().includes('ENTRY'))){
                cy.wrap($el).get('[data-cy="flow-node-out-set"]').contains('a');
                cy.wrap($el).get('[data-cy="flow-node-in-set"]').contains('a');
            }
        });

    });
});

describe('Visualisation of reaching definitions', () => {
    const code = 'a = 5\nb = 10\nc = a + b';
    describe('basic interactions', () => {




        // setup custom code
        beforeEach(() => {
            cy.visit('/');
            cy.get('[data-cy="start-example-button"]').click();
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
            cy.get('[data-cy="code-editor-save-button"]').click();
            cy.get('[data-cy="algo-menu-select-reaching-definitions-basic-blocks"]').should('be.enabled').click();
            cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        });

        it('should show nodes', () => {
            cy.get('[data-cy="algo-graph-display"]').should('be.visible');
            // 1 basic block + entry / exit node
            cy.get('[data-cy="flow-node"]').should('have.length', 3);
        });

        it('should not be able step back at beginning', () => {
            cy.get('[data-cy="algo-control-step-back-button"]').should('be.disabled');
        });

        it('should be able to step forward', () => {
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.enabled').click();
        });

        it('should be able to step back after stepping forward', () => {
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-control-step-back-button"]').should('be.enabled').click();
        });

        it('should be able to step to end and not step further', () => {
            cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.disabled');
            cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.disabled');
        });


        it('should be able to end the algorithm', () => {
            cy.get('[data-cy="algo-control-stop-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-graph-display"]').should('not.exist');
        });

        it('should have explanation text', () => {
            cy.get('[data-cy="algo-step-explanation-line"]').should('have.length.at.least', 1);
        });

        it('nodes should have dgen data', () => {
            cy.get('[data-cy="flow-node-algo-specific-values"]').each(($el) => {
                expect($el.text()).contains('gen');
            });
        });

        it('nodes should have kill data', () => {
            cy.get('[data-cy="flow-node-algo-specific-values"]').each(($el) => {
                expect($el.text()).contains('kill');
            });
        });

        it('all nodes should have in set', () => {
            cy.get('[data-cy="flow-node"]').each(($el) => {
                expect($el.text()).contains('in');
            });
        });

        it('all nodes should have out set', () => {
            cy.get('[data-cy="flow-node"]').each(($el) => {
                expect($el.text()).contains('out');
            });
        });

    });

    it('should set reaching out and in of exit correctly', () => {
        cy.visit('/');
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
        cy.get('[data-cy="code-editor-save-button"]').click();
        cy.get('[data-cy="algo-menu-select-reaching-definitions-basic-blocks"]').should('be.enabled').click();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();

        cy.get('[data-cy="flow-node-out-set"]').each(($el) => {
            if ($el.text().includes('EXIT')) {
                cy.wrap($el).get('[data-cy="flow-node-in-set"]').contains('d1');
                cy.wrap($el).get('[data-cy="flow-node-in-set"]').contains('d2');
                cy.wrap($el).get('[data-cy="flow-node-in-set"]').contains('d3');

                cy.wrap($el).get('[data-cy="flow-node-out-set"]').contains('d1');
                cy.wrap($el).get('[data-cy="flow-node-out-set"]').contains('d2');
                cy.wrap($el).get('[data-cy="flow-node-out-set"]').contains('d3');
            }
        })
    })
});


describe('Visualisation of constant propagation', () => {

    const code = 'a = 5\nb = 10\nc = a + b\na = c\n';

    describe('basic interactions', () => {
        // setup custom code
        beforeEach(() => {
            cy.visit('/');
            cy.get('[data-cy="start-example-button"]').click();
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
            cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
            cy.get('[data-cy="code-editor-save-button"]').click();
            cy.get('[data-cy="algo-menu-select-constant-propagation-basic-blocks"]').should('be.enabled').click();
            cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();
        });

        it('should show nodes', () => {
            cy.get('[data-cy="algo-graph-display"]').should('be.visible');
            // 1 basic block + entry / exit node
            cy.get('[data-cy="flow-node"]').should('have.length', 3);
        });

        it('should not be able step back at beginning', () => {
            cy.get('[data-cy="algo-control-step-back-button"]').should('be.disabled');
        });

        it('should be able to step forward', () => {
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.enabled').click();
        });

        it('should be able to step back after stepping forward', () => {
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-control-step-back-button"]').should('be.enabled').click();
        });

        it('should be able to step to end and not step further', () => {
            cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-control-step-forward-button"]').should('be.disabled');
            cy.get('[data-cy="algo-control-step-to-end-button"]').should('be.disabled');
        });

        it('should be able to end the algorithm', () => {
            cy.get('[data-cy="algo-control-stop-button"]').should('be.enabled').click();
            cy.get('[data-cy="algo-graph-display"]').should('not.exist');
        });

        it('should have explanation text', () => {
            cy.get('[data-cy="algo-step-explanation-line"]').should('have.length.at.least', 1);
        });

        it('all nodes should have in set', () => {
            cy.get('[data-cy="flow-node"]').each(($el) => {
                expect($el.text()).contains('in');
            });
        });

        it('all nodes should have out set', () => {
            cy.get('[data-cy="flow-node"]').each(($el) => {
                expect($el.text()).contains('out');
            });
        });

    });

    it('should set constant out and in of exit correctly', () => {
        cy.visit('/');
        cy.get('[data-cy="start-example-button"]').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').click();
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type('{selectall}{backspace}');
        cy.get('[data-cy="code-editor-area"]').find('.cm-content').type(code);
        cy.get('[data-cy="code-editor-save-button"]').click();
        cy.get('[data-cy="algo-menu-select-reaching-definitions-basic-blocks"]').should('be.enabled').click();
        cy.get('[data-cy="pre-algo-modal-start-button"]').should('be.visible').click();

        cy.get('[data-cy="flow-node-out-set"]').each(($el) => {
            if ($el.text().includes('EXIT')) {
                cy.wrap($el).get('[data-cy="flow-node-in-set"]').contains('a: NAC');
                cy.wrap($el).get('[data-cy="flow-node-in-set"]').contains('b: 10');
                cy.wrap($el).get('[data-cy="flow-node-in-set"]').contains('c: 15');

                cy.wrap($el).get('[data-cy="flow-node-out-set"]').contains('a: NAC');
                cy.wrap($el).get('[data-cy="flow-node-out-set"]').contains('b: 10');
                cy.wrap($el).get('[data-cy="flow-node-out-set"]').contains('c: 15');
            }
        })
    })

});