﻿/// <reference path="tsd.d.ts" />

declare var require: {
    <T>(path: string): T;
    (paths: string[], callback: (...modules: any[]) => void): void;
    ensure: (paths: string[], callback: (require: <T>(path: string) => T) => void) => void;
};

// JQuery

interface JQuery {
    gridster(options: any);
}

// SignalR extensions

interface SignalR {
    repositories: any;
}

interface HubConnection {
    lastError: { name: string, source: string, message: string, stack: any };
}