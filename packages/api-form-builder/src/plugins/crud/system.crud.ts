import Error from "@webiny/error";
import { NotAuthorizedError } from "@webiny/api-security";
import { UpgradePlugin } from "@webiny/api-upgrade/types";
import { getApplicablePlugin } from "@webiny/api-upgrade";
import defaults from "./defaults";
import { FormBuilderContext, System } from "../../types";
import { HandlerArgs } from "../../installation";
import { ContextPlugin } from "@webiny/handler/plugins/ContextPlugin";

export default options => new ContextPlugin<FormBuilderContext>(context => {
    const { tenancy, db, i18n } = context;

    // Either read locale and tenant from passed options, or read it from context.
    let locale = options.locale;
    if (!locale) {
        locale = context.i18nContent.getLocale()?.code;
    }

    let tenant = options.tenant;
    if (!tenant) {
        tenant = context.tenancy.getCurrentTenant()?.id;
    }

    const keys = () => ({ PK: `T#${tenant}#SYSTEM`, SK: "FB" });

    // const keys = () => ({ PK: `T#${tenancy.getCurrentTenant().id}#SYSTEM`, SK: "FB" });

    context.formBuilder = {
        ...context.formBuilder,
        system: {
            // Renamed this to just `get` and `set`, so version and installation status can be both
            // pulled from with as single method, instead of having `getVersion`, `getInstallation`,
            // and so on.
            async get() {
                const [[system]] = await db.read<System>({
                    ...defaults.db,
                    query: keys()
                });

                return system;
            },

            async set(data) {
                const system = this.get();
                if (system) {
                    await db.update({
                        ...defaults.db,
                        query: keys(),
                        data: {
                            ...system.data,
                            ...data
                        }
                    });
                } else {
                    await db.create({
                        ...defaults.db,
                        data: {
                            ...keys(),
                            data
                        }
                    });
                }
            },
            async install({ domain }) {
                const system = await this.get();
                if (system && system.installation) {
                    if (system.installation.status === "pending") {
                        throw new Error(
                            "Form builder installation is already in progress.",
                            "FORM_BUILDER_INSTALL_ABORTED"
                        );
                    }

                    if (system.installation && system.installation.status !== "completed") {
                        throw new Error(
                            "Form builder is already installed.",
                            "FORM_BUILDER_INSTALL_ABORTED"
                        );
                    }
                }

                // Invoke the standalone "installation" handler.
                await context.handlerClient.invoke<HandlerArgs>({
                    await: false,
                    name: process.env.FB_INSTALLATION_HANDLER,
                    payload: {
                        data: {
                            domain,
                            locale: i18n.getDefaultLocale().code,
                            tenant: tenancy.getCurrentTenant().id
                        }
                    }
                });
            },
            async upgrade(version) {
                const identity = context.security.getIdentity();
                if (!identity) {
                    throw new NotAuthorizedError();
                }

                const upgradePlugins = context.plugins
                    .byType<UpgradePlugin>("api-upgrade")
                    .filter(pl => pl.app === "form-builder");

                const plugin = getApplicablePlugin({
                    deployedVersion: context.WEBINY_VERSION,
                    installedAppVersion: await this.getVersion(),
                    upgradePlugins,
                    upgradeToVersion: version
                });

                await plugin.apply(context);

                // Store new app version
                await this.setVersion(version);

                return true;
            }
        }
    };
});
