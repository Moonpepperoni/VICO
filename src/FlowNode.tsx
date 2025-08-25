import {Handle, type Node, type NodeProps, Position} from '@xyflow/react';
import {Badge, Card} from 'react-bootstrap';
import type {FlowNodeState, FlowValue, FlowValueData} from "./service/data-flow-drive-service.ts";

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
        <Card className={"shadow-sm" + (data.isCurrent ? " border-4 border-dark-subtle" : "")}>
            <Handle type="target" position={Position.Top} style={{visibility: 'hidden'}}/>

            <Card.Header className={"bg-light"}>
                <small className="text-muted">in: </small>
                <Badge bg={inValue.changed ? 'info' : "secondary"} className="py-1">{inRep || "∅"}</Badge> {' '}
                <Badge bg="warning" className="py-1" style={{visibility: inValue.lookedAt ? 'visible' : 'hidden'}}>
                    <svg height="20px" width="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="#0D0D0D"/>
                        <path
                            d="M21.894 11.553C19.736 7.236 15.904 5 12 5c-3.903 0-7.736 2.236-9.894 6.553a1 1 0 0 0 0 .894C4.264 16.764 8.096 19 12 19c3.903 0 7.736-2.236 9.894-6.553a1 1 0 0 0 0-.894zM12 17c-2.969 0-6.002-1.62-7.87-5C5.998 8.62 9.03 7 12 7c2.969 0 6.002 1.62 7.87 5-1.868 3.38-4.901 5-7.87 5z"
                            fill="#0D0D0D"/>
                    </svg>
                </Badge>
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
                            <div style={{
                                flex: '5 0 0%',
                                paddingLeft: '1rem',
                                borderLeft: '1px solid #dee2e6'
                            }}>
                                <h6 className="border-bottom pb-1 mb-2">Knotendaten</h6>
                                {perNodeValuesRep && perNodeValuesRep.map(([key, value], index) => (
                                    <div key={index} className="mb-1">
                                        <small className="text-muted">{key}:</small> {' '}
                                        <Badge bg="secondary" className="py-1">{value.data || "∅"}</Badge> {' '}
                                        <Badge bg="warning" className="py-1"
                                               style={{visibility: value.lookedAt ? 'visible' : 'hidden'}}>
                                            <svg height="20px" width="20px" viewBox="0 0 24 24" fill="none"
                                                 xmlns="http://www.w3.org/2000/svg">
                                                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="#0D0D0D"/>
                                                <path
                                                    d="M21.894 11.553C19.736 7.236 15.904 5 12 5c-3.903 0-7.736 2.236-9.894 6.553a1 1 0 0 0 0 .894C4.264 16.764 8.096 19 12 19c3.903 0 7.736-2.236 9.894-6.553a1 1 0 0 0 0-.894zM12 17c-2.969 0-6.002-1.62-7.87-5C5.998 8.62 9.03 7 12 7c2.969 0 6.002 1.62 7.87 5-1.868 3.38-4.901 5-7.87 5z"
                                                    fill="#0D0D0D"/>
                                            </svg>
                                        </Badge>
                                    </div>
                                ))}
                            </div>}
                    </div>
                </Card.Body>
            }
            <Card.Footer className={"bg-light"}>
                <small className="text-muted">out:</small> {' '}
                <Badge bg={outValue.changed ? 'info' : "secondary"} className="py-1">{outRep || "∅"}</Badge> {' '}
                <Badge bg="warning" className="py-1" style={{visibility: outValue.lookedAt ? 'visible' : 'hidden'}}>
                    <svg height="20px" width="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="#0D0D0D"/>
                        <path
                            d="M21.894 11.553C19.736 7.236 15.904 5 12 5c-3.903 0-7.736 2.236-9.894 6.553a1 1 0 0 0 0 .894C4.264 16.764 8.096 19 12 19c3.903 0 7.736-2.236 9.894-6.553a1 1 0 0 0 0-.894zM12 17c-2.969 0-6.002-1.62-7.87-5C5.998 8.62 9.03 7 12 7c2.969 0 6.002 1.62 7.87 5-1.868 3.38-4.901 5-7.87 5z"
                            fill="#0D0D0D"/>
                    </svg>
                </Badge>
            </Card.Footer>

            <Handle type="source" position={Position.Bottom} style={{visibility: 'hidden'}}/>
        </Card>
    );
}