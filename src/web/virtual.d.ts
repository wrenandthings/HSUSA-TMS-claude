declare module "virtual:hsusa-api" {
    export function createApi(ipcRenderer: { invoke: (channel: string, input?: unknown) => Promise<any> }): Record<string, any>;
}
