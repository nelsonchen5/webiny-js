import Error from "@webiny/error";
import { DbContext } from "@webiny/handler-db/types";
import { HandlerPlugin } from "@webiny/handler/plugins/HandlerPlugin";
import settings from "../plugins/crud/settings.crud";
import system from "../plugins/crud/system.crud";
import { ArgsContext } from "@webiny/handler-args/types";
import defaults from "../plugins/crud/defaults";
import { TenancyContext } from "@webiny/api-tenancy/types";

export type HandlerArgs = {
    data: {
        domain?: string;
        locale: string;
        tenant: string;
    };
};

interface Context extends TenancyContext, DbContext, ArgsContext<HandlerArgs> {}

const handler = new HandlerPlugin<Context>(async context => {
    const { db, elasticsearch, formBuilder, invocationArgs } = context;


    const installation = await formBuilder.formBuilder.create();
    if (installation.status === "pending") {
        throw new Error(
            "Form builder installation is already in progress.",
            "FORM_BUILDER_INSTALL_ABORTED"
        );
    }

    context.formBuilder.formSubmission

    await formBuilder.system.set({
        installation: { status: "pending" }
    });

    await formBuilder.settings.createSettings(invocationArgs.data);

    try {
        // Create ES index if it doesn't already exist.
        try {
            const esIndex = defaults.es(context);
            const { body: exists } = await elasticsearch.indices.exists(esIndex);
            if (!exists) {
                await elasticsearch.indices.create({
                    ...esIndex,
                    body: {
                        // need this part for sorting to work on text fields
                        settings: {
                            analysis: {
                                analyzer: {
                                    lowercase_analyzer: {
                                        type: "custom",
                                        filter: ["lowercase", "trim"],
                                        tokenizer: "keyword"
                                    }
                                }
                            }
                        },
                        mappings: {
                            properties: {
                                property: {
                                    type: "text",
                                    fields: {
                                        keyword: {
                                            type: "keyword",
                                            ignore_above: 256
                                        }
                                    },
                                    analyzer: "lowercase_analyzer"
                                }
                            }
                        }
                    }
                });
            }

            await formBuilder.system.set({ version: context.WEBINY_VERSION });
        } catch (err) {
            await db.delete({
                ...defaults.db,
                query: {
                    PK: `T#root#L#${invocationArgs.data.locale}#FB#SETTINGS`,
                    SK: "default"
                }
            });

            throw new Error("Form builder failed to install!", "FORM_BUILDER_INSTALL_ABORTED", {
                reason: err.message
            });
        }
    } catch (e) {
        await formBuilder.system.setInstallation({
            status: "error",
            error: {
                data: e.data,
                message: e.message,
                code: e.code
            }
        });
    }
});

export default () => [settings, system, handler];
