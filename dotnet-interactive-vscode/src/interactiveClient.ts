import * as cp from 'child_process';
import { Writable } from 'stream';
import { Event, ReceivedInteractiveEvent } from './interfaces';

export type CommandEventCallback = {(event: Event, eventType: string): void};

export class InteractiveClient {
    private buffer: string = "";
    private callbacks: Map<string, CommandEventCallback[]> = new Map();
    private next: number = 1;
    private stdin: Writable;

    constructor() {
        let childProcess = cp.spawn('dotnet', ['interactive', 'stdio']);
        childProcess.on('exit', (code: number, _signal: string) => {
            //
            let x = 1;
        });
        childProcess.stdout.on('data', (data) => {
            let str: string = data.toString();
            this.buffer += str;

            let i = this.buffer.indexOf('\n');
            while (i >= 0) {
                let temp = this.buffer.substr(0, i + 1);
                this.buffer = this.buffer.substr(i + 1);
                i = this.buffer.indexOf('\n');
                let obj = JSON.parse(temp);
                try {
                    let received = <ReceivedInteractiveEvent>obj;
                    let callbacks = this.callbacks.get(received.cause.token);
                    if (callbacks) {
                        for (let callback of callbacks) {
                            callback(received.event, received.eventType);
                        }
                    }
                } catch {
                }
            }
        });

        this.stdin = childProcess.stdin;
    }

    private registerCallback(token: string, callback: CommandEventCallback) {
        if (!this.callbacks.has(token)) {
            this.callbacks.set(token, []);
        }

        this.callbacks.get(token)?.push(callback);
    }

    async hover(code: string, line: number, character: number, callback: CommandEventCallback) {
        let b = Buffer.from(code);
        let command = {
            documentIdentifier: "data:text/plain;base64," + b.toString('base64'),
            position: {
                line: line,
                character: character,
            }
        };
        this.submitCommand("RequestHoverText", command, callback);
    }

    async submitCode(code: string, callback: CommandEventCallback) {
        let command = {
            code: code,
            submissionType: 0,
            targetKernelName: null
        };
        this.submitCommand("SubmitCode", command, callback);
    }

    private async submitCommand(commandType: string, command: any, callback: CommandEventCallback) {
        let token = "abc" + this.next++;
        let submit = {
            token: token,
            commandType: commandType,
            command: command
        };

        this.registerCallback(token, callback);

        let str = JSON.stringify(submit);
        this.stdin.write(str);
        this.stdin.write('\n');
    }
}
