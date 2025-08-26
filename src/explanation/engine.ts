import type {YieldReason} from "../flow/common.ts";

export type ExplanationFunction = (yieldReason: YieldReason) => Explanation;

export function explainConstantPropagation(yieldReason: YieldReason): Explanation {
    switch (yieldReason) {
        case "initialized":
            return [{kind: 'text', content: 'Initial werden alle In- und Out-Mengen auf die leere Menge gesetzt'}];
        case "ended":
            return [{
                kind: 'text',
                content: "Es gab keine weiteren Änderungen an den In- und Out-Mengen."
            }, {kind: 'text', content: "Der Algorithmus ist beendet. "}];
        case "in-computed":
            return [{
                kind: 'text',
                content: 'Berechne die neue In-Menge, durch Anwendung des Meet-Operators auf jede Out-Variable eines jeden Vorgängers mit der aktuellen In-Variable'
            }];
        case "out-computed":
            return [{
                kind: 'text',
                content: 'Berechne mit dem Meet-Operator für jede Instruktion, die eine Variable definiert, basierend auf der In-Menge, den benutzten Variablen und den vorherigen Instruktionen des Blocks, den neuen Zustand.'
            },
                {
                    kind: 'text',
                    content: "Berechne anschließend die neue Out-Menge, durch Ersetzen aller alten Werte auf den Zustand der letzten Definition aus dem Block."
                }];
        default: {
            const _exhaustiveCheck: never = yieldReason;
            throw new Error(`Unknown yield reason: ${_exhaustiveCheck}`);
        }
    }
}

export function explainLiveness(yieldReason: YieldReason): Explanation {
    switch (yieldReason) {
        case "initialized":
            return [{
                kind: 'text',
                content: 'Initial werden alle In- und Out-Mengen auf die leere Menge gesetzt'
            }, {kind: 'text', content: 'Setze die Live-Out-Menge des Exit-Knoten auf die gewünschten Variablen.'}];
        case "ended":
            return [{
                kind: 'text',
                content: "Es gab keine weiteren Änderungen an den In- und Out-Mengen."
            }, {kind: 'text', content: "Der Algorithmus ist beendet. "}];
        case "in-computed":
            return [{kind: 'text', content: 'Berechne die neue In-Menge durch:'}, {
                kind: 'math',
                content: '\\(in(node) := use(node) \\cup (out(node) - def(node))\\)'
            }];
        case "out-computed":
            return [{kind: 'text', content: 'Berechne die neue Out-Menge durch:'}, {
                kind: 'math',
                content: '\\(out(node) := \\bigcup_{s \\in nachfolger(node)}in(s)\\)'
            }];
        default: {
            const _exhaustiveCheck: never = yieldReason;
            throw new Error(`Unknown yield reason: ${_exhaustiveCheck}`);
        }
    }
}

export function explainReachingDefinitions(yieldReason: YieldReason): Explanation {
    switch (yieldReason) {
        case "initialized":
            return [{kind: 'text', content: 'Initial werden alle In- und Out-Mengen auf die leere Menge gesetzt'}];
        case "ended":
            return [{
                kind: 'text',
                content: "Es gab keine weiteren Änderungen an den In- und Out-Mengen."
            }, {kind: 'text', content: "Der Algorithmus ist beendet. "}];
        case "in-computed":
            return [{kind: 'text', content: 'Berechne die neue In-Menge durch:'}, {
                kind: 'math',
                content: '\\(in(node) := \\bigcup_{p \\in vorgaenger(node)}out(p)\\)'
            }];
        case "out-computed":
            return [{kind: 'text', content: 'Berechne die neue Out-Menge durch:'}, {
                kind: 'math',
                content: '\\(out(node) := gen(node) \\cup (in(node) - kill(node))\\)'
            }];
        default: {
            const _exhaustiveCheck: never = yieldReason;
            throw new Error(`Unknown yield reason: ${_exhaustiveCheck}`);
        }

    }
}

export type Explanation = Array<ExplanationLine>;

export type ExplanationLine = {
    kind: 'math',
    content: string,
} | { kind: 'text', content: string };