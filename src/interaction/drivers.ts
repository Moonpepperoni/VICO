export interface InteractionDriver {

    allowedToAdvance(): boolean,

    shouldShowInSetOfNode(nodeId: number): boolean,

    shouldShowOutSetOfNode(nodeId: number): boolean,

    shouldShowLookedAtValuesOfNodes(): boolean,

    shouldShowExplanation(): boolean,
}


export class VisualisationDriver implements InteractionDriver {
    
    allowedToAdvance(): boolean {
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    shouldShowInSetOfNode(_nodeId: number): boolean {
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    shouldShowOutSetOfNode(_nodeId: number): boolean {
        return true;
    }
    
    shouldShowLookedAtValuesOfNodes(): boolean {
        return true;
    }

    shouldShowExplanation(): boolean {
        return true;
    }

}

type QuizState = 'new-question' | 'correct' | 'wrong';

export type CurrentQuestionData<T> = {
    area: 'in' | 'out',
    currentNodeId: number,
    solution: T,
} | {
    area: 'none',
};

export class QuizDriver<T> implements InteractionDriver {
    state : QuizState = 'new-question';
    private questionData : CurrentQuestionData<T>;
    private readonly comparator : (solution : T, test: T) => boolean;
    private hasRequestedHelp : boolean = false;

    constructor(comparator: (solution : T, test: T) => boolean) {
        this.comparator = comparator;
        this.questionData = {area: 'none'};
    }
    
    allowedToAdvance(): boolean {
        return 'correct' === this.state;
    }

    shouldShowInSetOfNode(nodeId: number): boolean {
       if (this.state === 'correct') return true;
        return this.questionData.area !== 'in' || this.questionData.currentNodeId !== nodeId;
    }
    
    shouldShowOutSetOfNode(nodeId: number): boolean {
        if (this.state === 'correct') return true;
        return this.questionData.area !== 'out' || this.questionData.currentNodeId !== nodeId;
    }
    
    shouldShowLookedAtValuesOfNodes(): boolean {
        return (this.state === 'correct' || this.hasRequestedHelp || this.questionData.area === 'none');
    }
    
    shouldShowExplanation(): boolean {
        return (this.questionData.area === 'none' || this.state === 'correct' || this.hasRequestedHelp );
    }

    requestHelp() {
        this.hasRequestedHelp = true;
    }

    trySolve(test : T) {
        if (this.questionData.area === 'none') return;
        if (this.comparator(this.questionData.solution, test)) this.state = 'correct';
    }

    canSubmitSolution() : boolean {
        return this.state !== 'correct' && this.questionData.area !== 'none';
    }

    requestSolution() {
        this.state = 'correct';
    }

    canRequestSolution(): boolean {
        return this.state === 'new-question' && this.questionData.area !== 'none';
    }

    setNewQuestion(newQuestion : {area: 'in' | 'out', currentNodeId: number, solution: T} | {area: 'none'}) {
        this.state = 'new-question';
        this.questionData = newQuestion;
        this.hasRequestedHelp = false;
    }
}