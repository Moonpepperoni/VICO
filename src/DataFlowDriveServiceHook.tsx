import { useState, useCallback, useMemo } from 'react';
import { DataFlowDriveService, type FlowAlgorithmSelector, type FlowState } from './service/data-flow-drive-service';


interface DataFlowServiceProps {
    initialProgramText: string;
}

/**
 * Status für den DataFlowDriveService
 */
interface DataFlowServiceState {
    currentAlgorithm: FlowAlgorithmSelector["kind"] | undefined;
    programText: string | undefined;
    currentValue: FlowState | undefined;
    canStepForward: boolean;
    canStepBackward: boolean;
    programErrors: Array<{ line: number; reason: string }>;
    canSelectAlgorithm: boolean;
}

/**
 * Rückgabewerte des useDataFlowService Hooks
 */
interface DataFlowServiceHook {
    // Aktueller Status
    state: DataFlowServiceState;

    // Methoden zum Setzen von Programm und Algorithmus
    setProgramText: (text: string) => void;
    setAlgorithm: (selector: FlowAlgorithmSelector) => void;
    deselectAlgorithm: () => void;

    // Navigationssteuerung
    stepForward: () => void;
    stepBackward: () => void;
    stepToEnd: () => void;
}

/**
 * Hook, der den DataFlowDriveService für React-Komponenten bereitstellt
 */
export function useDataFlowService({initialProgramText} : DataFlowServiceProps): DataFlowServiceHook {
    // Erstelle eine Instanz des Services, die während der Lebensdauer der Komponente bestehen bleibt
    const service = useMemo(() => new DataFlowDriveService(initialProgramText), [initialProgramText]);

    // State für die Benutzeroberfläche
    const [state, setState] = useState<DataFlowServiceState>({
        programText: service.programText,
        currentValue: service.currentStepValue(),
        canStepForward: service.canStepForward(),
        canStepBackward: service.canStepBackward(),
        programErrors: [],
        currentAlgorithm: service.currentAlgorithm,
        canSelectAlgorithm: service.canSelectAlgorithm()
    });

    // Hilfsfunktion, um den aktuellen Zustand zu aktualisieren
    const updateState = useCallback(() => {
        setState({
            programText: service.programText,
            currentValue: service.currentStepValue(),
            canStepForward: service.canStepForward(),
            canStepBackward: service.canStepBackward(),
            currentAlgorithm: service.currentAlgorithm,
            canSelectAlgorithm: service.canSelectAlgorithm(),
            programErrors: state.programErrors, // Fehler bleiben erhalten, bis ein neues Programm gesetzt wird
        });
    }, [service, state.programErrors]);

    // Funktion zum Setzen des Programmtexts
    const setProgramText = useCallback((text: string) => {
        const errors = service.trySetNewProgram(text);
        setState(prevState => ({
            ...prevState,
            programText: text,
            programErrors: errors,
            currentValue: service.currentStepValue(),
            canStepForward: service.canStepForward(),
            canStepBackward: service.canStepBackward(),
            currentAlgorithm: service.currentAlgorithm,
            canSelectAlgorithm: service.canSelectAlgorithm()
        }));
    }, [service]);

    // Funktion zum Setzen des Algorithmus
    const setAlgorithm = useCallback((selector: FlowAlgorithmSelector) => {
        service.trySetAlgorithm(selector);
        updateState();
    }, [service, updateState]);

    // Funktion zum Entfernen des ausgewählten Algorithmus
    const deselectAlgorithm = useCallback(() => {
        service.deselectAlgorithm();
        updateState();
    }, [service, updateState]);

    // Navigationssteuerung
    const stepForward = useCallback(() => {
        service.tryStepForward();
        updateState();
    }, [service, updateState]);

    const stepBackward = useCallback(() => {
        service.tryStepBackward();
        updateState();
    }, [service, updateState]);

    const stepToEnd = useCallback(() => {
        service.stepToEnd();
        updateState();
    }, [service, updateState]);

    // Gibt die Schnittstelle zum Hook zurück
    return {
        state,
        setProgramText,
        setAlgorithm,
        deselectAlgorithm,
        stepForward,
        stepBackward,
        stepToEnd,
    };
}


