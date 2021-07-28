import { Plugin } from "@webiny/plugins";

type Callable<TContext> = (context: TContext, next: Function) => any;

export class HandlerPlugin<TContext> extends Plugin {
    public static readonly type = "handler";
    private readonly _callable: Callable<TContext>;

    constructor(callable?: Callable<TContext>) {
        super();
        this._callable = callable;
    }

    handle(handler: TContext, next: Function): void | Promise<void> {
        if (typeof this._callable !== "function") {
            throw Error(
                `Missing callable in HandlerPlugin! Either pass a callable to plugin constructor or extend the plugin and override the "apply" method.`
            );
        }

        return this._callable(handler, next);
    }
}
