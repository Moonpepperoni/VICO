import {Handle, type Node, type NodeProps, Position} from '@xyflow/react';
import {Badge, Card} from 'react-bootstrap';
import type {FlowNodeState, FlowValue, FlowValueData} from "./service/data-flow-drive-service.ts";
import {LookAtBadge} from "./LookAtBadge.tsx";
import {ChangedBadge} from "./ChangedBadge.tsx";

type FlowNode = Node<FlowNodeState, 'number'>;

function flowValueToString(value : FlowValueData) : string {
    switch (value.type) {
        case 'string-set':
            return [...value.data].join(", ");
        case "string-map":
            return [...value.data.entries()].map(([k, v]) => `${k}: ${v}`).join(", ");
    }
}

export default function FlowNode({data}: NodeProps<FlowNode>) {
    const {inValue, outValue, kind} = data;
    let perNodeValues: undefined | Map<string, FlowValue> = undefined;
    if (kind === 'node') {
        perNodeValues = data.perNodeValues;
    }
    const inRep = flowValueToString(inValue.value);
    const outRep = flowValueToString(outValue.value);
    const perNodeValuesRep: Array<[string, {
        changed: boolean,
        lookedAt: boolean,
        data: string
    }]> | undefined = perNodeValues && [...perNodeValues.entries()].map(([key, v]) => [key, {
        changed: v.changed,
        lookedAt: v.lookedAt,
        data: [...v.value.data].join(", ")
    }]);

    return (
        <Card data-cy="flow-node" className={"shadow-sm" + (data.isCurrent ? " border-4 border-dark-subtle" : "")}>
            <Handle type="target" position={Position.Top} style={{visibility: 'hidden'}}/>

            <Card.Header data-cy="flow-node-in-set" className={"bg-light"}>
                <small className="text-muted">in: </small>{' '}
                <Badge className="py-1">{inRep || "∅"}</Badge> {' '}
                <LookAtBadge show={inValue.lookedAt} /> {' '}
                <ChangedBadge show={inValue.changed} />{' '}
            </Card.Header>
            {data.kind === 'entry' &&
                <h3 style={{alignSelf: 'center', justifyContent: 'space-around'}}>
                ENTRY
                </h3>}
            {data.kind === 'exit' &&
                <h3 style={{alignSelf: 'center', justifyContent: 'space-around'}}>
                    EXIT
                </h3>}

            {data.kind === 'node' &&
                <Card.Body className="p-2">
                    <div style={{display: 'flex', flexDirection: 'row'}}>
                        <div style={{
                            flex: '7 0 0%',
                            paddingRight: '1rem'
                        }}>
                            <h6 className="border-bottom pb-1 mb-2">{"Instruktion" + (data.instructions.length > 1 ? "en" : "")}</h6>
                            {data.instructions.map((i, index) => (
                                <pre key={index} className="mb-1 code-block">
                                <code>{i.marker !== '' && `${i.marker} | `}{i.instruction}</code>
                            </pre>
                            ))}
                        </div>
                        {perNodeValues && perNodeValues?.size > 0 &&
                            <div
                                data-cy="flow-node-algo-specific-values"
                                style={{
                                flex: '5 0 0%',
                                paddingLeft: '1rem',
                                borderLeft: '1px solid #dee2e6'
                            }}>
                                <h6 className="border-bottom pb-1 mb-2">Knotendaten</h6>
                                {perNodeValuesRep && perNodeValuesRep.map(([key, value], index) => (
                                    <div key={index} className="mb-1">
                                        <small className="text-muted">{key}:</small> {' '}
                                        <Badge bg="secondary" className="py-1">{value.data || "∅"}</Badge> {' '}
                                        <LookAtBadge show={value.lookedAt}/>
                                    </div>
                                ))}
                            </div>}
                    </div>
                </Card.Body>
            }
            <Card.Footer data-cy="flow-node-out-set" className={"bg-light"}>

                <small className="text-muted">out:</small> {' '}
                <Badge className="py-1">{outRep || "∅"}</Badge> {' '}
                <ChangedBadge show={outValue.changed} /> {' '}
                <LookAtBadge show={outValue.lookedAt} /> {' '}
            </Card.Footer>

            <Handle type="source" position={Position.Bottom} style={{visibility: 'hidden'}}/>
        </Card>
    );
}