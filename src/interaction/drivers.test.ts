// drivers.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { VisualisationDriver, QuizDriver, type CurrentQuestionData } from './drivers';

describe('VisualisationDriver', () => {
    let driver: VisualisationDriver;

    beforeEach(() => {
        driver = new VisualisationDriver();
    });

    it('should always allow advancing', () => {
        expect(driver.allowedToAdvance()).toBe(true);
    });

    it('should always show in sets of nodes', () => {
        expect(driver.shouldShowInSetOfNode(1)).toBe(true);
        expect(driver.shouldShowInSetOfNode(2)).toBe(true);
    });

    it('should always show out sets of nodes', () => {
        expect(driver.shouldShowOutSetOfNode(1)).toBe(true);
        expect(driver.shouldShowOutSetOfNode(2)).toBe(true);
    });

    it('should always show looked at values', () => {
        expect(driver.shouldShowLookedAtValuesOfNodes()).toBe(true);
    });

    it('should always show explanation', () => {
        expect(driver.shouldShowExplanation()).toBe(true);
    });
});

describe('QuizDriver', () => {
    // Test with a simple number array comparator
    const arrayComparator = (solution: number[], test: number[]): boolean => {
        if (solution.length !== test.length) return false;
        return solution.every((val, idx) => val === test[idx]);
    };

    let driver: QuizDriver<number[]>;

    beforeEach(() => {
        driver = new QuizDriver<number[]>(arrayComparator);
    });

    describe('initial state', () => {
        it('should initialize with new-question state', () => {
            expect(driver.state).toBe('new-question');
        });

        it('should initialize with "none" area', () => {
            expect(driver.canSubmitSolution()).toBe(false);
            expect(driver.canRequestSolution()).toBe(false);
        });
    });

    describe('setNewQuestion', () => {
        it('should set a new question with "in" area', () => {
            const question: CurrentQuestionData<number[]> = {
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            };

            driver.setNewQuestion(question);

            expect(driver.state).toBe('new-question');
            expect(driver.canSubmitSolution()).toBe(true);
            expect(driver.canRequestSolution()).toBe(true);
        });

        it('should set a new question with "out" area', () => {
            const question: CurrentQuestionData<number[]> = {
                area: 'out',
                currentNodeId: 2,
                solution: [4, 5, 6]
            };

            driver.setNewQuestion(question);

            expect(driver.state).toBe('new-question');
            expect(driver.canSubmitSolution()).toBe(true);
            expect(driver.canRequestSolution()).toBe(true);
        });

        it('should reset to "none" area', () => {
            // First set a valid question
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });

            // Then reset to none
            driver.setNewQuestion({ area: 'none' });

            expect(driver.state).toBe('new-question');
            expect(driver.canSubmitSolution()).toBe(false);
            expect(driver.canRequestSolution()).toBe(false);
        });

        it('should reset state to new-question when setting a new question', () => {
            // Set to correct state
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestSolution();
            expect(driver.state).toBe('correct');

            // Set new question
            driver.setNewQuestion({
                area: 'out',
                currentNodeId: 2,
                solution: [4, 5, 6]
            });

            expect(driver.state).toBe('new-question');
        });
    });

    describe('allowedToAdvance', () => {
        it('should only allow advancing in correct state', () => {
            expect(driver.allowedToAdvance()).toBe(false);

            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            expect(driver.allowedToAdvance()).toBe(false);

            driver.requestHelp();
            expect(driver.allowedToAdvance()).toBe(false);

            driver.requestSolution();
            expect(driver.allowedToAdvance()).toBe(true);
        });
    });

    describe('shouldShowInSetOfNode', () => {
        beforeEach(() => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
        });

        it('should hide in set for the current node in question', () => {
            expect(driver.shouldShowInSetOfNode(1)).toBe(false);
        });

        it('should show in set for other nodes', () => {
            expect(driver.shouldShowInSetOfNode(2)).toBe(true);
        });

        it('should show in set for all nodes when in correct state', () => {
            driver.requestSolution();
            expect(driver.shouldShowInSetOfNode(1)).toBe(true);
            expect(driver.shouldShowInSetOfNode(2)).toBe(true);
        });

        it('should show in set for all nodes when question is for out set', () => {
            driver.setNewQuestion({
                area: 'out',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            expect(driver.shouldShowInSetOfNode(1)).toBe(true);
        });
    });

    describe('shouldShowOutSetOfNode', () => {
        beforeEach(() => {
            driver.setNewQuestion({
                area: 'out',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
        });

        it('should hide out set for the current node in question', () => {
            expect(driver.shouldShowOutSetOfNode(1)).toBe(false);
        });

        it('should show out set for other nodes', () => {
            expect(driver.shouldShowOutSetOfNode(2)).toBe(true);
        });

        it('should show out set for all nodes when in correct state', () => {
            driver.requestSolution();
            expect(driver.shouldShowOutSetOfNode(1)).toBe(true);
            expect(driver.shouldShowOutSetOfNode(2)).toBe(true);
        });

        it('should show out set for all nodes when question is for in set', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            expect(driver.shouldShowOutSetOfNode(1)).toBe(true);
        });
    });

    describe('shouldShowLookedAtValuesOfNodes', () => {
        it('should show looked at values when area is none', () => {
            driver.setNewQuestion({ area: 'none' });
            expect(driver.shouldShowLookedAtValuesOfNodes()).toBe(true);
        });

        it('should not show looked at values in new-question state with active question', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            expect(driver.shouldShowLookedAtValuesOfNodes()).toBe(false);
        });

        it('should show looked at values in help state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestHelp();
            expect(driver.shouldShowLookedAtValuesOfNodes()).toBe(true);
        });

        it('should show looked at values in correct state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestSolution();
            expect(driver.shouldShowLookedAtValuesOfNodes()).toBe(true);
        });
    });

    describe('shouldShowExplanation', () => {
        it('should show explanation when area is none', () => {
            driver.setNewQuestion({ area: 'none' });
            expect(driver.shouldShowExplanation()).toBe(true);
        });

        it('should not show explanation in new-question state with active question', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            expect(driver.shouldShowExplanation()).toBe(false);
        });

        it('should show explanation in help state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestHelp();
            expect(driver.shouldShowExplanation()).toBe(true);
        });

        it('should show explanation in correct state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestSolution();
            expect(driver.shouldShowExplanation()).toBe(true);
        });
    });

    describe('requestHelp', () => {
        it('should transition to help state from new-question state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestHelp();
            expect(driver.state).toBe('help');
        });

        it('should not transition to help state from correct state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestSolution();
            driver.requestHelp();
            expect(driver.state).toBe('correct');
        });
    });

    describe('trySolve', () => {
        beforeEach(() => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
        });

        it('should set correct state when solution is correct', () => {
            driver.trySolve([1, 2, 3]);
            expect(driver.state).toBe('correct');
        });

        it('should not change state when solution is incorrect', () => {
            driver.trySolve([1, 2, 4]);
            expect(driver.state).toBe('new-question');
        });

        it('should do nothing when area is none', () => {
            driver.setNewQuestion({ area: 'none' });
            driver.trySolve([1, 2, 3]);
            expect(driver.state).toBe('new-question');
        });
    });

    describe('canSubmitSolution', () => {
        it('should allow submitting when in new-question state with active question', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            expect(driver.canSubmitSolution()).toBe(true);
        });

        it('should allow submitting when in help state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestHelp();
            expect(driver.canSubmitSolution()).toBe(true);
        });

        it('should not allow submitting when in correct state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestSolution();
            expect(driver.canSubmitSolution()).toBe(false);
        });

        it('should not allow submitting when area is none', () => {
            driver.setNewQuestion({ area: 'none' });
            expect(driver.canSubmitSolution()).toBe(false);
        });
    });

    describe('requestSolution', () => {
        it('should set state to correct', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestSolution();
            expect(driver.state).toBe('correct');
        });
    });

    describe('canRequestSolution', () => {
        it('should allow requesting solution in new-question state with active question', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            expect(driver.canRequestSolution()).toBe(true);
        });

        it('should not allow requesting solution in help state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestHelp();
            expect(driver.canRequestSolution()).toBe(false);
        });

        it('should not allow requesting solution in correct state', () => {
            driver.setNewQuestion({
                area: 'in',
                currentNodeId: 1,
                solution: [1, 2, 3]
            });
            driver.requestSolution();
            expect(driver.canRequestSolution()).toBe(false);
        });

        it('should not allow requesting solution when area is none', () => {
            driver.setNewQuestion({ area: 'none' });
            expect(driver.canRequestSolution()).toBe(false);
        });
    });
});